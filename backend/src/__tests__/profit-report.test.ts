// Request #91 — profit & loss in the accounting core: per product, salaries,
// net profit %, till margins; insights reads the same rule.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  buildProfitReport,
  invoiceMargins,
  lineRevenues,
} from '../services/accounting/profit-report.domain'
import { paymentMargin } from '../services/pos/pos.domain'

const inv = (id: string, subtotal: number, discountTotal = 0, currency = 'AFN') => ({
  id,
  currency,
  subtotal,
  discountTotal,
})
const line = (
  invoiceId: string,
  productId: string | null,
  totalPrice: number,
  quantity = 1,
  productName = productId ?? 'x',
) => ({
  invoiceId,
  productId,
  productName,
  quantity,
  totalPrice,
})
const cost = (invoiceId: string, productId: string, amount: number, isEstimated = false) => ({
  invoiceId,
  productId,
  amount,
  isEstimated,
})

describe('line revenue', () => {
  it('shares the invoice discount by line value, excludes tax', () => {
    const lines = [line('i', 'a', 600), line('i', 'b', 400)]
    const revenues = lineRevenues(inv('i', 1000, 100), lines)
    expect([...revenues.values()]).toEqual([540, 360])
  })
  it('no subtotal on the header → the lines as they are', () => {
    expect([...lineRevenues(inv('i', 0), [line('i', 'a', 50)]).values()]).toEqual([50])
  })
})

describe('profit report', () => {
  const base = { from: '2026-09-01', to: '2026-09-30', currency: 'AFN' }

  it('per product: revenue, cost, profit, margin — sorted by profit', () => {
    const report = buildProfitReport({
      ...base,
      invoices: [inv('i1', 1000), inv('i2', 500)],
      lines: [line('i1', 'a', 1000, 10), line('i2', 'b', 500, 5)],
      consumptions: [cost('i1', 'a', 600), cost('i2', 'b', 450)],
      payrolls: [],
    })
    expect(report.products).toEqual([
      expect.objectContaining({
        productId: 'a',
        quantity: 10,
        revenue: 1000,
        cost: 600,
        profit: 400,
        marginPercent: 40,
        costMissing: false,
      }),
      expect.objectContaining({
        productId: 'b',
        revenue: 500,
        cost: 450,
        profit: 50,
        marginPercent: 10,
      }),
    ])
  })

  it('salaries are gross (base + bonus + overtime) and come off net profit', () => {
    const report = buildProfitReport({
      ...base,
      invoices: [inv('i1', 1000)],
      lines: [line('i1', 'a', 1000)],
      consumptions: [cost('i1', 'a', 600)],
      payrolls: [{ currency: 'AFN', baseSalary: 200, bonuses: 30, overtimeAmount: 20 }],
    })
    expect(report.totals).toEqual({
      revenue: 1000,
      cost: 600,
      grossProfit: 400,
      salaries: 250,
      netProfit: 150,
      netMarginPercent: 15,
      invoiceCount: 1,
      payrollCount: 1,
    })
  })

  it('a sale with no recorded cost is flagged, not shown as pure profit silently', () => {
    const report = buildProfitReport({
      ...base,
      invoices: [inv('i1', 100)],
      lines: [line('i1', 'a', 100)],
      consumptions: [],
      payrolls: [],
    })
    expect(report.products[0]).toMatchObject({ cost: 0, costMissing: true })
  })

  it('two lines of one product on one invoice count its cost once', () => {
    const report = buildProfitReport({
      ...base,
      invoices: [inv('i1', 300)],
      lines: [line('i1', 'a', 100), line('i1', 'a', 200)],
      consumptions: [cost('i1', 'a', 120)],
      payrolls: [],
    })
    expect(report.products[0]).toMatchObject({ revenue: 300, cost: 120, quantity: 2 })
  })

  it('other currencies are counted and reported, never converted', () => {
    const report = buildProfitReport({
      ...base,
      invoices: [inv('i1', 100), inv('i2', 999, 0, 'USD')],
      lines: [line('i1', 'a', 100), line('i2', 'a', 999)],
      consumptions: [cost('i2', 'a', 1)],
      payrolls: [{ currency: 'USD', baseSalary: 5, bonuses: 0, overtimeAmount: 0 }],
    })
    expect(report.totals.revenue).toBe(100)
    expect(report.totals.salaries).toBe(0)
    expect(report.otherCurrencies).toEqual([{ currency: 'USD', invoices: 1, payrolls: 1 }])
  })

  it('no revenue → margin null, not NaN or 0%', () => {
    const report = buildProfitReport({
      ...base,
      invoices: [],
      lines: [],
      consumptions: [],
      payrolls: [{ currency: 'AFN', baseSalary: 10, bonuses: 0, overtimeAmount: 0 }],
    })
    expect(report.totals).toMatchObject({ netProfit: -10, netMarginPercent: null })
  })
})

describe('till margins', () => {
  const margins = invoiceMargins(
    [inv('i1', 1000), inv('i2', 1000)],
    [line('i1', 'a', 1000), line('i2', 'b', 1000)],
    [cost('i1', 'a', 750)],
  )
  it('per invoice', () => {
    expect(margins.get('i1')).toEqual({
      revenue: 1000,
      cost: 750,
      marginPercent: 25,
      costMissing: false,
    })
    expect(margins.get('i2')?.costMissing).toBe(true)
  })
  it('a payment is weighted over its invoices; unknown cost → no figure', () => {
    expect(paymentMargin(['i1'], margins)).toBe(25)
    expect(paymentMargin(['i1', 'i2'], margins)).toBeNull()
    expect(paymentMargin([], margins)).toBeNull()
  })
})

describe('one system: the accounting core owns the rule', () => {
  const src = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')
  it('insights reads per-product profit from the accounting core', () => {
    const insights = src('services/insights/insights.service.ts')
    const body = insights.slice(insights.indexOf('private async profitByProduct'))
    expect(body.slice(0, 300)).toContain('new AccountingService().getProductProfits(ctx, from, to)')
  })
  it('the till margin comes from the accounting core', () => {
    expect(src('services/pos/pos.service.ts')).toContain(
      'new AccountingService().getInvoiceMargins(',
    )
  })
  it('the report reads every page', () => {
    const repo = src('services/accounting/accounting.repository.ts')
    const body = repo.slice(repo.indexOf('// ─── Profit report (request #91)'))
    expect(body).not.toMatch(/\.limit\(/)
    expect(body).toContain('.range(from, to)')
  })
})
