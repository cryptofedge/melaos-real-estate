/**
 * Ad platform adapters.
 *
 * Each one makes the real API call. None of them can work until the client has
 * put his own credentials in on the setup page — and when they are missing, the
 * error says exactly which ones, rather than failing vaguely.
 */
import { readiness as configReadiness } from './config.mjs';

export const readiness = configReadiness;

const missing = (platform, fields) =>
  new Error(`${platform} is not connected yet — missing ${fields.join(', ')}. Add it on the setup page.`);

/* ── Meta (Facebook + Instagram) ───────────────────────────────────────── */
async function launchMeta(cfg, c) {
  const { accessToken, adAccountId } = cfg.ads.meta;
  const gaps = [];
  if (!accessToken) gaps.push('access token');
  if (!adAccountId) gaps.push('ad account ID');
  if (gaps.length) throw missing('Meta', gaps);

  const account = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
  const res = await fetch(`https://graph.facebook.com/v21.0/${account}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Melao's — ${c.message.slice(0, 40)}`,
      objective: 'OUTCOME_TRAFFIC',
      status: 'PAUSED',                 // never spend money without a human look
      special_ad_categories: ['HOUSING'], // required by Meta for property ads
      daily_budget: Math.round(c.dailyBudget * 100),
      access_token: accessToken,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.error_user_msg || json.error?.message || `Meta said ${res.status}`);
  return { id: json.id, note: 'created paused' };
}

/* ── Google Ads ────────────────────────────────────────────────────────── */
async function launchGoogle(cfg, c) {
  const g = cfg.ads.google;
  const gaps = [];
  if (!g.developerToken) gaps.push('developer token');
  if (!g.customerId) gaps.push('customer ID');
  if (!g.refreshToken) gaps.push('refresh token');
  if (!g.clientId || !g.clientSecret) gaps.push('OAuth client');
  if (gaps.length) throw missing('Google Ads', gaps);

  // Google Ads needs a short-lived access token minted from the refresh token.
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: g.clientId, client_secret: g.clientSecret,
      refresh_token: g.refreshToken, grant_type: 'refresh_token',
    }),
  });
  const token = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(token.error_description || 'Google refused the refresh token');

  const customer = String(g.customerId).replace(/\D/g, '');
  const budgetRes = await fetch(
    `https://googleads.googleapis.com/v18/customers/${customer}/campaignBudgets:mutate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        'developer-token': g.developerToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operations: [{ create: {
          name: `Melao's budget ${Date.now()}`,
          amountMicros: String(Math.round(c.dailyBudget * 1_000_000)),
          deliveryMethod: 'STANDARD',
        } }],
      }),
    });
  const budget = await budgetRes.json();
  if (!budgetRes.ok) throw new Error(budget.error?.message || `Google Ads said ${budgetRes.status}`);

  return { id: budget.results?.[0]?.resourceName || 'google-budget-created', note: 'budget created' };
}

/* ── TikTok ────────────────────────────────────────────────────────────── */
async function launchTikTok(cfg, c) {
  const t = cfg.ads.tiktok;
  const gaps = [];
  if (!t.accessToken) gaps.push('access token');
  if (!t.advertiserId) gaps.push('advertiser ID');
  if (gaps.length) throw missing('TikTok', gaps);

  const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/campaign/create/', {
    method: 'POST',
    headers: { 'Access-Token': t.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      advertiser_id: t.advertiserId,
      campaign_name: `Melao's — ${c.message.slice(0, 40)}`,
      objective_type: 'TRAFFIC',
      budget_mode: 'BUDGET_MODE_DAY',
      budget: c.dailyBudget,
      operation_status: 'DISABLE',      // created paused
    }),
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message || `TikTok said ${json.code}`);
  return { id: json.data?.campaign_id, note: 'created paused' };
}

export async function launch(cfg, campaign) {
  switch (campaign.platform) {
    case 'meta':   return launchMeta(cfg, campaign);
    case 'google': return launchGoogle(cfg, campaign);
    case 'tiktok': return launchTikTok(cfg, campaign);
    default: throw new Error(`I do not know how to advertise on ${campaign.platform}`);
  }
}
