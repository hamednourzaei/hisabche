// ============================================
// The profit report — revenue, cost, and what happens when the cost is unknown.
//
// ⚠️ WHY THIS FILE EXISTS. Phase 2 of the offline edition moved the rule out of
// `backend/src/services/accounting/profit-report.domain.ts` so the device can
// state what it earned with no server to ask. A report that disagrees with the
// server is worse than no report: the shopkeeper cannot tell which one is lying.
//
// ⚠️ THE MOST IMPORTANT CASE IN THIS FILE IS THE ONE WHERE THERE IS NO ANSWER.
// «Unknown is not zero» (CLAUDE.md §3, INV-000077): a sale whose goods have no
// recorded cost must show a null profit, never its full revenue as profit.
//
// ⚠️ EVERY MONEY FIXTURE USES TWO CURRENCIES (AFN with no minor unit, USD with
// two), and the expected figures are asserted exactly — never with a tolerance.
// ============================================

import { describe, expect, it } from 'vitest'

import { minor, round2 } from '../schemas/money'
import {
  buildProfitReport,
  invoiceMargins,
  isCostDeterminate,
  lineRevenues,
  restateAtRates,
  type CostStatus,
  type ProfitInvoice,
  type ProfitLine,
} from '../schemas/profit-report.domain'

