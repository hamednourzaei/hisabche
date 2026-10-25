// ============================================
// packages/local-engine/src/routes/warehouses.ts
//
// Warehouse management, stock placement, and warehouse overviews.
// ============================================

import {
  createwarehouseSchema,
  updatewarehouseSchema,
  warehouseOverview,
  warehouseProducts,
  type ProductStockRow,
} from '@hisabche/validation'
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

  // The device's warehouses, products and per-warehouse stock in the shapes
  // the server's shared rule reads (packages/validation warehouse-overview).
  function readStock(c: RouteHandlerContext) {
    const { db, ctx } = c
    const warehouses = db
      .all<WarehouseRow>(
        'SELECT * FROM warehouse WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY created_at ASC',
        [ctx.workspaceId],
      )
      .map((w) => ({ ...w, is_active: Boolean(w.is_active) }))
    const products = db.all<ProductStockRow>(
      `SELECT id, name, sku, unit, quantity, sell_price, buy_price, min_stock_level, category, image_url
       FROM product WHERE workspace_id = ? AND deleted_at IS NULL AND is_active = 1`,
      [ctx.workspaceId],
    )
    const live = new Set(warehouses.map((w) => w.id))
    // Stock left in a deleted warehouse counts as unassigned, as on the server.
    const stock = db
      .all<{ warehouse_id: string; product_id: string; quantity: number }>(
        `SELECT warehouse_id, product_id, qty AS quantity FROM product_stock
         WHERE workspace_id = ? AND deleted_at IS NULL`,
        [ctx.workspaceId],
      )
      .filter((row) => live.has(row.warehouse_id))
    return { warehouses, products, stock }
  }

  // ─── GET /warehouses/placement ──────────────────────────────
  // Same shape as the server (warehouse-access.ts). One person owns the device,
  // so nothing is restricted by branch.
  router.get('/warehouses/placement', (c: RouteHandlerContext) => {
    const { warehouses, stock } = readStock(c)
    const branchName = new Map(
      c.db
        .all<{ id: string; name: string }>('SELECT id, name FROM branch WHERE workspace_id = ?', [
          c.ctx.workspaceId,
        ])
        .map((row) => [row.id, row.name] as const),
    )
    const active = warehouses.filter((w) => w.is_active)
    const allowed = new Set(active.map((w) => w.id))
    return {
      branchesConfigured: true,
      restricted: false,
      warehouses: active.map((w) => ({
        id: w.id,
        name: w.name,
        branchId: w.branch_id,
        branchName: w.branch_id ? (branchName.get(w.branch_id) ?? null) : null,
      })),
      stock: stock
        .filter((row) => allowed.has(row.warehouse_id))
        .map((row) => ({
          productId: row.product_id,
          warehouseId: row.warehouse_id,
          quantity: Number(row.quantity) || 0,
        })),
    }
  })

  // ─── GET /warehouses/overview ───────────────────────────────
  router.get('/warehouses/overview', (c: RouteHandlerContext) => {
    const { warehouses, products, stock } = readStock(c)
    return warehouseOverview(warehouses, products, stock)
  })

  // ─── GET /warehouses/:id/detail ('unassigned' = stock in no warehouse) ──
  router.get('/warehouses/:id/detail', (c: RouteHandlerContext) => {
    const { id } = c.params
    const { warehouses, products, stock } = readStock(c)
    const unassigned = id === 'unassigned'
    const warehouse = unassigned ? null : warehouses.find((w) => w.id === id)
    if (!unassigned && !warehouse) throw new NotFoundError('Warehouse', id)
    return {
      warehouse: warehouse
        ? { id: warehouse.id, name: warehouse.name, location: warehouse.location ?? '' }
        : null,
      ...warehouseProducts(warehouse ? warehouse.id : null, products, stock),
    }
  })
}
