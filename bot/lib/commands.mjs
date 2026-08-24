/**
 * What the bot understands.
 *
 * Every handler is pure with respect to the network: it talks to an injected
 * `store` rather than to GitHub directly, so the whole command surface can be
 * tested without credentials or a live repo.
 */

const PROPS = 'data/properties.json';
const PROMOS = 'data/promotions.json';

const CITIES = {
  austin: 'Austin', atx: 'austin',
  dfw: 'Dallas–Fort Worth', dallas: 'dfw', fortworth: 'dfw',
  houston: 'Houston', htx: 'houston',
  sanantonio: 'San Antonio', sa: 'sanantonio', satx: 'sanantonio',
};

const money = (n) => '$' + Number(n || 0).toLocaleString('en-US');
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Accepts "1800", "$1,800", "1.8k". */
export function parseMoney(input) {
  const raw = String(input).trim().toLowerCase().replace(/[$,\s]/g, '');
  const k = raw.endsWith('k');
  const n = Number(k ? raw.slice(0, -1) : raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(k ? n * 1000 : n);
}

export function parseCity(input) {
  const key = String(input).trim().toLowerCase().replace(/[^a-z]/g, '');
  if (CITIES[key] && CITIES[key].length <= 12 && /^[a-z]+$/.test(CITIES[key])) return CITIES[key];
  return CITIES[key] ? key : null;
}

const HELP = [
  'What I can do:',
  '',
  'LISTINGS',
  '• *list* — homes online now',
  '• *list rented* — homes currently occupied',
  '• *add* — add a home, I will ask you the details',
  '• *rent 3 1850* — set home 3 to $1,850 a month',
  '• *beds 3 4* — set home 3 to 4 bedrooms',
  '• *rented 3* / *available 3* — change status',
  '• *delete 3* — remove a home',
  '• Send a photo with *photo 3* as the caption to add a picture',
  '',
  'AREAS',
  '• *area add Katy, houston*',
  '',
  'TENANTS',
  '• *tickets* — repairs and complaints waiting',
  '• *done 2* — mark one finished',
  '',
  'ADVERTISING',
  '• *promo* — what is running',
  '• *campaign meta 20 7 Nice 3 bed in Katy* — $20/day for 7 days',
  '• *campaign stop 2* — stop a campaign',
  '',
  'OTHER',
  '• *sale on* / *sale off* — show or hide for-sale homes',
  '• *status* — what is connected',
  '• *cancel* — stop what we were doing',
].join('\n');

/**
 * @param {object} deps
 * @param {object} deps.cfg      resolved config
 * @param {object} deps.store    { update, readJson, writeBinary }
 * @param {object} deps.sessions Map of phone → conversation state
 * @param {object} deps.ads      ad platform adapters
 */
export async function handle({ cfg, store, sessions, ads }, msg) {
  const from = msg.from;
  const session = sessions.get(from) || {};
  const text = (msg.text || '').trim();
  const lower = text.toLowerCase();

  // A photo, with or without a caption naming the home.
  if (msg.mediaId) return attachPhoto({ cfg, store, sessions }, msg, session);

  if (!text) return 'Send *help* to see what I can do.';

  if (lower === 'cancel' || lower === 'stop') {
    sessions.delete(from);
    return 'Cancelled. Nothing was changed.';
  }
  if (lower === 'help' || lower === 'hi' || lower === 'hello' || lower === 'menu') return HELP;

  // Mid-conversation (the guided "add" flow) takes priority over new commands.
  if (session.flow === 'add') return addStep({ cfg, store, sessions }, from, text, session);

  const [verb, ...rest] = lower.split(/\s+/);
  const args = text.split(/\s+/).slice(1);

  switch (verb) {
    case 'status':   return statusReply(cfg, ads);
    case 'tickets':
    case 'reports':  return listTickets(store, cfg, rest[0]);
    case 'done':     return closeTicket(store, cfg, args[0]);
    case 'list':     return listHomes(store, cfg, rest[0]);
    case 'add':      return startAdd(sessions, from);
    case 'rent':     return setField(store, cfg, args[0], 'rent', parseMoney(args.slice(1).join(' ')), money);
    case 'beds':     return setField(store, cfg, args[0], 'beds', Number(args[1]));
    case 'baths':    return setField(store, cfg, args[0], 'baths', Number(args[1]));
    case 'sqft':     return setField(store, cfg, args[0], 'sqft', Number(args[1]));
    case 'title':    return setField(store, cfg, args[0], 'title', args.slice(1).join(' '));
    case 'rented':   return setAvailability(store, cfg, args[0], 'occupied');
    case 'available':return setAvailability(store, cfg, args[0], 'available');
    case 'delete':   return removeHome(store, cfg, args[0]);
    case 'area':     return areaCommand(store, cfg, args);
    case 'sale':     return togglePublish(store, cfg, 'sale', rest[0]);
    case 'build':    return togglePublish(store, cfg, 'build', rest[0]);
    case 'promo':
    case 'promos':
    case 'campaigns':return listCampaigns(store, cfg);
    case 'campaign': return campaignCommand({ cfg, store, ads }, args);
    case 'keys':
    case 'setup':    return 'Open the setup page on the machine running me and sign in with your admin password. That is the only place API keys are entered.';
    default:
      return `I did not understand "${text}".\n\nSend *help* for the list.`;
  }
}

/* ─────────────────────────── Listings ─────────────────────────── */

function describe(h, i) {
  const state = h.availability === 'occupied' ? 'rented' : 'available';
  const price = h.listingType === 'sale' ? money(h.price) : money(h.rent) + '/mo';
  return `${i + 1}. *${h.title}* — ${price}\n   ${h.area || '—'}, ${h.city || '—'} · ${h.beds || '?'} bed · ${state}`;
}

async function listHomes(store, cfg, which) {
  const { data } = await store.readJson(cfg, PROPS);
  const homes = data.homes || [];
  if (!homes.length) return 'No homes yet. Send *add* to put the first one up.';

  const filtered = which === 'rented' || which === 'occupied'
    ? homes.filter((h) => h.availability === 'occupied')
    : which === 'sale'
      ? homes.filter((h) => h.listingType === 'sale')
      : homes.filter((h) => h.availability !== 'occupied');

  const label = which === 'rented' || which === 'occupied' ? 'Currently rented'
    : which === 'sale' ? 'For sale' : 'Available now';

  if (!filtered.length) return `${label}: none.`;

  // Numbers shown are positions in the full list, so "rent 3 1850" is stable.
  return `*${label}*\n\n` + filtered
    .map((h) => describe(h, homes.indexOf(h)))
    .join('\n\n');
}

/** Accepts a 1-based number from `list`, or part of a title. */
function findHome(homes, ref) {
  if (!ref) return -1;
  const n = Number(ref);
  if (Number.isInteger(n) && n >= 1 && n <= homes.length) return n - 1;
  const needle = String(ref).toLowerCase();
  return homes.findIndex((h) => (h.title || '').toLowerCase().includes(needle));
}

async function setField(store, cfg, ref, field, value, fmt) {
  if (value === null || value === undefined || Number.isNaN(value) || value === '') {
    return `That value did not look right. Try something like *${field} 1 ${field === 'rent' ? '1850' : '3'}*.`;
  }
  let name = '';
  const result = await store.update(cfg, PROPS, (data) => {
    const homes = data.homes || [];
    const i = findHome(homes, ref);
    if (i < 0) return false;
    homes[i][field] = value;
    name = homes[i].title;
    return data;
  }, `Set ${field} from WhatsApp`);

  if (!result) return `I could not find that home. Send *list* to see the numbers.`;
  return `Done — *${name}* ${field} is now ${fmt ? fmt(value) : value}.\nThe website updates in about a minute.`;
}

async function setAvailability(store, cfg, ref, availability) {
  let name = '';
  const result = await store.update(cfg, PROPS, (data) => {
    const homes = data.homes || [];
    const i = findHome(homes, ref);
    if (i < 0) return false;
    homes[i].availability = availability;
    name = homes[i].title;
    return data;
  }, `Mark ${availability} from WhatsApp`);

  if (!result) return 'I could not find that home. Send *list* to see the numbers.';
  return availability === 'occupied'
    ? `*${name}* is now marked rented. It moves to the "Currently rented" tab.`
    : `*${name}* is available again and back on the front page.`;
}

async function removeHome(store, cfg, ref) {
  let name = '';
  const result = await store.update(cfg, PROPS, (data) => {
    const homes = data.homes || [];
    const i = findHome(homes, ref);
    if (i < 0) return false;
    name = homes[i].title;
    homes.splice(i, 1);
    return data;
  }, 'Remove a home from WhatsApp');

  if (!result) return 'I could not find that home. Send *list* to see the numbers.';
  return `Removed *${name}*. If that was a mistake, tell me and it can be put back — nothing is ever really lost.`;
}

/* ─────────────────────────── Guided add ─────────────────────────── */

const ADD_STEPS = [
  { key: 'title', ask: 'What do you want to call it? (street address is fine)' },
  { key: 'city',  ask: 'Which city? Reply *austin*, *dfw*, *houston* or *sanantonio*.' },
  { key: 'area',  ask: 'Neighborhood or area? (or send *skip*)' },
  { key: 'rent',  ask: 'How much per month? (e.g. 1850)' },
  { key: 'beds',  ask: 'How many bedrooms?' },
  { key: 'baths', ask: 'How many bathrooms?' },
  { key: 'sqft',  ask: 'Square feet? (or send *skip*)' },
];

function startAdd(sessions, from) {
  sessions.set(from, { flow: 'add', step: 0, draft: {} });
  return `Adding a home. Send *cancel* any time.\n\n${ADD_STEPS[0].ask}`;
}

async function addStep({ cfg, store, sessions }, from, text, session) {
  const step = ADD_STEPS[session.step];
  const value = text.trim();
  const skipped = value.toLowerCase() === 'skip';

  if (step.key === 'city') {
    const city = parseCity(value);
    if (!city) return 'I did not recognise that city. Reply *austin*, *dfw*, *houston* or *sanantonio*.';
    session.draft.city = city;
  } else if (step.key === 'rent') {
    const rent = parseMoney(value);
    if (!rent) return 'How much per month? Just the number, like 1850.';
    session.draft.rent = rent;
  } else if (['beds', 'baths', 'sqft'].includes(step.key)) {
    if (skipped && step.key === 'sqft') session.draft.sqft = 0;
    else {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) return `That should be a number. ${step.ask}`;
      session.draft[step.key] = n;
    }
  } else {
    session.draft[step.key] = skipped ? '' : value;
  }

  session.step++;
  if (session.step < ADD_STEPS.length) {
    sessions.set(from, session);
    return ADD_STEPS[session.step].ask;
  }

  const d = session.draft;
  d.id = slug(d.title) + '-' + Math.random().toString(36).slice(2, 6);
  d.listingType = 'rent';
  d.availability = 'available';
  d.photos = [];
  d.description = '';
  d.availableFrom = '';

  await store.update(cfg, PROPS, (data) => {
    data.homes = data.homes || [];
    data.homes.push(d);
    return data;
  }, `Add ${d.title} from WhatsApp`);

  sessions.set(from, { lastHomeId: d.id });
  const position = '(send *list* to see its number)';

  return [
    `Added *${d.title}*.`,
    `${money(d.rent)}/mo · ${d.beds} bed · ${d.baths} bath${d.sqft ? ` · ${d.sqft} sq ft` : ''}`,
    '',
    'Now send me photos of it — just attach them to your next message and I will put them on the listing.',
    '',
    `It is live on the website in about a minute ${position}.`,
  ].join('\n');
}

