// ============================================
// Two regressions that reached production.
//
// 1. React #418 on the dashboard: the greeting read `new Date().getHours()`
//    during render. The server (UTC) and the browser (Kabul, +4:30) picked
//    different text, and React discarded the whole tree. The clock must be
//    read inside an effect only.
//
// 2. POST /api/payments 400: the invoice page sent `currency: null` (and other
//    null optional fields) — the server accepts a missing key, not `null`.
//    `display.currency` must only be sent behind a truthiness guard.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/.*/g, '')
}

const ui = join(__dirname, '..', 'components', 'ui')
const dashboard = code(join(ui, 'dashboard', 'dashboard-view.tsx'))
const invoice = code(join(ui, 'invoice-detail', 'containers', 'invoice-detail-container.tsx'))

function greetingBody(): string {
  const start = dashboard.indexOf('const Greeting = memo(')
  const end = dashboard.indexOf("Greeting.displayName = 'Greeting'")
  expect(start).toBeGreaterThanOrEqual(0)
  expect(end).toBeGreaterThan(start)
  return dashboard.slice(start, end)
}

describe('dashboard greeting does not read the clock during render', () => {
  it('⚠️ every `new Date()` in Greeting is inside a useEffect', () => {
    const withoutEffects = greetingBody().replace(/useEffect\(\(\) => \{[\s\S]*?\}, \[\]\)/g, '')
    expect(withoutEffects).not.toContain('new Date(')
    expect(withoutEffects).not.toContain('Date.now(')
  })

  it('the first paint uses the fixed `day` key', () => {
    expect(greetingBody()).toContain("h === null ? 'day'")
  })

  it('the `day` key exists in every locale', () => {
    for (const lang of ['fa', 'af', 'en']) {
      const messages = JSON.parse(
        readFileSync(
          join(__dirname, '..', '..', '..', 'i18n', 'messages', lang, 'common.json'),
          'utf8',
        ),
      ) as { dashboard?: { greeting?: Record<string, unknown> } }
      expect(typeof messages.dashboard?.greeting?.['day']).toBe('string')
    }
  })
})

describe('recording a payment from an invoice', () => {
  it('⚠️ never passes `display.currency` unguarded', () => {
    const uses = invoice.split('currency: display.currency').length - 1
    const guarded = invoice.split('display.currency ? { currency: display.currency }').length - 1
    expect(uses).toBeGreaterThan(0)
    expect(uses).toBe(guarded)
  })

  it('⚠️ a walk-in invoice sends a null party instead of refusing', () => {
    // An invoice with no customer is a cash sale; the server records its
    // payment with no party when the invoice is named. Refusing sent the user
    // looking for a customer field that does not exist on this page.
    expect(invoice).toContain(
      'const partyId = (isPurchase ? display.supplierId : display.customerId) || null',
    )
    expect(invoice).not.toContain('if (!partyId)')
    expect(invoice).toContain('allocations: [{ invoiceId: display.id, amount: input.amount }]')
  })

  it('the ledger retry and its reasons exist in every locale', () => {
    for (const lang of ['fa', 'af', 'en']) {
      const messages = JSON.parse(
        readFileSync(
          join(__dirname, '..', '..', '..', 'i18n', 'messages', lang, 'common.json'),
          'utf8',
        ),
      ) as { invoiceDetail?: Record<string, unknown> }
      for (const key of [
        'postToLedger',
        'recordMissingPayment',
        'ledgerMissingAccounts',
        'ledgerNotPostable',
      ]) {
        expect(typeof messages.invoiceDetail?.[key], lang + '.' + key).toBe('string')
      }
    }
  })
})
