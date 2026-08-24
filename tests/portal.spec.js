// Tenant portal. Spanish by default, English on request, and about a *lease* —
// the 1-2-10 construction warranty it used to show never applied to renters.
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/status.html');
});

test.describe('language', () => {
  test('opens in Spanish', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.locator('h1')).toContainText('Su casa y su contrato');
  });

  test('switches to English, including the checklist', async ({ page }) => {
    await page.locator('.demo').first().click();
    await expect(page.locator('#uAddress')).not.toBeEmpty();

    await page.locator('[data-lang-toggle]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toContainText('Your home and your lease');
    await expect(page.locator('#checklist')).toContainText('Change the AC filters');
    await expect(page.locator('#lease')).toContainText(/Started/i);
  });

  test('never mentions a construction warranty', async ({ page }) => {
    await page.locator('.demo').first().click();
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/garantía|warranty|1-2-10/i);
  });
});

test.describe('finding your home', () => {
  test('a unit code works', async ({ page }) => {
    await page.fill('#unitInput', 'CG-1428');
    await page.locator('#lookupForm button[type="submit"]').click();
    await expect(page.locator('#dashboard')).toBeVisible();
    await expect(page.locator('#uAddress')).toHaveText('1428 Cypress Grove Ln');
  });

  test('a street number works', async ({ page }) => {
    await page.fill('#unitInput', '905');
    await page.locator('#lookupForm button[type="submit"]').click();
    await expect(page.locator('#uAddress')).toHaveText('905 Copper Creek Way');
  });

  test('an unknown address explains what to do', async ({ page }) => {
    await page.fill('#unitInput', '99 Nowhere');
    await page.locator('#lookupForm button[type="submit"]').click();
    await expect(page.locator('#unitErr')).toBeVisible();
    await expect(page.locator('#unitErr')).toContainText(/No encontramos/i);
    await expect(page.locator('#dashboard')).toBeHidden();
  });

  test('the dashboard stays hidden until a home is loaded', async ({ page }) => {
    await expect(page.locator('#dashboard')).toBeHidden();
  });

  test('if records fail to load, the tenant is told', async ({ page }) => {
    await page.route('**/data/units.json', r => r.abort());
    await page.goto('/status.html');
    await expect(page.locator('#unitErr')).toBeVisible();
    await expect(page.locator('#unitErr')).toContainText(/no se pudieron cargar/i);
  });
});

test.describe('the lease', () => {
  test.beforeEach(async ({ page }) => {
    await page.locator('.demo').first().click();
    await expect(page.locator('#dashboard')).toBeVisible();
  });

  test('shows rent, deposit and the three lease boxes', async ({ page }) => {
    await expect(page.locator('#uRent')).toContainText('$1,850');
    await expect(page.locator('#uDeposit')).toContainText('$1,850');
    await expect(page.locator('#lease > div')).toHaveCount(3);
    await expect(page.locator('#lease')).toContainText(/Inició/i);
    await expect(page.locator('#lease')).toContainText(/Termina/i);
  });

  test('counts down to the end of the lease', async ({ page }) => {
    await expect(page.locator('#lease')).toContainText(/restantes|terminó/i);
  });
});

test.describe('the maintenance checklist', () => {
  test.beforeEach(async ({ page }) => {
    await page.locator('.demo').first().click();
    await expect(page.locator('#dashboard')).toBeVisible();
  });

  test('lists tenant-appropriate jobs', async ({ page }) => {
    await expect(page.locator('#checklist li')).toHaveCount(6);
    await expect(page.locator('#checklist')).toContainText('filtros del aire');
  });

  test('ticking one persists across a reload', async ({ page }) => {
    await page.locator('#checklist input[data-task="filter"]').check();
    await expect(page.locator('#progressLabel')).toContainText('1 de 6');

    await page.reload();
    await page.locator('.demo').first().click();
    await expect(page.locator('#checklist input[data-task="filter"]')).toBeChecked();
  });

  test('reset clears everything', async ({ page }) => {
    await page.locator('#checklist input[data-task="filter"]').check();
    await page.locator('#resetChecklist').click();
    expect(await page.locator('#checklist input:checked').count()).toBe(0);
    await expect(page.locator('#progressLabel')).toContainText('0 de 6');
  });
});

test.describe('service history', () => {
  test('shows past work and flags what is still open', async ({ page }) => {
    await page.locator('.demo', { hasText: 'BR-0212' }).click();
    await expect(page.locator('#history li')).toHaveCount(2);
    await expect(page.locator('#history')).toContainText(/En proceso/i);
    await expect(page.locator('#uOpen')).toHaveText('1');
  });

  test('a home with nothing outstanding says so', async ({ page }) => {
    await page.locator('.demo', { hasText: 'CC-0905' }).click();
    await expect(page.locator('#uOpen')).toContainText(/Ninguno/i);
  });
});

