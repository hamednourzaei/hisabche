// ============================================
// packages/local-engine/src/routes/analysis.ts
//
// The business-analysis reports on the device: collections, customer risk,
// suppliers, break-even, working capital and cohorts.
//
// ⚠️ NOT A SECOND SET OF RULES. The device reads its own invoices, payments and
// purchase orders (SQLite) and hands them to the assemblers of
// @hisabche/validation (analysis-report.domain) — the functions the server's
// AnalysisService calls, over rows shaped like `invoice_outstanding`. «Late»,
// «outstanding» and «profit» are decided in ONE place.
//
// Unknown stays unknown: cost of goods that is not fully recorded gives days of
// stock and the cash cycle as null, never zero; cash is not an input.
// ============================================

import {
  breakEvenAnalysis,
  breakEvenQuerySchema,
  buildProfitReport,
  cohortReport,
  collectionsWorklist,
  customerAssessment,
  layersValue,
  round2,
  settledInvoiceIds,
  supplierAnalysis,
  toMinorUnits,
  withCustomerNames,
  workingCapitalAnalysis,
  workingCapitalQuerySchema,
  type OutstandingRow,
  type SupplierOrderItemRow,
} from '@hisabche/validation'
import { NotFoundError, ValidationError } from '../errors'
import type { LocalDb } from '../db'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'
import { profitSources } from './report-sources'

const today = () => new Date().toISOString().slice(0, 10)
const day = (value: unknown) => String(value ?? '').slice(0, 10)

/**
 * Invoices as `invoice_outstanding` states them: what is still owed is the total
 * less what has been paid. A cancelled or deleted invoice is not owed.
 */
function outstandingRows(
  db: LocalDb,
  workspaceId: string,
  filter: { type: 'sale' | 'purchase'; customerId?: string; currency?: string; openOnly?: boolean },
): OutstandingRow[] {
  const clauses = ['workspace_id = ?', 'type = ?', 'deleted_at IS NULL', "status <> 'cancelled'"]
  const params: unknown[] = [workspaceId, filter.type]
  if (filter.customerId) {
    clauses.push('customer_id = ?')
    params.push(filter.customerId)
  }
  if (filter.currency) {
    clauses.push('currency = ?')
    params.push(filter.currency)
  }
  if (filter.openOnly) clauses.push('total - paid_amount > 0')
  return db
    .all<{
      id: string
      invoice_number: string | null
      total: number
      paid_amount: number
      due_date: string | null
      date: string
      customer_id: string | null
      currency: string | null
    }>(
      `SELECT id, invoice_number, total, paid_amount, due_date, date, customer_id, currency
         FROM invoice WHERE ${clauses.join(' AND ')} ORDER BY id`,
      params,
    )
    .map((row) => ({
      invoice_id: row.id,
      invoice_number: row.invoice_number,
      total: row.total,
      allocated: row.paid_amount,
      outstanding: Number(row.total) - Number(row.paid_amount),
      due_date: row.due_date,
      invoice_date: row.date,
      customer_id: row.customer_id,
      currency: row.currency,
    }))
}

/** The costing core's whole valuation of stock in the books (major units): open layers × cost, per product. */
function stockValue(db: LocalDb, workspaceId: string): number {
  const layers = db.all<{
    id: string
    product_id: string
    warehouse_id: string | null
    remaining_qty: number
    unit_cost: number
    entry_date: string
    created_at: string
  }>(
    `SELECT id, product_id, warehouse_id, remaining_qty, unit_cost, entry_date, created_at
       FROM cost_layer
      WHERE workspace_id = ? AND remaining_qty > 0 AND deleted_at IS NULL`,
    [workspaceId],
  )
  const byProduct = new Map<string, typeof layers>()
  for (const layer of layers) {
    byProduct.set(layer.product_id, [...(byProduct.get(layer.product_id) ?? []), layer])
  }
  let value = 0
  for (const rows of byProduct.values()) {
    value += round2(
      layersValue(
        rows.map((l) => ({
          id: l.id,
          productId: l.product_id,
          warehouseId: l.warehouse_id,
          remainingQty: Number(l.remaining_qty),
          unitCost: l.unit_cost,
          entryDate: l.entry_date,
          createdAt: l.created_at,
        })),
      ),
    )
  }
  return value
}

function parseQuery<T>(
  schema: {
    safeParse(
      input: unknown,
    ):
      { success: true; data: T } | { success: false; error: { errors: Array<{ message: string }> } }
  },
  query: Record<string, string>,
): T {
  const parsed = schema.safeParse(query)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.errors[0]?.message ?? 'Validation failed')
  }
  return parsed.data
}