/* ─────────────────────────── Photos ─────────────────────────── */

async function attachPhoto({ cfg, store, sessions }, msg, session) {
  const caption = (msg.text || '').trim();
  const ref = /^photo\s+(\S+)/i.exec(caption)?.[1] || null;

  const { data } = await store.readJson(cfg, PROPS);
  const homes = data.homes || [];
  if (!homes.length) return 'There are no homes yet. Send *add* first, then send photos.';

  let index = ref ? findHome(homes, ref) : -1;
  if (index < 0 && session.lastHomeId) index = homes.findIndex((h) => h.id === session.lastHomeId);
  if (index < 0) {
    return 'Which home is that photo for? Send it again with a caption like *photo 3*, or send *list* to see the numbers.';
  }

  const home = homes[index];
  const media = await store.downloadMedia(cfg, msg.mediaId);
  const ext = (media.mime || '').includes('png') ? 'png' : 'jpg';
  const path = `assets/properties/${home.id}/${Date.now()}.${ext}`;

  await store.writeBinary(cfg, path, media.buffer, `Add photo for ${home.title} from WhatsApp`);
  await store.update(cfg, PROPS, (d) => {
    const h = (d.homes || []).find((x) => x.id === home.id);
    if (!h) return false;
    h.photos = h.photos || [];
    h.photos.push(path);
    return d;
  }, `Attach photo to ${home.title}`);

  const count = (home.photos || []).length + 1;
  return `Photo added to *${home.title}* (${count} now). Send more, or *list* to carry on.`;
}

