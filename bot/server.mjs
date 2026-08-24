/**
 * Melao's WhatsApp control bot.
 *
 *   node server.mjs
 *
 * Three jobs:
 *   1. Serve a password-protected setup page where the client enters his own
 *      API keys. Nothing is hardcoded and no key is ever committed.
 *   2. Receive WhatsApp webhooks from Meta and act on the messages.
 *   3. Commit the results to the website's repository, which redeploys itself.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';

import { load, save, hashPassword, checkPassword, readiness, redact,
         storageBackend, describeStorage } from './lib/config.mjs';
import { parseWebhook, isAllowed, sendText, downloadMedia } from './lib/whatsapp.mjs';
import { readJson, update, writeBinary } from './lib/github.mjs';
import { handle } from './lib/commands.mjs';
import * as ads from './lib/ads.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);

const sessions = new Map();               // phone → conversation state
const store = { readJson, update, writeBinary, downloadMedia };
const adminSessions = new Map();          // cookie → expiry
const seenMessages = new Set();           // Meta retries webhooks; ignore repeats

const json = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};
const text = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(body);
};

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

/* ── Admin session cookie ──────────────────────────────────────────────── */
function issueSession(res) {
  const id = randomBytes(24).toString('hex');
  adminSessions.set(id, Date.now() + 8 * 60 * 60 * 1000);
  res.setHeader('Set-Cookie',
    `melao_admin=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${8 * 60 * 60}`);
}
function hasSession(req) {
  const raw = /melao_admin=([a-f0-9]+)/.exec(req.headers.cookie || '')?.[1];
  if (!raw) return false;
  const expiry = adminSessions.get(raw);
  if (!expiry || expiry < Date.now()) { adminSessions.delete(raw); return false; }
  return true;
}

/* ── WhatsApp message handling ─────────────────────────────────────────── */
async function onMessage(cfg, msg) {
  if (seenMessages.has(msg.id)) return;
  seenMessages.add(msg.id);
  if (seenMessages.size > 500) seenMessages.clear();

  if (!isAllowed(cfg, msg.from)) {
    console.log(`[bot] ignored message from ${msg.from} (not on the allow list)`);
    return;
  }

  let reply;
  try {
    reply = await handle({ cfg, store, sessions, ads }, msg);
  } catch (err) {
    console.error('[bot] command failed:', err);
    reply = `Something went wrong: ${err.message}`;
  }
  if (reply) {
    try { await sendText(cfg, msg.from, reply); }
    catch (err) { console.error('[bot] could not reply:', err.message); }
  }
}

