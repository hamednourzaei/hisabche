// ============================================
// backend/src/services/budgeting/budget.domain.ts
//
// What a business meant to spend, against what it has.
//
// ---------------------------------------------------------------------------
// COMMITTED SPEND IS THE POINT
//
// The naive budget compares actual postings to a limit. It is always late: by
// the time an expense is posted the money is gone, and telling somebody they
// are over budget after the fact is a report, not a control.
//
// What actually stops overspending is counting what is COMMITTED — purchase
// orders raised but not yet received, and approvals granted but not yet spent.
// The available figure is:
//
//   available = budget − actual − committed
//
// That is the number a purchase order should be checked against, and it is the
// one neither a spreadsheet nor a month-end report can give you.
//
// ---------------------------------------------------------------------------
// A BUDGET CONTROLS, WARNS, OR WATCHES
//
// Making every budget a hard block is how budgets get set to absurd numbers so
// work can continue. Three actions, chosen per budget:
//
//   block   refuse the document outright
//   warn    let it through, record that it breached
//   track   no interference at all; the variance report still shows it
// ============================================

export type BudgetAction = 'block' | 'warn' | 'approval' | 'track'

export type BudgetPeriod = 'monthly' | 'quarterly' | 'yearly'

export interface Budget {
  id: string
  /** The account this constrains. */
  accountId: string
  /** Optional narrowing: this cost centre, this project, this branch. */
  dimensionValueId?: string | null | undefined
  branchId?: string | null | undefined
  period: BudgetPeriod
  /** ISO date of the first day of the first period. */
  startsOn: string
  /** Minor units allowed PER PERIOD. */
  amountMinor: number
  action: BudgetAction
  /** Percentage of the budget at which a warning fires. 0 disables it. */
  warnAtPercent: number
  isActive: boolean
}

export interface BudgetConsumption {
  /** Minor units already posted. */
  actualMinor: number
  /**
   * Minor units committed but not posted: approved purchase orders, granted
   * approvals. The whole reason this control works before the money is gone.
   */
  committedMinor: number
}

export interface BudgetStatus {
  budgetId: string
  accountId: string
  periodStart: string
  periodEnd: string
  budgetMinor: number
  actualMinor: number
  committedMinor: number
  /** budget − actual − committed. Negative means already over. */
  availableMinor: number
  /** How much of the budget is used, 0–1+ . */
  utilisation: number
  state: 'ok' | 'warning' | 'exceeded'
  action: BudgetAction
}

/** The period a date falls in, as [start, end]. */
export function periodFor(budget: Budget, onDate: string): { start: string; end: string } {
  const start = new Date(`${budget.startsOn.slice(0, 10)}T00:00:00Z`)
  const target = new Date(`${onDate.slice(0, 10)}T00:00:00Z`)

  const months = budget.period === 'monthly' ? 1 : budget.period === 'quarterly' ? 3 : 12

  const elapsed =
    (target.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (target.getUTCMonth() - start.getUTCMonth())

  const index = Math.floor(elapsed / months)

  const periodStart = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index * months, start.getUTCDate()),
  )
  const periodEnd = new Date(
    Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth() + (index + 1) * months,
      start.getUTCDate(),
    ),
  )
  periodEnd.setUTCDate(periodEnd.getUTCDate() - 1)

  return {
    start: periodStart.toISOString().slice(0, 10),
    end: periodEnd.toISOString().slice(0, 10),
  }
}

export function evaluate(
  budget: Budget,
  consumption: BudgetConsumption,
  onDate: string,
): BudgetStatus {
  const { start, end } = periodFor(budget, onDate)

  const used = consumption.actualMinor + consumption.committedMinor
  const availableMinor = budget.amountMinor - used
  const utilisation = budget.amountMinor === 0 ? 0 : used / budget.amountMinor

  const warnThreshold = budget.warnAtPercent > 0 ? budget.warnAtPercent / 100 : Infinity

  return {
    budgetId: budget.id,
    accountId: budget.accountId,
    periodStart: start,
    periodEnd: end,
    budgetMinor: budget.amountMinor,
    actualMinor: consumption.actualMinor,
    committedMinor: consumption.committedMinor,
    availableMinor,
    utilisation,
    state: availableMinor < 0 ? 'exceeded' : utilisation >= warnThreshold ? 'warning' : 'ok',
    action: budget.action,
  }
}

export type BudgetRuleCode = 'BUDGET_EXCEEDED' | 'BUDGET_WARNING'

