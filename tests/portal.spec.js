// Resident portal: unit lookup, warranty state, upkeep checklist, and the
// request/complaint intake.
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/status.html');
});

test.describe('unit lookup', () => {
  test('finds a home by unit code', async ({ page }) => {
    await page.fill('#unitInput', 'CG-1428');
    await page.locator('#lookupForm button[type="submit"]').click();
    await expect(page.locator('#dashboard')).toBeVisible();
    await expect(page.locator('#uAddress')).toHaveText('1428 Cypress Grove Ln');
    await expect(page.locator('#uPlan')).toHaveText('The Sabine');
  });

  test('finds the same home by street address and by number alone', async ({ page }) => {
    await page.fill('#unitInput', '212 Bluebonnet Ridge Dr');
    await page.locator('#lookupForm button[type="submit"]').click();
    await expect(page.locator('#uAddress')).toHaveText('212 Bluebonnet Ridge Dr');

    await page.fill('#unitInput', '905');
    await page.locator('#lookupForm button[type="submit"]').click();
    await expect(page.locator('#uAddress')).toHaveText('905 Copper Creek Way');
  });

  test('demo shortcuts load a record', async ({ page }) => {
    await page.locator('.demo', { hasText: 'BR-0212' }).click();
    await expect(page.locator('#dashboard')).toBeVisible();
    await expect(page.locator('#uAddress')).toHaveText('212 Bluebonnet Ridge Dr');
  });

  test('an unknown address explains what to do instead of failing silently', async ({ page }) => {
    await page.fill('#unitInput', '99 Nowhere Road');
    await page.locator('#lookupForm button[type="submit"]').click();
    await expect(page.locator('#unitErr')).toBeVisible();
    await expect(page.locator('#unitErr')).toContainText(/could not find/i);
    await expect(page.locator('#dashboard')).toBeHidden();
    await expect(page.locator('#unitInput')).toHaveAttribute('aria-invalid', 'true');
  });

  test('the dashboard is hidden until a home is loaded', async ({ page }) => {
    await expect(page.locator('#dashboard')).toBeHidden();
    await expect(page.locator('#dashboard')).toHaveCSS('display', 'none');
  });
});

test.describe('warranty coverage', () => {
  test('shows all three tiers with correct active state', async ({ page }) => {
    // Closed 2023-08-02: 1yr workmanship expired, 2yr systems expired, 10yr structural active.
    await page.locator('.demo', { hasText: 'BR-0212' }).click();
    const cards = page.locator('#warranty > div');
    await expect(cards).toHaveCount(3);

    await expect(cards.nth(0)).toContainText('1-year Workmanship');
    await expect(cards.nth(0)).toContainText('Expired');
    await expect(cards.nth(2)).toContainText('10-year Structural');
    await expect(cards.nth(2)).toContainText('Active');
  });

  test('a recent closing still has workmanship cover', async ({ page }) => {
    await page.locator('.demo', { hasText: 'CC-0905' }).click();
    await expect(page.locator('#warranty > div').nth(2)).toContainText('Active');
  });
});

test.describe('upkeep checklist', () => {
  test('ticking an item updates progress and persists across reloads', async ({ page }) => {
    await page.locator('.demo', { hasText: 'CG-1428' }).click();
    const before = await page.locator('#progressLabel').textContent();

    await page.locator('#checklist input[data-task="filter"]').check();
    await expect(page.locator('#progressLabel')).not.toHaveText(before);
    await expect(page.locator('#checklist li').first()).toContainText('Up to date');

    await page.reload();
    await page.locator('.demo', { hasText: 'CG-1428' }).click();
    await expect(page.locator('#checklist input[data-task="filter"]')).toBeChecked();
  });

  test('reset clears every item', async ({ page }) => {
    await page.locator('.demo', { hasText: 'CG-1428' }).click();
    await page.locator('#checklist input[data-task="filter"]').check();
    await page.locator('#checklist input[data-task="gutters"]').check();
    await page.locator('#resetChecklist').click();

    const checked = await page.locator('#checklist input:checked').count();
    expect(checked).toBe(0);
    await expect(page.locator('#progressLabel')).toContainText('0 of 8');
  });

  test('progress bar exposes its value to assistive tech', async ({ page }) => {
    await page.locator('.demo', { hasText: 'CG-1428' }).click();
    await expect(page.locator('#progressBar')).toHaveAttribute('aria-valuenow', /\d+/);
  });
});

