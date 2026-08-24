/**
 * Where the client's own API keys live.
 *
 * Keys are entered through the bot's own setup page and written here, on the
 * machine running the bot. They are never committed — bot/.gitignore excludes
 * this file — and never sent to the website, which is public.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import * as store from './store.mjs';

export const storageBackend = store.backend;
export const describeStorage = store.describe;

/** Shape of everything the bot can be told about. Empty = not set up yet. */
export const BLANK = {
  admin: { passwordHash: '', salt: '' },

  whatsapp: {
    // From Meta → WhatsApp → API Setup
    phoneNumberId: '',
    accessToken: '',
    // You invent this one; paste the same value into Meta's webhook form.
    verifyToken: '',
    // Only these numbers can command the bot. Digits only, country code first.
    allowedNumbers: [],
  },

  github: {
    // Fine-grained token, Contents: Read and write, this repo only.
    token: '',
    repo: 'cryptofedge/melaos-real-estate',
    branch: 'main',
  },

  ads: {
    meta:   { accessToken: '', adAccountId: '', pageId: '' },
    google: { developerToken: '', customerId: '', refreshToken: '', clientId: '', clientSecret: '' },
    tiktok: { accessToken: '', advertiserId: '' },
  },
};

let cache = null;

export async function load() {
  if (cache) return cache;
  const stored = await store.read();
  // Merge so a config written by an older version still boots.
  cache = deepMerge(structuredClone(BLANK), stored || {});
  return cache;
}

export async function save(next) {
  cache = deepMerge(structuredClone(BLANK), next);
  await store.write(cache);
  return cache;
}

function deepMerge(base, extra) {
  for (const [k, v] of Object.entries(extra || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') {
      deepMerge(base[k], v);
    } else if (v !== undefined) {
      base[k] = v;
    }
  }
  return base;
}

/* ── Admin password for the setup page ─────────────────────────────────── */

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return { salt, passwordHash: scryptSync(password, salt, 64).toString('hex') };
}

export function checkPassword(password, cfg) {
  if (!cfg.admin?.passwordHash) return false;
  const attempt = scryptSync(password, cfg.admin.salt, 64);
  const stored = Buffer.from(cfg.admin.passwordHash, 'hex');
  return attempt.length === stored.length && timingSafeEqual(attempt, stored);
}

/**
 * What is configured, without ever revealing a value. Drives the setup page's
 * status lights and the bot's own "status" reply.
 */
export function readiness(cfg = {}) {
  // Tolerates a half-built config: this runs on the "status" command, and a
  // crash here would leave the client messaging a bot that never answers.
  const set = (v) => Boolean(v && String(v).trim());
  const wa = cfg.whatsapp || {}, gh = cfg.github || {}, ads = cfg.ads || {};
  const meta = ads.meta || {}, google = ads.google || {}, tiktok = ads.tiktok || {};
  return {
    admin:    set((cfg.admin || {}).passwordHash),
    whatsapp: set(wa.phoneNumberId) && set(wa.accessToken) && set(wa.verifyToken),
    allowed:  Array.isArray(wa.allowedNumbers) && wa.allowedNumbers.length > 0,
    github:   set(gh.token) && set(gh.repo),
    meta:     set(meta.accessToken) && set(meta.adAccountId),
    google:   set(google.developerToken) && set(google.customerId) && set(google.refreshToken),
    tiktok:   set(tiktok.accessToken) && set(tiktok.advertiserId),
  };
}

/** Never let a secret leave the process. */
export function redact(cfg = {}) {
  const wa = cfg.whatsapp || {}, gh = cfg.github || {};
  const a = cfg.ads || {}, meta = a.meta || {}, google = a.google || {}, tiktok = a.tiktok || {};
  const mask = (v) => (v && String(v).trim() ? '••••••' + String(v).slice(-4) : '');
  return {
    whatsapp: {
      phoneNumberId: wa.phoneNumberId || '',
      accessToken: mask(wa.accessToken),
      verifyToken: mask(wa.verifyToken),
      allowedNumbers: wa.allowedNumbers || [],
    },
    github: { token: mask(gh.token), repo: gh.repo || '', branch: gh.branch || 'main' },
    ads: {
      meta:   { accessToken: mask(meta.accessToken), adAccountId: meta.adAccountId || '', pageId: meta.pageId || '' },
      google: { developerToken: mask(google.developerToken), customerId: google.customerId || '',
                refreshToken: mask(google.refreshToken), clientId: google.clientId || '',
                clientSecret: mask(google.clientSecret) },
      tiktok: { accessToken: mask(tiktok.accessToken), advertiserId: tiktok.advertiserId || '' },
    },
  };
}
