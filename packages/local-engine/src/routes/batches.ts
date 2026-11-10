// ============================================
// packages/local-engine/src/routes/batches.ts
//
// The device's expiry batches (v22, V55 final completion — batch_expiry).
//
// ⚠️ NOT A SECOND ALLOCATION RULE. The plan is decided by the SHARED
// `planAllocation` (`packages/validation/.../lot-allocation.domain.ts`) —
// the exact pure core the server's TraceabilityService runs; the backend file
// re-exports it. The paths mirror the server's `/api/operations/batches*` so
// the offline-endpoint-matrix rows and the client hooks stay one-to-one:
//
//   GET  /operations/batches            list (productId / warehouseId / openOnly)
//   POST /operations/batches            receive a delivery as a batch
//   POST /operations/batches/plan-issue which batches an issue WOULD take
//   POST /operations/batches/issue      record which batches a sale took
//
// The invoice is recorded first (stock and money move there); issuing then
// takes the planned quantity FROM the named batches and writes the
// `lot_allocations` rows that say which invoice line took which batch.
// Cancelling the invoice gives the quantity back — but ONLY the quantity its
// own allocation rows recorded, never more (see the cancel handler in
// routes/invoices.ts). The status stays in the UPDATE's WHERE: two tills
// cannot both consume the same carton.
// ============================================

import {
  planAllocation,
  type AllocationStrategy,
  type BatchAllocation,
  type StockBatch,
} from '@hisabche/validation'
import { requireCapability } from '../auth'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

interface BatchRow {
  id: string
  workspace_id: string
  product_id: string
  batch_number: string
  expiry_date: string | null
  manufactured_date: string | null
  received_qty: number
  remaining_qty: number
  cost_layer_id: string | null
  warehouse_id: string | null
  received_on: string
}

function mapBatch(row: BatchRow): StockBatch {
  return {
    id: row.id,
    productId: row.product_id,
    batchNumber: row.batch_number,
    expiryDate: row.expiry_date,
    manufacturedDate: row.manufactured_date,
    receivedQty: Number(row.received_qty),
    remainingQty: Number(row.remaining_qty),
    costLayerId: row.cost_layer_id,
    warehouseId: row.warehouse_id,
    receivedOn: row.received_on,
  }
}

const today = () => new Date().toISOString().slice(0, 10)

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null

/** The manual choices a request named, in the shape the shared rule reads. */
function manualChoices(raw: Record<string, unknown>): BatchAllocation[] | undefined {
  if (!Array.isArray(raw.manual)) return undefined
  const manual = raw.manual
    .map((row) => row as Record<string, unknown>)
    .filter((row) => typeof row.batchId === 'string' && Number(row.quantity) > 0)
    .map((row) => ({
      batchId: String(row.batchId),
      batchNumber: '',
      quantity: Number(row.quantity),
      expiryDate: null,
      costLayerId: null,
    }))
  return manual.length > 0 ? manual : undefined
}

