// ============================================
// The orders screen and the storefront panel.
//
//   · The buttons offered from each state are exactly the moves the database
//     allows (transition_sales_order) — a button the database refuses is a
//     promise the screen cannot keep, and a missing one hides a real move.
//   · Every error code the lifecycle can answer with has a sentence in fa, af
//     and en (t() throws on a missing key).
//   · The screen is reachable on every host, hidden from crawlers, linked
//     from settings — and its views take props only.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ORDER_ERROR_CODES, ORDER_STATUSES } from '@hisabche/validation'

import { ACTIONS_FROM } from '../components/ui/orders/orders-view'

const ROOT = join(__dirname, '../../../..')
const LOCALES = ['fa', 'af', 'en'] as const
const catalog = (lang: string) =>
  JSON.parse(readFileSync(join(ROOT, 'packages/i18n/messages', lang, 'common.json'), 'utf8')) as {
    orders: Record<string, Record<string, string>>
    storefront: Record<string, string>
    settings: Record<string, string>
  }
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read = (p: string) => strip(readFileSync(join(ROOT, p), 'utf8'))

describe('the buttons are the lifecycle’s', () => {
  const sql = readFileSync(join(ROOT, 'docs/developer-platform-03-commerce-migration.sql'), 'utf8')
  // (v_from = 'pending' AND p_to IN ('confirmed', 'cancelled'))
  const allowed = new Map<string, string[]>()
  for (const m of sql.matchAll(/\(v_from = '(\w+)'\s+AND p_to IN \(([^)]*)\)\)/g)) {
    allowed.set(
      m[1]!,
      [...m[2]!.matchAll(/'(\w+)'/g)].map((x) => x[1]!),
    )
  }
  const ACTION_TO: Record<string, string> = {
    confirm: 'confirmed',
    cancel: 'cancelled',
    invoice: 'invoiced',
    fulfill: 'fulfilled',
  }

  it('found the transition table', () => {
    expect(allowed.get('pending')).toEqual(['confirmed', 'cancelled'])
  })

  it.each([...ORDER_STATUSES])('from %s', (status) => {
    const offered = ACTIONS_FROM[status].map((a) => ACTION_TO[a])
    // «paid» is never a button, and paid → invoiced happens only by reversal.
    const expected = (allowed.get(status) ?? []).filter(
      (to) => to !== 'paid' && !(status === 'paid' && to === 'invoiced'),
    )
    expect(offered.sort()).toEqual(expected.sort())
  })
})

describe.each(LOCALES)('%s has every sentence', (lang) => {
  const c = catalog(lang)
  it.each([...ORDER_ERROR_CODES])('orders.error.%s', (code) =>
    expect(c.orders.error?.[code]).toBeTruthy(),
  )
  it.each([...ORDER_STATUSES])('orders.status.%s', (s) => expect(c.orders.status?.[s]).toBeTruthy())
  it.each(['website', 'api', 'dashboard'])('orders.source.%s', (s) =>
    expect(c.orders.source?.[s]).toBeTruthy(),
  )
  it.each(['confirm', 'cancel', 'fulfill', 'invoice'])('orders.action.%s', (a) =>
    expect(c.orders.action?.[a]).toBeTruthy(),
  )
  it('the storefront messages the validation contract names', () => {
    expect(c.storefront.originInvalid).toBeTruthy()
    expect(c.storefront.phoneInvalid).toBeTruthy()
    expect(c.settings.ordersLink).toBeTruthy()
  })
})

describe('wiring', () => {
  it('reachable on every host, hidden from crawlers, linked from settings', () => {
    expect(read('apps/web/app/[lang]/(dashboard)/orders/page.tsx')).toContain('<OrdersContainer />')
    expect(read('packages/app-shell/src/app/app.tsx')).toContain(
      "{ path: 'orders', element: <OrdersPage /> }",
    )
    expect(readFileSync(join(ROOT, 'apps/web/app/robots.ts'), 'utf8')).toContain("'/*/orders'")
    expect(read('packages/ui/src/components/ui/settings/settings-page.tsx')).toContain(
      "localizePath('/orders', lang)",
    )
  })

  it('the views take props only', () => {
    for (const file of [
      'packages/ui/src/components/ui/orders/orders-view.tsx',
      'packages/ui/src/components/ui/developers/storefront-panel.tsx',
    ]) {
      expect(read(file)).not.toMatch(/^import \{[^}]*\} from '@hisabche\/api'/m)
    }
  })

  it('only listed error codes are translated — anything else is read as the server wrote it', () => {
    const container = read('packages/ui/src/components/ui/orders/containers/orders-container.tsx')
    expect(container).toContain('(ORDER_ERROR_CODES as readonly string[]).includes(code)')
  })

  it('503 and 403 are their own sentences on the orders screen', () => {
    const view = read('packages/ui/src/components/ui/orders/orders-view.tsx')
    expect(view).toContain("t('orders.notConfigured')")
    expect(view).toContain("t('orders.forbidden')")
  })
})
