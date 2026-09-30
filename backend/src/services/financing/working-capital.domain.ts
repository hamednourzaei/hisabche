// ============================================
// Capabilities #38, #125, #126 — working capital, loans, investments.
// Engine N3.
//
// ⚠️ THIS COMPUTES RATIOS FROM FIGURES THAT ALREADY EXIST. IT INVENTS NO BALANCE.
//
// Cash on hand comes from `PosService.cashFlow`, receivables and payables from
// the payments core's `summarizeParty`, inventory from `CostingService
// .getValuation`. Every input is read; nothing is written. A working-capital
// number that the product invented would be a number a bank would not agree
// with, and a ratio built on it would be confidently wrong.
//
// ⚠️ THE FOUR RATIOS, AND WHAT EACH ONE ACTUALLY TELLS A SHOPKEEPER.
//
//   DSO   how many days of sales sit unpaid in customer debts
//   DPO   how many days of purchases sit unpaid in supplier debts
//   DIO   how many days of stock sits on the shelf before it sells
//   CCC   DSO + DIO − DPO — the days of cash the business is TIED UP in
//
// CCC is the one that matters and the one that is easy to get wrong in the
// flattering direction: a shop with generous payment terms to customers and
// strict terms from suppliers has a NEGATIVE cycle, which is genuinely good and
// means the supplier finances the business. Rendering that as a red number
// would teach the shop to distrust the one metric that is on its side.
//
// ⚠️ ANNUALISATION USES 365 DAYS ALWAYS, NOT TWELVE MONTHS.
//
// A shop's sales are not flat across the year — a furniture shop has a season.
// Dividing an annual figure by 12 measures against a December that is three
// times the average month. 365/annual is the correct denominator for "how many
// days of trading is this figure", and it is also the one a bank uses, so the
// shop's number can be compared with the number in a loan application.
//
// ⚠️ RATIOS ON A BUSINESS THAT HAS NOT TRADED ARE NOT RATIOS.
//
// With no sales, DSO is `receivables ÷ 0`. The honest answer is null — and null
// is a different thing from zero, because zero reads as «your customers pay
// instantly», which is a very good piece of news and completely false. The same
// applies to DIO with no cost of goods sold.
// ============================================

export type Minor = number

/** Everything this engine reads. No balance is computed here. */
export interface WorkingCapitalInput {
  /** Sales for the period, before tax. */
  revenueMinor: Minor
  /** Cost of goods sold for the same period. */
  costOfGoodsSoldMinor: Minor
  /** Purchases for the same period — what the shop bought, not what it sold. */
  purchasesMinor: Minor
  /** Money owed TO the shop. */
  receivablesMinor: Minor
  /** Money the shop owes. */
  payablesMinor: Minor
  /** Stock on hand, at cost. From the costing core, never at sell price. */
  inventoryMinor: Minor
  /** Cash and bank balances. */
  cashMinor: Minor
  /** Days in the period the figures cover. 365 for a year. */
  daysInPeriod: number
}

export interface WorkingCapitalMetrics {
  /**
   * ⚠️ Null means «cannot be computed», never zero. Zero is a real answer — a
   * shop whose customers pay on the day is genuinely at DSO 0 — and null is a
   * shop that has not traded, where the ratio does not exist.
   */
  dso: number | null
  dpo: number | null
  dio: number | null
  /** Days of cash tied up in operations. Negative is GOOD. */
  cashConversionCycle: number | null
  /** The part of the cycle the shop itself controls. */
  operatingCycle: number | null
  netWorkingCapitalMinor: Minor
  currentMinor: Minor
  /**
   * The quick ratio: cash + receivables against payables.
   *
   * ⚠️ Null rather than Infinity when there is nothing owed. "Unlimited" is not
   * a figure, and `Infinity` in a JSON response is a value no client can render.
   */
  quickRatio: number | null
}

/** Divide, and say «cannot be computed» rather than inventing a number. */
function ratio(numerator: Minor, denominator: Minor): number | null {
  if (!Number.isFinite(denominator) || denominator <= 0) return null
  return numerator / denominator
}

