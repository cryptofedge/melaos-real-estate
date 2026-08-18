// Regression net for the Melao's site. Everything here has broken at least once
// in development, or is a dependency the page cannot render correctly without.
import { test, expect } from '@playwright/test';

/** Collects console errors and failed requests for the life of a page. */
function watch(page) {
  const errors = [], failed = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('response', r => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  return { errors, failed };
}

test.describe('page health', () => {
  test('loads with no console errors and no failed requests', async ({ page }) => {
    const seen = watch(page);
    await page.goto('/index.html');

    // Wait on the page's own work finishing, not networkidle -- the CDN keeps
    // connections open, so networkidle is flaky and times out on slow links.
    await expect(page.locator('.plan')).toHaveCount(40);
    await expect(page.locator('img[src*="logo"]').first()).toHaveJSProperty('complete', true);

    expect(seen.errors, 'console errors').toEqual([]);
    expect(seen.failed, 'requests that 404ed or worse').toEqual([]);
  });

  // The Tailwind Play CDN is the single biggest fragility: if it fails to load,
  // every class silently does nothing and the page renders as unstyled HTML.
  test('Tailwind actually applied its styles', async ({ page }) => {
    await page.goto('/index.html');

    // Custom palette from the inline tailwind.config.
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(249, 250, 251)');

    // A utility on an element that is present at every breakpoint. Anything
    // viewport-dependent makes this test fail for layout reasons rather than
    // because the stylesheet went missing.
    await expect(page.locator('#quickFilter')).toHaveCSS('border-radius', '12px');
  });

  test('brand mark renders from the vector, not the fallback', async ({ page }) => {
    await page.goto('/index.html');
    const logos = page.locator('img[src*="logo"]');
    await expect(logos).toHaveCount(2);
    for (const logo of await logos.all()) {
      await expect(logo).toHaveAttribute('src', /logo\.svg$/);
      const ok = await logo.evaluate(i => i.complete && i.naturalWidth > 0);
      expect(ok, 'logo.svg should load').toBe(true);
    }
    // Fallback symbol must stay hidden while the real artwork works.
    await expect(page.locator('header svg[hidden], footer svg[hidden]')).toHaveCount(2);
  });

  test('link preview metadata is present and absolute', async ({ page }) => {
    await page.goto('/index.html');
    for (const prop of ['og:title', 'og:description', 'og:url', 'og:image']) {
      const content = await page.locator(`meta[property="${prop}"]`).getAttribute('content');
      expect(content, `${prop} should be set`).toBeTruthy();
    }
    // Scrapers do not resolve relative paths - this is what broke WhatsApp.
    for (const prop of ['og:url', 'og:image']) {
      const content = await page.locator(`meta[property="${prop}"]`).getAttribute('content');
      expect(content, `${prop} must be absolute`).toMatch(/^https:\/\//);
    }
    await expect(page.locator('link[rel="icon"]')).toHaveCount(1);
  });
});

test.describe('inventory', () => {
  test.beforeEach(async ({ page }) => await page.goto('/index.html'));

  test('all 40 homes render in the right tabs', async ({ page }) => {
    await expect(page.locator('.plan')).toHaveCount(40);
    await expect(page.locator('#panel-single .plan')).toHaveCount(14);
    await expect(page.locator('#panel-two .plan')).toHaveCount(16);
    await expect(page.locator('#panel-custom .plan')).toHaveCount(10);
    await expect(page.locator('.community')).toHaveCount(6);
  });

  test('every home card carries the data the filters read', async ({ page }) => {
    const bad = await page.locator('.plan, .community').evaluateAll(els =>
      els.filter(e => !e.dataset.city || !e.dataset.price || !e.dataset.beds)
         .map(e => e.querySelector('h3')?.textContent ?? '(unnamed)'));
    expect(bad, 'cards missing filter attributes').toEqual([]);
  });

  test('filters narrow both grids and report the count', async ({ page }) => {
    await page.selectOption('#fCity', 'dfw');
    const status = page.locator('#filterStatus');
    await expect(status).toContainText(/Showing \d+ communit/);

    const communities = await page.locator('.community:not([hidden])').count();
    const plans = await page.locator('.plan:not([hidden])').count();
    expect(communities).toBeGreaterThan(0);
    expect(communities).toBeLessThan(6);
    expect(plans).toBeLessThan(40);

    // Everything still on screen must genuinely be in that market.
    const cities = await page.locator('.plan:not([hidden])').evaluateAll(
      els => [...new Set(els.map(e => e.dataset.city))]);
    expect(cities).toEqual(['dfw']);
  });

  test('resetting the filter restores everything', async ({ page }) => {
    await page.selectOption('#fCity', 'austin');
    await page.locator('#quickFilter button[type="reset"]').click();
    await expect(page.locator('.community:not([hidden])')).toHaveCount(6);
    await expect(page.locator('#filterStatus')).toContainText('all 40 homes');
  });
});

test.describe('tabs', () => {
  test('switching tabs swaps panels and updates aria-selected', async ({ page }) => {
    await page.goto('/index.html');
    const two = page.getByRole('tab', { name: /Two-Story/ });
    await two.click();
    await expect(two).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#panel-two')).toBeVisible();
    await expect(page.locator('#panel-single')).toBeHidden();
  });

  test('arrow keys move between tabs', async ({ page }) => {
    await page.goto('/index.html');
    await page.getByRole('tab', { name: /Single-Story/ }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: /Two-Story/ })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: /Custom Spec/ })).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('floor plan modal', () => {
  test.beforeEach(async ({ page }) => await page.goto('/index.html'));

  // The empty-shell bug: a closed modal leaking onto the page.
  test('stays fully hidden until opened', async ({ page }) => {
    const modal = page.locator('#planModal');
    await expect(modal).toBeHidden();
    await expect(modal).toHaveCSS('display', 'none');
    await expect(page.locator('#planScrim')).toHaveCSS('display', 'none');
  });

  test('opens with its stats and drawing populated', async ({ page }) => {
    await page.locator('#panel-single [data-plan]').first().click();
    await expect(page.locator('#planModal')).toBeVisible();
    await expect(page.locator('#planStats > div')).toHaveCount(4);
    await expect(page.locator('#planDrawing svg')).not.toHaveCount(0);
    await expect(page.locator('#planTitle')).not.toBeEmpty();
    // Room labels prove the schematic generated rather than rendering an empty box.
    await expect(page.locator('#planDrawing text').first()).not.toBeEmpty();
  });

  test('two-story plans draw both floors', async ({ page }) => {
    await page.getByRole('tab', { name: /Two-Story/ }).click();
    await page.locator('#panel-two [data-plan]').first().click();
    await expect(page.locator('#planDrawing svg')).toHaveCount(2);
  });

  test('Escape closes it and focus returns to the trigger', async ({ page }) => {
    const trigger = page.locator('#panel-single [data-plan]').first();
    await trigger.click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#planModal')).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page.locator('body')).not.toHaveClass(/no-scroll/);
  });
});

test.describe('contact form', () => {
  test.beforeEach(async ({ page }) => await page.goto('/index.html'));

  test('blocks an empty submit and flags the bad fields', async ({ page }) => {
    await page.locator('#tourForm button[type="submit"]').click();
    await expect(page.locator('#formStatus')).toContainText(/fix the highlighted/i);
    await expect(page.locator('#cName')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#cNameErr')).toBeVisible();
    await expect(page.locator('#cName')).toBeFocused();
  });

  test('rejects a malformed email', async ({ page }) => {
    await page.fill('#cName', 'Jordan Alvarez');
    await page.fill('#cEmail', 'not-an-email');
    await page.selectOption('#cLocation', 'Houston');
    await page.check('#cConsent');
    await page.locator('#tourForm button[type="submit"]').click();
    await expect(page.locator('#cEmailErr')).toBeVisible();
  });

  test('accepts a complete submission', async ({ page }) => {
    await page.fill('#cName', 'Jordan Alvarez');
    await page.fill('#cEmail', 'jordan@example.com');
    await page.selectOption('#cLocation', 'Houston');
    await page.check('#cConsent');
    await page.locator('#tourForm button[type="submit"]').click();
    await expect(page.locator('#formStatus')).toContainText(/Thank you, Jordan/);
  });
});

test.describe('layout', () => {
  for (const [label, width] of [['mobile', 375], ['tablet', 768], ['desktop', 1280]]) {
    test(`no horizontal overflow at ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/index.html');
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, 'page should never scroll sideways').toBeLessThanOrEqual(0);
    });
  }

  test('mobile drawer opens, traps and closes', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/index.html');
    const toggle = page.locator('#navToggle');
    await toggle.click();
    await expect(page.locator('#mobileDrawer')).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('#mobileDrawer')).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('accessibility basics', () => {
  test.beforeEach(async ({ page }) => await page.goto('/index.html'));

  test('exactly one h1, and headings are labelled', async ({ page }) => {
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('every form control has an accessible name', async ({ page }) => {
    const unnamed = await page.locator('input, select, textarea').evaluateAll(els =>
      els.filter(el => {
        if (el.type === 'hidden') return false;
        const id = el.id && document.querySelector(`label[for="${el.id}"]`);
        return !id && !el.getAttribute('aria-label') && !el.closest('label');
      }).map(el => el.id || el.name || el.tagName));
    expect(unnamed, 'controls with no label').toEqual([]);
  });

  test('every image has an alt attribute', async ({ page }) => {
    const missing = await page.locator('img').evaluateAll(els =>
      els.filter(e => e.getAttribute('alt') === null).map(e => e.src));
    expect(missing, 'images missing alt').toEqual([]);
  });

  test('all internal anchors point at something real', async ({ page }) => {
    const broken = await page.evaluate(() =>
      [...document.querySelectorAll('a[href^="#"]')]
        .map(a => a.getAttribute('href'))
        .filter(h => h !== '#' && !document.querySelector(h)));
    expect(broken, 'anchors with no target').toEqual([]);
  });
});
