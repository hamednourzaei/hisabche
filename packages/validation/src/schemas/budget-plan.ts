// ============================================
// packages/validation/src/schemas/budget-plan.ts
//
// The planning layer of budgets — what a saved budget looks like, how its
// period is split, which transitions are legal, what a revision changes, how the
// budgets page and the spend check are assembled from the actual figures.
//
// These were inside backend/src/services/budgeting/budget.service.ts, mixed with
// the Postgres reads that fetch the actuals. They are pure functions over rows
// here so the offline engine (packages/local-engine/src/routes/budgets.ts)
// answers the SAME way from its own SQLite, with the SAME rules:
//
//   · the caller fetches the figures (actuals by day, open commitments, an FX
//     quote) from wherever it keeps them;
//   · everything decided from them is decided here.
//
// ⚠️ NOTHING HERE READS A DATABASE, A CLOCK OR A CURRENCY TABLE. A base currency,
// a quote and «now» are arguments.
// ============================================

import { CURRENCY_CODES } from './common.schema'
import {
  applicableBudgets,
  checkImpact,
  checkSpend,
  distributeByWeights,
  equalDistribution,
  evaluate,
  findOverlap,
  normalizeActual,
  performance,
  periodFor,
  reviseBudget,
  theoreticalToDate,
  validateDistribution,
  type Budget,
  type BudgetAction,
  type BudgetConsumption,
  type BudgetDistribution,
  type BudgetPerformance,
  type BudgetPeriod,
  type BudgetRevision,
  type BudgetType,
  type ImpactResult,
} from './budget-rules'

/** The currencies a budget may be ENTERED in: the product's ONE currency list. */
export const BUDGET_CURRENCIES = CURRENCY_CODES

export type BudgetStatusCode = 'draft' | 'pending_approval' | 'approved' | 'archived'

/** A budget as the planning layer sees it. Extends the control-layer shape. */
export interface PlannedBudget extends Budget {
  name: string | null
  type: BudgetType
  status: BudgetStatusCode
  version: number
  /** Per sub-period minor units; null = equal split of amountMinor. */
  distribution: Array<{ start: string; amountMinor: number }> | null
  notes: string | null
  approvedBy: string | null
  approvedAt: string | null
  createdBy: string | null
  /** The currency the amount was ENTERED in. `amountMinor` is always the books currency. */
  currency: string
  /** The entered amount, in `currency` minor units. */
  amountCurrencyMinor: number
  /** Books-currency units per 1 unit of `currency`, fixed at save. null for the books currency. */
  fxRate: number | null
}

/** The currencies a budget may be entered in for a business keeping its books in `base`. */
export function budgetCurrencies(base: string): string[] {
  return [...new Set([base, ...BUDGET_CURRENCIES])]
}

function distributionOf(raw: unknown): Array<{ start: string; amountMinor: number }> | null {
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (!Array.isArray(value)) return null
  const parts: Array<{ start: string; amountMinor: number }> = []
  for (const item of value) {
    if (
      item === null ||
      typeof item !== 'object' ||
      typeof (item as { start?: unknown }).start !== 'string' ||
      !Number.isInteger((item as { amount_minor?: unknown }).amount_minor) ||
      ((item as { amount_minor: number }).amount_minor as number) < 0
    ) {
      return null
    }
    parts.push({
      start: (item as { start: string }).start.slice(0, 10),
      amountMinor: (item as { amount_minor: number }).amount_minor,
    })
  }
  return parts
}