export interface BudgetCheck {
  allowed: boolean
  /** Codes for every budget this document touched. */
  problems: Array<{ budgetId: string; code: BudgetRuleCode; overBy: number }>
  warnings: Array<{ budgetId: string; code: BudgetRuleCode; utilisation: number }>
}

/**
 * Whether a document may proceed, given every budget it touches.
 *
 * Only a `block` budget can refuse. A `warn` budget records the breach and
 * lets the work happen, because a control that stops the shop is a control
 * somebody deletes.
 */
export function checkSpend(
  statuses: Array<{ status: BudgetStatus; amountMinor: number }>,
): BudgetCheck {
  const problems: BudgetCheck['problems'] = []
  const warnings: BudgetCheck['warnings'] = []

  for (const entry of statuses) {
    const after = entry.status.availableMinor - entry.amountMinor

    if (after < 0) {
      const breach = {
        budgetId: entry.status.budgetId,
        code: 'BUDGET_EXCEEDED' as const,
        overBy: -after,
      }
      // A warn or track budget records the breach without refusing.
      if (entry.status.action === 'block') problems.push(breach)
      else
        warnings.push({
          budgetId: entry.status.budgetId,
          code: 'BUDGET_EXCEEDED',
          utilisation: entry.status.utilisation,
        })
      continue
    }

    if (entry.status.state === 'warning') {
      warnings.push({
        budgetId: entry.status.budgetId,
        code: 'BUDGET_WARNING',
        utilisation: entry.status.utilisation,
      })
    }
  }

  return { allowed: problems.length === 0, problems, warnings }
}

/**
 * Which budgets apply to a posting.
 *
 * A budget with no dimension and no branch applies to everything on that
 * account; one that names either applies only to matching postings. Both can
 * be in force at once — a workspace-wide cap and a per-project cap — and the
 * TIGHTEST binds, which falls out of checking all of them rather than picking.
 */
export function applicableBudgets(
  budgets: Budget[],
  posting: {
    accountId: string
    dimensionValueId?: string | null | undefined
    branchId?: string | null | undefined
  },
): Budget[] {
  return budgets.filter((budget) => {
    if (!budget.isActive) return false
    if (budget.accountId !== posting.accountId) return false
    if (budget.dimensionValueId && budget.dimensionValueId !== posting.dimensionValueId)
      return false
    if (budget.branchId && budget.branchId !== posting.branchId) return false
    return true
  })
}

export interface VarianceRow {
  budgetId: string
  accountId: string
  periodStart: string
  budgetMinor: number
  actualMinor: number
  /** actual − budget. Positive is overspend. */
  varianceMinor: number
  variancePercent: number | null
}

/**
 * Budget against actual, by period.
 *
 * Committed spend is deliberately EXCLUDED here: a variance report is about
 * what happened, and a purchase order that was never received did not happen.
 * It belongs in the live `available` figure, not in the retrospective one.
 */
export function varianceReport(
  rows: Array<{ budget: Budget; periodStart: string; actualMinor: number }>,
): VarianceRow[] {
  return rows
    .map((row) => {
      const varianceMinor = row.actualMinor - row.budget.amountMinor

      return {
        budgetId: row.budget.id,
        accountId: row.budget.accountId,
        periodStart: row.periodStart,
        budgetMinor: row.budget.amountMinor,
        actualMinor: row.actualMinor,
        varianceMinor,
        // A budget of zero has no meaningful percentage; showing one invites
        // a division nobody can interpret.
        variancePercent:
          row.budget.amountMinor === 0
            ? null
            : Math.round((varianceMinor / row.budget.amountMinor) * 1000) / 10,
      }
    })
    .sort((a, b) => b.varianceMinor - a.varianceMinor)
}

// ═══════════════════════════════════════════════════════════════════════════
// PLANNING — type, distribution, theoretical, variance, forecast, control
//
// Everything below is PURE: no database, no clock. The service feeds it real
// aggregates and today's date; tests feed it numbers. One engine, so the page,
// the purchase check and any AI explanation all read the same answer.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * What the budget measures. Revenue and expense variance mean opposite things:
 * spending less than an expense budget is good, earning less than a revenue
 * target is bad.
 *
 * Only the two the ledger can measure from one account are modelled. A profit
 * target spans revenue AND expense accounts and a cash budget reads cash
 * accounts by flow; neither is a single-account budget, and pretending they
 * were would put a wrong number on the page.
 */
export type BudgetType = 'expense' | 'revenue'

export const BUDGET_TYPES: readonly BudgetType[] = ['expense', 'revenue'] as const