/* ─────────────────────────── Areas ─────────────────────────── */

async function areaCommand(store, cfg, args) {
  if ((args[0] || '').toLowerCase() !== 'add') {
    return 'Try *area add Katy, houston*.';
  }
  const rest = args.slice(1).join(' ');
  const [namePart, cityPart] = rest.split(',').map((s) => (s || '').trim());
  const city = parseCity(cityPart || '');
  if (!namePart || !city) return 'Try *area add Katy, houston* — name, then city.';

  await store.update(cfg, PROPS, (data) => {
    data.neighborhoods = data.neighborhoods || [];
    if (data.neighborhoods.some((a) => a.name.toLowerCase() === namePart.toLowerCase())) return false;
    data.neighborhoods.push({ id: slug(namePart), name: namePart, city, note: '' });
    return data;
  }, `Add area ${namePart} from WhatsApp`);

  return `Added *${namePart}* to where we rent.`;
}

/* ─────────────────────────── Publishing ─────────────────────────── */

async function togglePublish(store, cfg, key, onOff) {
  const on = ['on', 'yes', 'show', 'true'].includes(String(onOff).toLowerCase());
  const off = ['off', 'no', 'hide', 'false'].includes(String(onOff).toLowerCase());
  if (!on && !off) return `Send *${key} on* or *${key} off*.`;

  await store.update(cfg, PROPS, (data) => {
    data.publish = data.publish || {};
    data.publish[key] = on;
    return data;
  }, `Turn ${key} listings ${on ? 'on' : 'off'} from WhatsApp`);

  return on
    ? `${key === 'sale' ? 'For-sale' : 'To-build'} homes will now show on the website.`
    : `${key === 'sale' ? 'For-sale' : 'To-build'} homes are hidden. They are still saved.`;
}

