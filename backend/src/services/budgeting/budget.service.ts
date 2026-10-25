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

import { selectAllPages } from '../../utils/fetch-all-pages'
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
  BUDGET_CURRENCIES,
  actualsFromDays,
  buildBudgetReport,
  controllingBudgets,
  convertParts,
  decideBudgetSpend,
  evaluate,
  filterBudgets,
  mapBudget,
  normalizeActual,
  periodFor,
  planBudgetApprove,
  planBudgetArchive,
  planBudgetRevision,
  planBudgetSave,
  planFor,
  reportWindow,
  varianceReport,
  type AccountDayNet,
  type Budget,
  type BudgetAction,
  type BudgetConsumption,
  type BudgetReport,
  type BudgetReportEntry,
  type BudgetReportRow,
  type BudgetStatus,
  type BudgetStatusCode,
  type BudgetType,
  type PlannedBudget,
} from '@hisabche/validation'

const LEGACY_COLUMNS =
  'id, account_id, dimension_value_id, branch_id, period, starts_on, amount_minor, action, warn_at_percent, is_active'

const PLANNING_COLUMNS = `${LEGACY_COLUMNS}, name, budget_type, status, version, distribution, notes, approved_by, approved_at, created_by`

/** docs/budget-currency-migration.sql. */
const COLUMNS = `${PLANNING_COLUMNS}, currency, amount_currency_minor, fx_rate`

/** The ledger's currency. Every actual a budget is compared with is in it. */
export const BASE_CURRENCY = 'AFN'
export { BUDGET_CURRENCIES, convertParts, planFor }
export type { BudgetReport, BudgetReportRow, BudgetStatusCode, PlannedBudget }
export type BudgetCurrency = (typeof BUDGET_CURRENCIES)[number]

