// WCAG 2.1 AA contrast for text.
//
// The brand gold (#C5A059) is only ~2.4:1 on white — it reads as decoration but
// fails as text. Every gold text use was moved to #826A3B (same hue, 4.5:1+),
// while borders, fills and dark-surface gold stayed on the brand value. This
// test stops that sliding back.
import { test, expect } from '@playwright/test';

/** Runs in the page: returns every visible text node below its required ratio. */
const findFailures = () => {
  const lum = (c) => {
    const [r, g, b] = c.map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const parse = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (hi + 0.05) / (lo + 0.05);
  };

  // Nearest ancestor with a solid background.
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const m = getComputedStyle(n).backgroundColor.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const parts = m[1].split(',').map(Number);
        if (parts.length < 4 || parts[3] > 0.9) return parts.slice(0, 3);
      }
      n = n.parentElement;
    }
    return [255, 255, 255];
  };

  const out = [];
  document.querySelectorAll('body *').forEach(el => {
    const cs = getComputedStyle(el);
    if (!el.offsetParent && cs.position !== 'fixed') return;
    if (cs.visibility === 'hidden' || cs.opacity === '0') return;

    const text = [...el.childNodes]
      .filter(n => n.nodeType === 3)
      .map(n => n.textContent.trim())
      .join(' ')
      .trim();
    if (!text) return;

    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const isLarge = size >= 24 || (size >= 18.66 && weight >= 700);
    const required = isLarge ? 3 : 4.5;
    const r = ratio(parse(cs.color), bgOf(el));

    if (r < required) {
      out.push(`${r.toFixed(2)}:1 (needs ${required}) — ${Math.round(size)}px/${weight} ` +
               `${cs.color} — "${text.slice(0, 40)}"`);
    }
  });
  return out;
};

test('the marketing page meets AA contrast', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForTimeout(700);
  const failures = await page.evaluate(findFailures);
  expect(failures, `${failures.length} element(s) below AA`).toEqual([]);
});

test('the resident portal meets AA contrast, dashboard included', async ({ page }) => {
  await page.goto('/status.html');
  await page.locator('.demo').first().click();
  await expect(page.locator('#dashboard')).toBeVisible();
  await page.waitForTimeout(400);
  const failures = await page.evaluate(findFailures);
  expect(failures, `${failures.length} element(s) below AA`).toEqual([]);
});

test('the complaint path meets AA contrast', async ({ page }) => {
  await page.goto('/status.html');
  await page.getByRole('radio', { name: 'Queja' }).check();
  await expect(page.locator('#complaintNote')).toBeVisible();
  const failures = await page.evaluate(findFailures);
  expect(failures, `${failures.length} element(s) below AA`).toEqual([]);
});

// The gold was deliberately dialled back — the client's customers are not a
// luxury audience. What must survive is the brand being *present*: the mark,
// and the bronze accent that replaced gold for text.
test('the brand is still visibly present after toning the gold down', async ({ page }) => {
  await page.goto('/index.html');

  await expect(page.locator('header img[src*="logo"]')).toBeVisible();

  const accentUsed = await page.evaluate(() =>
    [...document.querySelectorAll('body *')].some(el =>
      getComputedStyle(el).color === 'rgb(122, 98, 52)'));   // bronze
  expect(accentUsed, 'the bronze accent should appear somewhere').toBe(true);
});