export function registerAnalysisRoutes(router: Router): void {
  // ─── GET /analysis/collections ──────────────────────────────
  router.get('/analysis/collections', (c: RouteHandlerContext) => {
    const { db, ctx } = c
    const base = collectionsWorklist(
      outstandingRows(db, ctx.workspaceId, { type: 'sale', openOnly: true }),
      today(),
    )
    const ids = [
      ...new Set(base.actions.map((a) => a.customerId).filter((id): id is string => !!id)),
    ]
    const names = new Map<string, string>()
    if (ids.length > 0) {
      for (const row of db.all<{ id: string; full_name: string }>(
        `SELECT id, full_name FROM customer WHERE workspace_id = ? AND id IN (${ids.map(() => '?').join(', ')})`,
        [ctx.workspaceId, ...ids],
      )) {
        names.set(row.id, row.full_name)
      }
    }
    return withCustomerNames(base, names)
  })

  // ─── GET /analysis/customers/:id/risk ───────────────────────
  router.get('/analysis/customers/:id/risk', (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const customerId = params.id ?? ''
    const customer = db.get<{ id: string }>(
      'SELECT id FROM customer WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [customerId, ctx.workspaceId],
    )
    if (!customer) throw new NotFoundError('Customer')

    const rows = outstandingRows(db, ctx.workspaceId, { type: 'sale', customerId })
    // «Settled on» is the day of the LAST allocation on a fully paid invoice.
    const settledOn = new Map<string, string>()
    const ids = settledInvoiceIds(rows)
    if (ids.length > 0) {
      for (const row of db.all<{ invoice_id: string; created_at: string }>(
        `SELECT pa.invoice_id, pa.created_at
           FROM payment_allocation pa
           JOIN payment p ON p.id = pa.payment_id AND p.status = 'posted' AND p.deleted_at IS NULL
          WHERE pa.workspace_id = ? AND pa.deleted_at IS NULL
            AND pa.invoice_id IN (${ids.map(() => '?').join(', ')})
          ORDER BY pa.created_at ASC`,
        [ctx.workspaceId, ...ids],
      )) {
        // Ascending, so the last write per invoice wins.
        settledOn.set(row.invoice_id, day(row.created_at))
      }
    }
    return customerAssessment({ customerId, rows, settledOn, asOf: today() })
  })

  // ─── GET /analysis/suppliers ────────────────────────────────
  router.get('/analysis/suppliers', (c: RouteHandlerContext) => {
    const { db, ctx } = c
    const suppliers = db.all<{ id: string; name: string; is_active: number }>(
      'SELECT id, name, is_active FROM supplier WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY id',
      [ctx.workspaceId],
    )
    const orders = db.all<{
      id: string
      supplier_id: string | null
      order_date: string | null
      expected_delivery_date: string | null
      status: string | null
      received_at: string | null
    }>(
      `SELECT id, supplier_id, order_date, expected_delivery_date, status, received_at
         FROM purchase_order WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY id`,
      [ctx.workspaceId],
    )
    const items = new Map<string, SupplierOrderItemRow[]>()
    for (const row of db.all<{
      purchase_order_id: string
      product_id: string
      quantity: number
      total_price: number | null
    }>(
      `SELECT purchase_order_id, product_id, quantity, total_price
         FROM purchase_order_item WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY id`,
      [ctx.workspaceId],
    )) {
      items.set(row.purchase_order_id, [
        ...(items.get(row.purchase_order_id) ?? []),
        { product_id: row.product_id, quantity: row.quantity, total_price: row.total_price ?? 0 },
      ])
    }
    return supplierAnalysis({ asOf: today(), suppliers, orders, items })
  })

  // ─── GET /analysis/break-even ───────────────────────────────
  router.get('/analysis/break-even', (c: RouteHandlerContext) => {
    const { db, ctx, query } = c
    const q = parseQuery(breakEvenQuerySchema, query)
    const report = buildProfitReport({
      from: q.from,
      to: q.to,
      currency: q.currency,
      ...profitSources(db, ctx.workspaceId, q.from, q.to, ctx.baseCurrency),
    })
    return breakEvenAnalysis(report, q.otherFixedCosts ?? null)
  })

  // ─── GET /analysis/working-capital ──────────────────────────
  router.get('/analysis/working-capital', (c: RouteHandlerContext) => {
    const { db, ctx, query } = c
    const q = parseQuery(workingCapitalQuerySchema, query)
    const report = buildProfitReport({
      from: q.from,
      to: q.to,
      currency: q.currency,
      ...profitSources(db, ctx.workspaceId, q.from, q.to, ctx.baseCurrency),
    })
    return workingCapitalAnalysis({
      from: q.from,
      to: q.to,
      currency: q.currency,
      report,
      sales: outstandingRows(db, ctx.workspaceId, { type: 'sale', currency: q.currency }),
      purchases: outstandingRows(db, ctx.workspaceId, { type: 'purchase', currency: q.currency }),
      inventoryMinor: toMinorUnits(stockValue(db, ctx.workspaceId)),
    })
  })

  // ─── GET /analysis/cohorts ──────────────────────────────────
  router.get('/analysis/cohorts', (c: RouteHandlerContext) => {
    const { db, ctx } = c
    const rows = outstandingRows(db, ctx.workspaceId, { type: 'sale' }).filter(
      (row) => row.customer_id !== null,
    )
    return cohortReport(rows, today())
  })
}
