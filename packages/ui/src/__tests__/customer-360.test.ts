// Customer 360 (/customers/[id]). The page used to find the customer in the
// first 50 customers of the workspace and total the first 200 invoices of the
// whole workspace in the browser, labelling every amount «AFN».
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const dir = join(__dirname, '../components/ui/customers')
const container = readFileSync(join(dir, 'containers/customer-detail-container.tsx'), 'utf8')
const view = readFileSync(join(dir, 'customer-detail-view.tsx'), 'utf8')
const code = (s: string) => s.replace(/^\s*\/\/.*$/gm, '')

describe('customer 360 reads authoritative data', () => {
  it('fetches the customer by id, not from a capped list', () => {
    expect(code(container)).toContain('useCustomer(customerId)')
    expect(code(container)).not.toContain('useCustomers(')
    expect(code(container)).not.toMatch(/limit:\s*(50|200)\b/)
  })

  it('money figures come from the server summary and ledger', () => {
    expect(container).toContain("usePartySummary('customer', customerId)")
    expect(container).toContain("usePartyLedger('customer', customerId)")
    // No browser-side totalling of invoices.
    expect(code(container)).not.toMatch(/\.reduce\(/)
  })

  it('invoices are filtered by this customer on the server and paginated', () => {
    expect(code(container)).toMatch(/useInvoices\(\{[\s\S]*customerId,[\s\S]*\}\)/)
  })

  it('no hardcoded currency', () => {
    expect(code(view)).not.toMatch(/\bAFN\b/)
  })
})

describe('customer360 strings exist in every locale', () => {
  const keys = [...new Set([...view.matchAll(/\bt\('([a-zA-Z0-9]+)'/g)].map((m) => m[1]!))]
  for (const locale of ['fa', 'af', 'en']) {
    it(locale, () => {
      const bundle = JSON.parse(
        readFileSync(join(__dirname, '../../../i18n/messages', locale, 'common.json'), 'utf8'),
      ) as { customer360: Record<string, unknown> }
      expect(keys.length).toBeGreaterThan(20)
      expect(keys.filter((k) => bundle.customer360[k] === undefined)).toEqual([])
      for (const kind of ['sale', 'purchase', 'payment_in', 'payment_out', 'return'])
        expect((bundle.customer360['kind'] as Record<string, string>)[kind]).toBeTruthy()
    })
  }
})
