// ============================================
// packages/local-engine/src/routes/serials.ts
//
// The device's unit serials (v21, V55 P2 — serialized_items).
//
// ⚠️ NOT A SECOND SET OF RULES. The claim is decided by the SHARED
// `validateSerialSale` (`packages/validation/.../serial-batch.domain.ts`) —
// the same rule the server keeps. The paths mirror the server's
// `/api/operations/serials*` so the offline-endpoint-matrix rows and the
// client hooks stay one-to-one:
//
//   GET  /operations/serials           list (productId / status / invoiceId)
//   POST /operations/serials           receive units (dedup, in stock)
//   POST /operations/serials/issue     name the units a recorded sale handed over
//
// The invoice is recorded first (stock and money move there); issuing then
// marks the named units sold ON that invoice. Cancelling the invoice frees
// them again — see the cancel handler in routes/invoices.ts.
// ============================================

import { validateSerialSale, type SerialRecord } from '@hisabche/validation'
import { requireCapability } from '../auth'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

interface SerialRow {
  id: string
  workspace_id: string
  product_id: string
  serial_number: string
  status: string
  unit_cost_minor: number
  warehouse_id: string | null
  received_on: string
  invoice_id: string | null
  sold_on: string | null
}

function mapSerial(row: SerialRow) {
  return {
    id: row.id,
    productId: row.product_id,
    product_id: row.product_id,
    serialNumber: row.serial_number,
    serial_number: row.serial_number,
    status: row.status,
    unitCostMinor: row.unit_cost_minor,
    unit_cost_minor: row.unit_cost_minor,
    warehouseId: row.warehouse_id,
    receivedOn: row.received_on,
    received_on: row.received_on,
    invoiceId: row.invoice_id,
    invoice_id: row.invoice_id,
    soldOn: row.sold_on,
    sold_on: row.sold_on,
  }
}

const today = () => new Date().toISOString().slice(0, 10)

/** The row a serial claim is checked against, in the shape the shared rule reads. */
function asSerialRecord(row: SerialRow): SerialRecord {
  return {
    serialNumber: row.serial_number,
    productId: row.product_id,
    status: row.status as SerialRecord['status'],
    warehouseId: row.warehouse_id,
    soldInvoiceId: row.invoice_id,
  }
}

