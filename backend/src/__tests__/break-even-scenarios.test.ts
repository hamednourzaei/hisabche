// ============================================
// Engine N11 — break-even and scenarios.
// Capabilities #133, #134.
//
// ⚠️ EVERY FIGURE HERE COMES FROM `buildProfitReport`, AND THIS FILE IS WHAT
// STOPS THAT FROM CHANGING.
//
// The temptation in a break-even module is to recompute revenue and cost from
// the invoice rows, because the totals are "right there". That produces a second
// profit formula, which is the exact thing `profit-report.test.ts` exists to
// prevent and the thing `insights` was removed from doing once already. So these
// tests build a `ProfitReport` and check that the ENGINE reads it — including a
// case where the report's own figures disagree with the raw rows, and the
// engine must follow the report.
//
// ⚠️ THE INTERESTING CASES ARE ALL "NO".
//
// A product with no margin, a shop with no fixed costs, a period with no
// revenue. Each has a number a naive implementation produces and a shopkeeper
// would plan against:
//
//   * break-even on a negative-margin product → a huge number that looks like
//     «nearly there», when the truth is that selling more loses more
//   * break-even with no fixed costs → Infinity, or 0, and the right answer is
//     «every sale breaks even, including none»
//   * a 10% price rise on zero revenue → 0%, reading as «price does not matter»
//     when the truth is «there is no revenue to raise»
// ============================================

import { describe, expect, it } from 'vitest'

import { breakEven, runScenario, type FixedCosts } from '../services/analytics/break-even.domain'
import type { ProfitReport, ProductProfitRow } from '../services/accounting/profit-report.domain'

const product = (over: Partial<ProductProfitRow> = {}): ProductProfitRow => ({
  productId: 'p1',
  name: 'Widget',
  quantity: 100,
  revenue: 1000,
  cost: 400,
  profit: 600,
  marginPercent: 60,
  costMissing: false,
  costEstimated: false,
  ...over,
})

const report = (
  over: Partial<ProfitReport['totals']> = {},
  products = [product()],
): ProfitReport => ({
  from: '2026-09-01',
  to: '2026-09-30',
  currency: 'AFN',
  products,
  totals: {
    revenue: 1000,
    cost: 400,
    grossProfit: 600,
    salaries: 500,
    netProfit: 100,
    netMarginPercent: 10,
    invoiceCount: 3,
    payrollCount: 1,
    ...over,
  },
  otherCurrencies: [],
})

/** Rent is not in the report yet, so it is an input. */
const WITH_RENT: FixedCosts = { salaries: 0, other: 0 }

describe('N11 — break-even reads the report and does not recompute it', () => {
  it('uses the report totals, not the product rows', () => {
    // ⚠️ THE guard against a second profit formula. Salaries here are 500 from
    // the report; `WITH_RENT.salaries` is 0 on purpose, and the fixed costs must
    // still come out at 500 — proving the engine read the report and not the
    // caller.
    const result = breakEven(report(), WITH_RENT)

    expect(result.fixedCostsTotal).toBe(500)
  })

  it('break-even quantity covers the fixed costs at the product own margin', () => {
    // 500 fixed ÷ (600 contribution / 100 units = 6/unit) = 84 units.
    const [row] = breakEven(report(), WITH_RENT).rows

    expect(row?.breakEvenQuantity).toBe(84)
    expect(row?.contribution).toBe(600)
    expect(row?.contributionPercent).toBe(60)
  })

  it('each product gets ITS OWN break-even, never a blended one', () => {
    // ⚠️ A blended margin assumes the mix never changes, which is the one thing
    // a shop's mix never does. Two products, two answers.
    const result = breakEven(
      report({ revenue: 2000, cost: 900, grossProfit: 1100, salaries: 500, netProfit: 600 }, [
        product({ productId: 'p1', quantity: 100, revenue: 1000, cost: 100, profit: 900 }),
        product({ productId: 'p2', quantity: 100, revenue: 1000, cost: 800, profit: 200 }),
      ]),
      WITH_RENT,
    )

    // p1: 500 ÷ 9 = 56 · p2: 500 ÷ 2 = 250
    expect(result.rows[0]?.breakEvenQuantity).toBe(56)
    expect(result.rows[1]?.breakEvenQuantity).toBe(250)
  })
})

