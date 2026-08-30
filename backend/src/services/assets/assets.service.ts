// ============================================
// backend/src/services/assets/assets.service.ts
//
// Fixed assets: capitalise, depreciate on a schedule, dispose.
// ============================================

import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { memoryCache } from '../../utils/pagination'
import type { TenancyContext } from '../tenancy.service'
import { ledger } from '../accounting'

import {
  buildSchedule,
  disposeAsset,
  duePostings,
  validateAsset,
  type AssetInput,
  type DepreciationEntry,
  type DepreciationMethod,
} from './depreciation.domain'

const ASSET_COLUMNS =
  'id, name, asset_account_id, expense_account_id, accumulated_account_id, cost_minor, salvage_minor, method, periods, period_months, declining_factor, first_period_on, prorata_from, acquired_on, disposed_on, disposal_proceeds_minor, source_invoice_id'

export interface FixedAsset {
  id: string
  name: string
  costMinor: number
  salvageMinor: number
  method: DepreciationMethod
  periods: number
  periodMonths: number
  firstPeriodOn: string
  acquiredOn: string
  disposedOn: string | null
  assetAccountId: string | null
  expenseAccountId: string | null
  accumulatedAccountId: string | null
}

function mapAsset(raw: Record<string, any>): FixedAsset {
  return {
    id: raw.id,
    name: raw.name,
    costMinor: Number(raw.cost_minor) || 0,
    salvageMinor: Number(raw.salvage_minor) || 0,
    method: raw.method,
    periods: Number(raw.periods) || 0,
    periodMonths: Number(raw.period_months) || 1,
    firstPeriodOn: String(raw.first_period_on ?? '').slice(0, 10),
    acquiredOn: String(raw.acquired_on ?? '').slice(0, 10),
    disposedOn: raw.disposed_on ? String(raw.disposed_on).slice(0, 10) : null,
    assetAccountId: raw.asset_account_id ?? null,
    expenseAccountId: raw.expense_account_id ?? null,
    accumulatedAccountId: raw.accumulated_account_id ?? null,
  }
}

export class AssetsService {
  private async invalidate(workspaceId: string) {
    await memoryCache.invalidate(`assets:${workspaceId}`)
  }

  private assertMayManage(ctx: TenancyContext) {
    // Capitalising an expense moves money off this year's profit and onto the
    // balance sheet. That is an owner's or manager's judgement, not a clerk's.
    if (ctx.role !== 'owner' && ctx.role !== 'manager') {
      throw new ConflictError('ASSET_MANAGE_FORBIDDEN')
    }
  }