/**
 * The ONE place the ledger sign becomes a budget sign.
 *
 * Journal lines are summed as debit − credit. An expense account grows by
 * debit, so that is spend. A revenue account grows by CREDIT, so income is
 * credit − debit. A refund (credit on expense, debit on revenue) comes out
 * negative, which is correct: it gives budget back.
 */
export function normalizeActual(type: BudgetType, debitMinusCreditMinor: number): number {
  // `0 - x`, not `-x`: negating 0 gives -0, which formats as «−0».
  return type === 'revenue' ? 0 - debitMinusCreditMinor : debitMinusCreditMinor
}

/**
 * Split a total by weights (basis points, summing to exactly 10 000) with the
 * largest-remainder method: every minor unit lands somewhere, deterministically
 * (ties go to the earlier period).
 */
export function distributeByWeights(totalMinor: number, weightsBp: number[]): number[] {
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 0) throw new Error('BUDGET_AMOUNT_INVALID')
  if (weightsBp.length === 0) throw new Error('BUDGET_PERIODS_INVALID')
  let sum = 0
  for (const w of weightsBp) {
    if (!Number.isInteger(w) || w < 0) throw new Error('BUDGET_DISTRIBUTION_INVALID')
    sum += w
  }
  if (sum !== 10_000) throw new Error('BUDGET_DISTRIBUTION_PERCENT_INVALID')

  // BigInt: total × weight can pass 2^53 for large budgets.
  const exact = weightsBp.map((w) => BigInt(totalMinor) * BigInt(w))
  const floors = exact.map((e) => Number(e / 10_000n))
  let left = totalMinor - floors.reduce((s, x) => s + x, 0)
  const order = exact
    .map((e, i) => ({ i, rem: Number(e % 10_000n) }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    floors[i]! += 1
    left -= 1
  }
  return floors
}

/** Control policy. `approval` holds the document for a manager. */
export type BudgetPolicy = 'warn' | 'block' | 'approval' | 'track'

/**
 * Minor units planned for each sub-period, in order. An equal split is only
 * one way to fill this — never the assumption.
 */
export interface BudgetDistribution {
  /** First day of each sub-period (ISO), strictly ascending. */
  periodStarts: string[]
  amountsMinor: number[]
}

/** Split `totalMinor` into `parts` integers that sum exactly. */
export function equalDistribution(totalMinor: number, parts: number): number[] {
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 0) throw new Error('BUDGET_AMOUNT_INVALID')
  if (!Number.isInteger(parts) || parts <= 0) throw new Error('BUDGET_PERIODS_INVALID')
  const base = Math.floor(totalMinor / parts)
  const remainder = totalMinor - base * parts
  // The remainder lands on the last periods, so nothing is lost to rounding.
  return Array.from({ length: parts }, (_, i) => base + (i >= parts - remainder ? 1 : 0))
}

export function validateDistribution(d: BudgetDistribution): void {
  if (d.periodStarts.length === 0 || d.periodStarts.length !== d.amountsMinor.length) {
    throw new Error('BUDGET_DISTRIBUTION_INVALID')
  }
  for (const amount of d.amountsMinor) {
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('BUDGET_AMOUNT_INVALID')
  }
  for (let i = 1; i < d.periodStarts.length; i++) {
    if (d.periodStarts[i]! <= d.periodStarts[i - 1]!) {
      throw new Error('BUDGET_DISTRIBUTION_INVALID')
    }
  }
}