test.describe('reports and complaints', () => {
  test('defaults to a repair and swaps categories for a complaint', async ({ page }) => {
    await expect(page.locator('#rCategory')).toContainText('Plomería');
    await expect(page.locator('#complaintNote')).toBeHidden();

    await page.getByRole('radio', { name: 'Queja' }).check();
    await expect(page.locator('#rCategory')).toContainText('Trato del personal');
    await expect(page.locator('#rCategory')).not.toContainText('Plomería');
    await expect(page.locator('#complaintNote')).toBeVisible();
  });

  test('blocks an empty submit', async ({ page }) => {
    await page.locator('#requestForm button[type="submit"]').click();
    await expect(page.locator('#requestStatus')).toContainText(/Revise los campos/i);
    await expect(page.locator('#rName')).toBeFocused();
  });

  test('a complaint gets a CX reference and the written-response promise', async ({ page }) => {
    await page.getByRole('radio', { name: 'Queja' }).check();
    await page.fill('#rName', 'María González');
    await page.fill('#rEmail', 'maria@example.com');
    await page.fill('#rUnit', '1428 Cypress Grove Ln');
    await page.selectOption('#rCategory', 'No llegaron a la cita');
    await page.fill('#rDetail', 'El técnico no llegó en la hora acordada y nadie llamó.');
    await page.locator('#requestForm button[type="submit"]').click();

    await expect(page.locator('#requestStatus')).toContainText(/Queja CX-\d{4}-\d{4}/);
    await expect(page.locator('#requestStatus')).toContainText(/cinco días hábiles/i);
  });

  test('a repair gets an MR reference', async ({ page }) => {
    await page.fill('#rName', 'Luis R');
    await page.fill('#rEmail', '4325550100');
    await page.fill('#rUnit', '1428 Cypress Grove Ln');
    await page.selectOption('#rCategory', 'Plomería');
    await page.fill('#rDetail', 'Hay una fuga debajo del fregadero de la cocina.');
    await page.locator('#requestForm button[type="submit"]').click();
    await expect(page.locator('#requestStatus')).toContainText(/Reporte MR-\d{4}-\d{4}/);
  });

  test('the submission carries the real values into the email fallback', async ({ page }) => {
    await page.fill('#rName', 'María González');
    await page.fill('#rEmail', 'maria@example.com');
    await page.fill('#rUnit', '1428 Cypress Grove Ln');
    await page.selectOption('#rCategory', 'Plomería');
    await page.fill('#rDetail', 'Hay una fuga debajo del fregadero de la cocina.');
    await page.locator('#requestForm button[type="submit"]').click();

    const link = page.locator('#requestStatus a[href^="mailto:"]');
    await expect(link).toBeVisible();
    const href = decodeURIComponent(await link.getAttribute('href'));
    expect(href).toContain('María González');
    expect(href).toContain('1428 Cypress Grove Ln');
    expect(href).toContain('fuga');
  });

  test('emergency guidance is visible without submitting', async ({ page }) => {
    await expect(page.getByText(/No espere por este formulario/i)).toBeVisible();
    await expect(page.locator('#emergencyTel')).toHaveText('(432) 606-9495');
  });

  test('looking up a home prefills the address on the form', async ({ page }) => {
    await page.locator('.demo').first().click();
    await expect(page.locator('#rUnit')).toHaveValue('1428 Cypress Grove Ln');
  });
});

test.describe('portal health', () => {
  test('no console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto('/status.html');
    await page.locator('.demo').first().click();
    await expect(page.locator('#dashboard')).toBeVisible();
    expect(errors).toEqual([]);
  });

  for (const [label, width] of [['mobile', 375], ['tablet', 768], ['desktop', 1280]]) {
    test(`no sideways scroll at ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/status.html');
      await page.locator('.demo').first().click();
      const over = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over).toBeLessThanOrEqual(0);
    });
  }

  test('every control has an accessible name', async ({ page }) => {
    await page.locator('.demo').first().click();
    const unnamed = await page.locator('input, select, textarea').evaluateAll(els =>
      els.filter(el => el.type !== 'hidden' &&
        !(el.id && document.querySelector(`label[for="${el.id}"]`)) &&
        !el.getAttribute('aria-label') && !el.closest('label')).map(el => el.id || el.tagName));
    expect(unnamed).toEqual([]);
  });
});
