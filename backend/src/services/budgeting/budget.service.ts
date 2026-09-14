// ============================================
// backend/src/services/budgeting/budget.service.ts
//
// Budgets, and the commitment ledger that makes them a control rather than a
// retrospective report.
//
// This is the ONE place budget numbers are produced. The page, the purchase
// check and anything that explains a budget read `performanceReport` /
// `checkImpact`; none of them recompute. Every formula lives in
// budget.domain.ts; this file only fetches, authorizes and persists.
//
// ---------------------------------------------------------------------------
// SCHEMA TOLERANCE
//
// docs/budget-planning-migration.sql adds type, status, version, distribution,
// consumed commitments and revisions. Until a human runs it:
//   * reads fall back to the legacy columns (every legacy budget is an
//     approved expense budget with an equal split — which is what it was);
//   * writes that need the new columns refuse with BUDGET_MIGRATION_REQUIRED
//     rather than silently dropping the approval or the revision.
// ============================================

import { supabase } from '../../db'
import { ForbiddenError } from '../../errors/auth.error'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { memoryCache } from '../../utils/pagination'
import type { TenancyContext } from '../tenancy.service'
import { holds, type Capability } from '../authorization/authorization.domain'
import { callAggregate } from '../aggregates/aggregate-rpc'
import { fetchBudgetConsumptionAggregate } from '../aggregates/ledger-aggregates'
import { AuditService } from '../audit.service'
import { sod } from '../authorization'
import { CurrencyService } from '../currency/currency.service'
import { z } from 'zod'

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
  varianceReport,
  type Budget,
  type BudgetAction,
  type BudgetDistribution,
  type BudgetPerformance,
  type BudgetPeriod,
  type BudgetStatus,
  type BudgetType,
  type ImpactResult,
} from './budget.domain'

const LEGACY_COLUMNS =
  'id, account_id, dimension_value_id, branch_id, period, starts_on, amount_minor, action, warn_at_percent, is_active'

const PLANNING_COLUMNS = `${LEGACY_COLUMNS}, name, budget_type, status, version, distribution, notes, approved_by, approved_at, created_by`

/** docs/budget-currency-migration.sql. */
const COLUMNS = `${PLANNING_COLUMNS}, currency, amount_currency_minor, fx_rate`

/** The ledger's currency. Every actual a budget is compared with is in it. */
export const BASE_CURRENCY = 'AFN'
export const BUDGET_CURRENCIES = ['AFN', 'USD', 'PKR', 'IRR'] as const
export type BudgetCurrency = (typeof BUDGET_CURRENCIES)[number]

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
  /** The currency the amount was ENTERED in. `amountMinor` is always base. */
  currency: BudgetCurrency
  /** The entered amount, in `currency` minor units. */
  amountCurrencyMinor: number
  /** Base units per 1 unit of `currency`, fixed at save. null for AFN. */
  fxRate: number | null
}

/** 42703 undefined column / 42P01 undefined table — the migration has not run. */
function isMissingSchema(error: { code?: string } | null): boolean {
  return !!error && (error.code === '42703' || error.code === '42P01' || error.code === 'PGRST204')
}

const distributionSchema = z
  .array(z.object({ start: z.string(), amount_minor: z.number().int().nonnegative() }))
  .nullable()

function mapBudget(raw: Record<string, any>): PlannedBudget {
  const parsed = distributionSchema.safeParse(raw.distribution ?? null)
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
    isActive: raw.is_active !== false,
    name: raw.name ?? null,
    // Legacy rows (no column yet) were expense controls — see the migration.
    type: raw.budget_type === 'revenue' ? 'revenue' : 'expense',
    status: (raw.status as BudgetStatusCode | undefined) ?? 'approved',
    version: Number(raw.version) || 1,
    distribution:
      parsed.success && parsed.data
        ? parsed.data.map((d) => ({ start: d.start.slice(0, 10), amountMinor: d.amount_minor }))
        : null,
    notes: raw.notes ?? null,
    approvedBy: raw.approved_by ?? null,
    approvedAt: raw.approved_at ?? null,
    createdBy: raw.created_by ?? null,
    currency: (BUDGET_CURRENCIES as readonly string[]).includes(raw.currency)
      ? raw.currency
      : BASE_CURRENCY,
    // NULL on rows entered before the column existed: they were entered in AFN.
    amountCurrencyMinor:
      raw.amount_currency_minor === null || raw.amount_currency_minor === undefined
        ? Number(raw.amount_minor) || 0
        : Number(raw.amount_currency_minor) || 0,
    fxRate: raw.fx_rate === null || raw.fx_rate === undefined ? null : Number(raw.fx_rate),
  }
}

