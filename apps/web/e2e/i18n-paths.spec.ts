// apps/web/e2e/i18n-paths.spec.ts
import { test, expect } from '@playwright/test';

const locales = ['fa-IR', 'fa-AF', 'en'] as const;

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════
function path(locale: string, route: string) {
  return locale === 'fa-IR' ? route : `/${locale}${route}`;
}

async function login(page: import('@playwright/test').Page, locale: string) {
  const prefix = locale === 'fa-IR' ? '' : `/${locale}`;
  await page.goto(`${prefix}/login`);
  await page.locator('#login-email').waitFor({ state: 'visible' });
  await page.locator('#login-email').fill('demo@hisabche.com');
  await page.locator('#login-password').fill('Demo1234');

  const demoBtn = page.getByRole('button', { name: /ورود نمایشی|Demo Login/i });
  if (await demoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await demoBtn.click();
  } else {
    await page.locator('button[type="submit"]').first().click();
  }

  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

// ════════════════════════════════════════════
// LANDING
// ════════════════════════════════════════════
for (const locale of locales) {
  test.describe(`Landing — ${locale}`, () => {
    test('page loads', async ({ page }) => {
      const resp = await page.goto(path(locale, '/'));
      expect(resp?.status()).toBe(200);
    });

    test('hreflang tags exist', async ({ page }) => {
      await page.goto(path(locale, '/'));
      const count = await page.locator('link[rel="alternate"]').count();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test('has CTA button', async ({ page }) => {
      await page.goto(path(locale, '/'));
      await page.waitForLoadState('networkidle');
      const cta = page.getByRole('button').filter({ hasText: /شروع|Start|Get Started|Free/i }).first();
      await expect(cta).toBeVisible({ timeout: 5000 }).catch(() => {
        return expect(page.getByRole('link').filter({ hasText: /login|sign|ورود|ثبت|شروع/i }).first()).toBeVisible({ timeout: 3000 });
      });
    });
  });
}

// ════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════
for (const locale of locales) {
  test.describe(`Login — ${locale}`, () => {
    test('login form loads', async ({ page }) => {
      await page.goto(path(locale, '/login'));
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#login-email')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('#login-password')).toBeVisible({ timeout: 5000 });
    });

    test('login with demo works', async ({ page }) => {
      await login(page, locale);
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 5000 });
    });

    test('logout works', async ({ page }) => {
      await login(page, locale);
      await page.getByRole('button', { name: /خروج|Sign Out|Logout/i }).first().click();
      await page.waitForURL(/\/login/, { timeout: 10000 });
      await expect(page.locator('#login-email')).toBeVisible({ timeout: 5000 });
    });
  });
}

// ════════════════════════════════════════════
// SIGNUP
// ════════════════════════════════════════════
for (const locale of locales) {
  test.describe(`Signup — ${locale}`, () => {
    test('signup form loads', async ({ page }) => {
      await page.goto(path(locale, '/signup'));
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#signup-fullName').or(page.locator('input[name="fullName"]')).first()).toBeVisible({ timeout: 5000 });
    });
  });
}

// ════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════
for (const locale of locales) {
  test.describe(`Dashboard — ${locale}`, () => {
    test('shows content after login', async ({ page }) => {
      await login(page, locale);
      await page.goto(path(locale, '/dashboard'));
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main').first()).toBeVisible({ timeout: 5000 });
    });
  });
}

// ════════════════════════════════════════════
// PAGES (no login needed)
// ════════════════════════════════════════════
test('pricing page loads', async ({ page }) => {
  const resp = await page.goto('/pricing');
  expect(resp?.status()).toBe(200);
});

// ════════════════════════════════════════════
// LANGUAGE SWITCHER
// ════════════════════════════════════════════
test('language switcher changes URL', async ({ page }) => {
  await page.goto('/en/login');
  await page.waitForLoadState('networkidle');
  const langBtn = page.locator('button').filter({ has: page.locator('text=🇮🇷') }).first();
  if (await langBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await langBtn.click();
    const faOption = page.locator('button').filter({ hasText: /فارسی|دری/ }).first();
    if (await faOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await faOption.click();
      await page.waitForTimeout(1500);
      const url = page.url();
      expect(url).toMatch(/fa-IR|fa-AF/);
    }
  }
});

// ════════════════════════════════════════════
// SITEMAP & ROBOTS
// ════════════════════════════════════════════
test('sitemap.xml returns XML', async ({ page }) => {
  const response = await page.goto('/sitemap.xml');
  expect(response?.headers()['content-type']).toContain('xml');
});

test('robots.txt returns 200', async ({ page }) => {
  const response = await page.goto('/robots.txt');
  expect(response?.status()).toBe(200);
});

// ════════════════════════════════════════════
// 404
// ════════════════════════════════════════════
test('404 page does not crash', async ({ page }) => {
  await page.goto('/en/nonexistent-page-xyz');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('body')).not.toBeEmpty();
});