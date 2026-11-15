// ============================================
// apps/web/e2e/journey-industries.spec.ts
//
// V64 §2.8 BROWSER_JOURNEY, for EVERY trade: a new owner's first session in a real browser
// against the web app, the app's own backend and a REAL PostgreSQL —
//
//   signup → onboarding (THIS trade, business size, books currency) → the dashboard →
//   the trade's first product with an opening stock → a sale of 5 through the invoice
//   builder (cash, settled on the spot) → the invoice page says «paid» → the income
//   statement shows the sale.
//
// Every page it opens must render without the error boundary and without a raw i18n key
// on screen (`dashboard.salesChart.description` was printed on the dashboard; this check
// is how it was found).
//
// ---------------------------------------------------------------------------
// AGAINST LOCALHOST ONLY. Run with playwright.journey.config.ts, which starts
//   - the journey backend (backend/src/__tests__/helpers/journey-server.ts): the real
//     Fastify app, writes going WRITE-THROUGH to a real PostgreSQL carrying every
//     docs/ migration; Supabase Auth is a local stand-in; backend/.env is never read;
//   - the web app (`next dev`) pointed at that backend.
// If either is not reachable, every test SKIPS — it never falls back to production.
//
// PACING: the backend allows a signed-in person 100 requests a minute and one dashboard
// load is ~33 of them. The script waits like a person between pages instead of tripping
// the limit (a real finding, reported to the owner, not raised here).
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const WEB = process.env.JOURNEY_WEB_URL ?? 'http://localhost:3039'
const API = process.env.JOURNEY_API_URL ?? 'http://127.0.0.1:4100'

const REPO = join(__dirname, '..', '..', '..')

/** The 67 trades, read from the registry itself so a new trade cannot be left out. */
const TRADES: string[] = (() => {
  const source = readFileSync(
    join(REPO, 'packages', 'validation', 'src', 'schemas', 'industry-profiles.ts'),
    'utf8',
  )
  const block = source.slice(
    source.indexOf('export const INDUSTRY_KEYS = ['),
    source.indexOf('] as const', source.indexOf('export const INDUSTRY_KEYS = [')),
  )
  return [...block.matchAll(/'([a-zA-Z]+)'/g)].map((match) => match[1] ?? '')
})()

/** Every step of the first-visit tour, from the catalog the app itself reads. */
const GUIDE_STEPS: Array<{ stepId: string; routeId: string }> = (() => {
  const source = readFileSync(
    join(REPO, 'packages', 'ui-contract', 'src', 'guide-catalog.ts'),
    'utf8',
  )
  return [...source.matchAll(/id: '([^']+)',\s*routeId: '([^']+)'/g)].map((match) => ({
    stepId: match[1] ?? '',
    routeId: match[2] ?? '',
  }))
})()

/** Top-level message namespaces: a visible «namespace.word.word» is a raw key on screen. */
const NAMESPACES: string[] = Object.keys(
  JSON.parse(
    readFileSync(join(REPO, 'packages', 'i18n', 'messages', 'fa', 'common.json'), 'utf8'),
  ) as Record<string, unknown>,
)
const RAW_KEY = new RegExp(`\\b(?:${NAMESPACES.join('|')})\\.[a-z][a-zA-Z]+(?:\\.[a-zA-Z]+)*\\b`)

test.describe.configure({ mode: 'parallel' })
test.setTimeout(600_000)

test.beforeAll(async ({ request }) => {
  const web = await request.get(`${WEB}/fa/signup`).then(
    (response) => response.status() < 500,
    () => false,
  )
  const api = await request.get(`${API}/health`).then(
    (response) => response.status() < 500,
    () => false,
  )
  test.skip(
    !web || !api,
    `BLOCKED_EXTERNAL: start playwright.journey.config.ts (web ${web}, journey api ${api})`,
  )
})

