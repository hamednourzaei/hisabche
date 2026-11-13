// ============================================
// backend/src/services/intelligence/forecast.domain.ts
//
// N3 — what cash is likely to look like in 7 and 30 days.
// N4 — leads and opportunities nobody has touched.
//
// ---------------------------------------------------------------------------
// ⚠️ N3 IS DERIVED. IT IS NOT A NEW FINANCIAL SOURCE OF TRUTH.
//
// The spec is explicit, and it matters here more than usual: a forecast that
// got persisted would become a number people quote, and within a month
// somebody would be reconciling against it. Every figure below is computed
// from invoices, payments and the ledger at read time, and nothing is stored.
//
// ---------------------------------------------------------------------------
// THE ONE JUDGEMENT THIS MAKES, AND WHY IT IS EXPLICIT
//
// Customers pay late. A forecast that assumed every invoice arrives on its due
// date is not optimistic — it is wrong in a way that makes the whole thing
// useless, because the shortfall it fails to predict is exactly the one that
// hurts.
//
// So the observed average lateness shifts each due date. That average is
// computed from actual settled invoices, and when there is no history the
// forecast says so (`historyBasis: 'none'`) rather than silently assuming
// everyone pays on time.
// ============================================

export interface ReceivableInput {
  invoiceId: string
  /** What is still owed. Positive. */
  outstandingMinor: number
  /** ISO date. `null` when the invoice never had one. */
  dueDate: string | null
}

export interface SettledInvoiceInput {
  dueDate: string | null
  settledAt: string | null
}

export type HistoryBasis = 'observed' | 'none'

export interface PaymentDelay {
  /** Mean days between due date and settlement. Never negative. */
  averageDaysLate: number
  /** How many settled invoices the average came from. */
  sampleSize: number
  basis: HistoryBasis
}

/**
 * How late this business's customers actually pay.
 *
 * ⚠️ EARLY PAYMENTS DO NOT SUBTRACT.
 *
 * A customer who paid two days early does not offset one who paid thirty days
 * late — cash that arrives early is already in the bank and forecasts nothing.
 * Averaging signed lateness would let a handful of prompt payers hide a
 * chronic late-payer, which is the single most useful thing this figure has to
 * say.
 */
export function averagePaymentDelay(settled: readonly SettledInvoiceInput[]): PaymentDelay {
  const usable = settled.filter((row) => row.dueDate && row.settledAt)

  if (usable.length === 0) {
    return { averageDaysLate: 0, sampleSize: 0, basis: 'none' }
  }

  let total = 0
  for (const row of usable) {
    total += Math.max(0, daysBetween(new Date(row.dueDate!), new Date(row.settledAt!)))
  }

  return {
    averageDaysLate: round(total / usable.length),
    sampleSize: usable.length,
    basis: 'observed',
  }
}

export const MIN_FORECAST_HISTORY_SAMPLES = 3

export type ForecastConfidenceStatus = 'ok' | 'insufficient_data'

export interface ForecastWindow {
  /** 7 or 30. */
  days: number
  /** Whether settled invoice history was sufficient to project cash reliably. */
  status: ForecastConfidenceStatus
  /** Receivables expected to land inside the window, in minor units. */
  expectedInflowMinor: number
  /** Cash and bank today, in minor units. */
  openingCashMinor: number
  /**
   * opening + expected when history is sufficient; `null` when history is
   * insufficient (`insufficient_data`) — never invented as 0.
   */
  projectedCashMinor: number | null
  /** Invoices counted toward the inflow. */
  invoiceCount: number
  /**
   * Receivables that are ALREADY overdue.
   *
   * Reported separately rather than folded into the inflow: overdue money is
   * not «arriving on day N», it is money that should already be here, and
   * treating it as scheduled makes the forecast optimistic in exactly the case
   * where that is most dangerous.
   */
  overdueMinor: number
  /** Outstanding invoices with no due date — unschedulable, never forecast. */
  undatedMinor: number
}

export interface CashForecast {
  asOf: string
  status: ForecastConfidenceStatus
  delay: PaymentDelay
  windows: ForecastWindow[]
}

