// ============================================
// packages/local-engine/src/export/preview.ts
//
// Generates the Migration Preview metrics from the local SQLite database.
// These exact same numbers are verified during reconciliation (Step M3/M4).
// Rule 3: Unknown is not zero (null cost and null profit when unknown).
// ============================================

import type { LocalDb } from '../db'
import type {
  CostStatus,
  CurrencyTotal,
  InvoiceProfitPosition,
  MigrationPreview,
  StockPosition,
} from './types'

export function generatePreview(db: LocalDb, workspaceId: string): MigrationPreview {
  // 1. Workspace & base currency
  const ws = db.get<{ base_currency: string }>(
    'SELECT base_currency FROM local_workspace WHERE id = ?',
    [workspaceId],
  )
  const baseCurrency = ws?.base_currency || 'AFN'

  // 2. Exact Counts
  const getCount = (table: string, extraWhere = ''): number => {
    const row = db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${table} WHERE workspace_id = ? ${extraWhere}`,
      [workspaceId],
    )
    return Number(row?.count) || 0
  }

  const counts = {
    workspaces:
      db.get<{ c: number }>('SELECT COUNT(*) as c FROM local_workspace WHERE id = ?', [workspaceId])
        ?.c ?? 0,
    warehouses: getCount('warehouse', 'AND deleted_at IS NULL'),
    shelves: getCount('shelf', 'AND deleted_at IS NULL'),
    products: getCount('product', 'AND deleted_at IS NULL'),
    customers: getCount('customer', 'AND deleted_at IS NULL'),
    invoices: getCount('invoice', 'AND deleted_at IS NULL'),
    payments: getCount('payment', 'AND deleted_at IS NULL'),
    journalEntries: getCount('journal_entry', 'AND deleted_at IS NULL'),
    journalLines: getCount('journal_line', 'AND deleted_at IS NULL'),
    costLayers: getCount('cost_layer', 'AND deleted_at IS NULL'),
    transfers: getCount('inventory_movement', "AND type = 'transfer' AND deleted_at IS NULL"),
  }

  // 3. Totals by Currency (Invoices)
  const invoiceRows = db.all<{
    id: string
    invoice_number: string | null
    type: string
    currency: string
    subtotal: number
    total: number
    paid_amount: number
    status: string
  }>(
    `SELECT id, invoice_number, type, currency, subtotal, total, paid_amount, status
     FROM invoice
     WHERE workspace_id = ? AND deleted_at IS NULL
     ORDER BY date ASC, created_at ASC`,
    [workspaceId],
  )

  const totalsByCurrency: Record<string, CurrencyTotal> = {}
  const receivablesPerCurrency: Record<string, number> = {}
  const payablesPerCurrency: Record<string, number> = {}

  for (const inv of invoiceRows) {
    if (inv.status === 'cancelled') continue

    const curr = inv.currency
    const bucket = totalsByCurrency[curr] ?? { subtotal: 0, total: 0, paidAmount: 0 }
    totalsByCurrency[curr] = bucket
    bucket.subtotal += inv.subtotal
    bucket.total += inv.total
    bucket.paidAmount += inv.paid_amount

    const remaining = Math.max(0, inv.total - inv.paid_amount)
    if (inv.type === 'sale') {
      receivablesPerCurrency[curr] = (receivablesPerCurrency[curr] || 0) + remaining
    } else if (inv.type === 'purchase') {
      payablesPerCurrency[curr] = (payablesPerCurrency[curr] || 0) + remaining
    }
  }

  // 4. Stock by Product x Warehouse
  const stockRows = db.all<{
    product_id: string
    warehouse_id: string
    qty: number
  }>(
    `SELECT product_id, warehouse_id, qty
     FROM product_stock
     WHERE workspace_id = ? AND deleted_at IS NULL
     ORDER BY product_id ASC, warehouse_id ASC`,
    [workspaceId],
  )

  const stockByProductWarehouse: StockPosition[] = stockRows.map((r) => ({
    productId: r.product_id,
    warehouseId: r.warehouse_id,
    quantity: Number(r.qty) || 0,
  }))

  // 5. Trial Balance (debit == credit)
  const tbRow = db.get<{ total_debit: number; total_credit: number }>(
    `SELECT COALESCE(SUM(debit), 0) as total_debit, COALESCE(SUM(credit), 0) as total_credit
     FROM journal_line
     WHERE workspace_id = ? AND deleted_at IS NULL`,
    [workspaceId],
  )
  const totalDebit = Number(tbRow?.total_debit) || 0
  const totalCredit = Number(tbRow?.total_credit) || 0
  const trialBalance = {
    totalDebit,
    totalCredit,
    balanced: totalDebit === totalCredit,
  }

  // 6. Profit per Invoice (Unknown is not zero)
  const saleInvoices = invoiceRows.filter((i) => i.type === 'sale' && i.status !== 'cancelled')
  const profitByInvoice: InvoiceProfitPosition[] = []

  for (const sale of saleInvoices) {
    // Read invoice items
    const items = db.all<{
      id: string
      product_id: string | null
      quantity: number
      total_price: number
    }>(
      `SELECT id, product_id, quantity, total_price
       FROM invoice_item
       WHERE invoice_id = ? AND workspace_id = ? AND deleted_at IS NULL`,
      [sale.id, workspaceId],
    )

    // Read consumptions for this invoice
    const consumptions = db.all<{
      quantity: number
      unit_cost: number
      is_shortfall: number
    }>(
      `SELECT quantity, unit_cost, is_shortfall
       FROM cost_consumption
       WHERE consumer_id = ? AND workspace_id = ? AND deleted_at IS NULL`,
      [sale.id, workspaceId],
    )

    let costStatus: CostStatus = 'known'
    let costSum = 0

    if (items.length === 0 || consumptions.length === 0) {
      costStatus = 'unknown'
    } else {
      const hasShortfall = consumptions.some((c) => Boolean(c.is_shortfall))
      if (hasShortfall) {
        costStatus = 'unknown'
      } else {
        const consumedQty = consumptions.reduce((sum, c) => sum + Number(c.quantity), 0)
        const itemsQty = items.reduce((sum, it) => sum + Number(it.quantity), 0)
        if (consumedQty < itemsQty - 0.0001) {
          costStatus = 'partial'
        } else {
          for (const c of consumptions) {
            costSum += Math.round(Number(c.quantity) * Number(c.unit_cost))
          }
        }
      }
    }

    const revenue = sale.total
    const isCostKnown = costStatus === 'known'
    const finalCost = isCostKnown ? costSum : null
    const finalProfit = isCostKnown ? revenue - costSum : null

    profitByInvoice.push({
      invoiceId: sale.id,
      invoiceNumber: sale.invoice_number,
      currency: sale.currency,
      revenue,
      cost: finalCost,
      profit: finalProfit,
      costStatus,
    })
  }

  return {
    workspaceId,
    baseCurrency,
    counts,
    totalsByCurrency,
    receivablesPerCurrency,
    payablesPerCurrency,
    stockByProductWarehouse,
    trialBalance,
    profitByInvoice,
  }
}
