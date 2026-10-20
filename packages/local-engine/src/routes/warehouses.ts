// ============================================
// packages/local-engine/src/routes/warehouses.ts
//
// Warehouse management, stock placement, and warehouse overviews.
// ============================================

import { createwarehouseSchema, updatewarehouseSchema } from '@hisabche/validation'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

export interface WarehouseRow {
  id: string
  workspace_id: string
  name: string
  location: string
  branch_id: string | null
  is_active: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

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

export function mapWarehouse(row: WarehouseRow) {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    branchId: row.branch_id,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function registerWarehouseRoutes(router: Router): void {
  // ─── GET /warehouses ────────────────────────────────────────
  router.get('/warehouses', (c: RouteHandlerContext) => {
    const { db, ctx } = c
    const rows = db.all<WarehouseRow>(
      'SELECT * FROM warehouse WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY created_at ASC',
      [ctx.workspaceId],
    )
    return rows.map(mapWarehouse)
  })

  // ─── POST /warehouses ───────────────────────────────────────
  router.post('/warehouses', (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    const { workspaceId } = ctx
    const raw = (body || {}) as Record<string, unknown>
    const parsed = createwarehouseSchema.safeParse(raw)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
      )
    }
    const data = parsed.data

    const now = new Date().toISOString()
    const id = (raw.id as string) || generateUuid()
    const name = data.name.trim()
    const location = data.location?.trim() || ''
    const branchId = data.branchId || null

    db.run(
      `INSERT INTO warehouse (id, workspace_id, name, location, branch_id, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, workspaceId, name, location, branchId, now, now],
    )

    const row = db.get<WarehouseRow>('SELECT * FROM warehouse WHERE id = ?', [id])
    return mapWarehouse(row!)
  })

  // ─── PATCH /warehouses/:id ──────────────────────────────────
  router.patch('/warehouses/:id', (c: RouteHandlerContext) => {
    const { db, ctx, params, body } = c
    const { id } = params
    const { workspaceId } = ctx
    const raw = (body || {}) as Record<string, unknown>
    const parsed = updatewarehouseSchema.safeParse({ id, ...raw })
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
      )
    }
    const data = parsed.data

    const existing = db.get<WarehouseRow>(
      'SELECT * FROM warehouse WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [id, workspaceId],
    )
    if (!existing) throw new NotFoundError('Warehouse', id)

    const now = new Date().toISOString()
    const name = data.name !== undefined ? String(data.name).trim() : existing.name
    const location =
      data.location !== undefined
        ? data.location
          ? String(data.location).trim()
          : ''
        : existing.location
    const branchId = data.branchId !== undefined ? (data.branchId as string) : existing.branch_id
    const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : existing.is_active

    db.run(
      'UPDATE warehouse SET name = ?, location = ?, branch_id = ?, is_active = ?, updated_at = ? WHERE id = ?',
      [name, location, branchId, isActive, now, id],
    )

    const updated = db.get<WarehouseRow>('SELECT * FROM warehouse WHERE id = ?', [id])
    return mapWarehouse(updated!)
  })

  // ─── DELETE /warehouses/:id ─────────────────────────────────
  router.delete('/warehouses/:id', (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const { id } = params
    const { workspaceId } = ctx

    const existing = db.get<WarehouseRow>(
      'SELECT * FROM warehouse WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [id, workspaceId],
    )
    if (!existing) throw new NotFoundError('Warehouse', id)

    // Cannot delete if warehouse still holds stock
    const holding = db.get<{ sum: number }>(
      'SELECT sum(qty) as sum FROM product_stock WHERE warehouse_id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [id, workspaceId],
    )
    if ((holding?.sum ?? 0) > 0) {
      throw new ConflictError(
        'WAREHOUSE_HOLDS_STOCK',
        'Cannot delete warehouse that still holds stock',
      )
    }

    const now = new Date().toISOString()
    db.run('UPDATE warehouse SET deleted_at = ?, is_active = 0, updated_at = ? WHERE id = ?', [
      now,
      now,
      id,
    ])
    return { success: true }
  })

  // ─── GET /warehouses/placement ──────────────────────────────
  router.get('/warehouses/placement', (c: RouteHandlerContext) => {
    const { db, ctx } = c
    const { workspaceId } = ctx

    const warehouses = db.all<WarehouseRow>(
      'SELECT * FROM warehouse WHERE workspace_id = ? AND deleted_at IS NULL AND is_active = 1',
      [workspaceId],
    )

    const stock = db.all<{
      warehouse_id: string
      product_id: string
      product_name: string
      qty: number
    }>(
      `SELECT ps.warehouse_id, ps.product_id, p.name as product_name, ps.qty
       FROM product_stock ps
       JOIN product p ON p.id = ps.product_id
       WHERE ps.workspace_id = ? AND ps.deleted_at IS NULL AND ps.qty > 0 AND p.deleted_at IS NULL`,
      [workspaceId],
    )

    return warehouses.map((w) => {
      const items = stock.filter((s) => s.warehouse_id === w.id)
      return {
        warehouseId: w.id,
        warehouseName: w.name,
        location: w.location,
        totalItems: items.length,
        totalQuantity: items.reduce((sum, i) => sum + Number(i.qty), 0),
        products: items.map((i) => ({
          productId: i.product_id,
          productName: i.product_name,
          quantity: Number(i.qty),
        })),
      }
    })
  })

  // ─── GET /warehouses/overview ───────────────────────────────
  router.get('/warehouses/overview', (c: RouteHandlerContext) => {
    const { db, ctx } = c
    const { workspaceId } = ctx

    const warehouses = db.all<WarehouseRow>(
      'SELECT * FROM warehouse WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY created_at ASC',
      [workspaceId],
    )

    const stockRows = db.all<{
      warehouse_id: string
      product_id: string
      qty: number
      buy_price: number
    }>(
      `SELECT ps.warehouse_id, ps.product_id, ps.qty, p.buy_price
       FROM product_stock ps
       JOIN product p ON p.id = ps.product_id
       WHERE ps.workspace_id = ? AND ps.deleted_at IS NULL AND ps.qty > 0 AND p.deleted_at IS NULL`,
      [workspaceId],
    )

    const result = warehouses.map((w) => {
      const items = stockRows.filter((s) => s.warehouse_id === w.id)
      const totalUnits = items.reduce((sum, i) => sum + Number(i.qty), 0)
      const stockValue = items.reduce((sum, i) => sum + Number(i.qty) * (i.buy_price || 0), 0)

      return {
        warehouseId: w.id,
        warehouseName: w.name,
        location: w.location,
        branchId: w.branch_id,
        distinctProducts: items.length,
        totalUnits,
        stockValue,
      }
    })

    return { warehouses: result }
  })

  // ─── GET /warehouses/:id/detail ─────────────────────────────
  router.get('/warehouses/:id/detail', (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const { id } = params
    const { workspaceId } = ctx

    const warehouse = db.get<WarehouseRow>(
      'SELECT * FROM warehouse WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [id, workspaceId],
    )
    if (!warehouse) throw new NotFoundError('Warehouse', id)

    const stockRows = db.all<{
      product_id: string
      product_name: string
      sku: string | null
      barcode: string | null
      unit: string | null
      qty: number
      buy_price: number
      sell_price: number
    }>(
      `SELECT ps.product_id, p.name as product_name, p.sku, p.barcode, p.unit, ps.qty, p.buy_price, p.sell_price
       FROM product_stock ps
       JOIN product p ON p.id = ps.product_id
       WHERE ps.workspace_id = ? AND ps.warehouse_id = ? AND ps.deleted_at IS NULL AND p.deleted_at IS NULL`,
      [workspaceId, id],
    )

    return {
      warehouse: mapWarehouse(warehouse),
      products: stockRows.map((r) => ({
        productId: r.product_id,
        productName: r.product_name,
        sku: r.sku,
        barcode: r.barcode,
        unit: r.unit,
        quantity: Number(r.qty),
        buyPrice: r.buy_price,
        sellPrice: r.sell_price,
        stockValue: Number(r.qty) * (r.buy_price || 0),
      })),
    }
  })
}