/**
 * The forecast.
 *
 * ⚠️ AN INVOICE WITH NO DUE DATE IS NEVER FORECAST.
 *
 * It is reported in `undatedMinor` so the figure is visible, but placing it on
 * a day would be inventing a date. A forecast built on invented dates is
 * confidently wrong, which is worse than visibly incomplete.
 */
export function forecastCash(input: {
  asOf: Date
  openingCashMinor: number
  receivables: readonly ReceivableInput[]
  delay: PaymentDelay
  windowDays?: readonly number[]
}): CashForecast {
  const sufficientHistory =
    input.delay.basis === 'observed' && input.delay.sampleSize >= MIN_FORECAST_HISTORY_SAMPLES
  const status: ForecastConfidenceStatus = sufficientHistory ? 'ok' : 'insufficient_data'

  const windows = (input.windowDays ?? [7, 30]).map((days) => {
    const horizon = new Date(input.asOf.getTime() + days * 86_400_000)

    let expected = 0
    let overdue = 0
    let undated = 0
    let count = 0

    for (const receivable of input.receivables) {
      if (receivable.outstandingMinor <= 0) continue

      if (!receivable.dueDate) {
        undated += receivable.outstandingMinor
        continue
      }

      const due = new Date(receivable.dueDate)

      if (due < input.asOf) {
        // Already late. Not scheduled — see the field note.
        overdue += receivable.outstandingMinor
        continue
      }

      // Shifted by how late this business's customers actually pay.
      const expectedOn = new Date(due.getTime() + input.delay.averageDaysLate * 86_400_000)
      if (expectedOn <= horizon) {
        expected += receivable.outstandingMinor
        count += 1
      }
    }

    return {
      days,
      status,
      expectedInflowMinor: expected,
      openingCashMinor: input.openingCashMinor,
      projectedCashMinor: sufficientHistory ? input.openingCashMinor + expected : null,
      invoiceCount: count,
      overdueMinor: overdue,
      undatedMinor: undated,
    }
  })

  return { asOf: input.asOf.toISOString(), status, delay: input.delay, windows }
}

// ---------------------------------------------------------------------------
// N4 — FOLLOW-UPS NOBODY HAS MADE
// ---------------------------------------------------------------------------

/**
 * Days of silence before an opportunity is worth chasing.
 *
 * ⚠️ FOURTEEN, AND DELIBERATELY NOT A SETTING.
 *
 * The spec: «if no time-based trigger exists, use a simple default such as 14
 * days with a comment». There is no scheduler and no time-based trigger in
 * this codebase — `services/rules` evaluates CONDITIONS against facts it is
 * handed, it does not fire on elapsed time.
 *
 * So this is a READ MODEL: it answers «what has gone quiet» when somebody
 * asks. It does not notify, and it creates no automation framework beside the
 * one that exists (G2).
 */
export const STALE_AFTER_DAYS = 14

export interface OpportunityInput {
  id: string
  name: string
  stage: string | null
  /** The most recent interaction. `null` when there has never been one. */
  lastActivityAt: string | null
  createdAt: string
}

export interface StaleOpportunity {
  id: string
  name: string
  stage: string | null
  /** Days since the last activity, or since creation when there was none. */
  daysSilent: number
  /** True when nobody has EVER logged an interaction. */
  neverContacted: boolean
}

/**
 * Opportunities nobody has touched.
 *
 * ⚠️ AN OPPORTUNITY WITH NO ACTIVITY IS MEASURED FROM ITS CREATION.
 *
 * Not from «the beginning of time», and not excluded. One created today with
 * no activity is not stale; one created two months ago with no activity is the
 * most neglected thing in the pipeline. Using the creation date makes both
 * come out right, and `neverContacted` keeps the distinction visible.
 */