const inv = (id: string, subtotal: number, discountTotal = 0, currency = 'AFN'): ProfitInvoice => ({
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
): ProfitLine => ({ invoiceId, productId, productName, quantity, totalPrice })

const cost = (
  invoiceId: string | null,
  productId: string,
  amount: number,
  isEstimated = false,
  quantity?: number,
) => ({ invoiceId, productId, amount, isEstimated, quantity })

describe('what a line earned: the invoice discount, shared by value', () => {
  it('shares the discount over the lines and never over the tax', () => {
    const lines = [line('i', 'a', 600), line('i', 'b', 400)]
    expect([...lineRevenues(inv('i', 1000, 100), lines).values()]).toEqual([540, 360])
  })

  it('is the same arithmetic with a decimal currency', () => {
    // ⚠️ The share is NOT rounded here: rounding happens once, per product row,
    // in `buildProfitReport`. `40 × (90.45 / 100)` is `36.18000000000001` in
    // IEEE-754, and a test that asserted `36.18` would be asserting a rounding
    // this function deliberately does not do. What must be true is that the
    // share rounds to the right minor unit — and that nothing is lost on the
    // way, so the two shares still add up to the invoice's net sales.
    const lines = [line('i', 'a', 60), line('i', 'b', 40)]
    const values = [...lineRevenues(inv('i', 100.5, 10.05, 'USD'), lines).values()]
    expect(values.map(round2)).toEqual([54.27, 36.18])
    expect(minor(values[0]! + values[1]!)).toBe(minor(90.45))
  })

  it('a header with no subtotal (old rows) leaves the lines as they are', () => {
    expect([...lineRevenues(inv('i', 0), [line('i', 'a', 50)]).values()]).toEqual([50])
  })

  it('an invoice of zero-value lines earns zero, not NaN', () => {
    expect([...lineRevenues(inv('i', 0), [line('i', 'a', 0)]).values()]).toEqual([0])
  })
})

describe('the report, product by product', () => {
  const base = { from: '2026-09-01', to: '2026-09-30', currency: 'AFN' }

  it('reaches revenue, cost, profit and margin (AFN)', () => {
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
        costStatus: 'known',
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

  it('reaches the same figures, exactly, in a decimal currency (USD)', () => {
    const report = buildProfitReport({
      ...base,
      currency: 'USD',
      invoices: [inv('i1', 100.5, 0, 'USD')],
      lines: [line('i1', 'a', 100.5, 3)],
      consumptions: [cost('i1', 'a', 60.25)],
      payrolls: [],
    })
    const row = report.products[0]
    // 100.50 − 60.25 = 40.25, and 40.25 / 100.50 = 40.0497…% → 40.05
    expect(row).toMatchObject({ revenue: 100.5, cost: 60.25, profit: 40.25, marginPercent: 40.05 })
    expect(report.totals.revenue).toBe(100.5)
    expect(report.totals.netProfit).toBe(40.25)
  })

  it('a sale whose goods were never costed has NO profit — not all of it', () => {
    const report = buildProfitReport({
      ...base,
      invoices: [inv('i1', 100)],
      lines: [line('i1', 'a', 100)],
      consumptions: [],
      payrolls: [],
    })
    expect(report.products[0]).toMatchObject({
      cost: 0,
      costStatus: 'unknown',
      costMissing: true,
      profit: null,
      marginPercent: null,
    })
    expect(report.totals).toMatchObject({
      grossProfit: null,
      netProfit: null,
      netMarginPercent: null,
      costStatus: 'unknown',
      uncostedRevenue: 100,
      // ⚠️ The one figure that IS real, and it exists so the screen can say
      // «this much of the revenue has no cost behind it» instead of showing 0.
      knownGrossProfit: 0,
    })
  })

  it('the same refusal in a decimal currency (USD)', () => {
    const report = buildProfitReport({
      ...base,
      currency: 'USD',
      invoices: [inv('i1', 100.5, 0, 'USD')],
      lines: [line('i1', 'a', 100.5)],
      consumptions: [],
      payrolls: [],
    })
    expect(report.products[0]).toMatchObject({ profit: null, marginPercent: null })
    expect(report.totals.grossProfit).toBeNull()
  })

  it('a cost estimated from the last price paid is determinate, and says it was estimated', () => {
    const report = buildProfitReport({
      ...base,
      invoices: [inv('i1', 100)],
      lines: [line('i1', 'a', 100)],
      consumptions: [cost('i1', 'a', 70, true)],
      payrolls: [],
    })
    expect(report.products[0]).toMatchObject({
      profit: 30,
      costStatus: 'estimated',
      costMissing: false,
      costEstimated: true,
    })
    expect(report.totals.costStatus).toBe('estimated')
  })

  it('a cost that covers fewer units than were sold is partial, and no total is claimed', () => {
    const report = buildProfitReport({
      ...base,
      invoices: [inv('i1', 1000), inv('i2', 500)],
      lines: [line('i1', 'a', 1000, 10), line('i2', 'b', 500, 5)],
      // Product a was only paid for on six of its ten units; b was costed.
      consumptions: [cost('i1', 'a', 600, false, 6), cost('i2', 'b', 300)],
      payrolls: [],
    })
    expect(report.products[1]).toMatchObject({
      productId: 'a',
      quantity: 10,
      uncostedQuantity: 4,
      costStatus: 'partial',
      costMissing: true,
      profit: null,
    })
    expect(report.totals).toMatchObject({
      costStatus: 'partial',
      grossProfit: null,
      uncostedRevenue: 1000,
    })
    // ⚠️ Still reported: the profit of the part that IS costed is a real figure,
    // and hiding it would throw away the only true number in the report.
    expect(report.totals.knownGrossProfit).toBe(200)
    // A row whose profit is unknown sorts last, in the order of what was sold.
    expect(report.products.map((row) => row.productId)).toEqual(['b', 'a'])
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

  it('a text line has no cost to be missing — `none`, not `unknown`', () => {
    const report = buildProfitReport({
      ...base,
      invoices: [inv('i1', 500)],
      lines: [line('i1', null, 500, 1, 'Delivery')],
      consumptions: [],
      payrolls: [],
    })
    expect(report.products[0]).toMatchObject({
      costStatus: 'none',
      costMissing: false,
      profit: 500,
    })
    expect(report.totals.costStatus).toBe('none')
  })

  it('salaries are gross and come off the profit', () => {
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
      costStatus: 'known',
      uncostedRevenue: 0,
      knownGrossProfit: 400,
      grossProfit: 400,
      salaries: 250,
      netProfit: 150,
      netMarginPercent: 15,
      invoiceCount: 1,
      payrollCount: 1,
    })
  })

  it('money in another currency is counted and named, never converted', () => {
    const report = buildProfitReport({
      ...base,
      invoices: [inv('i1', 100), inv('i2', 999, 0, 'USD')],
      lines: [line('i1', 'a', 100), line('i2', 'a', 999)],
      consumptions: [cost('i2', 'a', 1)],
      payrolls: [{ currency: 'USD', baseSalary: 5, bonuses: 0, overtimeAmount: 0 }],
    })
    expect(report.totals.revenue).toBe(100)
    expect(report.totals.salaries).toBe(0)
    expect(report.totals.invoiceCount).toBe(1)
    expect(report.products).toHaveLength(1)
    expect(report.otherCurrencies).toEqual([{ currency: 'USD', invoices: 1, payrolls: 1 }])
  })

  it('no revenue is a null margin, not NaN and not 0%', () => {
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

describe('restating a foreign invoice at its frozen rate', () => {
  const invoice = inv('i1', 100, 10, 'USD')
  const lines = [line('i1', 'a', 60), line('i1', 'b', 40)]

  it('brings the invoice and its lines into the books currency', () => {
    const restated = restateAtRates([invoice], lines, new Map([['i1', 70]]), 'AFN')
    expect(restated.invoices[0]).toMatchObject({
      currency: 'AFN',
      subtotal: 7000,
      discountTotal: 700,
    })
    expect(restated.lines.map((l) => l.totalPrice)).toEqual([4200, 2800])
  })

  it('an invoice with no rate is left alone, in its own currency', () => {
    const restated = restateAtRates([invoice], lines, new Map(), 'AFN')
    expect(restated.invoices[0]).toEqual(invoice)
    expect(restated.lines).toEqual(lines)
  })

  it('a rate that is zero, negative or not a number is not a rate', () => {
    for (const rate of [0, -70, Number.NaN, Number.POSITIVE_INFINITY]) {
      const restated = restateAtRates([invoice], lines, new Map([['i1', rate]]), 'AFN')
      expect(restated.invoices[0]).toEqual(invoice)
    }
  })

  it('an invoice already in the books currency is not multiplied by anything', () => {
    const restated = restateAtRates([invoice], lines, new Map([['i1', 70]]), 'USD')
    expect(restated.invoices[0]).toEqual(invoice)
    expect(restated.lines[0]?.totalPrice).toBe(60)
  })

  it('restates a half-cent at the boundary the same way the server does', () => {
    const restated = restateAtRates(
      [inv('i', 0.005, 0, 'USD')],
      [line('i', 'a', 0.005)],
      new Map([['i', 1]]),
      'AFN',
    )
    // 0.005 × 1 = 0.005 → 0.01. A tie rounds up, and that is the server's rule.
    expect(restated.invoices[0]?.subtotal).toBe(0.01)
    expect(restated.lines[0]?.totalPrice).toBe(0.01)
  })
})

describe('the margin of one invoice (what the till shows)', () => {
  const margins = invoiceMargins(
    [inv('i1', 1000), inv('i2', 1000)],
    [line('i1', 'a', 1000), line('i2', 'b', 1000)],
    [cost('i1', 'a', 750)],
  )

  it('is the profit as a share of the invoice net sales', () => {
    expect(margins.get('i1')).toEqual({
      revenue: 1000,
      cost: 750,
      marginPercent: 25,
      costStatus: 'known',
      costMissing: false,
    })
  })

  it('is missing, not 100%, when the goods were never costed', () => {
    expect(margins.get('i2')).toEqual({
      revenue: 1000,
      cost: 0,
      marginPercent: null,
      costStatus: 'unknown',
      costMissing: true,
    })
  })
})

describe('which cost statuses yield a figure', () => {
  it('none, known and estimated do; partial and unknown do not', () => {
    const table: Array<[CostStatus, boolean]> = [
      ['none', true],
      ['known', true],
      ['estimated', true],
      ['partial', false],
      ['unknown', false],
    ]
    for (const [status, determinate] of table) {
      expect(isCostDeterminate(status)).toBe(determinate)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ A FIGURE THAT COULD NOT BE READ IS UNKNOWN, NOT ZERO — owner decision,
// 19 Oct 2026, while the shared `round2` was being settled.
//
// `round2` is ONE helper and it has no opinion about meaning: it answers 0 for a
// value it cannot round. A report DOES have an opinion. A cost nobody could read
// is not free goods, and a revenue nobody could read is not a sale of nothing.
// Both make the row's profit null (CLAUDE.md §3), and a row with no statable
// profit makes the period's gross profit null as well — through the same
// `costMissing` the screen already reads.
// ─────────────────────────────────────────────────────────────────────────────
describe('a figure that could not be read is unknown, not zero', () => {
  const base = { from: '2026-09-01', to: '2026-09-30', currency: 'AFN' }

  it('⚠️ a consumption whose amount is NaN leaves the row uncosted, never «cost 0»', () => {
    const report = buildProfitReport({
      ...base,
      invoices: [inv('i1', 1000)],
      lines: [line('i1', 'a', 1000)],
      // A read that produced NaN — the amount is not a number, not a zero.
      consumptions: [cost('i1', 'a', Number.NaN)],
      payrolls: [],
    })
    expect(report.products[0]).toMatchObject({
      revenue: 1000,
      cost: 0,
      costStatus: 'unknown',
      costMissing: true,
      profit: null,
      marginPercent: null,
    })
    // Without the guard the profit would have been the WHOLE revenue: 1000.
    expect(report.totals).toMatchObject({
      costStatus: 'unknown',
      uncostedRevenue: 1000,
      grossProfit: null,
      netProfit: null,
    })
  })

  it('⚠️ a line total that is NaN gives the row no profit either (USD)', () => {
    const report = buildProfitReport({
      ...base,
      currency: 'USD',
      invoices: [inv('i1', 100.5, 0, 'USD')],
      lines: [line('i1', 'a', Number.NaN)],
      consumptions: [cost('i1', 'a', 60.25)],
      payrolls: [],
    })
    // The COST was read; it is the revenue that could not be. `unknown − 60.25`
    // is not a figure, so the row carries no profit — it is not shown as a loss
    // of 60.25, and the period claims no gross profit.
    expect(report.products[0]).toMatchObject({
      cost: 60.25,
      costMissing: true,
      profit: null,
      marginPercent: null,
    })
    expect(report.totals).toMatchObject({ grossProfit: null, netProfit: null })
  })

  it('a cost that really is zero stays zero — a finite 0 is not «could not be read»', () => {
    const report = buildProfitReport({
      ...base,
      invoices: [inv('i1', 1000)],
      lines: [line('i1', 'a', 1000)],
      consumptions: [cost('i1', 'a', 0)],
      payrolls: [],
    })
    expect(report.products[0]).toMatchObject({
      cost: 0,
      costStatus: 'known',
      costMissing: false,
      profit: 1000,
      marginPercent: 100,
    })
    expect(report.totals).toMatchObject({ grossProfit: 1000, netProfit: 1000 })
  })
})
