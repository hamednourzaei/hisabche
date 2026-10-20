// ============================================
// packages/local-engine/src/routes/transfers.ts
//
// Inventory stock transfers between warehouses (BUG-102 rule).
// Atomic decrement from source and increment at destination.
// Prevents negative stock in source warehouse.
// ============================================

import { stockTransferSchema } from '@hisabche/validation'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

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

export function registerTransferRoutes(router: Router): void {
  // ─── POST /stock-transfers ──────────────────────────────────
  router.post('/stock-transfers', (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    const { workspaceId } = ctx
    const raw = (body || {}) as Record<string, unknown>

    const normalized = {
      productId: raw.productId || raw.product_id,
      fromWarehouseId:
        raw.fromWarehouseId ||
        raw.sourceWarehouseId ||
        raw.from_warehouse_id ||
        raw.source_warehouse_id,
      toWarehouseId:
        raw.toWarehouseId ||
        raw.destinationWarehouseId ||
        raw.to_warehouse_id ||
        raw.destination_warehouse_id,
      quantity: Number(raw.quantity),
      notes: raw.notes ? String(raw.notes) : undefined,
    }

    const parsed = stockTransferSchema.safeParse(normalized)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
      )
    }
    const data = parsed.data
    const { fromWarehouseId, toWarehouseId, productId, quantity } = data
    const notes = data.notes?.trim() || ''

    if (fromWarehouseId === toWarehouseId) {
      throw new ValidationError('Source and destination warehouse cannot be the same')
    }

    const now = new Date().toISOString()
    const transferId = generateUuid()

    return db.transaction(() => {
      // 1. Verify warehouses exist
      const sourceWh = db.get<{ name: string }>(
        'SELECT name FROM warehouse WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
        [fromWarehouseId, workspaceId],
      )
      if (!sourceWh) throw new NotFoundError('Source warehouse', fromWarehouseId)

      const destWh = db.get<{ name: string }>(
        'SELECT name FROM warehouse WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
        [toWarehouseId, workspaceId],
      )
      if (!destWh) throw new NotFoundError('Destination warehouse', toWarehouseId)

      // 2. Check stock in source warehouse
      const stockRow = db.get<{ qty: number }>(
        'SELECT qty FROM product_stock WHERE workspace_id = ? AND product_id = ? AND warehouse_id = ? AND deleted_at IS NULL',
        [workspaceId, productId, fromWarehouseId],
      )
      const available = Number(stockRow?.qty) || 0
      if (available < quantity) {
        throw new ConflictError(
          'INSUFFICIENT_STOCK',
          `Cannot transfer ${quantity} units: source warehouse only holds ${available}`,
        )
      }

      // 3. Decrement source warehouse
      db.run(
        'UPDATE product_stock SET qty = qty - ?, updated_at = ? WHERE workspace_id = ? AND product_id = ? AND warehouse_id = ?',
        [quantity, now, workspaceId, productId, fromWarehouseId],
      )

      // 4. Increment destination warehouse
      db.run(
        `INSERT INTO product_stock (id, workspace_id, product_id, warehouse_id, qty, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(workspace_id, product_id, warehouse_id) DO UPDATE SET qty = qty + excluded.qty, updated_at = excluded.updated_at`,
        [generateUuid(), workspaceId, productId, toWarehouseId, quantity, now, now],
      )

      // 5. Record movement
      db.run(
        `INSERT INTO inventory_movement (
          id, workspace_id, product_id, type, quantity, reference, date,
          created_at, updated_at, origin, sync_state
        ) VALUES (?, ?, ?, 'transfer', ?, ?, ?, ?, ?, 'local', 'local_only')`,
        [
          transferId,
          workspaceId,
          productId,
          quantity,
          `Transfer from ${sourceWh.name} to ${destWh.name}${notes ? ` - ${notes}` : ''}`,
          now.slice(0, 10),
          now,
          now,
        ],
      )

      return {
        success: true,
        transferId,
        productId,
        fromWarehouseId,
        toWarehouseId,
        quantity,
      }
    })
  })
}
