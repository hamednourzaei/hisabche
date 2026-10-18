// dashboard-fx-01 in the service: v2 first, v1 only while v2 is not installed;
// with v2 the headline is the converted `books` row, and how many invoices
// could not be converted reaches the response.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls: string[] = []
let installed = new Set<string>()
let payload: unknown = null

vi.mock('../db', () => ({
  supabase: {
    rpc: async (fn: string) => {
      calls.push(fn)
      if (!installed.has(fn)) return { data: null, error: { code: 'PGRST202' } }
      return { data: payload, error: null }
    },
  },
}))

const { dashboardKpisFromAggregate, fetchDashboardAggregate, fetchSalesAggregate } =
  await import('../services/aggregates/analytics-aggregates')

const row = (currency: string, total: number) => ({
  currency,
  total_sales: total,
  total_purchases: 0,
  customer_debt: 0,
  supplier_payable: 0,
  today_sales: total,
  today_invoices: 1,
  monthly_revenue: total,
  prev_month_revenue: 0,
  pending_payments: 0,
  pending_payments_count: 0,
  purchase_count: 0,
})

beforeEach(() => {
  calls.length = 0
  installed = new Set()
})

describe('which function is read', () => {
  it('v2 when installed — with the books currency', async () => {
    installed = new Set(['analytics_dashboard_kpis_v2'])
    payload = { currencies: [], active_customers: 0, low_stock_alerts: 0, warehouse_value: 0 }
    await fetchDashboardAggregate('ws', 'x', new Date(), new Date(), 'AFN')
    expect(calls).toEqual(['analytics_dashboard_kpis_v2'])
  })

  it('v1 only when v2 is missing (migration not run, or rolled back)', async () => {
    installed = new Set(['analytics_dashboard_kpis', 'analytics_sales_summary'])
    payload = { currencies: [], active_customers: 0, low_stock_alerts: 0, warehouse_value: 0 }
    await fetchDashboardAggregate('ws', 'x', new Date(), new Date(), 'AFN')
    expect(calls).toEqual(['analytics_dashboard_kpis_v2', 'analytics_dashboard_kpis'])
  })

  it('the sales summary the same way', async () => {
    installed = new Set(['analytics_sales_summary'])
    payload = null
    await fetchSalesAggregate('ws', 'a', 'b', new Date(), 'AFN').catch(() => null)
    expect(calls).toEqual(['analytics_sales_summary_v2', 'analytics_sales_summary'])
  })
})

describe('the headline', () => {
  const currencies = [row('AFN', 300_012_740), row('USD', 2_307_772.3)]

  it('v2: the converted books row — 450M, one invoice not convertible', () => {
    const out = dashboardKpisFromAggregate(
      {
        currencies,
        books: { ...row('AFN', 450_012_739.5), unconverted_count: 1 },
        active_customers: 1,
        low_stock_alerts: 0,
        warehouse_value: 0,
      } as never,
      'AFN',
    )
    expect(out.totalSales).toBe(450_012_739.5)
    expect(out.todaySales).toBe(450_012_739.5)
    expect(out.convertedToBooks).toBe(true)
    expect(out.unconvertedInvoices).toBe(1)
    // the raw buckets stay what they are
    expect(out.byCurrency.USD!.totalSales).toBe(2_307_772.3)
  })

  it('v1: books currency only, never the dollars added raw', () => {
    const out = dashboardKpisFromAggregate(
      { currencies, active_customers: 1, low_stock_alerts: 0, warehouse_value: 0 },
      'AFN',
    )
    expect(out.totalSales).toBe(300_012_740)
    expect(out.convertedToBooks).toBe(false)
  })
})
