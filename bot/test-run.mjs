// Exercises the command surface plus the tenant-ticket endpoint, with a fake
// store. No credentials, no network to GitHub or Meta.
import { handle } from './lib/commands.mjs';
import * as ads from './lib/ads.mjs';

const files = {
  'data/properties.json': { publish: { rent: true, sale: false }, neighborhoods: [], homes: [] },
  'data/promotions.json': { profiles: {}, campaigns: [] },
  'data/tickets.json': { tickets: [] },
};
const store = {
  async readJson(_c, p) { return { data: structuredClone(files[p]), sha: 'x' }; },
  async update(_c, p, mutate) {
    const next = mutate(structuredClone(files[p]));
    if (next === false) return null;
    files[p] = next;
    return next;
  },
  async writeBinary(_c, p) { return p; },
  async downloadMedia() { return { buffer: Buffer.from('x'), mime: 'image/jpeg' }; },
};
const cfg = {
  whatsapp: { allowedNumbers: ['14326069495'] },
  github: { repo: 'r', branch: 'main' },
  ads: { meta: {}, google: {}, tiktok: {} },
};
const sessions = new Map();
const from = '14326069495';

let failed = 0;
const send = (text, mediaId) =>
  handle({ cfg, store, sessions, ads }, { from, id: Math.random() + '', text, mediaId });

function check(label, actual, want) {
  const ok = want instanceof RegExp ? want.test(actual) : String(actual).includes(want);
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label);
  if (!ok) { failed++; console.log('        got: ' + String(actual).replace(/\n/g, ' | ').slice(0, 160)); }
}

/* ── listings still work after the rental changes ── */
check('help mentions tenant reports', await send('help'), /tickets/);
await send('add');
await send('Casa Roble 14');
await send('houston');
await send('Katy');
await send('1850');
await send('3');
await send('2');
check('adds a rental', await send('1642'), /Added \*Casa Roble 14\*/);
check('lists it', await send('list'), /Casa Roble 14/);

/* ── tenant reports ── */
check('nothing outstanding at first', await send('tickets'), /All quiet/);

files['data/tickets.json'].tickets.push(
  { id: 't1', tenant: 'María G.', unit: 'Casa Roble 14', contact: '555-0100',
    kind: 'maintenance', category: 'Plumbing', urgency: 'urgent', status: 'open',
    detail: 'Fuga de agua debajo del fregadero.', created: new Date().toISOString() },
  { id: 't2', tenant: 'Luis R.', unit: 'Otra casa', contact: 'luis@example.com',
    kind: 'complaint', category: 'Missed appointment', urgency: 'routine', status: 'open',
    detail: 'No llegó el técnico.', created: new Date(Date.now() - 8.64e7).toISOString() },
);

const listed = await send('tickets');
check('lists tenant reports', listed, 'Tenant reports* (2)');
check('urgent is flagged', listed, /\u{1F6A8}/u);
check('urgent sorts first', listed.indexOf('María') < listed.indexOf('Luis'), 'true');
check('shows what was reported', listed, /Fuga de agua/);

check('closes one', await send('done 1'), /Closed the report from \*María G\.\*/);
check('status changed', files['data/tickets.json'].tickets[0].status, 'closed');
check('closed drops off the list', await send('tickets'), 'Tenant reports* (1)');
check('all still shows it', await send('tickets all'), 'Tenant reports* (2)');
check('unknown number is refused', await send('done 99'), /could not find/i);

console.log('\n' + (failed ? failed + ' FAILED' : 'all bot checks passed'));
process.exit(failed ? 1 : 0);
