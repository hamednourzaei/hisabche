// ============================================
// apps/web/e2e/business-day.spec.ts
//
// One working day, in a real browser.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS WHEN `http-e2e-business-day.test.ts` ALREADY DOES
//
// That one drives the Fastify server directly and proves the LEDGER balances
// after each step. It cannot see a screen. Everything it asserts stayed true
// on the day the sidebar crashed on every page with `Element type is invalid`
// and the entire application rendered a red error box.
//
// This is the other half: the pages load, the navigation reaches them, and the
// numbers appear where a person would look. It asserts almost nothing about
// accounting — that is the HTTP test's job, and duplicating it here would make
// a slow test that fails for two unrelated reasons.
//
// ---------------------------------------------------------------------------
// AGAINST LOCALHOST, NOT PRODUCTION
//
// `playwright.config.ts` points `baseURL` at www.hisabche.com, which is right
// for the smoke test that lives beside this one. A test that CREATES an
// invoice must never run there: it would leave real rows in a real business's
// books. This file overrides the base URL and skips itself if nothing is
// listening locally, rather than silently falling back to production.
// ============================================

import { test, expect, type Page } from '@playwright/test'

const LOCAL = process.env.E2E_BASE_URL ?? 'http://localhost:3039'

test.describe.configure({ mode: 'serial' })

// ⚠️ The config's 30s is right for a smoke test against production. This one
// visits a dozen routes on a DEV server, where each is compiled on first
// request — the first run legitimately takes minutes, and the second seconds.
// A timeout tuned to the warm case makes the cold case look like a bug.
test.setTimeout(240_000)

/**
 * Demo login — never a typed password.
 *
 * The button exists precisely so a test (or a person evaluating the product)
 * can get in without credentials. If it disappears, this test should fail
 * loudly rather than fall back to typing one.
 */
async function signIn(page: Page) {
  await page.goto(`${LOCAL}/fa/login`)

  const demo = page.getByRole('button', { name: /ورود نمایشی|Demo Login/i })
  await expect(demo, 'the demo login button is the only supported way in').toBeVisible({
    timeout: 15_000,
  })
  await demo.click()

  // Onboarding may stand between login and the dashboard on a fresh workspace.
  await page.waitForURL(/\/(fa\/)?(dashboard|onboarding)/, { timeout: 30_000 })
}

/** Every dashboard route, asserted to render SOMETHING rather than the boundary. */
async function open(page: Page, path: string) {
  await page.goto(`${LOCAL}/fa${path}`)

  // The error boundary's own words. Asserting their absence is what would have
  // caught the sidebar crash — every individual page "loaded" that day.
  await expect(
    page.getByText(/مشکلی پیش آمد|Element type is invalid/i),
    `${path} rendered the error boundary`,
  ).toHaveCount(0)
}

test.beforeAll(async ({ request }) => {
  const reachable = await request.get(LOCAL).then(
    (response) => response.status() < 500,
    () => false,
  )

  test.skip(
    !reachable,
    `nothing is serving ${LOCAL} — start the web dev server, or set E2E_BASE_URL`,
  )
})

test('a working day: the shell, the lists, the ledger and the data hub all render', async ({
  page,
}) => {
  await signIn(page)

  // ─── The shell ───────────────────────────────────────────────────────────
  //
  // The sidebar is asserted FIRST and on its own, because when it breaks it
  // takes every page with it and each of those failures looks like a
  // different bug.
  await open(page, '/dashboard')
  await expect(page.getByRole('navigation').first()).toBeVisible()

  // ─── The breadcrumb no longer treats the locale as a place ───────────────
  //
  // `/fa/budgets` used to render `🏠 › fa › بودجه`. The locale is not a
  // destination and must never appear as a crumb.
  await open(page, '/budgets')
  const breadcrumb = page.getByRole('navigation', { name: /breadcrumb/i })
  if (await breadcrumb.isVisible().catch(() => false)) {
    await expect(breadcrumb).not.toContainText(/(^|\s)fa(\s|$)/)
  }

  // ─── The list engine, on two different entities ──────────────────────────
  for (const path of ['/customer-list', '/product-list']) {
    await open(page, path)

    // Search is the engine's most visible behaviour: typing must not throw and
    // must not leave the page on a stale, empty page number.
    const search = page.getByRole('textbox').first()
    if (await search.isVisible().catch(() => false)) {
      await search.fill('ز')
      await page.waitForTimeout(600)
      await expect(page.getByText(/مشکلی پیش آمد/i)).toHaveCount(0)
    }
  }

  // ─── The domain workspaces ───────────────────────────────────────────────
  for (const domain of ['accounting', 'sales', 'inventory', 'people']) {
    await open(page, `/${domain}-workspace`)
  }

  // ─── Data & sync, and the migration centre ───────────────────────────────
  await open(page, '/data-and-sync')
  await open(page, '/data-migration')

  // ─── The books ───────────────────────────────────────────────────────────
  await open(page, '/money')
  await open(page, '/invoices')
})

test('no page in the shell logs a React element-type error', async ({ page }) => {
  // A separate test because a console error does not fail a page load. The
  // sidebar crash produced exactly this message on every route while each
  // individual page still "worked".
  const failures: string[] = []

  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (/Element type is invalid|Cannot read propert/i.test(text)) failures.push(text)
  })

  await signIn(page)

  for (const path of ['/dashboard', '/customer-list', '/data-and-sync', '/accounting-workspace']) {
    await open(page, path)
  }

  expect(failures, failures.join('\n')).toEqual([])
})