/** A stored budget row (either database) as the planning layer's budget. */
export function mapBudget(raw: Record<string, any>, baseCurrency: string): PlannedBudget {
  return {
    id: raw.id,
    accountId: raw.account_id,
    dimensionValueId: raw.dimension_value_id ?? null,
    branchId: raw.branch_id ?? null,
    period: raw.period as BudgetPeriod,
    startsOn: String(raw.starts_on ?? '').slice(0, 10),
    amountMinor: Number(raw.amount_minor) || 0,
    action: raw.action as BudgetAction,
    warnAtPercent: Number(raw.warn_at_percent) || 0,
    isActive: raw.is_active !== false && raw.is_active !== 0,
    name: raw.name ?? null,
    // Legacy rows (no column yet) were expense controls — see the migration.
    type: raw.budget_type === 'revenue' ? 'revenue' : 'expense',
    status: (raw.status as BudgetStatusCode | undefined) ?? 'approved',
    version: Number(raw.version) || 1,
    distribution: distributionOf(raw.distribution ?? null),
    notes: raw.notes ?? null,
    approvedBy: raw.approved_by ?? null,
    approvedAt: raw.approved_at ?? null,
    createdBy: raw.created_by ?? null,
    currency: budgetCurrencies(baseCurrency).includes(raw.currency) ? raw.currency : baseCurrency,
    // NULL on rows entered before the column existed: they were entered in the books currency.
    amountCurrencyMinor:
      raw.amount_currency_minor === null || raw.amount_currency_minor === undefined
        ? Number(raw.amount_minor) || 0
        : Number(raw.amount_currency_minor) || 0,
    fxRate: raw.fx_rate === null || raw.fx_rate === undefined ? null : Number(raw.fx_rate),
  }
}

// ─── Periods ─────────────────────────────────────────────────────────────────

export const MONTHS_IN: Record<BudgetPeriod, number> = { monthly: 1, quarterly: 3, yearly: 12 }

export function addBudgetMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  const day = d.getUTCDate()
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, day))
  return out.toISOString().slice(0, 10)
}

export function daysInclusive(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000) + 1
}

/** The sub-period plan for the period containing `onDate`. */
export function planFor(budget: PlannedBudget, onDate: string) {
  const { start, end } = periodFor(budget, onDate)
  const months = MONTHS_IN[budget.period]
  const periodStarts = Array.from({ length: months }, (_, i) => addBudgetMonths(start, i))

  // A stored distribution is honoured only if it describes THIS period's
  // sub-periods and adds up to the budget. Anything else is a data error to
  // surface, not something to reinterpret.
  const stored = budget.distribution
  const matches =
    stored !== null &&
    stored.length === months &&
    stored.every((d, i) => d.start === periodStarts[i]) &&
    stored.reduce((s, d) => s + d.amountMinor, 0) === budget.amountMinor

  const distribution: BudgetDistribution = {
    periodStarts,
    amountsMinor: matches
      ? stored!.map((d) => d.amountMinor)
      : equalDistribution(budget.amountMinor, months),
  }

  return {
    start,
    end,
    distribution,
    distributionKind: matches ? ('custom' as const) : ('equal' as const),
    distributionMismatch: stored !== null && !matches,
  }
}

/**
 * Convert entered sub-period amounts to the books currency so they still sum to
 * exactly `baseTotal`: each part is rounded, the remainder lands on the last.
 */
export function convertParts(parts: number[], rate: number, baseTotal: number): number[] {
  const converted = parts.map((part) => Math.round(part * rate))
  const drift = baseTotal - converted.reduce((s, x) => s + x, 0)
  if (converted.length > 0)
    converted[converted.length - 1] = Math.max(0, converted[converted.length - 1]! + drift)
  return converted
}

// ─── Saving a draft ──────────────────────────────────────────────────────────

export interface BudgetSaveInput extends Budget {
  name?: string | null | undefined
  type?: BudgetType | undefined
  notes?: string | null | undefined
  /** Basis points per sub-period (sum 10 000), or explicit minor units. */
  distributionWeightsBp?: number[] | null | undefined
  distributionMinor?: number[] | null | undefined
  /** The currency `amountMinor` (and `distributionMinor`) were entered in. */
  currency?: string | undefined
}

export interface BudgetSavePlan {
  currency: string
  enteredMinor: number
  /** The control figure, in the books currency. */
  amountMinor: number
  fxRate: number | null
  /** Per sub-period in the books currency, or null = equal split. */
  distribution: Array<{ start: string; amount_minor: number }> | null
}

/** The refusals of a save, by name. */
export type BudgetSaveProblem =
  | 'BUDGET_AMOUNT_INVALID'
  | 'BUDGET_PERIOD_INVALID'
  | 'BUDGET_DISTRIBUTION_TOTAL_MISMATCH'
  | 'BUDGET_DISTRIBUTION_INVALID'
  | string

