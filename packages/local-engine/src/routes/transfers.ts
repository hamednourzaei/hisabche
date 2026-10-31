// ============================================
// packages/local-engine/src/routes/transfers.ts
//
// Inventory stock transfers between warehouses (BUG-102 rule).
// Atomic decrement from source and increment at destination.
// Prevents negative stock in source warehouse.
// ============================================

import { stockTransferSchema } from '@hisabche/validation'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import { buildEnqueue } from '@hisabche/app-bridge'
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
    const transferId =
      (raw.id as string) ||
      (raw.transferId as string) ||
      (c.headers?.['idempotency-key'] as string) ||
      generateUuid()

    const existingMovement = db.get<{ product_id: string; quantity: number }>(
      'SELECT product_id, quantity FROM inventory_movement WHERE id = ? AND workspace_id = ?',
      [transferId, workspaceId],
    )
    if (existingMovement) {
      if (
        existingMovement.product_id !== productId ||
        Math.abs(existingMovement.quantity - quantity) > 0.0001
      ) {
        throw new ConflictError(
          'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
          'An existing transfer with this ID has different parameters',
        )
      }
      return {
        success: true,
        transferId,
        productId,
        fromWarehouseId,
        toWarehouseId,
        quantity,
        replayed: true,
      }
    }

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

      // 6. Transfer cost layers (Target D fix)
      // When stock moves shelf, its cost layers travel with it so destination sales can consume them.
      let need = quantity
      const layers = db.all<{ id: string; unit_cost: number; remaining_qty: number }>(
        `SELECT id, unit_cost, remaining_qty FROM cost_layer
          WHERE workspace_id = ? AND product_id = ? AND warehouse_id = ? AND remaining_qty > 0 AND deleted_at IS NULL
          ORDER BY entry_date ASC, created_at ASC`,
        [workspaceId, productId, fromWarehouseId],
      )

      for (const layer of layers) {
        const take = Math.min(layer.remaining_qty, need)
        db.run(
          'UPDATE cost_layer SET remaining_qty = remaining_qty - ?, updated_at = ? WHERE id = ?',
          [take, now, layer.id],
        )

        db.run(
          `INSERT INTO cost_layer (
            id, workspace_id, product_id, warehouse_id, source_type, source_id, source_line,
            received_qty, remaining_qty, unit_cost, currency, entry_date, created_at, updated_at, origin, sync_state
          ) VALUES (?, ?, ?, ?, 'transfer', ?, 1, ?, ?, ?, 'AFN', ?, ?, ?, 'local', 'local_only')`,
          [
            generateUuid(),
            workspaceId,
            productId,
            toWarehouseId,
            transferId,
            take,
            take,
            layer.unit_cost,
            now.slice(0, 10),
            now,
            now,
          ],
        )

        need -= take
        if (need <= 0) break
      }

      if (need > 0) {
        throw new ConflictError(
          'INSUFFICIENT_COST_LAYERS',
          `Cannot transfer ${quantity} units: cost layers in source warehouse only cover ${quantity - need} units`,
        )
      }

      if (c.headers?.['x-hisabche-queue'] === '1') {
        const enqueue = buildEnqueue({
          entity: 'inventory_movement',
          operation: 'create',
          clientId: transferId,
          payload: {
            id: transferId,
            productId,
            fromWarehouseId,
            toWarehouseId,
            quantity,
            notes: normalized.notes,
          },
          userId: c.headers?.['x-hisabche-user-id'] ?? ctx.userId,
          workspaceId,
        })
        db.run(enqueue.sql, enqueue.params)
      }

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
