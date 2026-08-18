/**
 * Post-deploy health check for the published site.
 *
 * Catches the failure modes that only show up in production: Pages serving a
 * stale build, an asset that never got committed, or Open Graph tags pointing
 * somewhere that 404s so link previews silently break.
 *
 *   node scripts/check-live.mjs [url]
 */
const BASE = (process.argv[2] || 'https://cryptofedge.github.io/melaos-real-estate/')
  .replace(/\/?$/, '/');

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const get = async (url, opts = {}) => {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'WhatsApp/2.23.20.0 A' },
    ...opts,
  });
  return res;
};

console.log(`Checking ${BASE}\n`);

// ── the page itself ───────────────────────────────────────────────────────────
let html = '';
try {
  const res = await get(BASE);
  check('homepage responds 200', res.status === 200, `HTTP ${res.status}`);
  html = await res.text();
} catch (err) {
  check('homepage responds 200', false, String(err));
}

check('page is not an error stub', html.length > 20_000, `${html.length} bytes`);
check('inventory is present', /40 homes you can walk through/.test(html));
check('all three tab panels shipped',
  ['panel-single', 'panel-two', 'panel-custom'].every(id => html.includes(id)));

// ── link previews ─────────────────────────────────────────────────────────────
const meta = (prop) => {
  const re = new RegExp(`<meta\\s+(?:property|name)="${prop}"\\s+content="([^"]*)"`, 'i');
  return (html.match(re) || [])[1] || '';
};

for (const prop of ['og:title', 'og:description', 'og:url', 'og:image']) {
  check(`${prop} is set`, meta(prop).length > 0, meta(prop).slice(0, 70));
}
for (const prop of ['og:url', 'og:image']) {
  check(`${prop} is absolute`, /^https:\/\//.test(meta(prop)),
    meta(prop) || '(empty)');
}
check('twitter:card is summary_large_image',
  meta('twitter:card') === 'summary_large_image', meta('twitter:card'));

// ── assets the page and the scrapers depend on ───────────────────────────────
const assets = [
  meta('og:image'),
  `${BASE}assets/logo.svg`,
  `${BASE}assets/logo.png`,
  `${BASE}assets/favicon.png`,
  `${BASE}assets/favicon.ico`,
].filter(Boolean);

for (const url of assets) {
  try {
    const res = await get(url);
    const type = res.headers.get('content-type') || '';
    const size = Number(res.headers.get('content-length') || 0);
    check(`asset ${url.replace(BASE, '')}`, res.status === 200 && /image/.test(type),
      `HTTP ${res.status}  ${type}  ${size || '?'} bytes`);
    // Messengers skip images past a few hundred KB.
    if (url === meta('og:image')) {
      check('share card is small enough for messengers', size > 0 && size < 400_000,
        `${Math.round(size / 1024)} KB`);
    }
  } catch (err) {
    check(`asset ${url.replace(BASE, '')}`, false, String(err));
  }
}

// ── third-party dependencies the page cannot render without ──────────────────
for (const [name, url] of [
  ['Tailwind Play CDN', 'https://cdn.tailwindcss.com'],
  ['Google Fonts stylesheet',
   'https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap'],
]) {
  try {
    const res = await get(url);
    check(`dependency reachable: ${name}`, res.status === 200, `HTTP ${res.status}`);
  } catch (err) {
    check(`dependency reachable: ${name}`, false, String(err));
  }
}

// ── verdict ───────────────────────────────────────────────────────────────────
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('\nFailing checks:');
  for (const f of failed) console.log(`  - ${f.name}${f.detail ? `: ${f.detail}` : ''}`);
  process.exit(1);
}
console.log('Site is healthy.');