/**
 * What a draft will store — or why it cannot be stored.
 *
 * `fxRate` is the quote for `currency` on the period start, fetched by the
 * caller from its own rates (the most recent ON OR BEFORE it); it is required
 * exactly when `currency` is not the books currency, and null otherwise.
 */
export function planBudgetSave(
  input: BudgetSaveInput,
  context: { baseCurrency: string; fxRate: number | null },
): { ok: true; plan: BudgetSavePlan } | { ok: false; problem: BudgetSaveProblem } {
  const currency = input.currency ?? context.baseCurrency
  const enteredMinor = input.amountMinor

  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 0) {
    return { ok: false, problem: 'BUDGET_AMOUNT_INVALID' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startsOn) || Number.isNaN(Date.parse(input.startsOn))) {
    return { ok: false, problem: 'BUDGET_PERIOD_INVALID' }
  }

  let amountMinor = input.amountMinor
  let distributionMinor = input.distributionMinor
  let fxRate: number | null = null

  // The control figure is the books currency, because the actuals are. A foreign
  // entry is converted at the quote for the period start, and the rate is kept
  // so the conversion can be re-done by hand.
  if (currency !== context.baseCurrency) {
    if (context.fxRate === null || !(context.fxRate > 0)) {
      return { ok: false, problem: `BUDGET_FX_RATE_MISSING: ${currency}` }
    }
    fxRate = context.fxRate
    amountMinor = Math.round(enteredMinor * fxRate)
    if (distributionMinor && distributionMinor.length > 0) {
      distributionMinor = convertParts(distributionMinor, fxRate, amountMinor)
    }
  }

  const months = MONTHS_IN[input.period]
  const periodStarts = Array.from({ length: months }, (_, i) => addBudgetMonths(input.startsOn, i))
  let amounts: number[] | null = null
  try {
    if (distributionMinor && distributionMinor.length > 0) {
      validateDistribution({ periodStarts, amountsMinor: distributionMinor })
      if (distributionMinor.reduce((s, x) => s + x, 0) !== amountMinor) {
        throw new Error('BUDGET_DISTRIBUTION_TOTAL_MISMATCH')
      }
      amounts = distributionMinor
    } else if (input.distributionWeightsBp && input.distributionWeightsBp.length > 0) {
      if (input.distributionWeightsBp.length !== months)
        throw new Error('BUDGET_DISTRIBUTION_INVALID')
      amounts = distributeByWeights(amountMinor, input.distributionWeightsBp)
    }
  } catch (err) {
    return { ok: false, problem: (err as Error).message }
  }

  return {
    ok: true,
    plan: {
      currency,
      enteredMinor,
      amountMinor,
      fxRate,
      distribution: amounts
        ? periodStarts.map((start, i) => ({ start, amount_minor: amounts![i]! }))
        : null,
    },
  }
}

// ─── Transitions ─────────────────────────────────────────────────────────────

export type BudgetTransitionProblem = 'BUDGET_INVALID_TRANSITION' | `BUDGET_OVERLAP: ${string}`

export interface BudgetTransitionPlan {
  from: BudgetStatusCode
  to: BudgetStatusCode
  /** Columns that change with the status (snake_case, as stored). */
  extra: Record<string, unknown>
}

/** draft → pending_approval. */
export function planBudgetSubmit(
  budget: PlannedBudget,
): { ok: true; plan: BudgetTransitionPlan } | { ok: false; problem: BudgetTransitionProblem } {
  if (budget.status !== 'draft') return { ok: false, problem: 'BUDGET_INVALID_TRANSITION' }
  return { ok: true, plan: { from: 'draft', to: 'pending_approval', extra: {} } }
}

function candidateOf(budget: PlannedBudget) {
  const plan = planFor(budget, budget.startsOn)
  return {
    id: budget.id,
    accountId: budget.accountId,
    type: budget.type,
    branchId: budget.branchId,
    dimensionValueId: budget.dimensionValueId,
    startsOn: plan.start,
    endsOn: plan.end,
    status: budget.status,
  }
}

/**
 * pending_approval | draft → approved.
 *
 * An approved budget may not stack on another approved one for the same scope
 * and period — the limit would silently double. (Who may approve, and the
 * separation of duties between drafter and approver, are the CALLER's: the
 * server asks its SoD policy, a one-person device has nobody to separate.)
 */
