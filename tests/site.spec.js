// Public rental site. Deliberately exercises the empty-inventory state as a
// first-class case: the client is starting from zero listings.
import { test, expect } from '@playwright/test';

const SAMPLE = {
  publish: { rent: true, sale: false, build: false },
  neighborhoods: [
    { id: 'katy', name: 'Katy', city: 'houston', note: 'Good schools, quiet streets.' },
  ],
  homes: [
    { id: 'a1', title: '1428 Cypress Grove Ln', listingType: 'rent', availability: 'available',
      city: 'houston', area: 'Katy', rent: 1850, beds: 3, baths: 2, sqft: 1642,
      availableFrom: '', description: 'Fenced yard.', photos: [] },
    { id: 'a2', title: '212 Bluebonnet Ridge Dr', listingType: 'rent', availability: 'occupied',
      city: 'austin', area: 'Georgetown', rent: 2100, beds: 4, baths: 2, sqft: 2100,
      availableFrom: 'March', description: '', photos: [] },
  ],
};

const serve = (page, data) =>
  page.route('**/data/properties.json', r => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(data),
  }));

test.describe('with no listings yet', () => {
  test.beforeEach(async ({ page }) => {
    await serve(page, { publish: { rent: true }, neighborhoods: [], homes: [] });
    await page.goto('/index.html');
  });

  test('invites contact instead of showing an empty page', async ({ page }) => {
    await expect(page.locator('#emptyState')).toBeVisible();
    await expect(page.locator('#emptyState')).toContainText(/escríbanos/i);
    await expect(page.locator('#filterStatus')).toContainText(/no hay casas publicadas/i);
  });

  test('the empty state still offers WhatsApp', async ({ page }) => {
    await expect(page.locator('#waEmpty')).toHaveAttribute('href', /wa\.me\/14326069495/);
  });
});

test.describe('with listings', () => {
  test.beforeEach(async ({ page }) => {
    await serve(page, SAMPLE);
    await page.goto('/index.html');
  });

  test('splits available from currently rented', async ({ page }) => {
    await expect(page.locator('#panel-available .home')).toHaveCount(1);
    await expect(page.locator('#tab-available')).toContainText('(1)');
    await expect(page.locator('#panel-available')).toContainText('$1,850');

    await page.locator('#tab-occupied').click();
    await expect(page.locator('#panel-occupied .home')).toHaveCount(1);
    await expect(page.locator('#panel-occupied')).toContainText('Rentada');
  });

  test('the for-sale tab stays hidden while selling is off', async ({ page }) => {
    await expect(page.locator('#tab-sale')).toBeHidden();
  });

  test('shows for-sale homes once switched on', async ({ page }) => {
    await serve(page, {
      publish: { rent: true, sale: true },
      neighborhoods: [],
      homes: [{ id: 's1', title: '9 Sale St', listingType: 'sale', availability: 'available',
        city: 'dfw', area: 'Celina', price: 389000, beds: 3, baths: 2, sqft: 1800, photos: [] }],
    });
    await page.reload();
    await expect(page.locator('#tab-sale')).toBeVisible();
    await page.locator('#tab-sale').click();
    await expect(page.locator('#panel-sale')).toContainText('$389,000');
  });

  test('filters narrow the list', async ({ page }) => {
    await page.selectOption('#fCity', 'austin');
    await expect(page.locator('#panel-available .home:not([hidden])')).toHaveCount(0);
    await page.selectOption('#fCity', 'houston');
    await expect(page.locator('#panel-available .home:not([hidden])')).toHaveCount(1);
  });

  test('opens a home and offers WhatsApp about that specific house', async ({ page }) => {
    await page.locator('[data-home="a1"]').click();
    await expect(page.locator('#planModal')).toBeVisible();
    await expect(page.locator('#planTitle')).toHaveText('1428 Cypress Grove Ln');
    await expect(page.locator('#planStats')).toContainText('$1,850/mes');
    const href = decodeURIComponent(await page.locator('#planWhatsApp').getAttribute('href'));
    expect(href).toContain('1428 Cypress Grove Ln');
  });

  test('Escape closes the home and returns focus', async ({ page }) => {
    const trigger = page.locator('[data-home="a1"]');
    await trigger.click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#planModal')).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('lists the areas', async ({ page }) => {
    await expect(page.locator('.area')).toHaveCount(1);
    await expect(page.locator('#areaGrid')).toContainText('Katy');
  });

  test('listing text is escaped, not injected', async ({ page }) => {
    await serve(page, { publish: { rent: true }, neighborhoods: [],
      homes: [Object.assign({}, SAMPLE.homes[0], { title: '<img src=x onerror=alert(1)>Bad' })] });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.reload();
    await expect(page.locator('#panel-available .home h3')).toContainText('<img src=x');
    expect(await page.locator('#panel-available .home h3 img').count()).toBe(0);
    expect(errors).toEqual([]);
  });
});

test.describe('the business number', () => {
  test.beforeEach(async ({ page }) => { await serve(page, SAMPLE); await page.goto('/index.html'); });

  test('every WhatsApp link points at 432 606 9495', async ({ page }) => {
    const hrefs = await page.locator('a[href*="wa.me"]').evaluateAll(els => els.map(e => e.href));
    expect(hrefs.length).toBeGreaterThan(2);
    for (const h of hrefs) expect(h).toContain('wa.me/14326069495');
  });

  test('the number is shown to read, not just linked', async ({ page }) => {
    await expect(page.locator('#waNumber')).toHaveText('(432) 606-9495');
  });
});