  async list(ctx: TenancyContext): Promise<FixedAsset[]> {
    const { data, error } = await supabase
      .from('fixed_assets')
      .select(ASSET_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .order('acquired_on', { ascending: false })
      .limit(1000)

    if (error) throw new DatabaseError('Failed to fetch fixed assets', error)
    return (data ?? []).map(mapAsset)
  }

  async get(ctx: TenancyContext, id: string): Promise<FixedAsset> {
    const { data, error } = await supabase
      .from('fixed_assets')
      .select(ASSET_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch the asset', error)
    if (!data) throw new NotFoundError('Fixed asset')
    return mapAsset(data)
  }

  /**
   * Capitalise an asset and write its WHOLE schedule.
   *
   * The schedule is stored, not computed monthly. A month the job did not run
   * is otherwise a month of depreciation that never happened and nothing says
   * so; with the schedule on disk, "what is due and unposted" has a definite
   * answer that survives a crash and six weeks offline.
   */
  async create(
    ctx: TenancyContext,
    input: AssetInput & {
      name: string
      acquiredOn: string
      assetAccountId?: string | null | undefined
      expenseAccountId?: string | null | undefined
      accumulatedAccountId?: string | null | undefined
      sourceInvoiceId?: string | null | undefined
    },
  ): Promise<{ asset: FixedAsset; schedule: DepreciationEntry[] }> {
    this.assertMayManage(ctx)

    const problems = validateAsset(input)
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    const schedule = buildSchedule(input)

    const { data, error } = await supabase
      .from('fixed_assets')
      .insert({
        workspace_id: ctx.workspaceId,
        name: input.name,
        cost_minor: input.costMinor,
        salvage_minor: input.salvageMinor,
        method: input.method,
        periods: input.periods,
        period_months: input.periodMonths,
        declining_factor: input.decliningFactor ?? null,
        first_period_on: input.firstPeriodOn,
        prorata_from: input.prorataFrom ?? null,
        acquired_on: input.acquiredOn,
        asset_account_id: input.assetAccountId ?? null,
        expense_account_id: input.expenseAccountId ?? null,
        accumulated_account_id: input.accumulatedAccountId ?? null,
        source_invoice_id: input.sourceInvoiceId ?? null,
      })
      .select(ASSET_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create the asset', error)

    if (schedule.length > 0) {
      const { error: scheduleError } = await supabase.from('asset_depreciation_schedule').insert(
        schedule.map((entry) => ({
          workspace_id: ctx.workspaceId,
          asset_id: data.id,
          period: entry.period,
          on_date: entry.onDate,
          amount_minor: entry.amountMinor,
          accumulated_minor: entry.accumulatedMinor,
          book_value_minor: entry.bookValueMinor,
        })),
      )

      if (scheduleError) {
        await supabase
          .from('fixed_assets')
          .delete()
          .eq('id', data.id)
          .eq('workspace_id', ctx.workspaceId)
        throw new DatabaseError('Failed to write the depreciation schedule', scheduleError)
      }
    }

    await this.invalidate(ctx.workspaceId)
    return { asset: mapAsset(data), schedule }
  }

  async getSchedule(ctx: TenancyContext, assetId: string) {
    const { data, error } = await supabase
      .from('asset_depreciation_schedule')
      .select(
        'period, on_date, amount_minor, accumulated_minor, book_value_minor, posted_at, cancelled_at, journal_entry_id',
      )
      .eq('workspace_id', ctx.workspaceId)
      .eq('asset_id', assetId)
      .order('period')

    if (error) throw new DatabaseError('Failed to fetch the schedule', error)
    return data ?? []
  }

  /**
   * Post every depreciation entry that is due and unposted.
   *
   * Each is keyed by (asset, period), so a run six weeks late posts the four
   * entries it owes — and a run repeated twice posts nothing the second time.
   */
  async postDue(ctx: TenancyContext, asOf = new Date().toISOString().slice(0, 10)) {
    const { data, error } = await supabase
      .from('asset_depreciation_schedule')
      .select(
        'id, asset_id, period, on_date, amount_minor, accumulated_minor, book_value_minor, asset:fixed_assets(expense_account_id, accumulated_account_id, name)',
      )
      .eq('workspace_id', ctx.workspaceId)
      .lte('on_date', asOf)
      .is('posted_at', null)
      .is('cancelled_at', null)
      .order('on_date')
      .limit(500)

    if (error) throw new DatabaseError('Failed to find due depreciation', error)

    const posted: Array<{ assetId: string; period: number; amountMinor: number }> = []
    const skipped: Array<{ assetId: string; period: number; reason: string }> = []

    for (const row of data ?? []) {
      const asset = (row as any).asset as {
        expense_account_id: string | null
        accumulated_account_id: string | null
        name: string
      } | null

      if (!asset?.expense_account_id || !asset.accumulated_account_id) {
        // Said out loud rather than skipped silently: an asset with no accounts
        // configured simply never depreciates, and nothing would say why.
        skipped.push({ assetId: row.asset_id, period: row.period, reason: 'ACCOUNTS_NOT_SET' })
        continue
      }

      const amount = Number(row.amount_minor) / 100

      const outcome = await ledger.postDocument(ctx, {
        sourceType: 'depreciation',
        sourceId: row.id,
        date: String(row.on_date).slice(0, 10),
        description: `استهلاک ${asset.name} — دوره ${row.period}`,
        reference: `${row.asset_id}:${row.period}`,
        lines: [
          { accountId: asset.expense_account_id, debit: amount, credit: 0 },
          { accountId: asset.accumulated_account_id, debit: 0, credit: amount },
        ],
      })

      if (outcome.status === 'posted' || outcome.status === 'already_posted') {
        await supabase
          .from('asset_depreciation_schedule')
          .update({ posted_at: new Date().toISOString(), journal_entry_id: outcome.entryId })
          .eq('workspace_id', ctx.workspaceId)
          .eq('id', row.id)

        posted.push({
          assetId: row.asset_id,
          period: row.period,
          amountMinor: Number(row.amount_minor),
        })
      } else {
        skipped.push({ assetId: row.asset_id, period: row.period, reason: outcome.status })
      }
    }

    await this.invalidate(ctx.workspaceId)
    return { asOf, posted, skipped }
  }

  /**
   * Sell or scrap an asset.
   *
   * The gain or loss is proceeds less NET BOOK VALUE, and every remaining
   * scheduled entry is cancelled so the books stop depreciating something the
   * business no longer owns.
   */
  async dispose(
    ctx: TenancyContext,
    assetId: string,
    input: { onDate: string; proceedsMinor: number },
  ) {
    this.assertMayManage(ctx)

    const asset = await this.get(ctx, assetId)
    if (asset.disposedOn) throw new ConflictError('ASSET_ALREADY_DISPOSED')

    const schedule = (await this.getSchedule(ctx, assetId)).map((row: any) => ({
      period: row.period,
      onDate: String(row.on_date).slice(0, 10),
      amountMinor: Number(row.amount_minor),
      accumulatedMinor: Number(row.accumulated_minor),
      bookValueMinor: Number(row.book_value_minor),
    }))

    const result = disposeAsset(asset.costMinor, schedule, input)

    const { error } = await supabase
      .from('fixed_assets')
      .update({ disposed_on: input.onDate, disposal_proceeds_minor: input.proceedsMinor })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', assetId)

    if (error) throw new DatabaseError('Failed to record the disposal', error)

    if (result.cancelledPeriods.length > 0) {
      await supabase
        .from('asset_depreciation_schedule')
        .update({ cancelled_at: new Date().toISOString() })
        .eq('workspace_id', ctx.workspaceId)
        .eq('asset_id', assetId)
        .in('period', result.cancelledPeriods)
    }

    await this.invalidate(ctx.workspaceId)
    return result
  }

  /** Due entries without posting them, for a "what would this run do" view. */
  async previewDue(ctx: TenancyContext, assetId: string, asOf: string) {
    const schedule = (await this.getSchedule(ctx, assetId)).map((row: any) => ({
      period: row.period,
      onDate: String(row.on_date).slice(0, 10),
      amountMinor: Number(row.amount_minor),
      accumulatedMinor: Number(row.accumulated_minor),
      bookValueMinor: Number(row.book_value_minor),
      posted: Boolean(row.posted_at),
    }))

    const postedPeriods = schedule.filter((row) => row.posted).map((row) => row.period)
    return duePostings(schedule, postedPeriods, asOf)
  }
}