export function planBudgetApprove(
  budget: PlannedBudget,
  all: readonly PlannedBudget[],
  approver: string,
  nowIso: string,
): { ok: true; plan: BudgetTransitionPlan } | { ok: false; problem: BudgetTransitionProblem } {
  if (budget.status !== 'draft' && budget.status !== 'pending_approval') {
    return { ok: false, problem: 'BUDGET_INVALID_TRANSITION' }
  }
  const plan = planFor(budget, budget.startsOn)
  const clash = findOverlap(
    { ...candidateOf(budget), status: 'approved', endsOn: plan.end },
    all.map(candidateOf),
  )
  if (clash) return { ok: false, problem: `BUDGET_OVERLAP: ${clash.id}` }
  return {
    ok: true,
    plan: {
      from: budget.status,
      to: 'approved',
      extra: { approved_by: approver, approved_at: nowIso },
    },
  }
}

export function planBudgetArchive(
  budget: PlannedBudget,
): { ok: true; plan: BudgetTransitionPlan } | { ok: false; problem: BudgetTransitionProblem } {
  if (budget.status === 'archived') return { ok: false, problem: 'BUDGET_INVALID_TRANSITION' }
  return { ok: true, plan: { from: budget.status, to: 'archived', extra: { is_active: false } } }
}

// ─── Revising an approved budget ─────────────────────────────────────────────

export interface BudgetReviseInput {
  expectedVersion: number
  amountMinor: number
  distributionMinor?: number[] | null | undefined
  action?: BudgetAction | undefined
  warnAtPercent?: number | undefined
  reason: string
}

export interface BudgetRevisionPlan {
  revision: BudgetRevision
  amountMinor: number
  action: BudgetAction
  warnAtPercent: number
  /** The new split, by sub-period start. */
  distribution: Array<{ start: string; amount_minor: number }>
}

/** What a revision changes — or why it cannot be applied. Throws nothing. */
export function planBudgetRevision(
  budget: PlannedBudget,
  input: BudgetReviseInput,
  meta: { actorId: string; at: string },
):
  | { ok: true; plan: BudgetRevisionPlan }
  | { ok: false; problem: string; kind: 'conflict' | 'invalid' } {
  const plan = planFor(budget, budget.startsOn)
  const nextAmounts =
    input.distributionMinor && input.distributionMinor.length > 0
      ? input.distributionMinor
      : equalDistribution(input.amountMinor, plan.distribution.periodStarts.length)

  let revision: BudgetRevision
  try {
    validateDistribution({
      periodStarts: plan.distribution.periodStarts,
      amountsMinor: nextAmounts,
    })
    if (nextAmounts.reduce((s, x) => s + x, 0) !== input.amountMinor) {
      throw new Error('BUDGET_DISTRIBUTION_TOTAL_MISMATCH')
    }
    const toLines = (amounts: number[]) =>
      Object.fromEntries(plan.distribution.periodStarts.map((s, i) => [s, amounts[i] ?? 0]))
    revision = reviseBudget(
      {
        version: budget.version,
        status: budget.status === 'approved' ? 'approved' : 'draft',
        linesMinor: toLines(plan.distribution.amountsMinor),
      },
      toLines(nextAmounts),
      { reason: input.reason, actorId: meta.actorId, at: meta.at },
    )
  } catch (err) {
    const message = (err as Error).message
    return {
      ok: false,
      problem: message,
      kind: message === 'BUDGET_REVISION_REQUIRES_APPROVED' ? 'conflict' : 'invalid',
    }
  }

  if (budget.version !== input.expectedVersion) {
    return { ok: false, problem: 'BUDGET_VERSION_CONFLICT', kind: 'conflict' }
  }

  return {
    ok: true,
    plan: {
      revision,
      amountMinor: input.amountMinor,
      action: input.action ?? budget.action,
      warnAtPercent: input.warnAtPercent ?? budget.warnAtPercent,
      distribution: plan.distribution.periodStarts.map((start, i) => ({
        start,
        amount_minor: nextAmounts[i]!,
      })),
    },
  }
}