/** 42703 undefined column / 42P01 undefined table — the migration has not run. */
function isMissingSchema(error: { code?: string } | null): boolean {
  return !!error && (error.code === '42703' || error.code === '42P01' || error.code === 'PGRST204')
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

    const budgets = ((data ?? []) as unknown as Record<string, any>[]).map((raw) =>
      mapBudget(raw, BASE_CURRENCY),
    )
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

    const currency: BudgetCurrency = (input.currency ?? BASE_CURRENCY) as BudgetCurrency

    // The amount and the period are checked first, by the SHARED rule
    // (planBudgetSave); only the FX quote is missing at this point.
    const early = planBudgetSave(input, { baseCurrency: BASE_CURRENCY, fxRate: null })
    if (!early.ok && !early.problem.startsWith('BUDGET_FX_RATE_MISSING')) {
      throw new ValidationError(early.problem)
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
    let quoteRate: number | null = null
    if (currency !== BASE_CURRENCY) {
      const quote = await this.currencies.getRateFor(ctx, currency, input.startsOn)
      if ('error' in quote) throw new ValidationError(`BUDGET_FX_RATE_MISSING: ${currency}`)
      quoteRate = quote.rate
    }
    const planned = planBudgetSave(input, { baseCurrency: BASE_CURRENCY, fxRate: quoteRate })
    if (!planned.ok) throw new ValidationError(planned.problem)
    const { amountMinor, enteredMinor, fxRate, distribution: amounts } = planned.plan

    const row: Record<string, unknown> = {
      id: input.id,
      workspace_id: ctx.workspaceId,
      account_id: input.accountId,
      dimension_value_id: input.dimensionValueId ?? null,
      branch_id: input.branchId ?? null,
      period: input.period,
      starts_on: input.startsOn,
      amount_minor: amountMinor,
      action: input.action,
      warn_at_percent: input.warnAtPercent,
      is_active: input.isActive,
      name: input.name ?? null,
      budget_type: input.type ?? 'expense',
      notes: input.notes ?? null,
      distribution: amounts,
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
    const saved = mapBudget(data as Record<string, any>, BASE_CURRENCY)
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

    const planned = planBudgetApprove(
      budget,
      await this.list(ctx),
      ctx.userId,
      new Date().toISOString(),
    )
    if (!planned.ok && planned.problem === 'BUDGET_INVALID_TRANSITION') {
      throw new ConflictError(planned.problem)
    }
    await sod.assertAllowed(ctx, 'budget.approve', 'budget', id, override)
    // An approved budget may not stack on another approved one for the same
    // scope and period — the limit would silently double.
    if (!planned.ok) throw new ConflictError(planned.problem)

    return this.transition(ctx, id, planned.plan.from, 'approved', planned.plan.extra)
  }

  async archive(ctx: TenancyContext, id: string): Promise<PlannedBudget> {
    this.assertCan(ctx, 'budget.approve')
    const budget = await this.getOne(ctx, id)
    const planned = planBudgetArchive(budget)
    if (!planned.ok) throw new ConflictError(planned.problem)
    return this.transition(ctx, id, planned.plan.from, 'archived', planned.plan.extra)
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
    const after = mapBudget(data as Record<string, any>, BASE_CURRENCY)
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
    const planned = planBudgetRevision(budget, input, {
      actorId: ctx.userId,
      at: new Date().toISOString(),
    })
    if (!planned.ok) {
      throw planned.kind === 'conflict'
        ? new ConflictError(planned.problem)
        : new ValidationError(planned.problem)
    }
    const { revision } = planned.plan

    const { data, error } = await supabase.rpc('budget_apply_revision', {
      p_workspace_id: ctx.workspaceId,
      p_budget_id: id,
      p_expected_version: input.expectedVersion,
      p_amount_minor: planned.plan.amountMinor,
      p_distribution: planned.plan.distribution,
      p_action: planned.plan.action,
      p_reason: revision.reason,
      p_warn_at_percent: planned.plan.warnAtPercent,
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
      // Every row (27 Sep 2026): `.limit(10_000)` was cut to 1000 by PostgREST,
      // and this sum is the budget's actual.
      selectAllPages((from, to) =>
        supabase
          .from('journal_lines')
          .select('debit, credit, journal:journal_entries!inner(date, status, workspace_id)')
          .eq('workspace_id', ctx.workspaceId)
          .eq('account_id', budget.accountId)
          .eq('journal.status', 'posted')
          .gte('journal.date', start)
          .lte('journal.date', end)
          .order('id', { ascending: true })
          .range(from, to),
      ),
      selectAllPages((lo, hi) =>
        supabase
          .from('budget_commitments')
          .select('amount_minor')
          .eq('workspace_id', ctx.workspaceId)
          .eq('budget_id', budget.id)
          .is('released_at', null)
          .order('id', { ascending: true })
          .range(lo, hi),
      ),
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

    const budgets = filterBudgets(await this.list(ctx), filter)

    let source: BudgetReport['source'] = 'batch'
    const netByAccountDay = new Map<string, AccountDayNet[]>()
    const openByBudget = new Map<string, number>()

    const window = reportWindow(budgets, onDate)
    if (window) {
      const batch = await callAggregate(
        'budget_performance_batch',
        { p_workspace_id: ctx.workspaceId, p_start: window.start, p_end: window.end },
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

    const entries: BudgetReportEntry[] = []
    for (const budget of budgets) {
      if (source === 'batch') {
        const { actualMinor, seriesActual } = actualsFromDays(
          budget,
          onDate,
          netByAccountDay.get(budget.accountId) ?? [],
        )
        entries.push({
          budget,
          actualMinor,
          openMinor: openByBudget.get(budget.id) ?? 0,
          seriesActual,
        })
      } else {
        const c = await this.consumptionFor(ctx, budget, onDate)
        // Without the batch there is no per-sub-period split to show honestly.
        entries.push({
          budget,
          actualMinor: c.actualMinor,
          openMinor: c.committedMinor,
          seriesActual: [],
        })
      }
    }

    return buildBudgetReport(onDate, source, entries)
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
    const controlling = controllingBudgets(await this.list(ctx), posting)
    const consumption = new Map<string, BudgetConsumption>()
    await Promise.all(
      controlling.map(async (budget) => {
        consumption.set(budget.id, await this.consumptionFor(ctx, budget, posting.onDate))
      }),
    )
    return decideBudgetSpend(controlling, consumption, posting)
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
