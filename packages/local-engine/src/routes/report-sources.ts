// ============================================
// packages/local-engine/src/routes/report-sources.ts
//
// The device's READS for the statements: SQLite rows in, the shapes the shared
// pure functions of @hisabche/validation take out. Nothing here decides what a
// number means — `toBalanceSheet`, `toIncomeStatement`, `buildGeneralLedger`
// and `buildProfitReport` do, the same functions the server calls.
// ============================================

import {
  dateOnly,
  restateAtRates,
  round2,
  type AccountRootType,
  type EvidenceConsumption,
  type LedgerLine,
  type LedgerTotals,
  type ProfitConsumption,
  type ProfitInvoice,
  type ProfitLine,
} from '@hisabche/validation'
import type { LocalDb } from '../db'

/**
 * One account's movement over a window — the SQLite twin of the server's
 * `accounting_trial_balance` function: posted entries only, inclusive bounds,
 * accounts with no movement left out.
 */
export function ledgerTotals(
  db: LocalDb,
  workspaceId: string,
  fromDate: string | null,
  toDate: string | null,
): LedgerTotals[] {
  const clauses = ["je.status = 'posted'", 'je.deleted_at IS NULL', 'jl.deleted_at IS NULL']
  const params: unknown[] = [workspaceId, workspaceId]
  if (fromDate) {
    clauses.push('je.date >= ?')
    params.push(fromDate)
  }
  if (toDate) {
    clauses.push('je.date <= ?')
    params.push(toDate)
  }
  const rows = db.all<{
    account_id: string
    code: string
    name: string
    type: AccountRootType
    debit: number
    credit: number
  }>(
    `SELECT a.id AS account_id, a.code, a.name, a.type,
            coalesce(sum(jl.debit), 0) AS debit, coalesce(sum(jl.credit), 0) AS credit
       FROM journal_line jl
       JOIN journal_entry je ON je.id = jl.journal_id AND je.workspace_id = ?
       JOIN account a ON a.id = jl.account_id AND a.workspace_id = ?
      WHERE ${clauses.join(' AND ')}
      GROUP BY a.id, a.code, a.name, a.type
     HAVING coalesce(sum(jl.debit), 0) <> 0 OR coalesce(sum(jl.credit), 0) <> 0
      ORDER BY a.code`,
    params,
  )
  return rows.map((row) => ({
    accountId: row.account_id,
    accountCode: row.code,
    accountName: row.name,
    accountType: row.type,
    debit: Number(row.debit) || 0,
    credit: Number(row.credit) || 0,
  }))
}

/** Every posted line of one account in the window, ordered by date. */
export function ledgerLines(
  db: LocalDb,
  workspaceId: string,
  accountId: string,
  fromDate: string | null,
  toDate: string | null,
): LedgerLine[] {
  const clauses = [
    'jl.workspace_id = ?',
    'jl.account_id = ?',
    "je.status = 'posted'",
    'je.deleted_at IS NULL',
    'jl.deleted_at IS NULL',
  ]
  const params: unknown[] = [workspaceId, accountId]
  if (fromDate) {
    clauses.push('je.date >= ?')
    params.push(fromDate)
  }
  if (toDate) {
    clauses.push('je.date <= ?')
    params.push(toDate)
  }
  const rows = db.all<{
    id: string
    journal_id: string
    entry_number: string | null
    date: string
    description: string | null
    reference: string | null
    source_type: string | null
    source_id: string | null
    debit: number
    credit: number
  }>(
    `SELECT jl.id, jl.journal_id, je.entry_number, je.date, je.description, je.reference,
            je.source_type, je.source_id, jl.debit, jl.credit
       FROM journal_line jl
       JOIN journal_entry je ON je.id = jl.journal_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY je.date ASC, jl.id ASC`,
    params,
  )
  return rows.map((row) => ({
    lineId: row.id,
    entryId: row.journal_id,
    entryNumber: String(row.entry_number ?? ''),
    date: String(row.date ?? '').slice(0, 10),
    description: String(row.description ?? ''),
    reference: String(row.reference ?? ''),
    sourceType: row.source_type ?? null,
    sourceId: row.source_id ?? null,
    debit: Number(row.debit) || 0,
    credit: Number(row.credit) || 0,
  }))
}

interface InvoiceRow {
  id: string
  currency: string
  subtotal: number
  discount_total: number
  exchange_rate: number | null
}

export interface ProfitSources {
  invoices: ProfitInvoice[]
  lines: ProfitLine[]
  consumptions: ProfitConsumption[]
  /** The device has no payroll; the report takes none. */
  payrolls: []
}