export function registerSerialsRoutes(router: Router): void {
  // ─── GET /operations/serials ────────────────────────────────
  router.get('/operations/serials', (c: RouteHandlerContext) => {
    const { db, ctx, query } = c
    const clauses = ['workspace_id = ?', 'deleted_at IS NULL']
    const params: unknown[] = [ctx.workspaceId]
    if (query.productId) {
      clauses.push('product_id = ?')
      params.push(query.productId)
    }
    if (query.invoiceId) {
      clauses.push('invoice_id = ?')
      params.push(query.invoiceId)
    }
    // 'all' = every status (the product page's look-up); default in stock.
    if (query.status !== 'all') {
      clauses.push('status = ?')
      params.push(query.status || 'in_stock')
    }
    const rows = db.all<SerialRow>(
      `SELECT * FROM stock_serials WHERE ${clauses.join(' AND ')} ORDER BY received_on, id`,
      params,
    )
    return rows.map(mapSerial)
  })

  // ─── POST /operations/serials (receive) ─────────────────────
  router.post('/operations/serials', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'stock.adjust')
    const { db, ctx, body } = c
    const raw = (body || {}) as Record<string, unknown>
    const productId = typeof raw.productId === 'string' ? raw.productId : ''
    const serialNumbers = Array.isArray(raw.serialNumbers)
      ? (raw.serialNumbers as unknown[]).filter(
          (value): value is string => typeof value === 'string' && value.trim().length > 0,
        )
      : []
    if (!productId) throw new ValidationError('SERIAL_PRODUCT_REQUIRED')
    if (serialNumbers.length === 0) throw new ValidationError('SERIAL_COUNT_MISMATCH')
    if (new Set(serialNumbers).size !== serialNumbers.length) {
      throw new ValidationError('SERIAL_DUPLICATE')
    }

    if (
      !db.get('SELECT id FROM product WHERE id = ? AND workspace_id = ?', [
        productId,
        ctx.workspaceId,
      ])
    ) {
      throw new NotFoundError('Product')
    }

    const unitCostMinor = Number(raw.unitCostMinor) || 0
    const warehouseId = typeof raw.warehouseId === 'string' ? raw.warehouseId : null
    const receivedOn = (typeof raw.receivedOn === 'string' ? raw.receivedOn : today()).slice(0, 10)
    const now = new Date().toISOString()

    return db.transaction(() => {
      const created: SerialRow[] = []
      for (const serialNumber of serialNumbers) {
        // Workspace-wide IMEI uniqueness (not just per product)
        const existing = db.get<{ id: string }>(
          'SELECT id FROM stock_serials WHERE workspace_id = ? AND serial_number = ? AND deleted_at IS NULL',
          [ctx.workspaceId, serialNumber],
        )
        if (existing) throw new ConflictError('SERIAL_DUPLICATE')
        const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : ''
        db.run(
          `INSERT INTO stock_serials (
            id, workspace_id, product_id, serial_number, status, unit_cost_minor,
            warehouse_id, received_on, created_at, updated_at, origin, sync_state
          ) VALUES (?, ?, ?, ?, 'in_stock', ?, ?, ?, ?, ?, 'local', 'local_only')`,
          [
            id,
            ctx.workspaceId,
            productId,
            serialNumber,
            unitCostMinor,
            warehouseId,
            receivedOn,
            now,
            now,
          ],
        )
        created.push(db.get<SerialRow>('SELECT * FROM stock_serials WHERE id = ?', [id])!)
      }
      return created.map(mapSerial)
    })
  })

  // ─── POST /operations/serials/issue (claim a sale's units) ──
  router.post('/operations/serials/issue', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    const { db, ctx, body } = c
    const raw = (body || {}) as Record<string, unknown>
    const invoiceId = typeof raw.invoiceId === 'string' ? raw.invoiceId : ''
    const productId = typeof raw.productId === 'string' ? raw.productId : ''
    const serialNumbers = Array.isArray(raw.serialNumbers)
      ? (raw.serialNumbers as unknown[]).filter(
          (value): value is string => typeof value === 'string',
        )
      : []
    if (!invoiceId || !productId) throw new ValidationError('SERIAL_SALE_ONLY')
    if (serialNumbers.length === 0) throw new ValidationError('SERIAL_COUNT_MISMATCH')

    return db.transaction(() => {
      // The invoice is this workspace's recorded SALE — the same gate
      // `assignSerialsToSale` keeps on the server.
      const invoice = db.get<{ type: string; status: string }>(
        'SELECT type, status FROM invoice WHERE id = ? AND workspace_id = ?',
        [invoiceId, ctx.workspaceId],
      )
      if (!invoice) throw new NotFoundError('Invoice')
      if (invoice.type === 'purchase') throw new ValidationError('SERIAL_SALE_ONLY')
      if (invoice.status === 'cancelled') throw new ValidationError('SERIAL_INVOICE_CANCELLED')

      const sold = db
        .all<{ quantity: number }>(
          'SELECT quantity FROM invoice_item WHERE invoice_id = ? AND product_id = ?',
          [invoiceId, productId],
        )
        .reduce((sum, line) => sum + (Number(line.quantity) || 0), 0)
      if (sold <= 0) throw new ValidationError('SERIAL_PRODUCT_NOT_ON_INVOICE')

      const already = db.get<{ count: number }>(
        "SELECT COUNT(*) AS count FROM stock_serials WHERE workspace_id = ? AND invoice_id = ? AND product_id = ? AND status = 'sold'",
        [ctx.workspaceId, invoiceId, productId],
      )?.count
      if ((already ?? 0) + serialNumbers.length > sold) {
        throw new ValidationError('SERIAL_COUNT_MISMATCH')
      }

      const entryDate = today()
      let costMinor = 0
      for (const serialNumber of serialNumbers) {
        const row = db.get<SerialRow>(
          'SELECT * FROM stock_serials WHERE workspace_id = ? AND product_id = ? AND serial_number = ? AND deleted_at IS NULL',
          [ctx.workspaceId, productId, serialNumber],
        )
        // ONE shared rule for the claim, offline and online.
        const verdict = validateSerialSale(row ? asSerialRecord(row) : null, serialNumber)
        if (!verdict.valid) throw new ValidationError(verdict.error)

        // The status is in the WHERE too: two tills cannot both sell one phone.
        const claimed = db.run(
          `UPDATE stock_serials SET status = 'sold', invoice_id = ?, sold_on = ?, updated_at = ?
            WHERE workspace_id = ? AND product_id = ? AND serial_number = ? AND status = 'in_stock'`,
          [
            invoiceId,
            entryDate,
            new Date().toISOString(),
            ctx.workspaceId,
            productId,
            serialNumber,
          ],
        )
        if (claimed.changes === 0) throw new ConflictError('SERIAL_NOT_IN_STOCK')
        costMinor += row?.unit_cost_minor ?? 0
      }

      return { issued: serialNumbers.length, costMinor }
    })
  })
}