export function distributionTotal(d: BudgetDistribution): number {
  return d.amountsMinor.reduce((sum, a) => sum + a, 0)
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

/**
 * Theoretical budget-to-date: what the APPROVED distribution says should have
 * been consumed by `onDate`. Finished sub-periods count in full; the current
 * one is prorated by elapsed days, floored. Never `annual / 12`.
 */
export function theoreticalToDate(
  d: BudgetDistribution,
  periodEnd: string,
  onDate: string,
): number {
  const day = onDate.slice(0, 10)
  let total = 0
  for (let i = 0; i < d.periodStarts.length; i++) {
    const start = d.periodStarts[i]!.slice(0, 10)
    const nextStart = d.periodStarts[i + 1]
    const end = nextStart ? addDays(nextStart.slice(0, 10), -1) : periodEnd.slice(0, 10)
    const amount = d.amountsMinor[i]!
    if (day < start) break
    if (day >= end) {
      total += amount
      continue
    }
    const length = daysBetween(start, end) + 1
    const elapsed = daysBetween(start, day) + 1
    total += Math.floor((amount * elapsed) / length)
  }
  return total
}

export interface PerformanceInput {
  type: BudgetType
  budgetMinor: number
  theoreticalMinor: number
  /** Posted, in the budget's natural sign: spend for expense, income for revenue. */
  actualMinor: number
  /** Recorded − consumed − released. Never includes what already became actual. */
  openCommitmentMinor: number
  elapsedDays: number
  totalDays: number
}

export interface BudgetPerformance {
  type: BudgetType
  budgetMinor: number
  theoreticalMinor: number
  actualMinor: number
  openCommitmentMinor: number
  /** Spend types: budget − actual − open. Income types: budget − actual. */
  remainingMinor: number
  /** Positive is GOOD for every type: under spend, or above target. */
  varianceMinor: number
  /** Against the theoretical figure: "are we ahead of plan today?" */
  varianceToDateMinor: number
  /** null when there is nothing to project from (see forecastMethod). */
  forecastMinor: number | null
  /** Positive is GOOD, same convention as variance. null with forecastMinor. */
  forecastVarianceMinor: number | null
  forecastMethod: 'plan_remaining' | 'run_rate' | 'insufficient_data'
  state: 'ok' | 'near_limit' | 'warning' | 'over' | 'forecast_overrun'
}

/** Higher actuals are bad for spend, good for income. */
export function spendsBudget(type: BudgetType): boolean {
  return type === 'expense'
}

/**
 * The one performance calculation.
 *
 * Forecast, deterministic and explainable:
 *   plan_remaining = actual + open commitments + (budget − theoretical)
 *   run_rate       = actual × totalDays ÷ elapsedDays
 * For spend types the higher of the two is used (the prudent figure); for
 * income types the plan figure. Nothing an auditor cannot recompute by hand.
 */
export function performance(input: PerformanceInput, warnAtPercent = 80): BudgetPerformance {
  const { type, budgetMinor, theoreticalMinor, actualMinor, openCommitmentMinor } = input
  const spend = spendsBudget(type)

  const planRemaining = Math.max(0, budgetMinor - theoreticalMinor)
  const planForecast = actualMinor + (spend ? openCommitmentMinor : 0) + planRemaining
  const runRate =
    input.elapsedDays > 0 && input.totalDays > 0
      ? Math.round((actualMinor * input.totalDays) / input.elapsedDays)
      : actualMinor
  // Before the period starts there is nothing to project from. Returning the
  // plan as a "forecast" would be the plan wearing a forecast's label.
  const insufficient = input.elapsedDays <= 0 || input.totalDays <= 0
  const useRunRate = !insufficient && spend && runRate > planForecast
  const forecastMinor = insufficient ? null : useRunRate ? runRate : planForecast

  const remainingMinor = spend
    ? budgetMinor - actualMinor - openCommitmentMinor
    : budgetMinor - actualMinor
  const varianceMinor = spend ? budgetMinor - actualMinor : actualMinor - budgetMinor
  const varianceToDateMinor = spend
    ? theoreticalMinor - actualMinor
    : actualMinor - theoreticalMinor
  const forecastVarianceMinor =
    forecastMinor === null
      ? null
      : spend
        ? budgetMinor - forecastMinor
        : forecastMinor - budgetMinor

  let state: BudgetPerformance['state'] = 'ok'
  if (spend) {
    const used = actualMinor + openCommitmentMinor
    if (used > budgetMinor) state = 'over'
    else if (budgetMinor > 0 && used * 100 >= budgetMinor * 95) state = 'warning'
    else if (budgetMinor > 0 && warnAtPercent > 0 && used * 100 >= budgetMinor * warnAtPercent) {
      state = 'near_limit'
    } else if (forecastMinor !== null && forecastMinor > budgetMinor) state = 'forecast_overrun'
  } else if (forecastMinor !== null && forecastMinor < budgetMinor) {
    // For income, "overrun" means the target will be MISSED.
    state = 'forecast_overrun'
  }

  return {
    type,
    budgetMinor,
    theoreticalMinor,
    actualMinor,
    openCommitmentMinor,
    remainingMinor,
    varianceMinor,
    varianceToDateMinor,
    forecastMinor,
    forecastVarianceMinor,
    forecastMethod: insufficient ? 'insufficient_data' : useRunRate ? 'run_rate' : 'plan_remaining',
    state,
  }
}

export interface ImpactResult {
  availableMinor: number
  exceeds: boolean
  exceededByMinor: number
  decision: 'allow' | 'warn' | 'block' | 'require_approval'
}

/**
 * Budget control for ONE new commitment or posting. Server-side only.
 * Budget 100, actual 50, open 20, new 80 → available 30, exceeded by 50.
 */
export function checkImpact(
  policy: BudgetPolicy,
  state: { budgetMinor: number; actualMinor: number; openCommitmentMinor: number },
  newAmountMinor: number,
): ImpactResult {
  if (!Number.isSafeInteger(newAmountMinor) || newAmountMinor < 0) {
    throw new Error('BUDGET_AMOUNT_INVALID')
  }
  const availableMinor = state.budgetMinor - state.actualMinor - state.openCommitmentMinor
  const exceededByMinor = Math.max(0, newAmountMinor - Math.max(0, availableMinor))
  const exceeds = exceededByMinor > 0
  let decision: ImpactResult['decision'] = 'allow'
  if (exceeds) {
    if (policy === 'block') decision = 'block'
    else if (policy === 'approval') decision = 'require_approval'
    else if (policy === 'warn') decision = 'warn'
  }
  return { availableMinor, exceeds, exceededByMinor, decision }
}

/**
 * Open commitments = recorded − consumed − released.
 *
 * ⚠️ INVARIANT. When a commitment becomes actual, `consumedMinor` rises by the
 * same amount `actual` rises — so remaining does not move. Budget 100, actual
 * 50, open 20 → remaining 30; after the 20 is consumed: actual 70, open 0,
 * remaining 30. Never 10.
 */
export function openCommitments(
  rows: Array<{ amountMinor: number; consumedMinor: number; released: boolean }>,
): number {
  return rows.reduce(
    (sum, r) => sum + (r.released ? 0 : Math.max(0, r.amountMinor - r.consumedMinor)),
    0,
  )
}

export interface BudgetRevision {
  version: number
  previousVersion: number
  reason: string
  actorId: string
  createdAt: string
  approvedBy: string | null
  lines: Array<{ lineKey: string; beforeMinor: number; afterMinor: number }>
}

/**
 * A revision of an APPROVED budget. The previous version is never mutated;
 * the caller stores this record next to the new lines. Posted journal entries
 * are untouched — a budget is a plan, not a ledger.
 */
export function reviseBudget(
  current: {
    version: number
    status: 'draft' | 'approved' | 'archived'
    linesMinor: Record<string, number>
  },
  next: Record<string, number>,
  meta: { reason: string; actorId: string; at: string },
): BudgetRevision {
  if (current.status !== 'approved') throw new Error('BUDGET_REVISION_REQUIRES_APPROVED')
  if (!meta.reason.trim()) throw new Error('BUDGET_REVISION_REASON_REQUIRED')
  const keys = new Set([...Object.keys(current.linesMinor), ...Object.keys(next)])
  const lines = [...keys]
    .map((lineKey) => ({
      lineKey,
      beforeMinor: current.linesMinor[lineKey] ?? 0,
      afterMinor: next[lineKey] ?? 0,
    }))
    .filter((l) => l.beforeMinor !== l.afterMinor)
  if (lines.length === 0) throw new Error('BUDGET_REVISION_NO_CHANGE')
  for (const l of lines) {
    if (!Number.isSafeInteger(l.afterMinor) || l.afterMinor < 0) {
      throw new Error('BUDGET_AMOUNT_INVALID')
    }
  }
  return {
    version: current.version + 1,
    previousVersion: current.version,
    reason: meta.reason.trim(),
    actorId: meta.actorId,
    createdAt: meta.at,
    approvedBy: null,
    lines,
  }
}

export interface OverlapCandidate {
  id: string
  accountId: string
  type: BudgetType
  branchId?: string | null | undefined
  dimensionValueId?: string | null | undefined
  startsOn: string
  endsOn: string
  status: string
}

/**
 * Two APPROVED budgets on the same account, type and scope with overlapping
 * periods would double the limit. Drafts may overlap freely.
 */
export function findOverlap(
  candidate: OverlapCandidate,
  existing: OverlapCandidate[],
): OverlapCandidate | null {
  if (candidate.status !== 'approved') return null
  return (
    existing.find(
      (b) =>
        b.id !== candidate.id &&
        b.status === 'approved' &&
        b.accountId === candidate.accountId &&
        b.type === candidate.type &&
        (b.branchId ?? null) === (candidate.branchId ?? null) &&
        (b.dimensionValueId ?? null) === (candidate.dimensionValueId ?? null) &&
        b.startsOn <= candidate.endsOn &&
        candidate.startsOn <= b.endsOn,
    ) ?? null
  )
}
