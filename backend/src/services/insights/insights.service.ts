// ============================================
// backend/src/services/insights/insights.service.ts
//
// Assembling the real rows the insight functions run over.
//
// Every figure here is read from the SAME sources the reports use — invoices
// for revenue, the costing core's consumptions for cost. A second way of
// computing profit is a second answer to what the profit was, and the day they
// disagree nobody will know which is right.
// ============================================

import { supabase } from '../../db'
import { AccountingService } from '../accounting'
import { DatabaseError } from '../../errors/database.error'
import { memoryCache } from '../../utils/pagination'
import type { TenancyContext } from '../tenancy.service'

import {
  buildExplanation,
  compare,
  detectAnomalies,
  explainChange,
  grossMargin,
  grossProfit,
  round2,
  type LineForReview,
  type PeriodTotals,
} from './insights.domain'

export class InsightsService {
  private key(workspaceId: string, ...parts: string[]) {
    return `insights:${workspaceId}:${parts.join(':')}`
  }

  /**
   * Revenue and cost for a period.
   *
   * Revenue from the invoices, cost from the CONSUMPTIONS the costing core
   * recorded — the layers that were actually spent. Multiplying quantity by
   * the product's current buy price would give a different number every time
   * the shop restocked.
   */
  private async periodTotals(ctx: TenancyContext, from: string, to: string): Promise<PeriodTotals> {
    const [invoices, consumptions] = await Promise.all([
      supabase
        .from('invoices')
        .select('id, total')
        .eq('workspace_id', ctx.workspaceId)
        .eq('type', 'sale')
        .gte('date', from)
        .lte('date', to)
        .limit(5000),
      supabase
        .from('cost_consumptions')
        .select('amount')
        .eq('workspace_id', ctx.workspaceId)
        .eq('consumer_type', 'invoice')
        .gte('entry_date', from)
        .lte('entry_date', to)
        .limit(20_000),
    ])

    if (invoices.error) throw new DatabaseError('Failed to read invoices', invoices.error)
    if (consumptions.error) {
      throw new DatabaseError('Failed to read cost consumptions', consumptions.error)
    }

    const rows = invoices.data ?? []

    return {
      from,
      to,
      revenue: round2(rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0)),
      costOfGoodsSold: round2(
        (consumptions.data ?? []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
      ),
      invoiceCount: rows.length,
    }
  }

  /** Profit and margin for one period. */
  async getPeriodSummary(
    ctx: TenancyContext,
    from: string,
    to: string,
  ): Promise<PeriodTotals & { grossProfit: number; grossMarginPercent: number | null }> {
    const cacheKey = this.key(ctx.workspaceId, 'summary', from, to)

    const cached = await memoryCache.get<
      PeriodTotals & { grossProfit: number; grossMarginPercent: number | null }
    >(cacheKey)
    if (cached) return cached

    const totals = await this.periodTotals(ctx, from, to)
    const result = {
      ...totals,
      grossProfit: grossProfit(totals),
      grossMarginPercent: grossMargin(totals),
    }

    await memoryCache.set(cacheKey, result, 300)
    return result
  }

  /**
   * Why a figure moved between two periods.
   *
   * Returns the change, the products that account for it, and the numbers
   * behind each one. This is what a copilot is handed — never a database
   * connection and a question.
   */
  async explainProfitChange(
    ctx: TenancyContext,
    current: { from: string; to: string },
    previous: { from: string; to: string },
  ) {
    const [now, before, nowByProduct, beforeByProduct] = await Promise.all([
      this.periodTotals(ctx, current.from, current.to),
      this.periodTotals(ctx, previous.from, previous.to),
      this.profitByProduct(ctx, current.from, current.to),
      this.profitByProduct(ctx, previous.from, previous.to),
    ])

    const breakdown = explainChange(beforeByProduct, nowByProduct, { limit: 10 })

    return buildExplanation({
      headlineKey:
        grossProfit(now) >= grossProfit(before) ? 'insights.profit.up' : 'insights.profit.down',
      figures: {
        currentProfit: grossProfit(now),
        previousProfit: grossProfit(before),
        currentRevenue: now.revenue,
        previousRevenue: before.revenue,
        currentMarginPercent: grossMargin(now),
        previousMarginPercent: grossMargin(before),
        change: compare('grossProfit', grossProfit(before), grossProfit(now)).absolute,
        changePercent: compare('grossProfit', grossProfit(before), grossProfit(now)).percent,
      },
      contributors: breakdown.contributors,
    })
  }

  /** Profit per product over a period, from revenue and consumed cost. */
  /**
   * Per-product profit comes from the ACCOUNTING CORE (request #91): one rule for
   * revenue (net of invoice discount, no tax), cost and currency, shared with
   * the profit report on /accounting. This used to be a private copy with
   * `.limit(20_000)` and gross line totals.
   */
  private async profitByProduct(ctx: TenancyContext, from: string, to: string) {
    return new AccountingService().getProductProfits(ctx, from, to)
  }

  /**
   * Sales worth a second look, over a period.
   *
   * Found by arithmetic: sold below cost, margin under the floor, cost the
   * costing core had to estimate, discount over the ceiling.
   */
  async findAnomalies(
    ctx: TenancyContext,
    from: string,
    to: string,
    options: { marginFloorPercent?: number; discountCeilingPercent?: number } = {},
  ) {
    const [items, consumptions] = await Promise.all([
      supabase
        .from('invoice_items')
        .select(
          'invoice_id, product_id, product_name, total_price, discount, invoice:invoices!inner(invoice_number, date, type, workspace_id)',
        )
        .eq('workspace_id', ctx.workspaceId)
        .gte('invoice.date', from)
        .lte('invoice.date', to)
        .eq('invoice.type', 'sale')
        .limit(5000),
      supabase
        .from('cost_consumptions')
        .select('consumer_id, product_id, amount, is_estimated')
        .eq('workspace_id', ctx.workspaceId)
        .eq('consumer_type', 'invoice')
        .gte('entry_date', from)
        .lte('entry_date', to)
        .limit(20_000),
    ])

    if (items.error) throw new DatabaseError('Failed to read invoice items', items.error)
    if (consumptions.error) {
      throw new DatabaseError('Failed to read cost consumptions', consumptions.error)
    }

    const costByLine = new Map<string, { amount: number; estimated: boolean }>()
    for (const row of consumptions.data ?? []) {
      const key = `${row.consumer_id}:${row.product_id}`
      const current = costByLine.get(key) ?? { amount: 0, estimated: false }
      current.amount += Number(row.amount) || 0
      current.estimated = current.estimated || row.is_estimated === true
      costByLine.set(key, current)
    }

    const lines: LineForReview[] = (items.data ?? []).map((item: any) => {
      const cost = costByLine.get(`${item.invoice_id}:${item.product_id}`)

      return {
        invoiceId: item.invoice_id,
        invoiceNumber: item.invoice?.invoice_number ?? item.invoice_id,
        productId: item.product_id ?? '',
        productLabel: item.product_name ?? '',
        revenue: Number(item.total_price) || 0,
        cost: cost?.amount ?? 0,
        discountPercent: Number(item.discount) || 0,
        costIsEstimated: cost?.estimated ?? false,
      }
    })

    return {
      from,
      to,
      reviewed: lines.length,
      anomalies: detectAnomalies(lines, options),
    }
  }
}