// ─── The budgets page ────────────────────────────────────────────────────────

export interface BudgetReportRow {
  budget: PlannedBudget
  periodStart: string
  periodEnd: string
  distributionKind: 'equal' | 'custom'
  distributionMismatch: boolean
  performance: BudgetPerformance
  /** Per sub-period: plan, actual, open commitments are period-level only. */
  series: Array<{ start: string; planMinor: number; actualMinor: number }>
}

export interface BudgetReport {
  onDate: string
  rows: BudgetReportRow[]
  totals: {
    expense: {
      budgetMinor: number
      actualMinor: number
      openCommitmentMinor: number
      remainingMinor: number
      forecastMinor: number | null
    }
    revenue: {
      budgetMinor: number
      actualMinor: number
      remainingMinor: number
      forecastMinor: number | null
    }
  }
  /** 'batch' = one aggregate; 'per_budget' = no per-sub-period split to show. */
  source: 'batch' | 'per_budget'
}

export interface BudgetFilter {
  type?: BudgetType | undefined
  status?: BudgetStatusCode | undefined
  branchId?: string | undefined
}

export function filterBudgets(
  all: readonly PlannedBudget[],
  filter: BudgetFilter = {},
): PlannedBudget[] {
  return all.filter(
    (b) =>
      (!filter.type || b.type === filter.type) &&
      (!filter.status || b.status === filter.status) &&
      (!filter.branchId || b.branchId === filter.branchId),
  )
}

/** The widest window the actuals of these budgets must cover. */
export function reportWindow(
  budgets: readonly PlannedBudget[],
  onDate: string,
): { start: string; end: string } | null {
  const plans = budgets.map((budget) => planFor(budget, onDate))
  if (plans.length === 0) return null
  return {
    start: plans.reduce((m, p) => (p.start < m ? p.start : m), plans[0]!.start),
    end: plans.reduce((m, p) => (p.end > m ? p.end : m), plans[0]!.end),
  }
}

/** One day's net movement on an account, in the books currency's minor units (debit − credit). */
export interface AccountDayNet {
  day: string
  net: number
}

/** A budget's actual in its period and per sub-period, from the net movement by day. */
export function actualsFromDays(
  budget: PlannedBudget,
  onDate: string,
  days: readonly AccountDayNet[],
): { actualMinor: number; seriesActual: number[] } {
  const plan = planFor(budget, onDate)
  const inPeriod = days.filter((d) => d.day >= plan.start && d.day <= plan.end)
  const starts = plan.distribution.periodStarts
  const seriesActual = starts.map((s, i) => {
    const next = starts[i + 1]
    return normalizeActual(
      budget.type,
      inPeriod
        .filter((d) => d.day >= s && (!next || d.day < next))
        .reduce((sum, d) => sum + d.net, 0),
    )
  })
  return { actualMinor: seriesActual.reduce((s, x) => s + x, 0), seriesActual }
}

export interface BudgetReportEntry {
  budget: PlannedBudget
  actualMinor: number
  openMinor: number
  /** Empty when there is no honest per-sub-period split. */
  seriesActual: number[]
}

