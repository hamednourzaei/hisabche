// ============================================
// Capabilities #133, #134 — break-even and scenario planning.
// Engine N11.
//
// ⚠️ IT READS `ProfitReport.totals` AND INVENTS NO FIGURE OF ITS OWN.
//
// Revenue, cost, salaries and net profit come from `buildProfitReport`, which
// `profit-report.test.ts` already guards. Re-deriving them here would be the
// second profit formula this codebase has been removing for months, and the
// one thing that module's header explicitly forbids: "the same function the
// profit report and the till's margin use".
//
// So this file answers two questions the profit report does not: «at what volume
// does this stop losing money», and «what would happen if X».
//
// ⚠️ BREAK-EVEN ON GROSS MARGIN, NOT ON A GUESSED MARGIN.
//
// Break-even units = fixed costs ÷ contribution per unit. The contribution per
// unit is the product's own margin, so a shop selling three products with wildly
// different margins gets THREE break-evens, and a blended one would be a
// fiction: it assumes the mix stays exactly as it is, which is the one thing a
// shop's mix never does.
//
// ⚠️ AND A PRODUCT WITH NO MARGIN HAS NO BREAK-EVEN, IT DOES NOT HAVE AN
// INFINITE ONE. Selling at or below cost means the more you sell the more you
// lose, and the honest answer is `null` plus the reason — not a number the UI
// renders as «never breaks even».
//
// ⚠️ SCENARIOS DO NOT PREDICT. THEY ARITHMETIC.
//
// A scenario takes a stated change and computes the consequence under stated
// assumptions. It does not estimate, weight, or model. Every result carries the
// assumptions that produced it, so a shopkeeper can argue with the assumption
// rather than with a forecast — which is the difference between a tool and an
// oracle.
// ============================================

import type { ProfitReport, ProductProfitRow } from '../accounting/profit-report.domain'

const round2 = (v: number) => Math.round(v * 100) / 100

export interface BreakEvenRow {
  productId: string | null
  name: string
  quantity: number
  revenue: number
  cost: number
  /** revenue − cost. What each unit contributes toward the fixed costs. */
  contribution: number
  /** contribution / revenue, or null when there is no revenue. */
  contributionPercent: number | null
  /**
   * ⚠️ UNITS NEEDED TO COVER THE FIXED COSTS. Null when the product cannot:
   * a zero or negative contribution means every extra sale deepens the loss, and
   * returning a huge number here would render as «nearly there».
   */
  breakEvenQuantity: number | null
  /** Why it is null, so the UI can say why rather than showing a blank. */
  breakEvenReason: 'NO_REVENUE' | 'NO_CONTRIBUTION' | 'NO_FIXED_COSTS' | null
}

/**
 * What the shop's fixed costs are.
 *
 * ⚠️ SALARIES PLUS NOTHING ELSE, BY DEFAULT. Rent, utilities and depreciation
 * are real fixed costs and none of them is in `ProfitReport.totals` yet — so
 * they are INPUTS here rather than guesses. A break-even computed from salaries
 * alone is a LOWER BOUND, and the reason field says so.
 */
export interface FixedCosts {
  salaries: number
  /** Rent, utilities and the rest. Null means "not told", not zero. */
  other: number | null
}

export interface BreakEvenResult {
  rows: BreakEvenRow[]
  fixedCostsTotal: number
  /**
   * ⚠️ True when `other` was not supplied, so every row below is a LOWER BOUND.
   * The UI has to say so — a break-even that ignores rent is a number a shop
   * would plan against and then miss.
   */
  isLowerBound: boolean
}

/**
 * Break-even per product.
 *
 * ⚠️ SALARIES COME FROM THE REPORT, NOT FROM `fixedCosts.salaries`. The report
 * is the authority on what salaries were; the caller supplies only what the
 * report does not know. Passing salaries in twice would let the two disagree.
 */
export function breakEven(report: ProfitReport, fixedCosts: FixedCosts): BreakEvenResult {
  const salaries = report.totals.salaries
  const other = fixedCosts.other
  const fixedCostsTotal = salaries + (other ?? 0)
  const isLowerBound = other === null

  const rows: BreakEvenRow[] = report.products.map((product) => {
    const contribution = round2(product.revenue - product.cost)
    const contributionPercent =
      product.revenue === 0 ? null : round2((contribution / product.revenue) * 100)

    // ⚠️ ORDER MATTERS. No fixed costs means every sale breaks even at zero —
    // a real answer, and a different one from «this product never breaks even».
    if (fixedCostsTotal === 0) {
      return {
        ...base(product),
        contribution,
        contributionPercent,
        breakEvenQuantity: 0,
        breakEvenReason: 'NO_FIXED_COSTS',
      }
    }

    if (product.revenue === 0) {
      return {
        ...base(product),
        contribution,
        contributionPercent,
        breakEvenQuantity: null,
        breakEvenReason: 'NO_REVENUE',
      }
    }

    // ⚠️ A negative contribution is the important case: selling more makes it
    // worse. There is no quantity at which this product covers the fixed costs,
    // because the numerator and the denominator have opposite signs.
    if (contribution <= 0) {
      return {
        ...base(product),
        contribution,
        contributionPercent,
        breakEvenQuantity: null,
        breakEvenReason: 'NO_CONTRIBUTION',
      }
    }

    const perUnit = contribution / product.quantity
    if (perUnit <= 0) {
      return {
        ...base(product),
        contribution,
        contributionPercent,
        breakEvenQuantity: null,
        breakEvenReason: 'NO_CONTRIBUTION',
      }
    }

    return {
      ...base(product),
      contribution,
      contributionPercent,
      breakEvenQuantity: Math.ceil(fixedCostsTotal / perUnit),
      breakEvenReason: null,
    }
  })

  return { rows, fixedCostsTotal, isLowerBound }
}

