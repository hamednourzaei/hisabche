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

export type BudgetAction = 'block' | 'warn' | 'track'

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