/** The whole budgets page, from the figures the caller fetched. */
export function buildBudgetReport(
  onDate: string,
  source: BudgetReport['source'],
  entries: readonly BudgetReportEntry[],
): BudgetReport {
  const rows: BudgetReportRow[] = []
  for (const { budget, actualMinor, openMinor, seriesActual } of entries) {
    const plan = planFor(budget, onDate)
    const day = onDate.slice(0, 10)
    const totalDays = daysInclusive(plan.start, plan.end)
    const elapsedDays =
      day < plan.start ? 0 : day > plan.end ? totalDays : daysInclusive(plan.start, day)

    const perf = performance(
      {
        type: budget.type,
        budgetMinor: budget.amountMinor,
        theoreticalMinor: theoreticalToDate(plan.distribution, plan.end, onDate),
        actualMinor,
        openCommitmentMinor: budget.type === 'expense' ? openMinor : 0,
        elapsedDays,
        totalDays,
      },
      budget.warnAtPercent,
    )

    rows.push({
      budget,
      periodStart: plan.start,
      periodEnd: plan.end,
      distributionKind: plan.distributionKind,
      distributionMismatch: plan.distributionMismatch,
      performance: perf,
      series: plan.distribution.periodStarts.map((start, i) => ({
        start,
        planMinor: plan.distribution.amountsMinor[i] ?? 0,
        actualMinor: seriesActual[i] ?? 0,
      })),
    })
  }

  // Totals only over APPROVED budgets: a draft is not yet a plan anybody agreed
  // to, and summing it would overstate the budget.
  const approved = rows.filter((r) => r.budget.status === 'approved' && r.budget.isActive)
  const sumOrNull = (values: Array<number | null>) =>
    values.some((v) => v === null) ? null : values.reduce<number>((s, v) => s + (v ?? 0), 0)
  const expense = approved.filter((r) => r.budget.type === 'expense').map((r) => r.performance)
  const revenue = approved.filter((r) => r.budget.type === 'revenue').map((r) => r.performance)

  return {
    onDate,
    rows,
    totals: {
      expense: {
        budgetMinor: expense.reduce((s, p) => s + p.budgetMinor, 0),
        actualMinor: expense.reduce((s, p) => s + p.actualMinor, 0),
        openCommitmentMinor: expense.reduce((s, p) => s + p.openCommitmentMinor, 0),
        remainingMinor: expense.reduce((s, p) => s + p.remainingMinor, 0),
        forecastMinor: sumOrNull(expense.map((p) => p.forecastMinor)),
      },
      revenue: {
        budgetMinor: revenue.reduce((s, p) => s + p.budgetMinor, 0),
        actualMinor: revenue.reduce((s, p) => s + p.actualMinor, 0),
        remainingMinor: revenue.reduce((s, p) => s + p.remainingMinor, 0),
        forecastMinor: sumOrNull(revenue.map((p) => p.forecastMinor)),
      },
    },
    source,
  }
}

// ─── The spend check ─────────────────────────────────────────────────────────

export interface BudgetPosting {
  accountId: string
  dimensionValueId?: string | null | undefined
  branchId?: string | null | undefined
  amountMinor: number
  onDate: string
}

/** Only APPROVED, active EXPENSE budgets control spending — a draft is not a limit anybody agreed to. */
export function controllingBudgets(
  budgets: readonly PlannedBudget[],
  posting: BudgetPosting,
): PlannedBudget[] {
  return applicableBudgets([...budgets], posting).filter(
    (b) => (b as PlannedBudget).status === 'approved' && (b as PlannedBudget).type === 'expense',
  ) as PlannedBudget[]
}

/**
 * Whether a document may spend this much. The tightest decision wins:
 * block > require_approval > warn > allow.
 */
export function decideBudgetSpend(
  controlling: readonly PlannedBudget[],
  consumption: ReadonlyMap<string, BudgetConsumption>,
  posting: BudgetPosting,
) {
  if (controlling.length === 0) {
    return {
      allowed: true,
      decision: 'allow' as const,
      problems: [],
      warnings: [],
      impacts: [] as Array<ImpactResult & { budgetId: string }>,
    }
  }

  const statuses = controlling.map((budget) => ({
    budget,
    status: evaluate(
      budget,
      consumption.get(budget.id) ?? { actualMinor: 0, committedMinor: 0 },
      posting.onDate,
    ),
  }))

  const impacts: Array<ImpactResult & { budgetId: string }> = statuses.map(
    ({ budget, status }) => ({
      budgetId: budget.id,
      ...checkImpact(
        budget.action,
        {
          budgetMinor: status.budgetMinor,
          actualMinor: status.actualMinor,
          openCommitmentMinor: status.committedMinor,
        },
        Math.max(0, posting.amountMinor),
      ),
    }),
  )

  const rank = { allow: 0, warn: 1, require_approval: 2, block: 3 } as const
  const decision = impacts.reduce<ImpactResult['decision']>(
    (worst, i) => (rank[i.decision] > rank[worst] ? i.decision : worst),
    'allow',
  )

  const legacy = checkSpend(
    statuses.map(({ status }) => ({ status, amountMinor: posting.amountMinor })),
  )

  return {
    ...legacy,
    allowed: decision === 'allow' || decision === 'warn',
    decision,
    impacts,
  }
}
