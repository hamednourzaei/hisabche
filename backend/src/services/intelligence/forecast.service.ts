// ============================================
// backend/src/services/intelligence/forecast.service.ts
//
// N3 — cash forecast. N4 — opportunities that have gone quiet.
//
// ⚠️ BOTH ARE READ MODELS. Nothing is stored: N3 in particular must not become
// a persisted figure, or within a month somebody will be reconciling against a
// forecast. Every number is derived at read time.
// ============================================

import { selectAllPages } from '../../utils/fetch-all-pages'
import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import { crm } from '../crm'
import type { TenancyContext } from '../tenancy.service'

import {
  STALE_AFTER_DAYS,
  averagePaymentDelay,
  findStaleOpportunities,
  forecastCash,
  type CashForecast,
  type StaleOpportunity,
} from './forecast.domain'

export class ForecastService {
  /** N3 — projected cash at 7 and 30 days. */
  async cashForecast(ctx: TenancyContext): Promise<CashForecast> {
    const [receivables, settled, cash] = await Promise.all([
      this.outstandingReceivables(ctx),
      this.settlementHistory(ctx),
      this.cashOnHand(ctx),
    ])

    return forecastCash({
      asOf: new Date(),
      openingCashMinor: cash,
      receivables,
      delay: averagePaymentDelay(settled),
    })
  }

  /** N4 — opportunities nobody has touched. */
  async staleOpportunities(
    ctx: TenancyContext,
    days: number = STALE_AFTER_DAYS,
  ): Promise<StaleOpportunity[]> {
    // Through the CRM Core's port: open deals only, every row, no silent cap.
    const opportunities = await crm.listOpenOpportunityActivity(ctx)

    return findStaleOpportunities(
      opportunities.map((row) => ({
        id: row.id,
        name: row.title,
        stage: row.stage,
        lastActivityAt: row.lastActivityAt,
        createdAt: row.createdAt,
      })),
      new Date(),
      days,
    )
  }

  /**
   * What is still owed, per invoice.
   *
   * ⚠️ `total − paid_amount`, both of which are on the invoice. `paid_amount`
   * is a projection of `payment_allocations` maintained by trigger (Phase F),
   * so this reads the same figure the receivables report does rather than
   * re-summing allocations and risking a different answer.
   */
  private async outstandingReceivables(ctx: TenancyContext) {
    // Every row (27 Sep 2026): a .limit(N) here was cut to 1000 by PostgREST, and this feeds a total.
    const { data, error } = await selectAllPages((lo, hi) =>
      supabase
        .from('invoices')
        .select('id, total, paid_amount, due_date, status, type')
        .eq('workspace_id', ctx.workspaceId)
        .eq('type', 'sale')
        .neq('status', 'cancelled')
        .order('id', { ascending: true })
        .range(lo, hi),
    )

    if (error) throw new DatabaseError('Failed to read receivables', error)

    return (data ?? []).map((row: Record<string, any>) => ({
      invoiceId: String(row.id),
      // Minor units, so the forecast never adds floats.
      outstandingMinor: Math.round(
        ((Number(row.total) || 0) - (Number(row.paid_amount) || 0)) * 100,
      ),
      dueDate: row.due_date ?? null,
    }))
  }

  /** Settled invoices, for the observed payment delay. */
  private async settlementHistory(ctx: TenancyContext) {
    const { data, error } = await supabase
      .from('invoices')
      .select('due_date, updated_at, status')
      .eq('workspace_id', ctx.workspaceId)
      .eq('type', 'sale')
      .in('status', ['paid', 'completed'])
      .not('due_date', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(500)

    if (error) throw new DatabaseError('Failed to read settlement history', error)

    return (data ?? []).map((row: Record<string, any>) => ({
      dueDate: row.due_date ?? null,
      // ⚠️ `updated_at` is a PROXY for the settlement date, and an imperfect
      // one — editing a settled invoice moves it. It is what
      // `settlementDate()` in @hisabche/validation already uses, so the
      // forecast agrees with the «تاریخ تسویه» column rather than inventing a
      // second answer. Open gap 8 tracks replacing both with a real timestamp.
      settledAt: row.updated_at ?? null,
    }))
  }

  /**
   * Cash and bank today, from the LEDGER.
   *
   * Not from `payments` or a till session: the ledger is the source of truth
   * for what the business holds, and a forecast that started from a different
   * figure than the balance sheet would be arguing with it on day zero.
   */
  private async cashOnHand(ctx: TenancyContext): Promise<number> {
    const { data, error } = await supabase
      .from('accounts')
      .select('id, role')
      .eq('workspace_id', ctx.workspaceId)
      .in('role', ['cash', 'bank'])
      .is('deleted_at', null)

    if (error || !data || data.length === 0) return 0

    const accountIds = data.map((row: Record<string, any>) => String(row.id))

    // Every row (27 Sep 2026): the large .limit() was cut to 1000 by PostgREST, and this feeds a total.
    const { data: lines, error: linesError } = await selectAllPages((lo, hi) =>
      supabase
        .from('journal_lines')
        .select('debit, credit, account_id')
        .eq('workspace_id', ctx.workspaceId)
        .in('account_id', accountIds)
        .order('id', { ascending: true })
        .range(lo, hi),
    )

    // A failed read is not «no cash» (§7.3): a forecast built on 0 would
    // tell the owner the business is empty when the database was unreachable.
    if (linesError) throw new DatabaseError('Failed to read cash balances', linesError)
    if (!lines) return 0

    // Cash is an asset: debits increase it.
    let minor = 0
    for (const line of lines) {
      minor += Math.round((Number(line.debit) || 0) * 100)
      minor -= Math.round((Number(line.credit) || 0) * 100)
    }
    return minor
  }
}
