/**
 * Where the config actually persists.
 *
 * On a laptop a file is fine. On a free cloud host it is not: the disk is wiped
 * on every restart and redeploy, so keys entered on the setup page would vanish
 * and the bot would go quiet. Two backends, picked automatically:
 *
 *   disk  — a JSON file. Default, used locally and on hosts with a volume.
 *   gist  — encrypted and kept in a *private* GitHub gist. Survives restarts on
 *           hosts with no persistent storage.
 *
 * The gist backend needs two environment variables, set once in the host's
 * dashboard. Everything else is still entered by the client on the setup page.
 *
 *   CONFIG_SECRET           any long random string; encrypts the blob
 *   BOOTSTRAP_GITHUB_TOKEN  a token with the "gist" scope, nothing else
 *   CONFIG_GIST_ID          optional; created on first save and logged
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = process.env.CONFIG_FILE || join(HERE, '..', 'data', 'config.json');
const GIST_FILE = 'melaos-bot-config.enc';

const secret = process.env.CONFIG_SECRET || '';
const bootstrapToken = process.env.BOOTSTRAP_GITHUB_TOKEN || '';
let gistId = process.env.CONFIG_GIST_ID || '';

export const backend = secret && bootstrapToken ? 'gist' : 'disk';

/* ── Encryption ────────────────────────────────────────────────────────── */
// The blob lands in a private gist. Private is not secret — anyone who gets the
// URL can read it — so it is encrypted before it leaves the process.
const keyFrom = (salt) => scryptSync(secret, salt, 32);

function encrypt(plaintext) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(salt), iv);
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [salt.toString('base64'), iv.toString('base64'),
          cipher.getAuthTag().toString('base64'), body.toString('base64')].join('.');
}

function decrypt(packed) {
  const [salt, iv, tag, body] = String(packed).trim().split('.');
  if (!salt || !iv || !tag || !body) throw new Error('Stored config is not readable');
  const decipher = createDecipheriv('aes-256-gcm', keyFrom(Buffer.from(salt, 'base64')),
    Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString('utf8');
}

/* ── GitHub gist ───────────────────────────────────────────────────────── */
async function gistApi(path, options = {}) {
  const res = await fetch('https://api.github.com' + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${bootstrapToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const j = await res.json(); if (j.message) detail = j.message; } catch {}
    throw new Error(`Config storage: ${detail}`);
  }
  return res.json();
}

async function findGist() {
  if (gistId) return gistId;
  const list = await gistApi('/gists?per_page=100');
  const found = list.find((g) => g.files && g.files[GIST_FILE]);
  if (found) gistId = found.id;
  return gistId;
}

async function readGist() {
  const id = await findGist();
  if (!id) return null;
  const gist = await gistApi(`/gists/${id}`);
  const file = gist.files[GIST_FILE];
  if (!file) return null;
  // Large gists come back truncated with a raw_url to fetch instead.
  const packed = file.truncated
    ? await (await fetch(file.raw_url)).text()
    : file.content;
  return JSON.parse(decrypt(packed));
}

async function writeGist(cfg) {
  const files = { [GIST_FILE]: { content: encrypt(JSON.stringify(cfg)) } };
  const id = await findGist();
  if (id) {
    await gistApi(`/gists/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files }),
    });
    return id;
  }
  const created = await gistApi('/gists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: "Melao's bot config (encrypted)", public: false, files }),
  });
  gistId = created.id;
  console.log(`[bot] created the config store. Set CONFIG_GIST_ID=${gistId} to skip the lookup.`);
  return gistId;
}

/* ── Disk ──────────────────────────────────────────────────────────────── */
async function readDisk() {
  try { return JSON.parse(await readFile(FILE, 'utf8')); }
  catch { return null; }
}
async function writeDisk(cfg) {
  await mkdir(dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
}

/* ── Public ────────────────────────────────────────────────────────────── */
export async function read() {
  try {
    return backend === 'gist' ? await readGist() : await readDisk();
  } catch (err) {
    console.error('[bot] could not read config:', err.message);
    return null;
  }
}

export async function write(cfg) {
  if (backend === 'gist') return writeGist(cfg);
  return writeDisk(cfg);
}

export function describe() {
  return backend === 'gist'
    ? 'encrypted GitHub gist (survives restarts)'
    : `file at ${FILE} (lost if the host wipes its disk)`;
}
