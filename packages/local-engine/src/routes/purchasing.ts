// ============================================
// packages/local-engine/src/routes/purchasing.ts
//
// Suppliers and purchase orders on the device: list, open, create, and receive
// the goods.
//
// ⚠️ NOT A SECOND SET OF RULES. The order's body is `createPurchaseOrderSchema`,
// a line's value is `orderLineTotal`, what a unit cost on arrival is
// `receiptUnitCost`, and when an order may be received is `receiveRefusal` —
// the functions the server's PurchasingService calls. Receiving writes a COST
// LAYER first (what was actually paid), then the stock movement; an order is
// received exactly once.
//
// The reply is the server's: rows in snake_case with the supplier and the lines
// nested, as `GET /api/purchase-orders` sends them.
// ============================================

import {
  createPurchaseOrderSchema,
  flagFilter,
  orderLineTotal,
  receiptUnitCost,
  receiveRefusal,
} from '@hisabche/validation'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import type { LocalDb } from '../db'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'
import { receiveLayer } from './cost-layers'

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** An action's reply is 200 (the engine answers a bare POST 201). */
function answered<T>(data: T): { __status: 200; __data: T } {
  return { __status: 200, __data: data }
}

interface OrderRow {
  id: string
  supplier_id: string | null
  order_date: string
  expected_delivery_date: string | null
  status: string
  notes: string | null
  received_at: string | null
  created_at: string
  updated_at: string
}

interface LineRow {
  id: string
  purchase_order_id: string
  product_id: string
  quantity: number
  unit_price: number
  total_price: number | null
}

function supplierOf(db: LocalDb, workspaceId: string, id: string | null) {
  if (!id) return null
  return (
    db.get<{ id: string; name: string; phone: string; email: string }>(
      'SELECT id, name, phone, email FROM supplier WHERE id = ? AND workspace_id = ?',
      [id, workspaceId],
    ) ?? null
  )
}

function linesOf(db: LocalDb, workspaceId: string, orderId: string, withTotals: boolean) {
  return db
    .all<LineRow>(
      `SELECT id, purchase_order_id, product_id, quantity, unit_price, total_price
         FROM purchase_order_item
        WHERE purchase_order_id = ? AND workspace_id = ? AND deleted_at IS NULL ORDER BY created_at, id`,
      [orderId, workspaceId],
    )
    .map((line) => {
      const product =
        db.get<{ id: string; name: string; unit: string | null }>(
          'SELECT id, name, unit FROM product WHERE id = ? AND workspace_id = ?',
          [line.product_id, workspaceId],
        ) ?? null
      return {
        id: line.id,
        ...(withTotals ? { purchase_order_id: line.purchase_order_id } : {}),
        product_id: line.product_id,
        quantity: Number(line.quantity),
        unit_price: line.unit_price,
        ...(withTotals ? { total_price: line.total_price } : {}),
        product,
      }
    })
}

function openOrder(db: LocalDb, workspaceId: string, id: string) {
  const order = db.get<OrderRow>(
    'SELECT * FROM purchase_order WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
    [id, workspaceId],
  )
  if (!order) throw new NotFoundError('Purchase order')
  return {
    id: order.id,
    supplier_id: order.supplier_id,
    order_date: order.order_date,
    expected_delivery_date: order.expected_delivery_date,
    status: order.status,
    notes: order.notes,
    received_at: order.received_at,
    created_at: order.created_at,
    updated_at: order.updated_at,
    supplier: supplierOf(db, workspaceId, order.supplier_id),
    items: linesOf(db, workspaceId, order.id, true),
  }
}

