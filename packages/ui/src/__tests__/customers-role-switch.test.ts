// ============================================
// همه / مشتری / تأمین‌کننده lives under the hub's tabs, as the ONE branch
// switch of the customers tab — not as a second, hand-drawn control inside the
// list. And the per-currency totals of a statement come from one function, so
// the screen, the print and the CSV cannot disagree.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { getStatementTotals } from '../lib/customers/statement-totals'

const root = join(__dirname, '..')

const src = (rel: string) =>
  readFileSync(join(root, rel), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')

const messages = (lang: string) =>
  JSON.parse(
    readFileSync(join(root, '../../i18n/messages', lang, 'common.json'), 'utf8'),
  ) as Record<string, Record<string, unknown>>

const constList = (source: string, name: string): string[] => {
  const start = source.indexOf(`export const ${name} = [`)
  expect(start).toBeGreaterThan(-1)
  const body = source.slice(start, source.indexOf(']', start))
  return [...body.matchAll(/'([A-Za-z]+)'/g)].map((match) => String(match[1]))
}

describe('the party role switch belongs to the hub', () => {
  const hub = src('components/ui/customers/containers/customers-hub-container.tsx')
  const view = src('components/ui/customers/customer-view.tsx')
  const container = src('components/ui/customers/containers/customer-container.tsx')

  it('the list no longer draws its own role control', () => {
    expect(view).not.toContain('PartyRoleFilter')
    expect(view).not.toContain('role="radiogroup"')
    expect(view).not.toContain('onRoleFilterChange')
  })

  it('the hub draws it with the shared switch, on the branch, from the URL', () => {
    expect(hub).toContain('useHubSection(CUSTOMER_ROLES)')
    expect(hub).toContain("<SegmentedControl branch label={t('customers.role.label')}")
    expect(hub).toContain('<CustomersContainer role={role} />')
  })

  it('the role is asked of the server, never filtered on the client', () => {
    expect(container).toContain("useCustomersData(role === 'all' ? {} : { role })")
    expect(container).not.toContain("useState<'all' | 'buyer' | 'seller'>")
  })

  it('⚠️ roles and outreach sections share ?view= and so must never overlap', () => {
    // Both tabs read the same query parameter. A value one tab wrote is
    // unknown to the other, which falls back to its first option — that only
    // holds while the two lists have nothing in common.
    const roles = constList(hub, 'CUSTOMER_ROLES')
    const sections = constList(hub, 'OUTREACH_SECTIONS')
    expect(roles).toEqual(['all', 'buyer', 'seller'])
    expect(sections.length).toBeGreaterThan(0)
    expect(roles.filter((role) => sections.includes(role))).toEqual([])
  })

  it.each(['fa', 'af', 'en'])('every key the change uses exists in %s', (lang) => {
    const all = messages(lang)
    const customers = all.customers ?? {}
    const role = (customers.role ?? {}) as Record<string, unknown>
    for (const key of ['all', 'buyer', 'seller', 'both', 'label']) {
      expect(typeof role[key], `customers.role.${key}`).toBe('string')
    }
    for (const key of [
      'addSupplier',
      'addCustomer',
      'error_CUSTOMER_DECLARED_ROLE_SCHEMA_REQUIRED',
      'error_CUSTOMER_DECLARED_ROLE_INVALID',
    ]) {
      expect(typeof customers[key], `customers.${key}`).toBe('string')
    }
    const c360 = all.customer360 ?? {}
    for (const key of [
      'totalsTitle',
      'colCurrency',
      'totalSales',
      'totalPurchases',
      'totalReceived',
      'totalPaid',
      'colBalance',
    ]) {
      expect(typeof c360[key], `customer360.${key}`).toBe('string')
    }
  })
})

describe('statement totals: one function, one row per currency', () => {
  it('screen and CSV both read getStatementTotals and neither filters byCurrency itself', () => {
    const view = src('components/ui/customers/customer-detail-view.tsx')
    const container = src('components/ui/customers/containers/customer-detail-container.tsx')
    expect(view).toContain('getStatementTotals(props.summary, ledger)')
    expect(container).toContain('getStatementTotals(summary, ledger)')
    expect(container).not.toContain('byCurrency')
    expect(view).toContain('tableId="customer-statement-totals"')
  })

  it('⚠️ three currencies stay three rows; no figure adds two of them', () => {
    const totals = getStatementTotals({
      bookCurrency: 'AFN',
      byCurrency: [
        // Sold 1,000, received 400 → owes 600.
        row('AFN', { totalSales: 1000, totalReceived: 400, netBalance: 600 }),
        // A payment and no invoice at all → we owe them 50.
        row('USD', { totalReceived: 50, netBalance: -50 }),
        // Bought 7 grams, paid 2 → we owe 5.
        row('XAU', { totalPurchases: 7, totalPaid: 2, netBalance: -5 }),
      ],
    })

    expect(totals.map((line) => line.currency)).toEqual(['AFN', 'USD', 'XAU'])
    expect(totals.map((line) => line.netBalance)).toEqual([600, -50, -5])
    expect(totals[1]).toMatchObject({ totalSales: 0, totalReceived: 50 })

    // Every sum that would mix two currencies, by hand: none may appear.
    const mixed = [1050, 1007, 57, 1057, 450, 402, 52, 452, 650, 595, 545, 550, -55]
    const shown = totals.flatMap((line) => [
      line.totalSales,
      line.totalPurchases,
      line.totalReceived,
      line.totalPaid,
      line.netBalance,
    ])
    for (const value of mixed) expect(shown).not.toContain(value)
    expect(shown.length).toBe(15)
  })

  it('a figure the server did not send stays unknown, it does not become 0', () => {
    const [only] = getStatementTotals({
      byCurrency: [{ currency: 'AFN', totalSales: 10, netBalance: null }],
    })
    expect(only?.netBalance).toBeNull()
    expect(only?.totalPaid).toBeNull()
  })
})

function row(currency: string, part: Record<string, number>) {
  return {
    currency,
    totalSales: 0,
    totalPurchases: 0,
    totalReceived: 0,
    totalPaid: 0,
    openingBalance: 0,
    netBalance: 0,
    ...part,
  }
}