/**
 * Sale invoices of the window (every currency — the report picks its own),
 * their lines and the cost layers they consumed.
 */
export function profitSources(
  db: LocalDb,
  workspaceId: string,
  from: string,
  to: string,
  booksCurrency: string,
): ProfitSources {
  const invoiceRows = db.all<InvoiceRow>(
    `SELECT id, currency, subtotal, discount_total, exchange_rate
       FROM invoice
      WHERE workspace_id = ? AND date >= ? AND date <= ? AND status <> 'cancelled'
        AND deleted_at IS NULL AND type = 'sale'`,
    [workspaceId, from, to],
  )
  return sourcesOf(db, workspaceId, invoiceRows, booksCurrency)
}

/** The sale invoices of the window or the one invoice, with what the report reads of them. */
function sourcesOf(
  db: LocalDb,
  workspaceId: string,
  invoiceRows: InvoiceRow[],
  booksCurrency: string,
): ProfitSources {
  const invoices: ProfitInvoice[] = invoiceRows.map((inv) => ({
    id: inv.id,
    currency: inv.currency,
    subtotal: inv.subtotal,
    discountTotal: inv.discount_total,
  }))
  const rates = new Map<string, number>()
  for (const row of invoiceRows) {
    const rate = Number(row.exchange_rate)
    if (rate > 0 && Number.isFinite(rate)) rates.set(row.id, rate)
  }
  const ids = invoices.map((invoice) => invoice.id)
  if (ids.length === 0) return { invoices, lines: [], consumptions: [], payrolls: [] }

  const marks = ids.map(() => '?').join(', ')
  const lines = db
    .all<{
      invoice_id: string
      product_id: string | null
      product_name: string
      quantity: number
      total_price: number
    }>(
      `SELECT invoice_id, product_id, product_name, quantity, total_price
         FROM invoice_item
        WHERE invoice_id IN (${marks}) AND workspace_id = ? AND deleted_at IS NULL`,
      [...ids, workspaceId],
    )
    .map((line) => ({
      invoiceId: line.invoice_id,
      productId: line.product_id,
      productName: line.product_name,
      quantity: Number(line.quantity),
      totalPrice: line.total_price,
    }))

  const consumptions = db
    .all<{
      consumer_id: string | null
      product_id: string
      quantity: number
      unit_cost: number
      is_shortfall: number
    }>(
      `SELECT consumer_id, product_id, quantity, unit_cost, is_shortfall
         FROM cost_consumption
        WHERE consumer_id IN (${marks}) AND workspace_id = ? AND deleted_at IS NULL`,
      [...ids, workspaceId],
    )
    .map((row) => ({
      invoiceId: row.consumer_id,
      productId: row.product_id,
      amount: round2(Number(row.quantity) * Number(row.unit_cost)),
      isEstimated: Boolean(row.is_shortfall),
      quantity: Number(row.quantity),
    }))

  // A sale in another currency that carries its frozen rate is a sale in the
  // BOOKS currency (the server's rule); one without a rate stays under its own
  // currency, where the report says its profit cannot be computed.
  const restated = restateAtRates(invoices, lines, rates, booksCurrency)
  return { invoices: restated.invoices, lines: restated.lines, consumptions, payrolls: [] }
}

/** `from`/`to` of a report query: explicit dates, else the current month. */
export function reportRange(query: Record<string, string>): { from: string; to: string } {
  const to = query.to ? dateOnly(query.to) : dateOnly(new Date())
  const from = query.from ? dateOnly(query.from) : `${to.slice(0, 7)}-01`
  return { from, to }
}

/** The sources of ONE sale invoice (the till's margin and the evidence chain). */
export function profitSourcesForInvoice(
  db: LocalDb,
  workspaceId: string,
  invoiceId: string,
  booksCurrency: string,
): ProfitSources {
  const rows = db.all<InvoiceRow>(
    `SELECT id, currency, subtotal, discount_total, exchange_rate
       FROM invoice
      WHERE workspace_id = ? AND id = ? AND type = 'sale' AND deleted_at IS NULL`,
    [workspaceId, invoiceId],
  )
  return sourcesOf(db, workspaceId, rows, booksCurrency)
}

/**
 * Everything behind ONE invoice's profit: its profit sources, each cost
 * consumption with the layer it drew from, the journal entry it posted and the
 * posted payments that settled it. The shape `explainInvoiceProfit` takes.
 */