test.describe('enquiry form', () => {
  test.beforeEach(async ({ page }) => { await serve(page, SAMPLE); await page.goto('/index.html'); });

  test('needs a name, phone, city and consent', async ({ page }) => {
    await page.locator('#tourForm button[type="submit"]').click();
    await expect(page.locator('#formStatus')).toContainText(/Revise los campos/i);
    await expect(page.locator('#cName')).toBeFocused();
  });

  test('accepts a submission without an email', async ({ page }) => {
    await page.fill('#cName', 'Jordan Alvarez');
    await page.fill('#cPhone', '432 555 0101');
    await page.selectOption('#cLocation', 'Houston');
    await page.check('#cConsent');
    await page.locator('#tourForm button[type="submit"]').click();
    await expect(page.locator('#formStatus')).toContainText(/Gracias Jordan/);
    await expect(page.locator('#formStatus a[href*="wa.me"]')).toBeVisible();
  });

  test('rejects a malformed email when one is given', async ({ page }) => {
    await page.fill('#cName', 'Jordan');
    await page.fill('#cPhone', '4325550101');
    await page.fill('#cEmail', 'nope');
    await page.selectOption('#cLocation', 'Houston');
    await page.check('#cConsent');
    await page.locator('#tourForm button[type="submit"]').click();
    await expect(page.locator('#cEmailErr')).toBeVisible();
  });
});

test.describe('page health', () => {
  test.beforeEach(async ({ page }) => { await serve(page, SAMPLE); });

  test('no console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto('/index.html');
    await expect(page.locator('.home')).toHaveCount(2);
    expect(errors).toEqual([]);
  });

  test('the stylesheet loaded', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(247, 244, 238)');
  });

  test('says so if listings cannot be loaded', async ({ page }) => {
    await page.route('**/data/properties.json', r => r.abort());
    await page.goto('/index.html');
    await expect(page.locator('#filterStatus')).toContainText(/No se pudieron cargar/i);
  });

  for (const [label, width] of [['mobile', 375], ['tablet', 768], ['laptop', 1152],
                                ['desktop', 1280], ['wide', 1440]]) {
    test(`no sideways scroll at ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/index.html');
      await expect(page.locator('.home')).toHaveCount(2);
      const over = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over).toBeLessThanOrEqual(0);
    });
  }

  test('one h1, labelled controls, alt text, working anchors', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('h1')).toHaveCount(1);

    const unnamed = await page.locator('input, select, textarea').evaluateAll(els =>
      els.filter(el => el.type !== 'hidden' &&
        !(el.id && document.querySelector(`label[for="${el.id}"]`)) &&
        !el.getAttribute('aria-label') && !el.closest('label')).map(el => el.id || el.tagName));
    expect(unnamed).toEqual([]);

    const noAlt = await page.locator('img').evaluateAll(els =>
      els.filter(e => e.getAttribute('alt') === null).map(e => e.src));
    expect(noAlt).toEqual([]);

    const broken = await page.evaluate(() =>
      [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href'))
        .filter(h => h !== '#' && !document.querySelector(h)));
    expect(broken).toEqual([]);
  });
});

test.describe('language', () => {
  test.beforeEach(async ({ page }) => { await serve(page, SAMPLE); await page.goto('/index.html'); });

  test('Spanish is what a first-time visitor gets', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.locator('h1')).toContainText('¿Busca una casa para rentar?');
    await expect(page.locator('[data-lang-toggle]').first()).toHaveText('English');
  });

  test('the toggle switches the whole page, including cards', async ({ page }) => {
    await page.locator('[data-lang-toggle]').first().click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toContainText('Looking for a house to rent?');
    await expect(page.locator('#panel-available')).toContainText('/mo');
    await expect(page.locator('#panel-available')).toContainText('Available');
    await expect(page.locator('#filterStatus')).toContainText(/Showing all/);
    await expect(page.locator('[data-lang-toggle]').first()).toHaveText('Español');
  });

  test('it switches back', async ({ page }) => {
    const toggle = page.locator('[data-lang-toggle]').first();
    await toggle.click();
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.locator('h1')).toContainText('¿Busca');
  });

  test('the choice is remembered', async ({ page }) => {
    await page.locator('[data-lang-toggle]').first().click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toContainText('Looking for');
  });

  test('form errors follow the language', async ({ page }) => {
    await page.locator('[data-lang-toggle]').first().click();
    await page.locator('#tourForm button[type="submit"]').click();
    await expect(page.locator('#formStatus')).toContainText(/check the highlighted/i);
    await expect(page.locator('#cNameErr')).toContainText(/enter your name/i);
  });
});

test.describe('rent by month and by year', () => {
  const withYear = {
    publish: { rent: true },
    neighborhoods: [],
    homes: [Object.assign({}, SAMPLE.homes[0], { rent: 1850, rentYear: 20400 })],
  };

  test('shows the yearly price beside the monthly one', async ({ page }) => {
    await serve(page, withYear);
    await page.goto('/index.html');
    await expect(page.locator('#panel-available .home')).toContainText('$1,850');
    await expect(page.locator('#panel-available .home')).toContainText('$20,400');
  });

  test('the detail view lists both', async ({ page }) => {
    await serve(page, withYear);
    await page.goto('/index.html');
    await page.locator('[data-home="a1"]').click();
    await expect(page.locator('#planStats')).toContainText('$1,850/mes');
    await expect(page.locator('#planStats')).toContainText('$20,400');
  });

  test('a home without a yearly price shows only the monthly one', async ({ page }) => {
    await serve(page, SAMPLE);
    await page.goto('/index.html');
    const card = page.locator('#panel-available .home');
    await expect(card).toContainText('$1,850');
    await expect(card).not.toContainText('/año');
  });
});