test.describe('service history', () => {
  test('lists past visits with their state', async ({ page }) => {
    await page.locator('.demo', { hasText: 'BR-0212' }).click();
    const rows = page.locator('#history li');
    await expect(rows).toHaveCount(3);
    await expect(page.locator('#history')).toContainText('In progress');
    await expect(page.locator('#uOpen')).toHaveText('1');
  });

  test('a home with nothing outstanding says so', async ({ page }) => {
    await page.locator('.demo', { hasText: 'CC-0905' }).click();
    await expect(page.locator('#uOpen')).toHaveText('None');
  });
});

test.describe('requests and complaints', () => {
  test('defaults to a repair, and switching to a complaint swaps the categories', async ({ page }) => {
    const cat = page.locator('#rCategory');
    await expect(cat).toContainText('Plumbing');
    await expect(page.locator('#complaintNote')).toBeHidden();

    await page.getByRole('radio', { name: 'Complaint' }).check();
    await expect(cat).toContainText('Contractor or staff conduct');
    await expect(cat).not.toContainText('Plumbing');
    await expect(page.locator('#complaintNote')).toBeVisible();
    await expect(page.locator('#complaintNote')).toContainText(/written\s+response\s+within\s+five/i);
  });

  test('questions get their own categories', async ({ page }) => {
    await page.getByRole('radio', { name: 'Question' }).check();
    await expect(page.locator('#rCategory')).toContainText('What my warranty covers');
    await expect(page.locator('#complaintNote')).toBeHidden();
  });

  test('blocks an empty submit and focuses the first problem', async ({ page }) => {
    await page.locator('#requestForm button[type="submit"]').click();
    await expect(page.locator('#requestStatus')).toContainText(/fix the highlighted/i);
    await expect(page.locator('#rName')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#rName')).toBeFocused();
  });

  test('rejects a too-short description', async ({ page }) => {
    await page.fill('#rName', 'Jordan Alvarez');
    await page.fill('#rEmail', 'jordan@example.com');
    await page.fill('#rUnit', '1428 Cypress Grove Ln');
    await page.selectOption('#rCategory', 'Plumbing');
    await page.fill('#rDetail', 'leak');
    await page.locator('#requestForm button[type="submit"]').click();
    await expect(page.locator('#rDetailErr')).toBeVisible();
  });

  test('a complaint returns a CX reference and the response commitment', async ({ page }) => {
    await page.getByRole('radio', { name: 'Complaint' }).check();
    await page.fill('#rName', 'Jordan Alvarez');
    await page.fill('#rEmail', 'jordan@example.com');
    await page.fill('#rUnit', '1428 Cypress Grove Ln');
    await page.selectOption('#rCategory', 'Missed or late appointment');
    await page.fill('#rDetail', 'The technician did not arrive in the booked window and nobody called.');
    await page.locator('#requestForm button[type="submit"]').click();

    await expect(page.locator('#requestStatus')).toContainText(/Complaint CX-\d{4}-\d{4}/);
    await expect(page.locator('#requestStatus')).toContainText(/within five/i);
  });

  test('a repair returns an MR reference', async ({ page }) => {
    await page.fill('#rName', 'Jordan Alvarez');
    await page.fill('#rEmail', 'jordan@example.com');
    await page.fill('#rUnit', '1428 Cypress Grove Ln');
    await page.selectOption('#rCategory', 'Plumbing');
    await page.fill('#rDetail', 'Slow drain in the upstairs guest bathroom since Tuesday.');
    await page.locator('#requestForm button[type="submit"]').click();
    await expect(page.locator('#requestStatus')).toContainText(/Request MR-\d{4}-\d{4}/);
  });

  test('emergency guidance is visible without submitting anything', async ({ page }) => {
    await expect(page.getByText(/Do not wait on this form/i)).toBeVisible();
    await expect(page.locator('a[href="tel:+15125550188"]')).toBeVisible();
  });
});

test.describe('portal page health', () => {
  test('no console errors, no failed same-origin requests', async ({ page }) => {
    const errors = [], failed = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', r => {
      if (r.status() >= 400 && r.url().includes('127.0.0.1:8080')) failed.push(r.url());
    });
    await page.goto('/status.html');
    await page.locator('.demo', { hasText: 'CG-1428' }).click();
    expect(errors).toEqual([]);
    expect(failed).toEqual([]);
  });

  test('share preview and icon are wired up', async ({ page }) => {
    for (const prop of ['og:title', 'og:image', 'og:url']) {
      const content = await page.locator(`meta[property="${prop}"]`).getAttribute('content');
      expect(content, prop).toBeTruthy();
      if (prop !== 'og:title') expect(content).toMatch(/^https:\/\//);
    }
    await expect(page.locator('link[rel="icon"]')).toHaveCount(1);
  });

  for (const [label, width] of [['mobile', 375], ['tablet', 768], ['desktop', 1280]]) {
    test(`no horizontal overflow at ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/status.html');
      await page.locator('.demo', { hasText: 'CG-1428' }).click();
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('every control on the page has an accessible name', async ({ page }) => {
    await page.locator('.demo', { hasText: 'CG-1428' }).click();
    const unnamed = await page.locator('input, select, textarea').evaluateAll(els =>
      els.filter(el => {
        if (el.type === 'hidden') return false;
        const labelled = el.id && document.querySelector(`label[for="${el.id}"]`);
        return !labelled && !el.getAttribute('aria-label') && !el.closest('label');
      }).map(el => el.id || el.name || el.tagName));
    expect(unnamed).toEqual([]);
  });
});

test.describe('delivery and configuration', () => {
  // A submission must never vanish just because no backend is wired yet.
  test('a submitted request offers a prefilled email carrying the details', async ({ page }) => {
    await page.fill('#rName', 'Jordan Alvarez');
    await page.fill('#rEmail', 'jordan@example.com');
    await page.fill('#rUnit', '1428 Cypress Grove Ln');
    await page.selectOption('#rCategory', 'Plumbing');
    await page.fill('#rDetail', 'Slow drain in the upstairs guest bathroom since Tuesday.');
    await page.locator('#requestForm button[type="submit"]').click();

    const link = page.locator('#requestStatus a[href^="mailto:"]');
    await expect(link).toBeVisible();

    const href = decodeURIComponent(await link.getAttribute('href'));
    expect(href).toContain('Jordan Alvarez');
    expect(href).toContain('1428 Cypress Grove Ln');
    expect(href).toContain('Plumbing');
    expect(href).toContain('Slow drain');
    expect(href).toMatch(/^mailto:[^?]+@/);
  });

  test('the page states plainly how submissions are delivered', async ({ page }) => {
    await expect(page.locator('#deliveryNote')).not.toBeEmpty();
  });

  test('promised timescales all come from one config value', async ({ page }) => {
    const ack = await page.locator('[data-sla="ack"]').allTextContents();
    const complaint = await page.locator('[data-sla="complaint"]').allTextContents();
    expect(ack.length).toBeGreaterThan(0);
    expect(new Set(ack).size, 'acknowledgement wording should be identical everywhere').toBe(1);
    expect(new Set(complaint).size, 'complaint wording should be identical everywhere').toBe(1);
    expect(ack[0]).not.toMatch(/^\s*$/);
  });

  test('records come from data/units.json, not hardcoded markup', async ({ page }) => {
    const res = await page.request.get('/data/units.json');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Object.keys(data)).toContain('CG-1428');
    expect(data['CG-1428'].closed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('if the records fail to load, the resident is told what to do', async ({ page }) => {
    await page.route('**/data/units.json', route => route.abort());
    await page.goto('/status.html');
    await expect(page.locator('#unitErr')).toBeVisible();
    await expect(page.locator('#unitErr')).toContainText(/could not be loaded/i);
  });
});
