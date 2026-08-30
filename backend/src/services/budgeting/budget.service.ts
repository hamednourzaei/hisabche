// ============================================
// backend/src/services/budgeting/budget.service.ts
//
// Budgets, and the commitment ledger that makes them a control rather than a
// retrospective report.
// ============================================

import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { memoryCache } from '../../utils/pagination'
import type { TenancyContext } from '../tenancy.service'

import {
  applicableBudgets,
  checkSpend,
  evaluate,
  periodFor,
  varianceReport,
  type Budget,
  type BudgetAction,
  type BudgetPeriod,
  type BudgetStatus,
} from './budget.domain'

const COLUMNS =
  'id, account_id, dimension_value_id, branch_id, period, starts_on, amount_minor, action, warn_at_percent, is_active'

function mapBudget(raw: Record<string, any>): Budget {
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
  }
}

export class BudgetService {
  private async invalidate(workspaceId: string) {
    await memoryCache.invalidate(`budget:${workspaceId}`)
  }

  private assertMayManage(ctx: TenancyContext) {
    if (ctx.role !== 'owner' && ctx.role !== 'manager') {
      throw new ConflictError('BUDGET_MANAGE_FORBIDDEN')
    }
  }

  async list(ctx: TenancyContext): Promise<Budget[]> {
    const cacheKey = `budget:${ctx.workspaceId}:list`

    const cached = await memoryCache.get<Budget[]>(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('budgets')
      .select(COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .order('starts_on', { ascending: false })
      .limit(500)

    if (error) throw new DatabaseError('Failed to fetch budgets', error)

    const budgets = (data ?? []).map(mapBudget)
    await memoryCache.set(cacheKey, budgets, 300)
    return budgets
  }

  async upsert(ctx: TenancyContext, input: Budget): Promise<Budget> {
    this.assertMayManage(ctx)

    if (input.amountMinor < 0) throw new ValidationError('BUDGET_AMOUNT_INVALID')

    const { data, error } = await supabase
      .from('budgets')
      .upsert(
        {
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
        },
        { onConflict: 'id' },
      )
      .select(COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to save the budget', error)

    await this.invalidate(ctx.workspaceId)
    return mapBudget(data)
  }

  /**
   * Actual and committed spend for a budget in the period containing `onDate`.
   *
   * Actual comes from posted journal lines; committed from the open commitment
   * rows. The two are read separately because they answer different questions
   * and only one of them is reversible.
   */
  private async consumptionFor(ctx: TenancyContext, budget: Budget, onDate: string) {
    const { start, end } = periodFor(budget, onDate)

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

    return {
      actualMinor: (actual.data ?? []).reduce(
        (sum, row: any) =>
          sum + Math.round(((Number(row.debit) || 0) - (Number(row.credit) || 0)) * 100),
        0,
      ),
      committedMinor: (committed.data ?? []).reduce(
        (sum, row) => sum + (Number(row.amount_minor) || 0),
        0,
      ),
    }
  }

  async getStatus(ctx: TenancyContext, budgetId: string, onDate: string): Promise<BudgetStatus> {
    const budget = (await this.list(ctx)).find((b) => b.id === budgetId)
    if (!budget) throw new NotFoundError('Budget')

    return evaluate(budget, await this.consumptionFor(ctx, budget, onDate), onDate)
  }

  /**
   * Whether a document may spend this much on this account.
   *
   * Called BEFORE the money is committed. That is the whole point: telling
   * somebody they are over budget after the expense is posted is a report.
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
    const budgets = applicableBudgets(await this.list(ctx), posting)
    if (budgets.length === 0) return { allowed: true, problems: [], warnings: [] }

    const statuses = await Promise.all(
      budgets.map(async (budget) => ({
        status: evaluate(
          budget,
          await this.consumptionFor(ctx, budget, posting.onDate),
          posting.onDate,
        ),
        amountMinor: posting.amountMinor,
      })),
    )

    return checkSpend(statuses)
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

  async getVariance(ctx: TenancyContext, onDate: string) {
    const budgets = await this.list(ctx)

    const rows = await Promise.all(
      budgets.map(async (budget) => {
        const { start } = periodFor(budget, onDate)
        const consumption = await this.consumptionFor(ctx, budget, onDate)
        return { budget, periodStart: start, actualMinor: consumption.actualMinor }
      }),
    )

    return varianceReport(rows)
  }
}