function base(product: ProductProfitRow) {
  return {
    productId: product.productId,
    name: product.name,
    quantity: product.quantity,
    revenue: product.revenue,
    cost: product.cost,
  }
}

// ─── Scenarios (#134) ───────────────────────────────────────────────────────

export type ScenarioChange =
  | { kind: 'price_change'; percent: number; productId?: string | null }
  | { kind: 'cost_change'; percent: number }
  | { kind: 'volume_change'; percent: number }
  | { kind: 'salary_change'; percent: number }

export interface ScenarioResult {
  before: { revenue: number; cost: number; grossProfit: number; netProfit: number }
  after: { revenue: number; cost: number; grossProfit: number; netProfit: number }
  /** after − before. Signed, because the direction is the answer. */
  delta: { revenue: number; cost: number; grossProfit: number; netProfit: number }
  /**
   * ⚠️ THE ASSUMPTIONS THAT PRODUCED THIS. Stated so a shopkeeper can argue
   * with the assumption rather than with a number. A scenario with no
   * assumptions shown is a forecast wearing a costume.
   */
  assumptions: string[]
  /**
   * ⚠️ Null when the starting figures cannot support the arithmetic — no
   * revenue means a 10% price rise is undefined, not zero.
   */
  meaningful: boolean
  reason: string | null
}

/**
 * What would happen if one thing changed.
 *
 * ⚠️ ONE CHANGE AT A TIME, AND IT SAYS SO. Chained percentage changes compound,
 * and a shop reading "revenue +10%" beside "cost +15%" has no way to know
 * whether the model applied them to the same base. Each result lists exactly one
 * assumption.
 *
 * ⚠️ VOLUME AND PRICE COMPOUND DIFFERENTLY AND DELIBERATELY: a price rise
 * applies to revenue only, a volume rise to BOTH revenue and variable cost —
 * because the goods still cost what they cost, and a scenario that raised
 * volume without raising cost is the fantasy every optimistic plan is built on.
 */
export function runScenario(report: ProfitReport, change: ScenarioChange): ScenarioResult {
  const baseTotals = report.totals
  const before = {
    revenue: baseTotals.revenue,
    cost: baseTotals.cost,
    grossProfit: round2(baseTotals.grossProfit),
    netProfit: baseTotals.netProfit,
  }

  const factor = 1 + change.percent / 100
  let revenue = before.revenue
  let cost = before.cost
  const assumptions: string[] = [`${change.kind} ${change.percent}%`]

  switch (change.kind) {
    case 'price_change':
      revenue = round2(before.revenue * factor)
      assumptions.push('costs unchanged')
      break

    case 'cost_change':
      cost = round2(before.cost * factor)
      assumptions.push('revenue unchanged')
      break

    case 'volume_change':
      // ⚠️ BOTH sides move. See the header.
      revenue = round2(before.revenue * factor)
      cost = round2(before.cost * factor)
      assumptions.push('costs move with volume — the goods still cost what they cost')
      break

    case 'salary_change':
      assumptions.push('revenue and costs unchanged')
      break
  }

  const grossProfit = round2(revenue - cost)
  const salaryFactor = change.kind === 'salary_change' ? factor : 1
  // ⚠️ Net profit = gross profit − salaries. The report's own `netProfit` is
  // used unchanged for `before`, so whatever else it accounts for stays
  // accounted for; this line only recomputes the AFTER figure from the same
  // two components rather than inventing a third formula for net.
  const netProfit = round2(grossProfit - baseTotals.salaries * salaryFactor)
  const after = { revenue, cost, grossProfit, netProfit }

  // ⚠️ A SALARY CHANGE IS MEANINGFUL WITH NO REVENUE.
  //
  // Salaries do not depend on revenue, so the blanket "no revenue means this is
  // undefined" answer is wrong for exactly the one scenario that still computes.
  // The first version computed `meaningful` from revenue alone and then
  // special-cased the REASON — which left `meaningful: false` attached to a
  // perfectly good number, and a UI keying on that flag would hide it.
  //
  // Every OTHER change multiplies revenue, so it needs revenue to exist.
  const needsRevenue = change.kind !== 'salary_change'
  const meaningful = needsRevenue ? before.revenue !== 0 : true
  const reason = meaningful
    ? null
    : 'no revenue in the period, so a percentage of it is not a number'

  return {
    before,
    after,
    delta: {
      revenue: round2(after.revenue - before.revenue),
      cost: round2(after.cost - before.cost),
      grossProfit: round2(after.grossProfit - before.grossProfit),
      netProfit: round2(after.netProfit - before.netProfit),
    },
    assumptions,
    meaningful,
    reason,
  }
}