/* ─────────────────────────── Campaigns ─────────────────────────── */

async function listCampaigns(store, cfg) {
  const { data } = await store.readJson(cfg, PROMOS);
  const list = data.campaigns || [];
  if (!list.length) return 'No campaigns yet.\n\nStart one like:\n*campaign meta 20 7 Nice 3 bed in Katy*\n(platform, dollars per day, days, then the message)';
  return '*Campaigns*\n\n' + list.map((c, i) =>
    `${i + 1}. ${c.platform} — ${money(c.dailyBudget)}/day for ${c.days} days\n   "${c.message}"\n   ${c.status}${c.externalId ? ` · ${c.externalId}` : ''}`
  ).join('\n\n');
}

async function campaignCommand({ cfg, store, ads }, args) {
  const sub = (args[0] || '').toLowerCase();

  if (sub === 'stop') {
    let name = '';
    const result = await store.update(cfg, PROMOS, (data) => {
      const list = data.campaigns || [];
      const i = Number(args[1]) - 1;
      if (!list[i]) return false;
      list[i].status = 'stopped';
      name = list[i].platform;
      return data;
    }, 'Stop a campaign from WhatsApp');
    if (!result) return 'I could not find that campaign. Send *promo* to see the numbers.';
    return `Stopped the ${name} campaign.`;
  }

  const platform = sub;
  if (!['meta', 'google', 'tiktok'].includes(platform)) {
    return 'Which platform? *meta*, *google* or *tiktok*.\n\nLike: *campaign meta 20 7 Nice 3 bed in Katy*';
  }
  const dailyBudget = parseMoney(args[1]);
  const days = Number(args[2]);
  const message = args.slice(3).join(' ');

  if (!dailyBudget || !Number.isInteger(days) || days < 1 || !message) {
    return 'I need budget, days and a message.\n\n*campaign meta 20 7 Nice 3 bed in Katy*\n= $20 a day, 7 days.';
  }

  const record = {
    id: 'c-' + Date.now().toString(36),
    platform, dailyBudget, days, message,
    created: new Date().toISOString(),
    status: 'draft',
    externalId: '',
  };

  // Try to launch for real. Without credentials this reports what is missing
  // rather than pretending the campaign is running.
  let launched = null, problem = '';
  try {
    launched = await ads.launch(cfg, record);
  } catch (err) {
    problem = err.message;
  }

  if (launched) {
    record.status = 'live';
    record.externalId = launched.id;
  }

  await store.update(cfg, PROMOS, (data) => {
    data.campaigns = data.campaigns || [];
    data.campaigns.push(record);
    return data;
  }, `Create a ${platform} campaign from WhatsApp`);

  const spend = money(dailyBudget * days);
  if (launched) {
    return `${platform} campaign is live.\n${money(dailyBudget)}/day for ${days} days — up to ${spend} total.\nReference ${launched.id}\n\nSend *campaign stop* with its number to end it early.`;
  }
  return [
    `Saved the ${platform} campaign as a draft — ${money(dailyBudget)}/day for ${days} days (${spend} max).`,
    '',
    `I could not start it: ${problem}`,
    '',
    'Add the keys on the setup page and I will be able to launch it for you.',
  ].join('\n');
}

