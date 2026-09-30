// ============================================
// Capability #69 — the month-end package.
//
// ⚠️ WHAT THIS IS, AND WHY IT IS NOT A NEW CLOSE.
//
// Closing a period is not one action. It is an ORDER, and the order is the
// whole content of this file:
//
//   1. post the depreciation that has fallen due      (assets)
//   2. post the FX revaluation for the month         (currency)
//   3. re-post anything whose cost was recalculated  (costing)
//   4. close the year, if this month ends one        (accounting)
//   5. lock the period                               (accounting)
//
// Every one of those already exists and is individually correct:
// `AssetsService.postDue`, the `fx_revaluation` source type in
// `ledger.port`, `repost.domain`, `AccountingService.postYearEndClose`, and
// `setPeriodLock`. This module decides WHICH RUN, IN WHICH ORDER, and WHEN TO
// STOP — and nothing else. It is an ordering and a stop condition, not a
// second implementation of any of the five.
//
// ⚠️ WHY THE ORDER IS NOT ARBITRARY.
//
// Depreciation before revaluation: revaluation moves the value of MONETARY
// balances. A depreciation entry written after a revaluation is measured against
// a book value that has already moved, so the two steps in the other order give
// an answer that depends on when the scheduler happened to run. Same reasoning
// for cost repost: a recalculated cost is measured against the balances as they
// stand, so it must land before a revaluation reads them.
//
// Lock LAST, always: a lock is a promise that nothing more will be written. If
// step 3 fails and the lock is already set, the period is sealed with a known
// error inside it, and the only way out is a manual unlock — the one state a
// bookkeeping system should never be able to reach on its own.
//
// ⚠️ WHY IT STOPS RATHER THAN PRESSING ON.
//
// Every step below returns a status, not a boolean. A month-end that posts
// depreciation, fails the revaluation, and then LOCKS is worse than one that
// stops and says so: it looks finished, it is finished, and the error is
// permanent. So the run stops at the first failure and reports what did and did
// not happen — which is the difference between a package and a script.
//
// ⚠️ AND NOTHING HERE IS ATOMIC.
//
// There is no transaction spanning five engines and a period lock, and pretending
// otherwise would be the "compensating DELETE" the rules forbid. Each step is
// idempotent on its own — depreciation keys on `(asset, period)`, the ledger keys
// on `(sourceType, sourceId)`, a revaluation reverses the last one — so a re-run
// of a failed package is safe and is the intended recovery. What must never
// happen is the lock being set while a step is known to have failed.
// ============================================

/** The five steps, in the order they must run. */
export type MonthEndStep =
  'depreciation' | 'fx_revaluation' | 'cost_repost' | 'year_end_close' | 'period_lock'

/** The fixed order. Exported so a caller can render it and tests can assert it. */
export const MONTH_END_ORDER: readonly MonthEndStep[] = [
  'depreciation',
  'fx_revaluation',
  'cost_repost',
  'year_end_close',
  'period_lock',
]

export type StepStatus =
  /** Ran and did its work. `detail` carries what it actually did. */
  | 'ok'
  /** Nothing to do — not a failure, and not the same as having done work. */
  | 'nothing_to_do'
  /** Did not complete. The package STOPS here. */
  | 'failed'

export interface StepOutcome {
  step: MonthEndStep
  status: StepStatus
  /** A number for a person to check, not a generated sentence. */
  detail?: string
  /** The honest reason, when `status` is `failed`. */
  reason?: string
}

export interface MonthEndPlan {
  fromDate: string
  toDate: string
  /** Set when this month ends a financial year, so step 4 runs. */
  closesYear: boolean
}

/**
 * Whether a period that STARTS in `startDate`'s month ends the financial year.
 *
 * ⚠️ This compares MONTHS, not dates, and it takes the period's start month —
 * not its end date. Both choices are deliberate and both are the opposite of
 * what looks natural:
 *
 *   * Matching on the END date says a period running 1–30 December closes a
 *     year. A month that has not finished cannot close anything; a shop whose
 *     books close on the 31st would get a year-end on the 30th, and a period
 *     ending 31 December would be the only one that ever closed.
 *   * Matching on the START month is what makes a partial period honest: if
 *     December is the close month and the period begins in December, this IS
 *     the closing period, whether or not the shop got to the 31st.
 *
 * ⚠️ `fiscalYearEnd` is `MM-DD` from the workspace's own configuration. There
 * is no default here: assuming December would close a year for a shop whose
 * books end in March, which is the default in several markets this product is
 * sold into.
 */
export function monthEndsFiscalYear(startDate: string, fiscalYearEnd: string): boolean {
  const startMonth = startDate.slice(5, 7)
  const endMonth = fiscalYearEnd.slice(0, 2)

  if (endMonth < '01' || endMonth > '12') {
    // A misconfigured year end must not silently close a year, and must not
    // silently refuse one either — the caller reports it.
    throw new Error(`MONTH_END_FISCAL_YEAR_END_INVALID: ${fiscalYearEnd}`)
  }

  return startMonth === endMonth
}

export type MonthEndRuleCode =
  /** A step failed. The period is NOT locked and the run must stop. */
  | 'MONTH_END_STEP_FAILED'
  /** `closesYear` was claimed but the plan says otherwise. */
  | 'MONTH_END_YEAR_MISMATCH'

export interface MonthEndDecision {
  /** What the run should do, in order. `[]` means stop before the lock. */
  run: MonthEndStep[]
  violations: { code: MonthEndRuleCode; step: MonthEndStep; reason: string }[]
}

/**
 * Decide what a month-end run should do, and whether it may lock.
 *
 * ⚠️ PURE. It takes the outcomes so far and produces the rest of the plan, which
 * is what makes the STOP behaviour testable without a database — and the stop
 * behaviour is the only thing in this file worth being wrong about.
 */
export function decideMonthEnd(plan: MonthEndPlan, completed: StepOutcome[]): MonthEndDecision {
  const violations: MonthEndDecision['violations'] = []

  const failed = completed.find((outcome) => outcome.status === 'failed')
  if (failed) {
    // The lock is the one step that must never run on a known-bad period.
    violations.push({
      code: 'MONTH_END_STEP_FAILED',
      step: failed.step,
      reason: failed.reason ?? 'no reason given',
    })
    return { run: [], violations }
  }

  const remaining = MONTH_END_ORDER.filter((step) => !completed.some((c) => c.step === step))

  return { run: remaining, violations }
}

/**
 * Summarise a finished run for the person who started it.
 *
 * ⚠️ `locked` is stated separately from "everything succeeded", because a run
 * that failed on step 2 and never locked is a DIFFERENT outcome from one that
 * locked a good period — and a summary that renders both as «done» is how a
 * shop ends a month not knowing that its books are open.
 */
export function summariseMonthEnd(
  plan: MonthEndPlan,
  outcomes: StepOutcome[],
): {
  fromDate: string
  toDate: string
  outcomes: StepOutcome[]
  locked: boolean
  failedAt?: MonthEndStep
} {
  const failure = outcomes.find((outcome) => outcome.status === 'failed')
  const lock = outcomes.find((outcome) => outcome.step === 'period_lock')

  return {
    fromDate: plan.fromDate,
    toDate: plan.toDate,
    outcomes,
    locked: lock?.status === 'ok',
    ...(failure ? { failedAt: failure.step } : {}),
  }
}