export function findStaleOpportunities(
  opportunities: readonly OpportunityInput[],
  asOf: Date,
  thresholdDays: number = STALE_AFTER_DAYS,
): StaleOpportunity[] {
  const stale: StaleOpportunity[] = []

  for (const opportunity of opportunities) {
    const since = opportunity.lastActivityAt ?? opportunity.createdAt
    const daysSilent = daysBetween(new Date(since), asOf)
    if (daysSilent < thresholdDays) continue

    stale.push({
      id: opportunity.id,
      name: opportunity.name,
      stage: opportunity.stage,
      daysSilent,
      neverContacted: opportunity.lastActivityAt === null,
    })
  }

  // Quietest first — the list is read from the top.
  return stale.sort((a, b) => b.daysSilent - a.daysSilent)
}

// ---------------------------------------------------------------------------
// V63 #103 — PLATFORM REVENUE, NEXT MONTHS
// ---------------------------------------------------------------------------

export interface MonthlyRevenuePoint {
  /** `YYYY-MM`, UTC. */
  month: string
  /** Net receipts that month (payments − refunds), minor units. Zero is a real zero. */
  netMinor: number
}

export interface MonthlyRevenueForecast {
  status: ForecastConfidenceStatus
  /** Complete months the average was taken from. */
  basisMonths: number
  /** Mean net receipts of those months; `null` with `insufficient_data` — never 0. */
  averageMinor: number | null
  /** The months ahead, each `null` when the history is insufficient. */
  next: Array<{ month: string; projectedMinor: number | null }>
}

/**
 * The next months' receipts, as the mean of the last complete months.
 *
 * ⚠️ THE CURRENT MONTH NEVER COUNTS. It is half-way through; averaging it in
 * drags every forecast down by however much of the month is still to come.
 *
 * ⚠️ FEWER THAN `MIN_FORECAST_HISTORY_SAMPLES` COMPLETE MONTHS IS
 * `insufficient_data` — the same threshold the cash forecast uses — and every
 * projected figure is `null`, not a guess built on one or two months.
 *
 * `series` must already be zero-filled from the first month that had any
 * entry: a month with no payment is a real zero, a month before the ledger
 * existed is not part of the history at all (`zeroFilledMonths`).
 */
export function forecastMonthlyRevenue(input: {
  asOf: Date
  series: readonly MonthlyRevenuePoint[]
  basisMonths?: number
  horizonMonths?: number
}): MonthlyRevenueForecast {
  const current = monthKey(input.asOf)
  const complete = input.series.filter((point) => point.month < current)
  const take = Math.max(MIN_FORECAST_HISTORY_SAMPLES, input.basisMonths ?? 3)
  const basis = complete.slice(-take)
  const sufficient = basis.length >= MIN_FORECAST_HISTORY_SAMPLES
  const average = sufficient
    ? Math.round(basis.reduce((sum, point) => sum + point.netMinor, 0) / basis.length)
    : null

  const next: MonthlyRevenueForecast['next'] = []
  const horizon = Math.max(1, input.horizonMonths ?? 3)
  for (let step = 0; step < horizon; step += 1) {
    const at = new Date(Date.UTC(input.asOf.getUTCFullYear(), input.asOf.getUTCMonth() + step, 1))
    next.push({ month: monthKey(at), projectedMinor: average })
  }

  return {
    status: sufficient ? 'ok' : 'insufficient_data',
    basisMonths: basis.length,
    averageMinor: average,
    next,
  }
}

/**
 * Net receipts per month from the first month that has an entry up to the
 * month of `asOf`, with empty months as real zeros.
 */
export function zeroFilledMonths(
  entries: ReadonlyArray<{ at: string; signedMinor: number }>,
  asOf: Date,
): MonthlyRevenuePoint[] {
  if (entries.length === 0) return []
  const totals = new Map<string, number>()
  let first: string | null = null
  for (const entry of entries) {
    const month = entry.at.slice(0, 7)
    totals.set(month, (totals.get(month) ?? 0) + entry.signedMinor)
    if (first === null || month < first) first = month
  }
  const out: MonthlyRevenuePoint[] = []
  const last = monthKey(asOf)
  const [year, month] = (first ?? last).split('-').map(Number)
  for (let cursor = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 1)); ;) {
    const key = monthKey(cursor)
    if (key > last) break
    out.push({ month: key, netMinor: totals.get(key) ?? 0 })
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  }
  return out
}

/** `YYYY-MM` of a date, UTC. */
export function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7)
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000)
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
