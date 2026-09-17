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

describe('customer 360 phase 2 — activity, CRM core panel, history', () => {
  const panel = readFileSync(join(__dirname, '../components/ui/crm/customer-crm-panel.tsx'), 'utf8')
  const invoiceHooks = readFileSync(join(__dirname, '../../../api/src/hooks/invoices.ts'), 'utf8')

  it('activity and history come from the server', () => {
    expect(container).toContain("usePartyActivity('customer', customerId)")
    expect(container.replace(/\s+/g, '')).toContain("useRecordHistory('customer',customerId")
  })

  it('CRM tab uses the shared panel, which reads only the CRM core port', () => {
    expect(code(view)).toContain('<CustomerCrmPanel customerId={customer.id}')
    expect(code(panel)).toContain('useCustomerCrm(customerId)')
    expect(code(panel)).not.toMatch(/useInteractions|useOpportunities|\.reduce\(/)
  })

  it('invoice create/update/delete refresh the party summary', () => {
    expect(
      code(invoiceHooks).match(/queryKey: paymentKeys\.all/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(3)
  })

  it('crmPanel strings exist in every locale', () => {
    const keys = [...new Set([...panel.matchAll(/\bt\('([a-zA-Z]+)'/g)].map((m) => m[1]!))]
    expect(keys.length).toBeGreaterThan(10)
    for (const locale of ['fa', 'af', 'en']) {
      const bundle = JSON.parse(
        readFileSync(join(__dirname, `../../../i18n/messages/${locale}/common.json`), 'utf8'),
      )
      for (const key of keys)
        expect(bundle.crmPanel?.[key], `${locale}.crmPanel.${key}`).toBeTruthy()
    }
  })
})

describe('customer 360 phase 3 — credit, terms, linked supplier, documents', () => {
  const panel = readFileSync(join(dir, 'customer-profile-panel.tsx'), 'utf8')

  it('reads the Customer Profile Core, never totals money in the browser', () => {
    expect(code(panel)).toContain('useCustomerProfile(customerId)')
    expect(code(panel)).toContain('useCustomerDocuments(customerId)')
    expect(code(panel)).not.toMatch(/\.reduce\(/)
    expect(code(view)).toContain('<CustomerProfilePanel customerId={customer.id}')
  })

  it('says «not configured» instead of offering a form that cannot save', () => {
    expect(code(panel)).toContain("t('notConfigured')")
    expect(code(panel)).toContain('disabled={!data.configured')
  })

  it('customerProfile strings (incl. errors.*) exist in every locale', () => {
    const keys = [...new Set([...panel.matchAll(/\bt\('([a-zA-Z.]+)'\)/g)].map((m) => m[1]!))]
    const errorKeys = [...panel.matchAll(/'(CUSTOMER_[A-Z_]+)'/g)].map((m) => `errors.${m[1]}`)
    expect(keys.length).toBeGreaterThan(20)
    for (const locale of ['fa', 'af', 'en']) {
      const bundle = JSON.parse(
        readFileSync(join(__dirname, `../../../i18n/messages/${locale}/common.json`), 'utf8'),
      )
      for (const key of [...keys, ...errorKeys, 'errors.generic']) {
        const value = key
          .split('.')
          .reduce<unknown>(
            (node, part) => (node as Record<string, unknown> | undefined)?.[part],
            bundle.customerProfile,
          )
        expect(value, `${locale}.customerProfile.${key}`).toBeTruthy()
      }
      expect(bundle.customer360.tabAccount).toBeTruthy()
    }
  })
})

describe('customer 360 phase 4 — accounting view and insights', () => {
  const panels = readFileSync(join(dir, 'customer-analysis-panels.tsx'), 'utf8')
  const hooks = readFileSync(join(__dirname, '../../../api/src/hooks/customer-profile.ts'), 'utf8')
  const backendDomain = readFileSync(
    join(__dirname, '../../../../backend/src/services/customer-profile/customer-profile.domain.ts'),
    'utf8',
  )
  const serverCodes = [...backendDomain.matchAll(/\|\s*'([A-Z_]+)'/g)]
    .map((m) => m[1]!)
    .filter((c) => !c.startsWith('CUSTOMER_'))

  it('reads the server, adds nothing up in the browser, and is on the page', () => {
    expect(code(panels)).toContain('useCustomerAccounting(customerId)')
    expect(code(panels)).toContain('useCustomerInsights(customerId)')
    expect(code(panels)).not.toMatch(/\.reduce\(/)
    expect(code(view)).toContain('<CustomerAccountingPanel')
    expect(code(view)).toContain('<CustomerInsightsPanel')
  })

  it('every insight code the server can send has a title and body in every locale', () => {
    expect(serverCodes.length).toBe(9)
    for (const c of serverCodes) expect(hooks).toContain(`'${c}'`)
    for (const locale of ['fa', 'af', 'en']) {
      const bundle = JSON.parse(
        readFileSync(join(__dirname, `../../../i18n/messages/${locale}/common.json`), 'utf8'),
      )
      for (const c of serverCodes) {
        expect(bundle.customerAnalysis.insight[c]?.title, `${locale} ${c}.title`).toBeTruthy()
        expect(bundle.customerAnalysis.insight[c]?.body, `${locale} ${c}.body`).toBeTruthy()
      }
      const keys = [...new Set([...panels.matchAll(/\bt\('([a-zA-Z]+)'/g)].map((m) => m[1]!))]
      for (const key of keys)
        expect(bundle.customerAnalysis[key], `${locale}.customerAnalysis.${key}`).toBeTruthy()
      for (const kind of ['sale', 'purchase', 'payment_in', 'payment_out']) {
        expect(bundle.customer360.kind[kind], `${locale}.customer360.kind.${kind}`).toBeTruthy()
      }
      expect(bundle.customer360.tabAccounting && bundle.customer360.tabInsights).toBeTruthy()
    }
  })

  it('the page says the insights are rules, not an AI model', () => {
    expect(code(panels)).toContain("t('insightsDisclaimer'")
  })
})