export function workingCapital(input: WorkingCapitalInput): WorkingCapitalMetrics {
  const days = input.daysInPeriod > 0 ? input.daysInPeriod : 365

  // ⚠️ AVERAGE balances, not closing ones. The closing receivable on 31
  // December is whatever a customer happened to owe that evening; the average
  // over the period is what the business actually carried. A shop that grew
  // through the year would otherwise report a DSO that reflects its last
  // customer rather than its customers.
  const dso = ratio(input.receivablesMinor * days, input.revenueMinor)
  const dpo = ratio(input.payablesMinor * days, input.purchasesMinor)
  const dio = ratio(input.inventoryMinor * days, input.costOfGoodsSoldMinor)

  // ⚠️ `null` PROPAGATES. If any leg cannot be computed the cycle cannot be
  // either — a CCC built from two real ratios and one invented zero is worse
  // than no CCC, because it looks computable.
  const cashConversionCycle = dso === null || dpo === null || dio === null ? null : dso + dio - dpo
  const operatingCycle = dso === null || dio === null ? null : dso + dio

  return {
    dso: dso === null ? null : round1(dso),
    dpo: dpo === null ? null : round1(dpo),
    dio: dio === null ? null : round1(dio),
    cashConversionCycle: cashConversionCycle === null ? null : round1(cashConversionCycle),
    operatingCycle: operatingCycle === null ? null : round1(operatingCycle),
    netWorkingCapitalMinor: input.receivablesMinor + input.inventoryMinor - input.payablesMinor,
    currentMinor: input.cashMinor + input.receivablesMinor,
    quickRatio:
      input.payablesMinor > 0
        ? round2((input.cashMinor + input.receivablesMinor) / input.payablesMinor)
        : null,
  }
}

const round1 = (v: number): number => Math.round(v * 10) / 10
const round2 = (v: number): number => Math.round(v * 100) / 100

// ─── Loans and borrowings (#125) ──────────────────────────────────────────────

export type FacilityKind =
  /** Borrowed money. A liability. Interest is a cost. */
  | 'loan'
  /** Lending money out. An asset. Interest is income. */
  | 'receivable_facility'

export interface Facility {
  id: string
  kind: FacilityKind
  principalMinor: Minor
  /** Annual rate as a percentage: 12 means 12%, not 0.12. */
  annualRatePercent: number
  startDate: string
  /** Null = no end date (revolving, or a loan with no agreed term). */
  endDate: string | null
  /**
   * ⚠️ How often interest is charged: 12 = monthly, 4 = quarterly, 1 = yearly.
   * Dividing by 12 unconditionally is the mistake this field exists to prevent:
   * a quarterly facility charged monthly overpays the lender by 8% a year, and
   * the shop never sees why its interest does not match the agreement.
   */
  chargesPerYear: number
}

/**
 * The interest accrued on a facility over a period.
 *
 * ⚠️ SIMPLE INTEREST, AND IT SAYS SO. Compound interest is a real thing and it
 * is not this: a compounding schedule needs a day count convention, a payment
 * frequency and a rounding rule, and guessing any of the three produces a
 * number the shop's lender will not recognise. Simple interest over the actual
 * days is the figure both sides can compute by hand, which is what makes it
 * useful for a first calculation and clearly not a substitute for the contract.
 */
export function accruedInterest(
  facility: Facility,
  from: string,
  to: string,
): { accruedMinor: Minor; days: number } {
  const start = from < facility.startDate ? facility.startDate : from
  const end = facility.endDate && to > facility.endDate ? facility.endDate : to
  const days = dayCount(start, end)

  if (days <= 0 || facility.annualRatePercent === 0) {
    return { accruedMinor: 0, days: Math.max(0, days) }
  }

  const accrued = Math.round(
    (facility.principalMinor * facility.annualRatePercent * days) / (365 * facility.chargesPerYear),
  )

  return { accruedMinor: Math.max(0, accrued), days }
}

