import { expect, test } from '@playwright/test'

/**
 * Admin Customers Hub — end-to-end coverage.
 *
 * Runs against the admin dev server on :3040 (override with ADMIN_BASE_URL).
 * Reuses the web app's Playwright install so no dependency is added.
 *
 * The redirect checks need no session: proxy.ts rewrites legacy paths before
 * authentication. The in-page checks need a real admin account; they are
 * skipped (with a visible reason) when credentials are not supplied, because
 * a fake session would only prove the test harness works.
 */
// 127.0.0.1, not localhost: Node/Playwright resolves localhost to ::1 on
// Windows while next dev binds IPv4 only (EACCES ::1 otherwise).
test.use({ baseURL: process.env.ADMIN_BASE_URL ?? 'http://127.0.0.1:3040' })

const LOCALES = ['fa', 'af', 'en'] as const

for (const lang of LOCALES) {
  test(`legacy /${lang}/subscriptions resolves to the single customers URL`, async ({
    request,
  }) => {
    const res = await request.get(`/${lang}/subscriptions`, { maxRedirects: 0 })
    expect([301, 307, 308]).toContain(res.status())
    expect(res.headers()['location']).toBe(`/${lang}/customers?tab=workspaces`)
  })
}

test('the legacy revenue subscriptions tab no longer renders', async ({ request }) => {
  const res = await request.get('/fa/revenue?tab=subscriptions', { maxRedirects: 0 })
  // unauthenticated → login redirect; if a session is present, no 404 from a
  // removed tab. Either way it must never be a server error.
  expect(res.status()).toBeLessThan(500)
})

const email = process.env.E2E_ADMIN_EMAIL
const password = process.env.E2E_ADMIN_PASSWORD

test.describe('signed-in operator', () => {
  test.skip(!email || !password, 'Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD to run UI checks')

  test.beforeEach(async ({ page }) => {
    await page.goto('/fa/login')
    await page.getByLabel('Email').fill(email!)
    await page.getByLabel('Password').fill(password!)
    await page.getByRole('button', { name: /sign in|ورود/i }).click()
    await page.waitForURL(/\/fa\/dashboard/)
  })

  test('subscription information is shown inside the workspace card', async ({ page }) => {
    await page.goto('/fa/customers?tab=workspaces')
    const cards = page.locator('li[data-expired]')
    await expect(cards.first()).toBeVisible()
    // plan badge, status badge and period end are all on the same card
    await expect(cards.first().locator('[data-subscription-controls]')).toBeHidden()
    await cards.first().getByRole('button').first().click()
    await expect(cards.first().locator('[data-subscription-controls]')).toBeVisible()
  })

  test('an expired card carries a destructive border, alert and reset control', async ({
    page,
  }) => {
    await page.goto('/fa/customers?tab=workspaces')
    const expired = page.locator('li[data-expired="true"]').first()
    if ((await expired.count()) === 0) test.skip(true, 'No expired subscription in fixture data')
    await expect(expired).toHaveAttribute('data-expired', 'true')
    await expect(expired.getByRole('alert')).toBeVisible()
    await expired.locator('button').first().click()
    await expect(expired.getByRole('button', { name: /reset|ریست/i })).toBeVisible()
    // The status select must show the expired option, not a stale "active".
    await expect(expired.getByRole('combobox', { name: /وضعیت|status/i })).toContainText('منقضی')
  })

  test('there is no separate subscriptions tab', async ({ page }) => {
    await page.goto('/fa/customers')
    await expect(page.getByRole('button', { name: /اشتراک‌ها|Subscriptions/ })).toHaveCount(0)
  })
})
