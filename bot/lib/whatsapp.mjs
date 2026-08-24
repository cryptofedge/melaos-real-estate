/**
 * WhatsApp Cloud API: sending replies and pulling down photos the client sends.
 */
const GRAPH = 'https://graph.facebook.com/v21.0';

export async function sendText(cfg, to, body) {
  // WhatsApp rejects messages over 4096 characters.
  const text = body.length > 4000 ? body.slice(0, 3990) + '\n…' : body;
  const res = await fetch(`${GRAPH}/${cfg.whatsapp.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.whatsapp.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text, preview_url: true },
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`WhatsApp send failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  return res.json();
}

/** Two-step: ask the Graph API where the media is, then fetch the bytes. */
export async function downloadMedia(cfg, mediaId) {
  const meta = await fetch(`${GRAPH}/${mediaId}`, {
    headers: { Authorization: `Bearer ${cfg.whatsapp.accessToken}` },
  });
  if (!meta.ok) throw new Error(`Could not find that photo (${meta.status})`);
  const { url, mime_type: mime } = await meta.json();

  const bin = await fetch(url, {
    headers: { Authorization: `Bearer ${cfg.whatsapp.accessToken}` },
  });
  if (!bin.ok) throw new Error(`Could not download that photo (${bin.status})`);

  return { buffer: Buffer.from(await bin.arrayBuffer()), mime: mime || 'image/jpeg' };
}

/** Pulls the interesting bits out of Meta's deeply nested webhook payload. */
export function parseWebhook(payload) {
  const out = [];
  for (const entry of payload?.entry || []) {
    for (const change of entry.changes || []) {
      for (const msg of change.value?.messages || []) {
        out.push({
          from: msg.from,
          id: msg.id,
          type: msg.type,
          text: msg.text?.body || msg.image?.caption || msg.document?.caption || '',
          mediaId: msg.image?.id || msg.document?.id || null,
          mime: msg.image?.mime_type || msg.document?.mime_type || null,
        });
      }
    }
  }
  return out;
}

export function isAllowed(cfg, from) {
  const list = cfg.whatsapp.allowedNumbers || [];
  if (!list.length) return false;               // locked until someone is listed
  const digits = String(from).replace(/\D/g, '');
  return list.some((n) => String(n).replace(/\D/g, '') === digits);
}