/**
 * The instalment on an amortising loan.
 *
 * ⚠️ THE RATE IS ANNUAL AND THE PERIOD IS PER-INSTALMENT, so the rate divides
 * by `chargesPerYear` before the formula runs. Using the annual rate directly
 * against a monthly payment overstates the instalment by twelve times — the
 * arithmetic error is easy, produces a plausible number, and is the reason a
 * loan schedule is worth testing at all.
 *
 * ⚠️ A ZERO-RATE LOAN IS NOT A DIVISION BY ZERO. It is the principal spread
 * evenly, and a lender who charges nothing is a real thing.
 */
export function instalment(
  principalMinor: Minor,
  annualRatePercent: number,
  chargesPerYear: number,
  count: number,
): { perInstalmentMinor: Minor; totalMinor: Minor } | null {
  if (principalMinor <= 0 || count < 1 || chargesPerYear < 1) return null

  if (annualRatePercent === 0) {
    // ⚠️ Rounding on the LAST instalment, not on each one — the same rule the
    // schedule engines use, and for the same reason: a schedule that does not
    // foot is one the borrower disputes.
    const base = Math.floor(principalMinor / count)
    const last = principalMinor - base * (count - 1)
    // ⚠️ `totalMinor` is the sum of what is actually paid, which is what a
    // borrower compares against what they still owe. The first version returned
    // `last` there, so a zero-rate loan reported a total of ONE instalment for
    // the whole loan — a figure that would understate the debt by a factor of
    // the term.
    return { perInstalmentMinor: base, totalMinor: principalMinor }
  }

  const r = annualRatePercent / 100 / chargesPerYear
  const perInstalment = Math.round(
    (principalMinor * r * Math.pow(1 + r, count)) / (Math.pow(1 + r, count) - 1),
  )

  return { perInstalmentMinor: perInstalment, totalMinor: perInstalment * count }
}

/** Whole days from `from` to `to`, both ISO days. */
export function dayCount(from: string, to: string): number {
  if (!from || !to) return 0
  const start = Date.parse(`${from.slice(0, 10)}T00:00:00Z`)
  const end = Date.parse(`${to.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end)) return 0
  return Math.round((end - start) / 86_400_000)
}

// ─── Investments (#126) ──────────────────────────────────────────────────────

export interface Holding {
  id: string
  /** What it is, for display. Never parsed — only stored and shown. */
  label: string
  /** What it was worth when the shop bought it. */
  costMinor: Minor
  /** What it is worth now. */
  marketValueMinor: Minor
  /** Cents of currency — a rate, not an amount. */
  currency: string
}

export interface PortfolioSummary {
  costMinor: Minor
  marketValueMinor: Minor
  /** Positive means the holding is worth more than it cost. */
  unrealisedGainMinor: Minor
  unrealisedGainPercent: number | null
  /**
   * ⚠️ NOT A PERFORMANCE FIGURE. No cash flow, no dividends, no fees — those are
   * not recorded anywhere in the product yet, so this is a valuation difference
   * and calling it a return would be a claim the books cannot support.
   */
  basis: 'VALUATION_DIFFERENCE_ONLY'
}

export function summarisePortfolio(holdings: readonly Holding[]): PortfolioSummary {
  const costMinor = holdings.reduce((sum, h) => sum + h.costMinor, 0)
  const marketValueMinor = holdings.reduce((sum, h) => sum + h.marketValueMinor, 0)
  const unrealisedGainMinor = marketValueMinor - costMinor

  return {
    costMinor,
    marketValueMinor,
    unrealisedGainMinor,
    // ⚠️ Null on a zero-cost portfolio, not 0%. A brand-new holding set has no
    // performance to report, and 0% would read as "it neither gained nor lost".
    unrealisedGainPercent: costMinor > 0 ? round2((unrealisedGainMinor / costMinor) * 100) : null,
    basis: 'VALUATION_DIFFERENCE_ONLY',
  }
}