/* ─────────────────────── Tenant reports ─────────────────────── */

const TICKETS = 'data/tickets.json';

async function listTickets(store, cfg, which) {
  const { data } = await store.readJson(cfg, TICKETS);
  const all = data.tickets || [];
  const list = which === 'all' ? all : all.filter((t) => t.status !== 'closed');

  if (!list.length) return which === 'all' ? 'No reports at all yet.' : 'Nothing outstanding. All quiet.';

  const rank = (t) => (t.urgency === 'urgent' ? 0 : t.urgency === 'priority' ? 1 : 2);
  const sorted = list.slice().sort((a, b) => rank(a) - rank(b) ||
    String(b.created || '').localeCompare(String(a.created || '')));

  return `*Tenant reports* (${list.length})

` + sorted.map((t) => {
    const n = all.indexOf(t) + 1;
    const mark = t.urgency === 'urgent' ? '🚨 ' : '';
    return `${n}. ${mark}*${t.tenant}* — ${t.unit || '—'}
` +
      `   ${t.kind} · ${t.category || '—'} · ${t.status}
` +
      `   ${String(t.detail || '').slice(0, 120)}`;
  }).join('\n\n') + '\n\nSend *done 2* to close one.';
}

async function closeTicket(store, cfg, ref) {
  let who = '';
  const result = await store.update(cfg, TICKETS, (data) => {
    const list = data.tickets || [];
    const i = Number(ref) - 1;
    if (!list[i]) return false;
    list[i].status = 'closed';
    list[i].closed = new Date().toISOString();
    who = list[i].tenant;
    return data;
  }, 'Close a tenant report from WhatsApp');

  if (!result) return 'I could not find that report. Send *tickets* to see the numbers.';
  return `Closed the report from *${who}*.`;
}

/* ─────────────────────────── Status ─────────────────────────── */

function statusReply(cfg, ads) {
  const tick = (ok) => (ok ? '✅' : '❌');
  const r = ads.readiness(cfg);
  return [
    '*What is connected*',
    '',
    `${tick(r.whatsapp)} WhatsApp`,
    `${tick(r.github)} Website (GitHub)`,
    `${tick(r.meta)} Meta ads`,
    `${tick(r.google)} Google ads`,
    `${tick(r.tiktok)} TikTok ads`,
    '',
    'Anything with ❌ needs its keys adding on the setup page.',
  ].join('\n');
}

export const _internals = { findHome, describe, ADD_STEPS, HELP };