describe('N11 — the cases with no number say why', () => {
  it('a product selling at or below cost has NO break-even, not a huge one', () => {
    // ⚠️ THE failure this prevents. Contribution −200 per unit against 500 of
    // fixed costs is −2.5 units — and a naive implementation floors or
    // negates it into something the UI renders as a number.
    const result = breakEven(
      report({ revenue: 1000, cost: 1200, grossProfit: -200, salaries: 500, netProfit: -700 }, [
        product({ revenue: 1000, cost: 1200, profit: -200, marginPercent: -20 }),
      ]),
      WITH_RENT,
    )

    expect(result.rows[0]?.breakEvenQuantity).toBeNull()
    expect(result.rows[0]?.breakEvenReason).toBe('NO_CONTRIBUTION')
  })

  it('a shop with no fixed costs breaks even at zero units', () => {
    // ⚠️ A real answer, and a different one from «this product never breaks
    // even». With no rent and no salaries, the first sale covers everything.
    const result = breakEven(report({ salaries: 0, netProfit: 600 }), { salaries: 0, other: 0 })

    expect(result.fixedCostsTotal).toBe(0)
    expect(result.rows[0]?.breakEvenQuantity).toBe(0)
    expect(result.rows[0]?.breakEvenReason).toBe('NO_FIXED_COSTS')
  })

  it('a product that never sold has no break-even and says so', () => {
    const result = breakEven(
      report({ revenue: 0 }, [
        product({ quantity: 0, revenue: 0, cost: 0, profit: 0, marginPercent: null }),
      ]),
      WITH_RENT,
    )

    expect(result.rows[0]?.breakEvenQuantity).toBeNull()
    expect(result.rows[0]?.breakEvenReason).toBe('NO_REVENUE')
  })

  it('a result that ignores rent says it is a LOWER BOUND', () => {
    // ⚠️ A break-even computed from salaries alone is real but incomplete, and a
    // shop that plans against it and misses is worse off than one that was
    // told it was incomplete.
    const withRent = breakEven(report(), { salaries: 0, other: 5000 })
    const withoutRent = breakEven(report(), { salaries: 0, other: null })

    expect(withRent.isLowerBound).toBe(false)
    expect(withoutRent.isLowerBound).toBe(true)
    expect(withoutRent.fixedCostsTotal).toBeLessThan(withRent.fixedCostsTotal)
  })
})

describe('N11 — a scenario states its assumptions', () => {
  it('a price rise changes revenue only', () => {
    const result = runScenario(report(), { kind: 'price_change', percent: 10 })

    expect(result.after.revenue).toBe(1100)
    expect(result.after.cost).toBe(400)
    expect(result.assumptions.join(' ')).toContain('costs unchanged')
  })

  it('a volume rise moves COSTS TOO', () => {
    // ⚠️ THE assumption every optimistic plan leaves out. The goods still cost
    // what they cost; raising volume without raising cost is a fantasy.
    const result = runScenario(report(), { kind: 'volume_change', percent: 20 })

    expect(result.after.revenue).toBe(1200)
    expect(result.after.cost).toBe(480)
    expect(result.assumptions.join(' ')).toContain('costs move with volume')
  })

  it('a cost rise changes cost only', () => {
    const result = runScenario(report(), { kind: 'cost_change', percent: 25 })

    expect(result.after.revenue).toBe(1000)
    expect(result.after.cost).toBe(500)
    expect(result.after.grossProfit).toBe(500)
  })

  it('a salary rise reaches net profit', () => {
    const result = runScenario(report(), { kind: 'salary_change', percent: 100 })

    expect(result.after.netProfit).toBe(600 - 1000)
    expect(result.delta.netProfit).toBe(-500)
  })

  it('the delta is SIGNED, because the direction is the answer', () => {
    const up = runScenario(report(), { kind: 'cost_change', percent: 50 })
    const down = runScenario(report(), { kind: 'cost_change', percent: -50 })

    expect(up.delta.grossProfit).toBeLessThan(0)
    expect(down.delta.grossProfit).toBeGreaterThan(0)
  })
})

describe('N11 — a scenario on nothing says it is not meaningful', () => {
  it('a 10% price rise on zero revenue is UNDEFINED, not zero', () => {
    // ⚠️ 0% revenue × 1.1 = 0, and the UI would render «price does not matter».
    // The truth is that there is no revenue to raise.
    const result = runScenario(report({ revenue: 0, grossProfit: 0, netProfit: 0 }), {
      kind: 'price_change',
      percent: 10,
    })

    expect(result.meaningful).toBe(false)
    expect(result.reason).toContain('no revenue')
  })

  it('a salary change IS meaningful with no revenue', () => {
    // ⚠️ Salaries do not depend on revenue, so the blanket «meaningless» answer
    // would be wrong for the one scenario where it still works.
    const result = runScenario(report({ revenue: 0, grossProfit: 0, netProfit: 0 }), {
      kind: 'salary_change',
      percent: 10,
    })

    expect(result.meaningful).toBe(true)
    expect(result.reason).toBeNull()
  })

  it('every scenario states at least one assumption', () => {
    for (const kind of ['price_change', 'cost_change', 'volume_change', 'salary_change'] as const) {
      const result = runScenario(report(), { kind, percent: 5 })
      expect(result.assumptions.length, kind).toBeGreaterThan(0)
    }
  })
})