export function registerPurchasingRoutes(router: Router): void {
  // ─── GET /suppliers ─────────────────────────────────────────
  router.get('/suppliers', (c: RouteHandlerContext) => {
    const { db, ctx, query } = c
    const clauses = ['workspace_id = ?', 'deleted_at IS NULL']
    const params: unknown[] = [ctx.workspaceId]
    const isActive = flagFilter(query.isActive)
    if (isActive !== undefined) {
      clauses.push('is_active = ?')
      params.push(isActive ? 1 : 0)
    }
    if (query.search) {
      clauses.push('(name LIKE ? OR phone LIKE ?)')
      params.push(`%${query.search}%`, `%${query.search}%`)
    }
    return db
      .all<{
        id: string
        name: string
        phone: string
        email: string
        address: string | null
        notes: string
        is_active: number
        created_at: string
        updated_at: string
      }>(
        `SELECT id, name, phone, email, address, notes, is_active, created_at, updated_at
           FROM supplier WHERE ${clauses.join(' AND ')} ORDER BY name LIMIT 500`,
        params,
      )
      .map((row) => ({
        id: row.id,
        name: row.name ?? '',
        phone: row.phone ?? '',
        email: row.email ?? '',
        address: row.address ?? null,
        notes: row.notes ?? '',
        isActive: row.is_active !== 0,
        createdAt: row.created_at ?? null,
        updatedAt: row.updated_at ?? null,
      }))
  })

  // ─── GET /purchase-orders ───────────────────────────────────
  router.get('/purchase-orders', (c: RouteHandlerContext) => {
    const { db, ctx } = c
    return db
      .all<OrderRow>(
        `SELECT * FROM purchase_order WHERE workspace_id = ? AND deleted_at IS NULL
          ORDER BY created_at DESC, id`,
        [ctx.workspaceId],
      )
      .map((order) => ({
        id: order.id,
        supplier_id: order.supplier_id,
        status: order.status,
        order_date: order.order_date,
        supplier: supplierOf(db, ctx.workspaceId, order.supplier_id),
        items: linesOf(db, ctx.workspaceId, order.id, false),
      }))
  })

  // ─── GET /purchase-orders/:id ───────────────────────────────
  router.get('/purchase-orders/:id', (c: RouteHandlerContext) =>
    openOrder(c.db, c.ctx.workspaceId, c.params.id ?? ''),
  )

  // ─── POST /purchase-orders ──────────────────────────────────
  router.post('/purchase-orders', (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    const raw = (body || {}) as Record<string, unknown>
    const parsed = createPurchaseOrderSchema.safeParse(raw)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
      )
    }
    const data = parsed.data

    // A retried submit names the same order: the first one is returned.
    const orderId = typeof raw.id === 'string' && raw.id ? raw.id : generateUuid()
    const existing = db.get<{ id: string }>(
      'SELECT id FROM purchase_order WHERE id = ? AND workspace_id = ?',
      [orderId, ctx.workspaceId],
    )
    if (existing) return { __status: 200, __data: openOrder(db, ctx.workspaceId, orderId) }

    if (!supplierOf(db, ctx.workspaceId, data.supplierId)) throw new NotFoundError('Supplier')
    for (const item of data.items) {
      const product = db.get<{ id: string }>(
        'SELECT id FROM product WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
        [item.productId, ctx.workspaceId],
      )
      if (!product) throw new ValidationError(`PURCHASE_ORDER_PRODUCT_UNKNOWN: ${item.productId}`)
    }

    const now = new Date().toISOString()
    return db.transaction(() => {
      db.run(
        `INSERT INTO purchase_order (
          id, workspace_id, supplier_id, order_date, expected_delivery_date, status, notes,
          created_at, updated_at, origin, sync_state
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
        [
          orderId,
          ctx.workspaceId,
          data.supplierId,
          data.orderDate || now,
          data.expectedDeliveryDate || null,
          data.status || 'pending',
          data.notes || null,
          now,
          now,
        ],
      )
      for (const item of data.items) {
        db.run(
          `INSERT INTO purchase_order_item (
            id, workspace_id, purchase_order_id, product_id, quantity, unit_price, total_price,
            created_at, updated_at, origin, sync_state
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
          [
            generateUuid(),
            ctx.workspaceId,
            orderId,
            item.productId,
            item.quantity,
            item.unitPrice,
            orderLineTotal(item),
            now,
            now,
          ],
        )
      }
      return openOrder(db, ctx.workspaceId, orderId)
    })
  })

  // ─── POST /purchase-orders/:id/receive ──────────────────────
  // Goods arrived. Two things happen, in this order: the goods get a COST LAYER
  // holding what was paid for them, and the stock moves. The order is claimed
  // first — conditioned on the status just read — so a second receive finds
  // nothing to claim and is refused, never a second arrival on the shelf.
  router.post('/purchase-orders/:id/receive', (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const id = params.id ?? ''

    return db.transaction(() => {
      const order = db.get<OrderRow>(
        'SELECT * FROM purchase_order WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
        [id, ctx.workspaceId],
      )
      if (!order) throw new NotFoundError('Purchase order')

      const refusal = receiveRefusal(order.status)
      if (refusal) throw new ConflictError(refusal)

      const receivedAt = new Date().toISOString()
      const claimed = db.run(
        `UPDATE purchase_order SET status = 'received', received_at = ?, updated_at = ?
          WHERE id = ? AND workspace_id = ? AND status = ?`,
        [receivedAt, receivedAt, id, ctx.workspaceId, order.status],
      )
      if (claimed.changes === 0) throw new ConflictError('PURCHASE_ORDER_ALREADY_RECEIVED')

      const entryDate = String(order.order_date ?? receivedAt).slice(0, 10)
      const lines = db.all<LineRow>(
        `SELECT id, purchase_order_id, product_id, quantity, unit_price, total_price
           FROM purchase_order_item
          WHERE purchase_order_id = ? AND workspace_id = ? AND deleted_at IS NULL`,
        [id, ctx.workspaceId],
      )
      for (const line of lines) {
        const unitCost = receiptUnitCost(line)
        if (!line.product_id || unitCost === null) continue
        receiveLayer(db, {
          workspaceId: ctx.workspaceId,
          productId: line.product_id,
          warehouseId: null,
          quantity: Number(line.quantity),
          unitCost,
          currency: ctx.baseCurrency,
          entryDate,
          sourceType: 'purchase_order',
          sourceId: id,
          sourceLine: line.id,
          now: receivedAt,
        })
        db.run(
          `INSERT INTO inventory_movement (
            id, workspace_id, product_id, type, quantity, reference, date,
            created_at, updated_at, origin, sync_state
          ) VALUES (?, ?, ?, 'purchase', ?, ?, ?, ?, ?, 'local', 'local_only')`,
          [
            generateUuid(),
            ctx.workspaceId,
            line.product_id,
            Number(line.quantity),
            `purchase_order:${id}`,
            receivedAt.slice(0, 10),
            receivedAt,
            receivedAt,
          ],
        )
        db.run(
          'UPDATE product SET quantity = quantity + ?, updated_at = ? WHERE id = ? AND workspace_id = ?',
          [Number(line.quantity), receivedAt, line.product_id, ctx.workspaceId],
        )
      }

      const received = db.get<OrderRow>('SELECT * FROM purchase_order WHERE id = ?', [id])!
      return answered({
        id: received.id,
        supplier_id: received.supplier_id,
        order_date: received.order_date,
        expected_delivery_date: received.expected_delivery_date,
        status: received.status,
        notes: received.notes,
        received_at: received.received_at,
        created_at: received.created_at,
        updated_at: received.updated_at,
      })
    })
  })

  // ─── POST /inventory/reorder-suggestions/draft-po ───────────
  router.post('/inventory/reorder-suggestions/draft-po', (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    const raw = (body ?? {}) as {
      suggestions?: Array<{
        supplierId?: string
        productId: string
        suggestedQuantity: number
        unitPrice?: number
      }>
    }
    const items = raw.suggestions ?? []
    const now = new Date().toISOString()
    const orderDate = now.slice(0, 10)

    const bySupplier = new Map<
      string,
      Array<{ productId: string; quantity: number; unitPrice: number }>
    >()
    for (const item of items) {
      const supId = item.supplierId || 'default-supplier'
      if (!bySupplier.has(supId)) bySupplier.set(supId, [])
      bySupplier.get(supId)!.push({
        productId: item.productId,
        quantity: item.suggestedQuantity,
        unitPrice: item.unitPrice ?? 0,
      })
    }

    return db.transaction(() => {
      const draftPOs = []
      for (const [supplierId, supItems] of bySupplier.entries()) {
        const orderId = `po-draft-${Math.random().toString(36).slice(2, 9)}`
        db.run(
          `INSERT INTO purchase_order (id, workspace_id, supplier_id, order_date, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
          [orderId, ctx.workspaceId, supplierId, orderDate, now, now],
        )
        for (const si of supItems) {
          const lineId = `pol-${Math.random().toString(36).slice(2, 9)}`
          const total = si.quantity * si.unitPrice
          db.run(
            `INSERT INTO purchase_order_item (id, workspace_id, purchase_order_id, product_id, quantity, unit_price, total_price, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              lineId,
              ctx.workspaceId,
              orderId,
              si.productId,
              si.quantity,
              si.unitPrice,
              total,
              now,
              now,
            ],
          )
        }
        draftPOs.push(openOrder(db, ctx.workspaceId, orderId))
      }
      return { draftPOs, count: draftPOs.length }
    })
  })
}