export function registerBatchesRoutes(router: Router): void {
  // ─── GET /operations/batches ────────────────────────────────
  router.get('/operations/batches', (c: RouteHandlerContext) => {
    const { db, ctx, query } = c
    const clauses = ['workspace_id = ?', 'deleted_at IS NULL']
    const params: unknown[] = [ctx.workspaceId]
    if (query.productId) {
      clauses.push('product_id = ?')
      params.push(query.productId)
    }
    if (query.warehouseId) {
      clauses.push('warehouse_id = ?')
      params.push(query.warehouseId)
    }
    // The server lists open batches by default (openOnly !== false) — the FEFO
    // queue a decision is computed over. 'all' sees the consumed ones too.
    if (query.openOnly !== 'all') {
      clauses.push('remaining_qty > 0')
    }
    const rows = db.all<BatchRow>(
      `SELECT * FROM stock_batches WHERE ${clauses.join(' AND ')}
        ORDER BY expiry_date ASC, received_on ASC, id ASC`,
      params,
    )
    return rows.map(mapBatch)
  })

  // ─── POST /operations/batches (receive) ─────────────────────
  router.post('/operations/batches', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'stock.adjust')
    const { db, ctx, body } = c
    const raw = (body || {}) as Record<string, unknown>
    const productId = asString(raw.productId)
    const batchNumber = asString(raw.batchNumber)
    const quantity = Number(raw.quantity)
    if (!productId || !batchNumber) throw new ValidationError('BATCH_NOT_NAMED')
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ValidationError('BATCH_QUANTITY_INVALID')
    }

    if (
      !db.get('SELECT id FROM product WHERE id = ? AND workspace_id = ?', [
        productId,
        ctx.workspaceId,
      ])
    ) {
      throw new NotFoundError('Product')
    }

    const expiryDate = asString(raw.expiryDate)
    const manufacturedDate = asString(raw.manufacturedDate)
    const costLayerId = asString(raw.costLayerId)
    const warehouseId = asString(raw.warehouseId)
    const receivedOn = (asString(raw.receivedOn) ?? today()).slice(0, 10)
    const now = new Date().toISOString()

    return db.transaction(() => {
      // One batch number is one delivery: receiving it twice would double the
      // shelf without a second carton existing.
      const existing = db.get<{ id: string }>(
        'SELECT id FROM stock_batches WHERE workspace_id = ? AND product_id = ? AND batch_number = ?',
        [ctx.workspaceId, productId, batchNumber],
      )
      if (existing) throw new ConflictError('BATCH_NUMBER_DUPLICATE')

      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : ''
      db.run(
        `INSERT INTO stock_batches (
          id, workspace_id, product_id, batch_number, expiry_date, manufactured_date,
          received_qty, remaining_qty, cost_layer_id, warehouse_id, received_on,
          created_at, updated_at, origin, sync_state
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
        [
          id,
          ctx.workspaceId,
          productId,
          batchNumber,
          expiryDate,
          manufacturedDate,
          quantity,
          quantity,
          costLayerId,
          warehouseId,
          receivedOn,
          now,
          now,
        ],
      )
      return mapBatch(db.get<BatchRow>('SELECT * FROM stock_batches WHERE id = ?', [id])!)
    })
  })

  // ─── POST /operations/batches/plan-issue (plan only) ────────
  router.post('/operations/batches/plan-issue', (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    const raw = (body || {}) as Record<string, unknown>
    const productId = asString(raw.productId)
    const quantity = Number(raw.quantity)
    if (!productId) throw new ValidationError('BATCH_NOT_NAMED')
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ValidationError('BATCH_QUANTITY_INVALID')
    }

    const rows = db.all<BatchRow>(
      'SELECT * FROM stock_batches WHERE workspace_id = ? AND product_id = ? AND deleted_at IS NULL',
      [ctx.workspaceId, productId],
    )
    const manual = manualChoices(raw)
    return planAllocation(rows.map(mapBatch), quantity, {
      strategy: (asString(raw.strategy) as AllocationStrategy | null) ?? 'fefo',
      asOf: (asString(raw.asOf) ?? today()).slice(0, 10),
      ...(manual ? { manual } : {}),
    })
  })

  // ─── POST /operations/batches/issue (claim a sale's batches) ─
  router.post('/operations/batches/issue', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    const { db, ctx, body } = c
    const raw = (body || {}) as Record<string, unknown>
    const invoiceId = asString(raw.invoiceId)
    const productId = asString(raw.productId)
    const quantity = Number(raw.quantity)
    if (!invoiceId || !productId) throw new ValidationError('BATCH_SALE_ONLY')
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ValidationError('BATCH_QUANTITY_INVALID')
    }
    const consumerLine = asString(raw.consumerLine)

    return db.transaction(() => {
      // The invoice is this workspace's recorded SALE — the gate the server's
      // issue flow keeps for the documents it consumes against.
      const invoice = db.get<{ type: string; status: string }>(
        'SELECT type, status FROM invoice WHERE id = ? AND workspace_id = ?',
        [invoiceId, ctx.workspaceId],
      )
      if (!invoice) throw new NotFoundError('Invoice')
      if (invoice.type === 'purchase') throw new ValidationError('BATCH_SALE_ONLY')
      if (invoice.status === 'cancelled') throw new ValidationError('BATCH_INVOICE_CANCELLED')

      const sold = db
        .all<{ quantity: number }>(
          'SELECT quantity FROM invoice_item WHERE invoice_id = ? AND product_id = ?',
          [invoiceId, productId],
        )
        .reduce((sum, line) => sum + (Number(line.quantity) || 0), 0)
      if (sold <= 0) throw new ValidationError('BATCH_PRODUCT_NOT_ON_INVOICE')

      // An invoice allocates each line once. A replayed issue (a retry, a
      // double tap) finds its own allocations and must not take the shelf
      // twice.
      const already = db
        .all<{ quantity: number }>(
          "SELECT quantity FROM lot_allocations WHERE workspace_id = ? AND consumer_type = 'invoice' AND consumer_id = ? AND product_id = ? AND batch_id IS NOT NULL",
          [ctx.workspaceId, invoiceId, productId],
        )
        .reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)
      if (already + quantity > sold) throw new ValidationError('BATCH_COUNT_MISMATCH')

      const rows = db.all<BatchRow>(
        'SELECT * FROM stock_batches WHERE workspace_id = ? AND product_id = ? AND deleted_at IS NULL',
        [ctx.workspaceId, productId],
      )
      const manual = manualChoices(raw)
      const plan = planAllocation(rows.map(mapBatch), quantity, {
        strategy: (asString(raw.strategy) as AllocationStrategy | null) ?? 'fefo',
        asOf: (asString(raw.asOf) ?? today()).slice(0, 10),
        ...(manual ? { manual } : {}),
      })
      if (plan.shortfall > 0) {
        throw new ConflictError(
          plan.blockedByExpiry.length > 0 ? 'BATCH_ONLY_EXPIRED_STOCK' : 'BATCH_INSUFFICIENT_STOCK',
        )
      }

      const entryDate = (asString(raw.asOf) ?? today()).slice(0, 10)
      for (const allocation of plan.allocations) {
        // The remaining quantity is in the WHERE too: two tills cannot both
        // consume the same carton, and the CHECK constraint is the second net.
        const taken = db.run(
          `UPDATE stock_batches SET remaining_qty = remaining_qty - ?, updated_at = ?
            WHERE workspace_id = ? AND id = ? AND remaining_qty >= ?`,
          [
            allocation.quantity,
            new Date().toISOString(),
            ctx.workspaceId,
            allocation.batchId,
            allocation.quantity,
          ],
        )
        if (taken.changes === 0) throw new ConflictError('BATCH_INSUFFICIENT_STOCK')

        db.run(
          `INSERT INTO lot_allocations (
            id, workspace_id, consumer_type, consumer_id, consumer_line,
            product_id, batch_id, serial_id, quantity, entry_date,
            created_at, updated_at, origin, sync_state
          ) VALUES (?, ?, 'invoice', ?, ?, ?, ?, NULL, ?, ?, ?, ?, 'local', 'local_only')`,
          [
            typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '',
            ctx.workspaceId,
            invoiceId,
            consumerLine,
            productId,
            allocation.batchId,
            allocation.quantity,
            entryDate,
            new Date().toISOString(),
            new Date().toISOString(),
          ],
        )
      }

      return plan
    })
  })
}