/** A person, not a script: no more than ~50 API calls in any minute. */
function pacer(page: Page) {
  const calls: number[] = []
  page.on('request', (request) => {
    if (request.url().startsWith(API) && request.method() !== 'OPTIONS') calls.push(Date.now())
  })
  return async () => {
    for (;;) {
      const now = Date.now()
      while (calls.length && now - (calls[0] ?? now) > 60_000) calls.shift()
      if (calls.length < 50) return
      await page.waitForTimeout(2_000)
    }
  }
}

/** The page rendered: no error boundary, no raw message key. */
async function expectHealthy(page: Page, where: string) {
  await expect(
    page.getByText(/مشکلی پیش آمد|Element type is invalid/),
    `${where}: error boundary`,
  ).toHaveCount(0)
  const text = await page.locator('body').innerText()
  const raw = RAW_KEY.exec(text)
  expect(raw?.[0] ?? null, `${where}: a raw i18n key is on screen`).toBeNull()
}

async function firstDay(page: Page, trade: string, index: number) {
  const pace = pacer(page)
  // What went wrong, kept so a failed step can say it (console errors, refused API calls).
  const problems: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text().slice(0, 240)}`)
  })
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message.slice(0, 240)}`))
  page.on('response', async (response) => {
    if (!response.url().startsWith(API) || response.status() < 400) return
    const body = await response.text().catch(() => '')
    problems.push(
      `api ${response.status()} ${response.request().method()} ${response.url().slice(API.length)} ${body.slice(0, 240)}`,
    )
  })
  // One owner = one client address (signups are limited per address), added below CORS.
  const address = `10.77.${Math.floor(index / 250)}.${(index % 250) + 1}`
  await page.route(`${API}/**`, (route) =>
    route.continue({ headers: { ...route.request().headers(), 'x-forwarded-for': address } }),
  )

  // The first-visit guide can open at any moment and cover the page; a person closes it.
  await page.addLocatorHandler(page.locator('[data-guide-layer]'), async () => {
    // Escape is the guide's own way out (it listens for it); while a dialog is open the guide
    // is not shown at all (use-modal-open.ts), so this can only close the guide.
    await page.keyboard.press('Escape')
  })

  try {
    await steps()
  } catch (error) {
    // Every failure says what the browser and the API reported on the way.
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`${reason}
  — seen on the way: ${problems.slice(-10).join(' || ') || 'nothing'}`)
  }

  async function steps() {
    // 1. Signup.
    await page.goto(`${WEB}/fa/signup`, { waitUntil: 'networkidle', timeout: 180_000 })
    await page.fill('#signup-fullName', `مالک ${trade}`)
    await page.fill('#signup-businessName', `دکان ${trade}`)
    await page.fill('#signup-email', `${trade.toLowerCase()}-${Date.now()}@journey.test`)
    await page.fill('#signup-password', 'Journey-Pass-1234')
    const signedUp = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/auth/signup') && response.request().method() === 'POST',
    )
    await page.locator('form:has(#signup-email) button[type=submit]').click()
    const session = (await (await signedUp).json()) as { token?: string }
    expect(session.token, `${trade}: signup answered a session`).toBeTruthy()
    // This owner has walked the first-visit tour (55 steps, guide-catalog.ts): recorded through
    // the app's own route, exactly as the tour records it. The tour itself — and its clash with
    // dialogs — is proven by guide-waits-for-dialogs.test.ts, not by clicking it 67 times.
    for (let at = 0; at < GUIDE_STEPS.length; at += 100) {
      let status = 0
      for (let attempt = 0; attempt < 6; attempt++) {
        const seen = await page.request.post(`${API}/api/me/guide-progress`, {
          headers: { authorization: `Bearer ${session.token}`, 'x-forwarded-for': address },
          data: { steps: GUIDE_STEPS.slice(at, at + 100) },
        })
        status = seen.status()
        if (status !== 429) break
        await page.waitForTimeout(10_000)
      }
      expect(status, `${trade}: tour recorded as seen`).toBeLessThan(300)
    }
    await page.waitForURL(/\/fa\/onboarding/, { timeout: 60_000 })

    // 2. Onboarding: THIS trade, a business size, the books currency.
    await page.getByRole('button', { name: 'شروع' }).click()
    const tradeOption = page.locator(`[data-option-key="${trade}"]`).first()
    await tradeOption.scrollIntoViewIfNeeded()
    await tradeOption.click()
    for (let step = 0; step < 12 && /\/onboarding/.test(page.url()); step++) {
      for (const key of ['solo', 'AFN']) {
        const option = page.locator(`[data-option-key="${key}"]`).first()
        if ((await option.count()) && (await option.getAttribute('aria-checked')) !== 'true') {
          await option.click()
        }
      }
      const next = page.getByRole('button', { name: /^(بعدی|ورود به حسابچه)/ }).last()
      if ((await next.count()) && (await next.isEnabled())) await next.click()
      await page.waitForTimeout(1_500)
    }
    await page.waitForURL(/\/fa\/dashboard/, { timeout: 60_000 }).catch(() => {
      throw new Error(
        `${trade}: onboarding did not reach the dashboard — ${problems.slice(-8).join(' || ')}`,
      )
    })
    await page.waitForLoadState('networkidle')
    await expectHealthy(page, `${trade} dashboard`)

    // 3. The trade's first product, with an opening stock of 50.
    await pace()
    await page.goto(`${WEB}/fa/warehouse?add=true`)
    // By the form's own field ids, not its words: each trade's DNA renames them (a restaurant's
    // «نام کالا» reads «غذا»), and the dialog then has no accessible name at all.
    const dialog = page.getByRole('dialog').filter({ has: page.locator('#product-name') })
    await expect(dialog, `${trade}: the add-product form opens`).toBeVisible({ timeout: 60_000 })
    await dialog.locator('#product-name').fill(`کالای ${trade}`)
    await dialog.locator('#product-quantity').fill('50')
    await dialog.locator('#product-buy-price').fill('1000')
    await dialog.locator('#product-sell-price').fill('1400')
    await dialog.getByRole('button', { name: 'ذخیره' }).click()
    await expect(dialog, `${trade}: the product is saved`).toBeHidden({ timeout: 30_000 })
    await expectHealthy(page, `${trade} warehouse`)

    // 4. A sale of 5 through the invoice builder; no customer = cash, settled on the spot.
    await pace()
    await page.goto(`${WEB}/fa/invoices/new`)
    await page.getByRole('button', { name: 'انتخاب از انبار' }).first().click({ timeout: 60_000 })
    await page
      .getByRole('option', { name: new RegExp(`کالای ${trade}`) })
      .first()
      .click()
    await page.getByRole('textbox', { name: 'تعداد' }).first().fill('5')
    await expect(
      page.getByRole('row', { name: /۷٬۰۰۰/ }).first(),
      `${trade}: line total`,
    ).toBeVisible()
    await page.getByRole('button', { name: /مرحله بعدی/ }).click()
    await page.getByRole('button', { name: 'تأیید و ثبت فاکتور' }).click({ timeout: 30_000 })
    await page.waitForURL(/\/fa\/invoices\/[0-9a-f-]{36}/, { timeout: 60_000 })
    await expect(page.getByRole('heading', { name: /جزئیات فاکتور/ })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText('پرداخت شده').first(), `${trade}: the sale is paid`).toBeVisible()
    await expect(page.getByText('پرداخت کامل شده است'), `${trade}: payment recorded`).toBeVisible()
    await expectHealthy(page, `${trade} invoice`)

    // 5. The income statement shows the sale.
    await pace()
    await page.goto(`${WEB}/fa/accounting?tab=reports&view=incomeStatement`)
    await expect(
      page.getByText(/۷٬۰۰۰/).first(),
      `${trade}: revenue on the income statement`,
    ).toBeVisible({
      timeout: 60_000,
    })
    await expectHealthy(page, `${trade} income statement`)
  }
}

for (const [index, trade] of TRADES.entries()) {
  test(`${trade}: signup → onboarding → product → paid sale → income statement`, async ({
    page,
  }) => {
    await firstDay(page, trade, index)
  })
}
