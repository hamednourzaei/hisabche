// ============================================
// backend/src/services/cloud-migration/reconciliation.service.ts
//
// Step M3: Independent Reconciliation Engine.
// Re-reads directly from the cloud database (Rule 2: Postgres reads, not call results).
// Unknown is not zero: preserves null costs and unknown cost status.
// ============================================

import type { MigrationPreview } from '@hisabche/local-engine'
import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import { AccountingService } from '../accounting/accounting.service'
import type { TenancyContext } from '../tenancy.service'
import type { ReconciliationDiff, ReconciliationOutcome } from './types'

export class ReconciliationService {
  constructor(private readonly accounting: AccountingService = new AccountingService()) {}

  async reconcile(
    ctx: TenancyContext,
    expected: MigrationPreview,
    cloudIdMap: Map<string, string>,
  ): Promise<ReconciliationOutcome> {
    const diffs: ReconciliationDiff[] = []
    const { workspaceId } = ctx

    // ─── 1. Invoices & Currency Totals ───────────────────────────────────────
    const { data: rawInvoices, error: invError } = await supabase
      .from('invoices')
      .select('id, type, currency, subtotal, total, paid_amount, status, reference')
      .eq('workspace_id', workspaceId)

    if (invError) throw new DatabaseError('Failed to read invoices for reconciliation', invError)

    const invoices = (rawInvoices ?? []) as Array<{
      id: string
      type: string
      currency: string
      subtotal: number
      total: number
      paid_amount: number
      status: string
      reference: string | null
    }>

    // Non-cancelled invoices count
    const activeInvoices = invoices.filter((i) => i.status !== 'cancelled')
    const totalInvoices = invoices.length

    if (totalInvoices !== expected.counts.invoices) {
      diffs.push({
        metric: 'invoices.totalCount',
        expected: expected.counts.invoices,
        actual: totalInvoices,
        diff: totalInvoices - expected.counts.invoices,
      })
    }

    // Totals per currency
    const actualTotalsByCurr: Record<
      string,
      { subtotal: number; total: number; paidAmount: number }
    > = {}
    const actualReceivablesByCurr: Record<string, number> = {}
    const actualPayablesByCurr: Record<string, number> = {}

    for (const inv of activeInvoices) {
      const c = inv.currency
      if (!actualTotalsByCurr[c]) {
        actualTotalsByCurr[c] = { subtotal: 0, total: 0, paidAmount: 0 }
      }
      actualTotalsByCurr[c].subtotal += Math.round(Number(inv.subtotal) || 0)
      actualTotalsByCurr[c].total += Math.round(Number(inv.total) || 0)
      actualTotalsByCurr[c].paidAmount += Math.round(Number(inv.paid_amount) || 0)

      const remaining = Math.max(
        0,
        Math.round(Number(inv.total) || 0) - Math.round(Number(inv.paid_amount) || 0),
      )
      if (inv.type === 'sale') {
        actualReceivablesByCurr[c] = (actualReceivablesByCurr[c] || 0) + remaining
      } else if (inv.type === 'purchase') {
        actualPayablesByCurr[c] = (actualPayablesByCurr[c] || 0) + remaining
      }
    }

    const checkedTotals: Record<string, { expected: number; actual: number; matched: boolean }> = {}
    for (const [curr, exp] of Object.entries(expected.totalsByCurrency)) {
      const act = actualTotalsByCurr[curr]?.total ?? 0
      const matched = act === exp.total
      checkedTotals[curr] = { expected: exp.total, actual: act, matched }
      if (!matched) {
        diffs.push({
          metric: `totalsByCurrency.${curr}.total`,
          expected: exp.total,
          actual: act,
          diff: act - exp.total,
        })
      }

      const actPaid = actualTotalsByCurr[curr]?.paidAmount ?? 0
      if (actPaid !== exp.paidAmount) {
        diffs.push({
          metric: `totalsByCurrency.${curr}.paidAmount`,
          expected: exp.paidAmount,
          actual: actPaid,
          diff: actPaid - exp.paidAmount,
        })
      }
    }

    const checkedReceivables: Record<
      string,
      { expected: number; actual: number; matched: boolean }
    > = {}
    for (const [curr, expRec] of Object.entries(expected.receivablesPerCurrency)) {
      const actRec = actualReceivablesByCurr[curr] ?? 0
      const matched = actRec === expRec
      checkedReceivables[curr] = { expected: expRec, actual: actRec, matched }
      if (!matched) {
        diffs.push({
          metric: `receivables.${curr}`,
          expected: expRec,
          actual: actRec,
          diff: actRec - expRec,
        })
      }
    }

    // ─── 2. Stock Positions (product x warehouse) ───────────────────────────
    let stockMismatches = 0
    for (const pos of expected.stockByProductWarehouse) {
      const cloudProductId = cloudIdMap.get(`product:${pos.productId}`) ?? pos.productId
      const cloudWarehouseId = cloudIdMap.get(`warehouse:${pos.warehouseId}`) ?? pos.warehouseId

      // Read stock from warehouse_stock or product_stock
      const { data: stockRow, error: stockErr } = await supabase
        .from('warehouse_stock')
        .select('quantity')
        .eq('workspace_id', workspaceId)
        .eq('product_id', cloudProductId)
        .eq('warehouse_id', cloudWarehouseId)
        .maybeSingle()

      if (stockErr)
        throw new DatabaseError('Failed to read warehouse stock for reconciliation', stockErr)

      const actQty = Number(stockRow?.quantity ?? 0)
      if (Math.abs(actQty - pos.quantity) > 0.0001) {
        stockMismatches += 1
        diffs.push({
          metric: `stock.${pos.productId}.${pos.warehouseId}`,
          expected: pos.quantity,
          actual: actQty,
          diff: actQty - pos.quantity,
          details: { productId: pos.productId, warehouseId: pos.warehouseId },
        })
      }
    }

    // ─── 3. Trial Balance ────────────────────────────────────────────────────
    const { data: tbLines, error: tbErr } = await supabase
      .from('journal_lines')
      .select('debit, credit')
      .eq('workspace_id', workspaceId)

    if (tbErr) throw new DatabaseError('Failed to read journal lines for trial balance', tbErr)

    let actualDebit = 0
    let actualCredit = 0
    for (const line of tbLines ?? []) {
      actualDebit += Math.round(Number(line.debit) || 0)
      actualCredit += Math.round(Number(line.credit) || 0)
    }

    const tbBalanced = actualDebit === actualCredit
    if (!tbBalanced) {
      diffs.push({
        metric: 'trialBalance.unbalanced',
        expected: 'balanced (debit == credit)',
        actual: `debit: ${actualDebit}, credit: ${actualCredit}`,
        diff: actualDebit - actualCredit,
      })
    }
    if (actualDebit !== expected.trialBalance.totalDebit) {
      diffs.push({
        metric: 'trialBalance.totalDebit',
        expected: expected.trialBalance.totalDebit,
        actual: actualDebit,
        diff: actualDebit - expected.trialBalance.totalDebit,
      })
    }
    if (actualCredit !== expected.trialBalance.totalCredit) {
      diffs.push({
        metric: 'trialBalance.totalCredit',
        expected: expected.trialBalance.totalCredit,
        actual: actualCredit,
        diff: actualCredit - expected.trialBalance.totalCredit,
      })
    }

    // ─── 4. Profit per Invoice (Unknown is not zero) ──────────────────────────
    const saleCloudIds = activeInvoices.filter((i) => i.type === 'sale').map((i) => i.id)

    let profitMismatches = 0
    if (saleCloudIds.length > 0) {
      const margins = await this.accounting.getInvoiceMargins(ctx, saleCloudIds)

      for (const expProfit of expected.profitByInvoice) {
        const cloudInvId = cloudIdMap.get(`invoice:${expProfit.invoiceId}`) ?? expProfit.invoiceId
        const cloudMargin = margins.get(cloudInvId)

        if (!cloudMargin) {
          profitMismatches += 1
          diffs.push({
            metric: `profit.missingInvoice.${expProfit.invoiceId}`,
            expected: expProfit,
            actual: null,
            diff: 'Invoice missing in cloud profit report',
          })
          continue
        }

        // Rule: Unknown is not zero
        if (expProfit.costStatus === 'unknown') {
          if (cloudMargin.costStatus !== 'unknown' || cloudMargin.cost !== null) {
            profitMismatches += 1
            diffs.push({
              metric: `profit.costStatusUnknownViolated.${expProfit.invoiceId}`,
              expected: { cost: null, costStatus: 'unknown' },
              actual: { cost: cloudMargin.cost, costStatus: cloudMargin.costStatus },
              diff: 'Expected unknown cost, got non-null or non-unknown',
            })
          }
        } else if (expProfit.costStatus === 'known') {
          const actCost = cloudMargin.cost !== null ? Math.round(cloudMargin.cost) : null
          const actProfit = actCost !== null ? Math.round(cloudMargin.revenue - actCost) : null
          if (actCost !== expProfit.cost || actProfit !== expProfit.profit) {
            profitMismatches += 1
            const diffVal =
              actProfit !== null && expProfit.profit !== null ? actProfit - expProfit.profit : null
            diffs.push({
              metric: `profit.figureMismatch.${expProfit.invoiceId}`,
              expected: { cost: expProfit.cost, profit: expProfit.profit },
              actual: { cost: actCost, profit: actProfit },
              diff: diffVal,
            })
          }
        }
      }
    }

    const matched = diffs.length === 0

    return {
      matched,
      reconciledAt: new Date().toISOString(),
      checkedMetrics: {
        invoiceCount: {
          expected: expected.counts.invoices,
          actual: totalInvoices,
          matched: totalInvoices === expected.counts.invoices,
        },
        totalsByCurrency: checkedTotals,
        receivablesPerCurrency: checkedReceivables,
        stockPositions: {
          matched: stockMismatches === 0,
          totalPositions: expected.stockByProductWarehouse.length,
          mismatchCount: stockMismatches,
        },
        trialBalance: {
          expectedDebit: expected.trialBalance.totalDebit,
          actualDebit,
          expectedCredit: expected.trialBalance.totalCredit,
          actualCredit,
          matched:
            actualDebit === expected.trialBalance.totalDebit &&
            actualCredit === expected.trialBalance.totalCredit,
        },
        profitReports: {
          matched: profitMismatches === 0,
          checkedInvoices: expected.profitByInvoice.length,
          mismatchCount: profitMismatches,
        },
      },
      diffs,
    }
  }
}
