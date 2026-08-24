// Demo mode: what you send a client so they can try the tool without a token.
// The whole point is that it cannot touch anything real, so that is what these
// tests hammer at.
import { test, expect } from '@playwright/test';

/** Fails the test if the page contacts GitHub at all. */
async function forbidGitHub(page) {
  const calls = [];
  await page.route('https://api.github.com/**', route => {
    calls.push(route.request().method() + ' ' + route.request().url());
    route.abort();
  });
  return calls;
}

test.describe('opening the demo', () => {
  test('a ?demo=1 link goes straight in, no sign-in', async ({ page }) => {
    const calls = await forbidGitHub(page);
    await page.goto('/admin.html?demo=1');
    await expect(page.locator('#editor')).toBeVisible();
    await expect(page.locator('#signIn')).toBeHidden();
    await expect(page.locator('#demoBanner')).toBeVisible();
    expect(calls, 'the demo must not call GitHub').toEqual([]);
  });

  test('the button on the sign-in page also opens it', async ({ page }) => {
    await forbidGitHub(page);
    await page.goto('/admin.html');
    await expect(page.locator('#signIn')).toBeVisible();
    await page.locator('#tryDemo').click();
    await expect(page.locator('#editor')).toBeVisible();
    await expect(page.locator('#demoBanner')).toBeVisible();
  });

  test('says plainly that nothing is saved', async ({ page }) => {
    await page.goto('/admin.html?demo=1');
    await expect(page.locator('#demoBanner')).toContainText(/nothing is saved/i);
    await expect(page.locator('#demoBanner')).toContainText(/not affected/i);
  });

  test('shows sample properties, not the real portfolio', async ({ page }) => {
    await page.goto('/admin.html?demo=1');
    await expect(page.locator('#panel-homes article')).toHaveCount(3);
    await expect(page.locator('#panel-homes')).toContainText('Sample Oak Lane');
    await expect(page.locator('#tab-communities')).toContainText('(2)');
    await expect(page.locator('#tab-promos')).toContainText('(1)');
  });
});

test.describe('the demo is fully usable', () => {
  test.beforeEach(async ({ page }) => {
    await forbidGitHub(page);
    await page.goto('/admin.html?demo=1');
    await expect(page.locator('#editor')).toBeVisible();
  });

  test('a home can be edited and the change shows', async ({ page }) => {
    await page.locator('[data-edit="demo-1"]').click();
    await expect(page.locator('#dlgTitle')).toHaveText('14 Sample Oak Lane');
    await page.fill('#f-rent', '1975');
    await page.locator('#dlgSave').click();
    await expect(page.locator('#panel-homes')).toContainText('$1,975');
  });

  test('a home can be added', async ({ page }) => {
    await page.locator('#addHome').click();
    await page.fill('#f-title', '99 New Street');
    await page.fill('#f-rent', '1700');
    await page.locator('#dlgSave').click();
    await expect(page.locator('#panel-homes article')).toHaveCount(4);
  });

  test('the promotions tab works', async ({ page }) => {
    await page.locator('#tab-promos').click();
    await expect(page.locator('#panel-promos')).toBeVisible();
    await expect(page.locator('#campaignGrid')).toContainText('meta');
    await page.fill('#pInstagram', 'https://instagram.com/example');
    await expect(page.locator('#publish')).toBeEnabled();
  });
});

test.describe('the demo cannot change anything real', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin.html?demo=1');
    await expect(page.locator('#editor')).toBeVisible();
  });

  test('publishing explains itself instead of committing', async ({ page }) => {
    const calls = await forbidGitHub(page);
    await page.locator('[data-edit="demo-1"]').click();
    await page.fill('#f-rent', '1');
    await page.locator('#dlgSave').click();
    await page.locator('#publish').click();

    await expect(page.locator('#log')).toContainText(/demo/i);
    await expect(page.locator('#log')).toContainText(/nothing is published/i);
    expect(calls, 'publish must not reach GitHub in demo mode').toEqual([]);
  });

  test('there is no sign-out, because there was no sign-in', async ({ page }) => {
    await expect(page.locator('#signOut')).toBeHidden();
    await expect(page.locator('#who')).toHaveText('Demo');
  });

  test('no token is stored by opening the demo', async ({ page }) => {
    const stored = await page.evaluate(() => localStorage.getItem('melaos.admin.token'));
    expect(stored).toBeNull();
  });

  test('leaving the demo returns to the sign-in page', async ({ page }) => {
    await page.locator('#exitDemo').click();
    await expect(page.locator('#signIn')).toBeVisible();
    await expect(page.locator('#editor')).toBeHidden();
  });

  test('the sample data is obviously fictional', async ({ page }) => {
    const text = await page.locator('#panel-homes').innerText();
    // Placeholder street names only — nothing that could be mistaken for a real listing.
    expect(text).toMatch(/Sample|Example|Demo/);
  });
});