/* ── Routes ────────────────────────────────────────────────────────────── */
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const cfg = await load();

  try {
    // Meta's webhook verification handshake.
    if (req.method === 'GET' && url.pathname === '/webhook') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      const expected = cfg.whatsapp.verifyToken;
      const ok = mode === 'subscribe' && expected && token &&
        token.length === expected.length &&
        timingSafeEqual(Buffer.from(token), Buffer.from(expected));
      return ok ? text(res, 200, challenge || '') : text(res, 403, 'Verification failed');
    }

    // Incoming messages. Answer Meta immediately, then do the work.
    if (req.method === 'POST' && url.pathname === '/webhook') {
      const body = await readBody(req);
      res.writeHead(200).end('EVENT_RECEIVED');
      let payload;
      try { payload = JSON.parse(body); } catch { return; }
      for (const msg of parseWebhook(payload)) onMessage(cfg, msg);
      return;
    }

    if (url.pathname === '/health') {
      return json(res, 200, { ok: true, ready: readiness(cfg) });
    }

    /* ── Setup page ─────────────────────────────────────────────────── */
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/setup')) {
      const html = await readFile(join(HERE, 'public', 'setup.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    if (req.method === 'GET' && url.pathname === '/api/state') {
      return json(res, 200, {
        firstRun: !cfg.admin.passwordHash,
        signedIn: hasSession(req),
        ready: readiness(cfg),
        config: hasSession(req) ? redact(cfg) : null,
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/password') {
      const { password } = JSON.parse(await readBody(req) || '{}');
      if (!password || password.length < 8) {
        return json(res, 400, { error: 'Choose a password of at least 8 characters.' });
      }
      if (cfg.admin.passwordHash) return json(res, 409, { error: 'A password is already set.' });
      await save({ ...cfg, admin: hashPassword(password) });
      issueSession(res);
      return json(res, 200, { ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/api/login') {
      const { password } = JSON.parse(await readBody(req) || '{}');
      if (!checkPassword(password || '', cfg)) {
        // Slow brute force down without blocking the loop for long.
        await new Promise((r) => setTimeout(r, 400));
        return json(res, 401, { error: 'Wrong password.' });
      }
      issueSession(res);
      return json(res, 200, { ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/api/config') {
      if (!hasSession(req)) return json(res, 401, { error: 'Sign in first.' });
      const incoming = JSON.parse(await readBody(req) || '{}');

      // A masked value means "leave this one alone".
      const keep = (next, current) => (!next || next.startsWith('••••') ? current : next);
      const merged = structuredClone(cfg);
      const w = incoming.whatsapp || {};
      merged.whatsapp.phoneNumberId = w.phoneNumberId ?? merged.whatsapp.phoneNumberId;
      merged.whatsapp.accessToken = keep(w.accessToken, merged.whatsapp.accessToken);
      merged.whatsapp.verifyToken = keep(w.verifyToken, merged.whatsapp.verifyToken);
      if (Array.isArray(w.allowedNumbers)) {
        merged.whatsapp.allowedNumbers = w.allowedNumbers
          .map((n) => String(n).replace(/\D/g, '')).filter(Boolean);
      }
      const g = incoming.github || {};
      merged.github.token = keep(g.token, merged.github.token);
      merged.github.repo = g.repo || merged.github.repo;
      merged.github.branch = g.branch || merged.github.branch;

      for (const p of ['meta', 'google', 'tiktok']) {
        const src = incoming.ads?.[p] || {};
        for (const [k, v] of Object.entries(src)) {
          merged.ads[p][k] = /token|secret/i.test(k) ? keep(v, merged.ads[p][k]) : v;
        }
      }

      await save(merged);
      return json(res, 200, { ok: true, ready: readiness(merged) });
    }

    /* ── Tenant portal posts maintenance requests and complaints here ──── */
    if (req.method === 'POST' && url.pathname === '/api/ticket') {
      // Public by necessity: tenants are not signed in. Kept safe by accepting
      // only a fixed shape, capping the size, and never echoing anything back.
      res.setHeader('Access-Control-Allow-Origin', '*');
      const body = await readBody(req);
      if (body.length > 8000) return json(res, 413, { error: 'Too long' });

      let form;
      try { form = JSON.parse(body || '{}'); } catch { return json(res, 400, { error: 'Bad request' }); }

      const clean = (v, max) => String(v == null ? '' : v).slice(0, max).trim();
      const ticket = {
        id: 't-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        reference: clean(form.reference, 24),
        tenant: clean(form.name, 80),
        unit: clean(form.unit, 120),
        contact: clean(form.email || form.phone, 120),
        kind: ['maintenance', 'complaint', 'question'].includes(form.kind) ? form.kind : 'maintenance',
        category: clean(form.category, 80),
        urgency: ['routine', 'priority', 'urgent'].includes(form.urgency) ? form.urgency : 'routine',
        status: 'open',
        detail: clean(form.detail, 4000),
        notes: '',
        created: new Date().toISOString(),
      };

      if (!ticket.tenant || !ticket.detail) {
        return json(res, 400, { error: 'Name and description are required' });
      }

      try {
        await update(cfg, 'data/tickets.json', (d) => {
          d.tickets = d.tickets || [];
          d.tickets.push(ticket);
          return d;
        }, `Tenant ${ticket.kind} from the portal`);
      } catch (err) {
        console.error('[bot] could not save ticket:', err.message);
        return json(res, 502, { error: 'Could not save that. Please call us.' });
      }

      // Tell the owner straight away — an urgent repair should not wait for
      // someone to happen to open the admin page.
      const owner = (cfg.whatsapp.allowedNumbers || [])[0];
      if (owner && cfg.whatsapp.accessToken) {
        const flag = ticket.urgency === 'urgent' ? '\u{1F6A8} URGENTE\n\n' : '';
        sendText(cfg, owner,
          `${flag}Nuevo reporte de inquilino

` +
          `${ticket.tenant} — ${ticket.unit}
` +
          `${ticket.kind} · ${ticket.category}

` +
          `${ticket.detail}

` +
          `Contacto: ${ticket.contact || '—'}`
        ).catch((e) => console.error('[bot] could not notify owner:', e.message));
      }

      return json(res, 200, { ok: true, reference: ticket.reference || ticket.id });
    }

    if (req.method === 'OPTIONS' && url.pathname === '/api/ticket') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      return res.end();
    }

    // Sends a test message so the client can confirm WhatsApp works.
    if (req.method === 'POST' && url.pathname === '/api/test-whatsapp') {
      if (!hasSession(req)) return json(res, 401, { error: 'Sign in first.' });
      const to = (cfg.whatsapp.allowedNumbers || [])[0];
      if (!to) return json(res, 400, { error: 'Add your WhatsApp number to the allow list first.' });
      try {
        await sendText(cfg, to, 'This is Melao\'s bot. If you can read this, WhatsApp is connected. Send *help* to begin.');
        return json(res, 200, { ok: true, to });
      } catch (err) {
        return json(res, 502, { error: err.message });
      }
    }

    return text(res, 404, 'Not found');
  } catch (err) {
    console.error('[bot] request failed:', err);
    return json(res, 500, { error: err.message });
  }
});

// Bind to every interface: a container gets traffic from outside itself.
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\nMelao's bot listening on port ${PORT}`);
  console.log(`Setup page:   /setup`);
  console.log(`Webhook URL:  <your public address>/webhook`);
  console.log(`Config store: ${describeStorage()}`);

  // A cloud host with no volume silently loses the client's keys on restart.
  // Say so loudly at boot rather than letting the bot go quiet days later.
  if (storageBackend === 'disk' && (process.env.RENDER || process.env.DYNO || process.env.K_SERVICE)) {
    console.warn('[bot] WARNING: cloud host using disk storage — keys will be lost on restart.');
    console.warn('[bot] Set CONFIG_SECRET and BOOTSTRAP_GITHUB_TOKEN to keep them.');
  }
  console.log('');
});