const MONTHS_IN: Record<BudgetPeriod, number> = { monthly: 1, quarterly: 3, yearly: 12 }

function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  const day = d.getUTCDate()
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, day))
  return out.toISOString().slice(0, 10)
}

function daysInclusive(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000) + 1
}

/** The sub-period plan for the period containing `onDate`. */
export function planFor(budget: PlannedBudget, onDate: string) {
  const { start, end } = periodFor(budget, onDate)
  const months = MONTHS_IN[budget.period]
  const periodStarts = Array.from({ length: months }, (_, i) => addMonths(start, i))

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
 * Convert entered sub-period amounts to base currency so they still sum to
 * exactly `baseTotal`: each part is rounded, the remainder lands on the last.
 */
export function convertParts(parts: number[], rate: number, baseTotal: number): number[] {
  const converted = parts.map((part) => Math.round(part * rate))
  const drift = baseTotal - converted.reduce((s, x) => s + x, 0)
  if (converted.length > 0)
    converted[converted.length - 1] = Math.max(0, converted[converted.length - 1]! + drift)
  return converted
}

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
  /** 'batch' = one aggregate call; 'per_budget' = migration not run yet. */
  source: 'batch' | 'per_budget'
}

const batchSchema = z.object({
  actuals: z.array(
    z.object({ account_id: z.string(), day: z.string(), net_minor: z.number().int() }),
  ),
  commitments: z.array(z.object({ budget_id: z.string(), open_minor: z.number().int() })),
})

export class BudgetService {
  private audit = new AuditService()
  private currencies = new CurrencyService()

  private async invalidate(workspaceId: string) {
    await memoryCache.invalidate(`budget:${workspaceId}`)
  }

  /** The existing capability table decides — never a role string compared here. */
  private assertCan(ctx: TenancyContext, capability: Capability) {
    if (!holds(ctx, capability)) {
      throw new ForbiddenError(`BUDGET_FORBIDDEN: ${capability}`)
    }
  }

  private async writeAudit(
    ctx: TenancyContext,
    action: string,
    entityId: string,
    oldData: unknown,
    newData: unknown,
  ) {
    // An audit row that fails to write must not undo a saved budget, but it
    // must not vanish either: it is logged loudly.
    try {
      await this.audit.log({
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        action,
        entityType: 'budget',
        entityId,
        oldData: oldData as Record<string, unknown> | undefined,
        newData: newData as Record<string, unknown> | undefined,
      } as Parameters<AuditService['log']>[0])
    } catch (err) {
      console.error('[Budget] audit write failed:', action, entityId, err)
    }
  }

  async list(ctx: TenancyContext): Promise<PlannedBudget[]> {
    const cacheKey = `budget:${ctx.workspaceId}:list`

    const cached = await memoryCache.get<PlannedBudget[]>(cacheKey)
    if (cached) return cached

    const read = (columns: string) =>
      supabase
        .from('budgets')
        .select(columns)
        .eq('workspace_id', ctx.workspaceId)
        .order('starts_on', { ascending: false })
        .limit(500)

    // Newest schema first, then each older one — a missing currency migration
    // must not also hide the planning columns.
    let { data, error } = await read(COLUMNS)
    if (error && isMissingSchema(error)) ({ data, error } = await read(PLANNING_COLUMNS))
    if (error && isMissingSchema(error)) ({ data, error } = await read(LEGACY_COLUMNS))

    if (error) throw new DatabaseError('Failed to fetch budgets', error)

    const budgets = ((data ?? []) as unknown as Record<string, any>[]).map(mapBudget)
    await memoryCache.set(cacheKey, budgets, 300)
    return budgets
  }