export function invoiceEvidenceSources(
  db: LocalDb,
  workspaceId: string,
  invoiceId: string,
  booksCurrency: string,
): {
  invoice: ProfitInvoice
  lines: ProfitLine[]
  consumptions: EvidenceConsumption[]
  ledger: Array<{ id: string; entryNumber: string | null; status: string }>
  payments: Array<{ paymentId: string; amount: number }>
} | null {
  const sources = profitSourcesForInvoice(db, workspaceId, invoiceId, booksCurrency)
  const invoice = sources.invoices[0]
  if (!invoice) return null

  const consumptions = db
    .all<{
      consumer_id: string
      product_id: string
      quantity: number
      unit_cost: number
      is_shortfall: number
      layer_source_type: string | null
      layer_source_id: string | null
      layer_unit_cost: number | null
      layer_entry_date: string | null
    }>(
      `SELECT cc.consumer_id, cc.product_id, cc.quantity, cc.unit_cost, cc.is_shortfall,
              cl.source_type AS layer_source_type, cl.source_id AS layer_source_id,
              cl.unit_cost AS layer_unit_cost, cl.entry_date AS layer_entry_date
         FROM cost_consumption cc
         LEFT JOIN cost_layer cl ON cl.id = cc.layer_id
        WHERE cc.workspace_id = ? AND cc.consumer_type = 'invoice' AND cc.consumer_id = ?
          AND cc.deleted_at IS NULL
        ORDER BY cc.id`,
      [workspaceId, invoiceId],
    )
    .map((row) => ({
      invoiceId: String(row.consumer_id),
      productId: String(row.product_id),
      quantity: Number(row.quantity) || 0,
      unitCost: Number(row.unit_cost) || 0,
      amount: round2((Number(row.quantity) || 0) * (Number(row.unit_cost) || 0)),
      isEstimated: Boolean(row.is_shortfall),
      layer: row.layer_source_type
        ? {
            sourceType: String(row.layer_source_type),
            sourceId: row.layer_source_id ? String(row.layer_source_id) : null,
            unitCost: Number(row.layer_unit_cost) || 0,
            entryDate: String(row.layer_entry_date ?? ''),
          }
        : null,
    }))

  const ledger = db
    .all<{ id: string; entry_number: string | null; status: string }>(
      `SELECT id, entry_number, status FROM journal_entry
        WHERE workspace_id = ? AND source_type = 'invoice' AND source_id = ? AND deleted_at IS NULL`,
      [workspaceId, invoiceId],
    )
    .map((row) => ({
      id: String(row.id),
      entryNumber: row.entry_number ? String(row.entry_number) : null,
      status: String(row.status),
    }))

  // Only allocations of POSTED payments settle anything.
  const payments = db
    .all<{ payment_id: string; amount: number }>(
      `SELECT pa.payment_id, pa.amount
         FROM payment_allocation pa
         JOIN payment p ON p.id = pa.payment_id AND p.status = 'posted' AND p.deleted_at IS NULL
        WHERE pa.workspace_id = ? AND pa.invoice_id = ? AND pa.deleted_at IS NULL`,
      [workspaceId, invoiceId],
    )
    .map((row) => ({ paymentId: String(row.payment_id), amount: Number(row.amount) || 0 }))

  return { invoice, lines: sources.lines, consumptions, ledger, payments }
}

/** A product's cost layers (all — what remains is on the shelf) and its consumptions in [from, to]. */
export function productJourneySources(
  db: LocalDb,
  workspaceId: string,
  productId: string,
  from: string,
  to: string,
) {
  const layers = db
    .all<{
      source_type: string
      received_qty: number
      remaining_qty: number
      unit_cost: number
      currency: string
    }>(
      `SELECT source_type, received_qty, remaining_qty, unit_cost, currency
         FROM cost_layer
        WHERE workspace_id = ? AND product_id = ? AND deleted_at IS NULL ORDER BY id`,
      [workspaceId, productId],
    )
    .map((row) => ({
      sourceType: String(row.source_type),
      receivedQty: Number(row.received_qty) || 0,
      remainingQty: Number(row.remaining_qty) || 0,
      unitCost: Number(row.unit_cost) || 0,
      currency: String(row.currency),
    }))
  const consumptions = db
    .all<{ consumer_type: string; quantity: number; unit_cost: number }>(
      `SELECT consumer_type, quantity, unit_cost FROM cost_consumption
        WHERE workspace_id = ? AND product_id = ? AND entry_date >= ? AND entry_date <= ?
          AND deleted_at IS NULL ORDER BY id`,
      [workspaceId, productId, from, to],
    )
    .map((row) => ({
      consumerType: String(row.consumer_type),
      quantity: Number(row.quantity) || 0,
      amount: round2((Number(row.quantity) || 0) * (Number(row.unit_cost) || 0)),
    }))
  return { layers, consumptions }
}
