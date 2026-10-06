// ============================================
// The dashboard's aggregate tells a person only what their role includes.
//
// What can go wrong: a storekeeper with no invoices being read total sales by
// the home screen; a hidden figure sent as a bare zero («you sold nothing»); one
// member's masked answer cached for the whole business and served to the owner
// — or the owner's full answer served to the storekeeper; the sales series and
// the suggestions staying open to anybody in the business.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { capabilitiesOf, customRoleAccess } from '../services/authorization/authorization.domain'
import {
  DASHBOARD_FIGURE_GROUPS,
  DASHBOARD_GROUP_FIELDS,
  hiddenDashboardGroups,
  maskDashboardKpis,
} from '../services/analytics/dashboard-visibility.domain'

const ROOT = join(__dirname, '..', '..', '..')
const code = (...parts: string[]) =>
  readFileSync(join(ROOT, ...parts), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')

const FULL = {
  todaySales: 100,
  todayInvoices: 2,
  monthlyRevenue: 900,
  monthlyGrowth: 12,
  pendingPayments: 40,
  pendingPaymentsCount: 1,
  activeCustomers: 7,
  customerGrowth: 3,
  lowStockAlerts: 4,
  totalSales: 5000,
  customerDebt: 300,
  warehouseValue: 80_000,
  byCurrency: { AFN: { totalSales: 5000 } },
  currencies: ['AFN'],
  mixedCurrency: false,
}

const holder = (capabilities: Iterable<string>) => {
  const set = new Set(capabilities)
  return (capability: string) => set.has(capability)
}

describe('who is told what', () => {
  it('the owner is told everything', () => {
    expect(hiddenDashboardGroups(holder(capabilitiesOf('owner')))).toEqual([])
  })

  it('an employee sees sales and customers, but not the stock at COST', () => {
    // The product page already keeps the buy price from this role.
    expect(hiddenDashboardGroups(holder(capabilitiesOf('seller')))).toEqual(['stockValue'])
  })

  it('a storekeeper role with no invoices is not read the sales', () => {
    const keeper = customRoleAccess(['inventory.read', 'product.read', 'product.write'])
    const hidden = hiddenDashboardGroups(holder(keeper.capabilities))
    expect(hidden).toContain('sales')
    expect(hidden).toContain('customers')
    expect(hidden).not.toContain('stock')
  })
})

describe('what a hidden figure becomes', () => {
  it('zero AND named — never a bare zero', () => {
    const masked = maskDashboardKpis(FULL, ['sales', 'customers'])
    for (const field of [...DASHBOARD_GROUP_FIELDS.sales, ...DASHBOARD_GROUP_FIELDS.customers]) {
      expect((masked as Record<string, unknown>)[field], field).toBe(0)
    }
    expect(masked.hidden).toEqual(['sales', 'customers'])
    // What they may see is untouched.
    expect(masked.lowStockAlerts).toBe(4)
    expect(masked.warehouseValue).toBe(80_000)
  })

  it('the per-currency breakdown is money: it goes with sales or customers', () => {
    expect(maskDashboardKpis(FULL, ['sales']).byCurrency).toEqual({})
    expect(maskDashboardKpis(FULL, ['customers']).currencies).toEqual([])
    expect(maskDashboardKpis(FULL, ['stockValue']).byCurrency).toEqual(FULL.byCurrency)
  })

  it('nothing hidden changes nothing — and the shared computation is not mutated', () => {
    const masked = maskDashboardKpis(FULL, [])
    expect(masked).toMatchObject(FULL)
    maskDashboardKpis(FULL, ['sales'])
    expect(FULL.totalSales).toBe(5000)
  })

  it('every numeric figure of the answer belongs to a group', () => {
    const grouped = new Set(
      DASHBOARD_FIGURE_GROUPS.flatMap((group) => DASHBOARD_GROUP_FIELDS[group]),
    )
    const numeric = Object.entries(FULL)
      .filter(([, value]) => typeof value === 'number')
      .map(([key]) => key)
    // A figure added to the answer and forgotten here would be told to everybody.
    expect(numeric.filter((key) => !grouped.has(key))).toEqual([])
  })
})

describe('the routes', () => {
  const analytics = code('backend', 'src', 'routes', 'analytics.routes.ts')

  it('the aggregate is masked per person and cached per MEMBER', () => {
    const route = analytics.slice(
      analytics.indexOf("'/api/analytics/dashboard'"),
      analytics.indexOf("'/api/analytics/sales'"),
    )
    expect(route).toContain("cacheMiddleware({ scope: 'member', ttl: 30, keyPrefix: 'dashboard' })")
    expect(route).toContain(
      'hiddenDashboardGroups((capability) => holds(request.tenancy, capability))',
    )
  })

  it('the sales series needs the invoices', () => {
    const route = analytics.slice(analytics.indexOf("'/api/analytics/sales'"))
    expect(route.slice(0, 260)).toContain("requireCapability('invoice.read')")
  })

  it('the suggestions need everything they are written from', () => {
    const ai = code('backend', 'src', 'routes', 'ai.routes.ts')
    const route = ai.slice(ai.indexOf("'/api/ai/insights'")).slice(0, 420)
    for (const capability of ['invoice.read', 'customer.read', 'product.read']) {
      expect(route, capability).toContain(`requireCapability('${capability}')`)
    }
  })
})