  private async getOne(ctx: TenancyContext, id: string): Promise<PlannedBudget> {
    const budget = (await this.list(ctx)).find((b) => b.id === id)
    if (!budget) throw new NotFoundError('Budget')
    return budget
  }

  /**
   * Create or edit a DRAFT. An approved budget is never overwritten — it is
   * revised (`revise`), which keeps the previous version.
   */
  async upsert(
    ctx: TenancyContext,
    input: Budget & {
      name?: string | null | undefined
      type?: BudgetType | undefined
      notes?: string | null | undefined
      /** Basis points per sub-period (sum 10 000), or explicit minor units. */
      distributionWeightsBp?: number[] | null | undefined
      distributionMinor?: number[] | null | undefined
      /** The currency `amountMinor` (and `distributionMinor`) were entered in. */
      currency?: BudgetCurrency | undefined
    },
  ): Promise<PlannedBudget> {
    this.assertCan(ctx, 'budget.manage')

    const currency: BudgetCurrency = input.currency ?? BASE_CURRENCY
    const enteredMinor = input.amountMinor
    let fxRate: number | null = null

    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 0) {
      throw new ValidationError('BUDGET_AMOUNT_INVALID')
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startsOn) || Number.isNaN(Date.parse(input.startsOn))) {
      throw new ValidationError('BUDGET_PERIOD_INVALID')
    }

    const existing = (await this.list(ctx)).find((b) => b.id === input.id)
    if (existing && existing.status === 'approved') {
      throw new ConflictError('BUDGET_APPROVED_REQUIRES_REVISION')
    }

    // The account must be this workspace's — a foreign key proves it exists,
    // not whose it is.
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, type')
      .eq('id', input.accountId)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()
    if (accountError) throw new DatabaseError('Failed to verify the account', accountError)
    if (!account) throw new ValidationError('BUDGET_ACCOUNT_INVALID')

    if (input.branchId) {
      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .select('id')
        .eq('id', input.branchId)
        .eq('workspace_id', ctx.workspaceId)
        .maybeSingle()
      if (branchError) throw new DatabaseError('Failed to verify the branch', branchError)
      if (!branch) throw new ValidationError('BUDGET_BRANCH_INVALID')
    }

    // ─── Currency ─────────────────────────────────────────────────────────
    // The control figure is base currency, because the actuals are. A foreign
    // entry is converted at the workspace's own quote for the period start —
    // the most recent ON OR BEFORE it, never a later one — and the rate is
    // stored so the conversion can be re-done by hand.
    if (currency !== BASE_CURRENCY) {
      const quote = await this.currencies.getRateFor(ctx, currency, input.startsOn)
      if ('error' in quote) throw new ValidationError(`BUDGET_FX_RATE_MISSING: ${currency}`)
      fxRate = quote.rate
      input = {
        ...input,
        amountMinor: Math.round(enteredMinor * quote.rate),
        ...(input.distributionMinor && input.distributionMinor.length > 0
          ? {
              distributionMinor: convertParts(
                input.distributionMinor,
                quote.rate,
                Math.round(enteredMinor * quote.rate),
              ),
            }
          : {}),
      }
    }

    const months = MONTHS_IN[input.period]
    const periodStarts = Array.from({ length: months }, (_, i) => addMonths(input.startsOn, i))
    let amounts: number[] | null = null
    try {
      if (input.distributionMinor && input.distributionMinor.length > 0) {
        validateDistribution({ periodStarts, amountsMinor: input.distributionMinor })
        if (input.distributionMinor.reduce((s, x) => s + x, 0) !== input.amountMinor) {
          throw new Error('BUDGET_DISTRIBUTION_TOTAL_MISMATCH')
        }
        amounts = input.distributionMinor
      } else if (input.distributionWeightsBp && input.distributionWeightsBp.length > 0) {
        if (input.distributionWeightsBp.length !== months)
          throw new Error('BUDGET_DISTRIBUTION_INVALID')
        amounts = distributeByWeights(input.amountMinor, input.distributionWeightsBp)
      }
    } catch (err) {
      throw new ValidationError((err as Error).message)
    }

    const row: Record<string, unknown> = {
      id: input.id,
      workspace_id: ctx.workspaceId,
      account_id: input.accountId,
      dimension_value_id: input.dimensionValueId ?? null,
      branch_id: input.branchId ?? null,
      period: input.period,
      starts_on: input.startsOn,
      amount_minor: input.amountMinor,
      action: input.action,
      warn_at_percent: input.warnAtPercent,
      is_active: input.isActive,
      name: input.name ?? null,
      budget_type: input.type ?? 'expense',
      notes: input.notes ?? null,
      distribution: amounts
        ? periodStarts.map((start, i) => ({ start, amount_minor: amounts![i] }))
        : null,
      updated_at: new Date().toISOString(),
      currency,
      amount_currency_minor: enteredMinor,
      fx_rate: fxRate,
      ...(existing ? {} : { status: 'draft', version: 1, created_by: ctx.userId }),
    }

    let { data, error } = await supabase
      .from('budgets')
      .upsert(row, { onConflict: 'id' })
      .select(COLUMNS)
      .single()

    // Before the currency migration an AFN budget still saves; a foreign one
    // cannot, because dropping its currency would store a dollar figure as
    // afghanis.
    if (error && isMissingSchema(error) && currency === BASE_CURRENCY) {
      const { currency: _c, amount_currency_minor: _a, fx_rate: _f, ...planningRow } = row
      ;({ data, error } = await supabase
        .from('budgets')
        .upsert(planningRow, { onConflict: 'id' })
        .select(PLANNING_COLUMNS)
        .single())
    }

    if (error && isMissingSchema(error)) throw new ConflictError('BUDGET_MIGRATION_REQUIRED')
    if (error) throw new DatabaseError('Failed to save the budget', error)

    await this.invalidate(ctx.workspaceId)
    const saved = mapBudget(data as Record<string, any>)
    // SoD: index who drafted/edited this budget, so approval can be separated.
    await sod.recordAction(ctx, 'budget.manage', 'budget', saved.id)
    await this.writeAudit(
      ctx,
      existing ? 'budget.update' : 'budget.create',
      saved.id,
      existing,
      saved,
    )
    return saved
  }

  /** draft → pending_approval. Anyone who may manage budgets. */
  async submit(ctx: TenancyContext, id: string): Promise<PlannedBudget> {
    this.assertCan(ctx, 'budget.manage')
    return this.transition(ctx, id, 'draft', 'pending_approval', {})
  }

  /**
   * pending_approval | draft → approved.
   *
   * Separation of duties goes through the workspace's SoD policy
   * (`budget.draft-then-approve`), not a rule of its own: `off` for a
   * one-person shop (the default), `warn` allows the drafter to approve with a
   * recorded override reason, `strict` refuses.
   */
  async approve(
    ctx: TenancyContext,
    id: string,
    override?: { reason: string } | undefined,
  ): Promise<PlannedBudget> {
    this.assertCan(ctx, 'budget.approve')
    const budget = await this.getOne(ctx, id)

    if (budget.status !== 'draft' && budget.status !== 'pending_approval') {
      throw new ConflictError('BUDGET_INVALID_TRANSITION')
    }
    await sod.assertAllowed(ctx, 'budget.approve', 'budget', id, override)

    // An approved budget may not stack on another approved one for the same
    // scope and period — the limit would silently double.
    const plan = planFor(budget, budget.startsOn)
    const toCandidate = (b: PlannedBudget) => {
      const p = planFor(b, b.startsOn)
      return {
        id: b.id,
        accountId: b.accountId,
        type: b.type,
        branchId: b.branchId,
        dimensionValueId: b.dimensionValueId,
        startsOn: p.start,
        endsOn: p.end,
        status: b.status,
      }
    }
    const clash = findOverlap(
      { ...toCandidate(budget), status: 'approved', endsOn: plan.end },
      (await this.list(ctx)).map(toCandidate),
    )
    if (clash) throw new ConflictError(`BUDGET_OVERLAP: ${clash.id}`)

    return this.transition(ctx, id, budget.status, 'approved', {
      approved_by: ctx.userId,
      approved_at: new Date().toISOString(),
    })
  }

  async archive(ctx: TenancyContext, id: string): Promise<PlannedBudget> {
    this.assertCan(ctx, 'budget.approve')
    const budget = await this.getOne(ctx, id)
    if (budget.status === 'archived') throw new ConflictError('BUDGET_INVALID_TRANSITION')
    return this.transition(ctx, id, budget.status, 'archived', { is_active: false })
  }

  private async transition(
    ctx: TenancyContext,
    id: string,
    from: BudgetStatusCode,
    to: BudgetStatusCode,
    extra: Record<string, unknown>,
  ): Promise<PlannedBudget> {
    const before = await this.getOne(ctx, id)
    if (before.status !== from) throw new ConflictError('BUDGET_INVALID_TRANSITION')

    // Guarded on the status we read: a concurrent transition updates nothing.
    const { data, error } = await supabase
      .from('budgets')
      .update({ status: to, updated_at: new Date().toISOString(), ...extra })
      .eq('id', id)
      .eq('workspace_id', ctx.workspaceId)
      .eq('status', from)
      .select(COLUMNS)
      .maybeSingle()

    if (error && isMissingSchema(error)) throw new ConflictError('BUDGET_MIGRATION_REQUIRED')
    if (error) throw new DatabaseError('Failed to change the budget status', error)
    if (!data) throw new ConflictError('BUDGET_INVALID_TRANSITION')

    await this.invalidate(ctx.workspaceId)
    const after = mapBudget(data as Record<string, any>)
    await this.writeAudit(ctx, `budget.${to}`, id, { status: from }, { status: to })
    return after
  }

  /**
   * Revise an APPROVED budget. The previous version survives in
   * budget_revisions; posted journal entries are never touched. Atomic and
   * version-locked in `budget_apply_revision`.
   */
  async revise(
    ctx: TenancyContext,
    id: string,
    input: {
      expectedVersion: number
      amountMinor: number
      distributionMinor?: number[] | null | undefined
      action?: BudgetAction | undefined
      warnAtPercent?: number | undefined
      reason: string
    },
  ) {
    this.assertCan(ctx, 'budget.approve')
    const budget = await this.getOne(ctx, id)
    const plan = planFor(budget, budget.startsOn)

    const nextAmounts =
      input.distributionMinor && input.distributionMinor.length > 0
        ? input.distributionMinor
        : equalDistribution(input.amountMinor, plan.distribution.periodStarts.length)

    let revision
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
        { reason: input.reason, actorId: ctx.userId, at: new Date().toISOString() },
      )
    } catch (err) {
      const message = (err as Error).message
      if (message === 'BUDGET_REVISION_REQUIRES_APPROVED') throw new ConflictError(message)
      throw new ValidationError(message)
    }

    if (budget.version !== input.expectedVersion) throw new ConflictError('BUDGET_VERSION_CONFLICT')

    const { data, error } = await supabase.rpc('budget_apply_revision', {
      p_workspace_id: ctx.workspaceId,
      p_budget_id: id,
      p_expected_version: input.expectedVersion,
      p_amount_minor: input.amountMinor,
      p_distribution: plan.distribution.periodStarts.map((start, i) => ({
        start,
        amount_minor: nextAmounts[i],
      })),
      p_action: input.action ?? budget.action,
      p_reason: revision.reason,
      p_warn_at_percent: input.warnAtPercent ?? budget.warnAtPercent,
      p_actor_id: ctx.userId,
      p_lines: revision.lines.map((l) => ({
        line_key: l.lineKey,
        before_minor: l.beforeMinor,
        after_minor: l.afterMinor,
      })),
    })

    if (error) {
      const message = error.message ?? ''
      if (error.code === 'PGRST202' || error.code === '42883')
        throw new ConflictError('BUDGET_MIGRATION_REQUIRED')
      if (message.includes('BUDGET_VERSION_CONFLICT'))
        throw new ConflictError('BUDGET_VERSION_CONFLICT')
      if (message.includes('BUDGET_REVISION_REQUIRES_APPROVED'))
        throw new ConflictError('BUDGET_REVISION_REQUIRES_APPROVED')
      throw new DatabaseError('Failed to revise the budget', error)
    }

    await this.invalidate(ctx.workspaceId)
    await this.writeAudit(
      ctx,
      'budget.revise',
      id,
      { version: budget.version },
      { version: revision.version, reason: revision.reason },
    )
    return { ...revision, result: data }
  }

  async revisions(ctx: TenancyContext, id: string) {
    this.assertCan(ctx, 'budget.read')
    await this.getOne(ctx, id)

    const { data, error } = await supabase
      .from('budget_revisions')
      .select(
        'id, version, previous_version, reason, actor_id, previous_values, new_values, lines, approved_by, created_at',
      )
      .eq('workspace_id', ctx.workspaceId)
      .eq('budget_id', id)
      .order('version', { ascending: false })
      .limit(200)

    // Before the migration there is no history table — and no revisions.
    if (error && isMissingSchema(error)) return []
    if (error) throw new DatabaseError('Failed to fetch budget revisions', error)
    return data ?? []
  }

  /**
   * Actual and open committed spend for a budget in the period containing
   * `onDate`, in the budget's natural sign.
   */
  private async consumptionFor(ctx: TenancyContext, budget: PlannedBudget, onDate: string) {
    const { start, end } = periodFor(budget, onDate)

    // ⚠️ AGGREGATED IN POSTGRES FIRST. This figure decides whether spending is
    // BLOCKED; the row reads below were `.limit(10_000)` / `.limit(5000)`,
    // which PostgREST cuts to max-rows (1000), so an understated actual let
    // spending through. They run only while `budget_consumption` is missing.
    const aggregate = await fetchBudgetConsumptionAggregate(
      ctx.workspaceId,
      budget.id,
      budget.accountId,
      start,
      end,
    )
    if (aggregate) {
      return {
        actualMinor: normalizeActual(budget.type, aggregate.actualMinor),
        committedMinor: aggregate.committedMinor,
      }
    }

    const [actual, committed] = await Promise.all([
      supabase
        .from('journal_lines')
        .select('debit, credit, journal:journal_entries!inner(date, status, workspace_id)')
        .eq('workspace_id', ctx.workspaceId)
        .eq('account_id', budget.accountId)
        .eq('journal.status', 'posted')
        .gte('journal.date', start)
        .lte('journal.date', end)
        .limit(10_000),
      supabase
        .from('budget_commitments')
        .select('amount_minor')
        .eq('workspace_id', ctx.workspaceId)
        .eq('budget_id', budget.id)
        .is('released_at', null)
        .limit(5000),
    ])

    if (actual.error) throw new DatabaseError('Failed to read actual spend', actual.error)
    if (committed.error) throw new DatabaseError('Failed to read commitments', committed.error)

    const net = (actual.data ?? []).reduce(
      (sum, row: any) =>
        sum + Math.round(((Number(row.debit) || 0) - (Number(row.credit) || 0)) * 100),
      0,
    )

    return {
      actualMinor: normalizeActual(budget.type, net),
      committedMinor: (committed.data ?? []).reduce(
        (sum, row) => sum + (Number(row.amount_minor) || 0),
        0,
      ),
    }
  }

  /**
   * The whole budgets page in one bounded query set: one list read and one
   * `budget_performance_batch` call, regardless of how many budgets exist.
   */
  async performanceReport(
    ctx: TenancyContext,
    onDate: string,
    filter: {
      type?: BudgetType | undefined
      status?: BudgetStatusCode | undefined
      branchId?: string | undefined
    } = {},
  ): Promise<BudgetReport> {
    this.assertCan(ctx, 'budget.read')

    const all = await this.list(ctx)
    const budgets = all.filter(
      (b) =>
        (!filter.type || b.type === filter.type) &&
        (!filter.status || b.status === filter.status) &&
        (!filter.branchId || b.branchId === filter.branchId),
    )

    const plans = budgets.map((budget) => ({ budget, plan: planFor(budget, onDate) }))

    let source: BudgetReport['source'] = 'batch'
    const netByAccountDay = new Map<string, Array<{ day: string; net: number }>>()
    const openByBudget = new Map<string, number>()

    if (plans.length > 0) {
      const minStart = plans.reduce(
        (m, p) => (p.plan.start < m ? p.plan.start : m),
        plans[0]!.plan.start,
      )
      const maxEnd = plans.reduce((m, p) => (p.plan.end > m ? p.plan.end : m), plans[0]!.plan.end)

      const batch = await callAggregate(
        'budget_performance_batch',
        { p_workspace_id: ctx.workspaceId, p_start: minStart, p_end: maxEnd },
        batchSchema,
      )

      if (batch) {
        for (const a of batch.actuals) {
          const list = netByAccountDay.get(a.account_id) ?? []
          list.push({ day: a.day.slice(0, 10), net: a.net_minor })
          netByAccountDay.set(a.account_id, list)
        }
        for (const c of batch.commitments) openByBudget.set(c.budget_id, c.open_minor)
      } else {
        source = 'per_budget'
      }
    }

    const rows: BudgetReportRow[] = []
    for (const { budget, plan } of plans) {
      let actualMinor: number
      let openMinor: number
      let seriesActual: number[]

      if (source === 'batch') {
        const days = (netByAccountDay.get(budget.accountId) ?? []).filter(
          (d) => d.day >= plan.start && d.day <= plan.end,
        )
        const starts = plan.distribution.periodStarts
        seriesActual = starts.map((s, i) => {
          const next = starts[i + 1]
          return normalizeActual(
            budget.type,
            days
              .filter((d) => d.day >= s && (!next || d.day < next))
              .reduce((sum, d) => sum + d.net, 0),
          )
        })
        actualMinor = seriesActual.reduce((s, x) => s + x, 0)
        openMinor = openByBudget.get(budget.id) ?? 0
      } else {
        const c = await this.consumptionFor(ctx, budget, onDate)
        actualMinor = c.actualMinor
        openMinor = c.committedMinor
        // Without the batch there is no per-sub-period split to show honestly.
        seriesActual = []
      }

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

    // Totals only over APPROVED budgets: a draft is not yet a plan anybody
    // agreed to, and summing it would overstate the budget.
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

  async getStatus(ctx: TenancyContext, budgetId: string, onDate: string): Promise<BudgetStatus> {
    const budget = await this.getOne(ctx, budgetId)
    return evaluate(budget, await this.consumptionFor(ctx, budget, onDate), onDate)
  }

  /**
   * Whether a document may spend this much on this account.
   *
   * Called BEFORE the money is committed. Only APPROVED, active EXPENSE
   * budgets control spending — a draft is not yet a limit anybody agreed to.
   * The tightest decision wins: block > require_approval > warn > allow.
   */
  async checkSpend(
    ctx: TenancyContext,
    posting: {
      accountId: string
      dimensionValueId?: string | null | undefined
      branchId?: string | null | undefined
      amountMinor: number
      onDate: string
    },
  ) {
    const controlling = applicableBudgets(await this.list(ctx), posting).filter(
      (b) => (b as PlannedBudget).status === 'approved' && (b as PlannedBudget).type === 'expense',
    ) as PlannedBudget[]

    if (controlling.length === 0) {
      return { allowed: true, decision: 'allow' as const, problems: [], warnings: [], impacts: [] }
    }

    const statuses = await Promise.all(
      controlling.map(async (budget) => ({
        budget,
        status: evaluate(
          budget,
          await this.consumptionFor(ctx, budget, posting.onDate),
          posting.onDate,
        ),
      })),
    )

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

  /**
   * Reserve budget against a document that has not spent it yet.
   *
   * Keyed on (budget, sourceType, sourceId) so a re-submitted purchase order
   * does not reserve the money twice.
   */
  async commit(
    ctx: TenancyContext,
    input: { budgetId: string; sourceType: string; sourceId: string; amountMinor: number },
  ) {
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 0) {
      throw new ValidationError('BUDGET_AMOUNT_INVALID')
    }
    const { error } = await supabase.from('budget_commitments').upsert(
      {
        workspace_id: ctx.workspaceId,
        budget_id: input.budgetId,
        source_type: input.sourceType,
        source_id: input.sourceId,
        amount_minor: input.amountMinor,
      },
      { onConflict: 'workspace_id,budget_id,source_type,source_id' },
    )

    if (error) throw new DatabaseError('Failed to commit budget', error)
    await this.invalidate(ctx.workspaceId)
  }

  /**
   * Mark how much of a commitment has become actual.
   *
   * ABSOLUTE, not incremental: `consumedMinor` is the total posted against the
   * source so far, so replaying the same receipt does not consume twice. Open
   * = amount − consumed, which keeps remaining unchanged as money moves from
   * committed to actual.
   */
  async consume(ctx: TenancyContext, sourceType: string, sourceId: string, consumedMinor: number) {
    if (!Number.isSafeInteger(consumedMinor) || consumedMinor < 0) {
      throw new ValidationError('BUDGET_AMOUNT_INVALID')
    }

    const { data, error } = await supabase
      .from('budget_commitments')
      .select('id, amount_minor')
      .eq('workspace_id', ctx.workspaceId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .is('released_at', null)

    if (error && isMissingSchema(error)) throw new ConflictError('BUDGET_MIGRATION_REQUIRED')
    if (error) throw new DatabaseError('Failed to read the commitment', error)

    for (const row of (data ?? []) as Array<{ id: string; amount_minor: number }>) {
      const { error: updateError } = await supabase
        .from('budget_commitments')
        .update({ consumed_minor: Math.min(Number(row.amount_minor) || 0, consumedMinor) })
        .eq('id', row.id)
        .eq('workspace_id', ctx.workspaceId)

      if (updateError && isMissingSchema(updateError))
        throw new ConflictError('BUDGET_MIGRATION_REQUIRED')
      if (updateError) throw new DatabaseError('Failed to consume the commitment', updateError)
    }

    await this.invalidate(ctx.workspaceId)
  }

  /**
   * Release a commitment once it has become a real posting — or was cancelled.
   *
   * Without this the same money is counted twice: once as committed and once
   * as actual, and the budget looks exhausted at half its spend.
   */
  async release(ctx: TenancyContext, sourceType: string, sourceId: string) {
    const { error } = await supabase
      .from('budget_commitments')
      .update({ released_at: new Date().toISOString() })
      .eq('workspace_id', ctx.workspaceId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .is('released_at', null)

    if (error) throw new DatabaseError('Failed to release the commitment', error)
    await this.invalidate(ctx.workspaceId)
  }

  /** Every breach, whatever the action taken. A warn budget still records. */
  async recordBreach(
    ctx: TenancyContext,
    input: {
      budgetId: string
      sourceType: string
      sourceId: string
      overByMinor: number
      actionTaken: string
    },
  ) {
    const { error } = await supabase.from('budget_breaches').insert({
      workspace_id: ctx.workspaceId,
      budget_id: input.budgetId,
      source_type: input.sourceType,
      source_id: input.sourceId,
      over_by_minor: input.overByMinor,
      action_taken: input.actionTaken,
      actor_id: ctx.userId,
    })

    if (error) console.error('[Budget] failed to record a breach:', error)
  }

  /**
   * Budget against actual, by period — built from `performanceReport`, so it
   * is one aggregate call rather than one query per budget.
   */
  async getVariance(ctx: TenancyContext, onDate: string) {
    const report = await this.performanceReport(ctx, onDate)
    return varianceReport(
      report.rows.map((row) => ({
        budget: row.budget,
        periodStart: row.periodStart,
        actualMinor: row.performance.actualMinor,
      })),
    )
  }
}
