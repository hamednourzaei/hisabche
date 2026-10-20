// ============================================
// packages/local-engine/src/routes/shelves.ts
//
// Warehouse storage locations (shelves, racks, bins).
// Shelves have code + description/name + capacity only.
// No position_x/y/width/height (warehouse map was removed).
// ============================================

import { createStorageLocationSchema } from '@hisabche/validation'
import { NotFoundError, ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

export interface ShelfRow {
  id: string
  workspace_id: string
  warehouse_id: string
  code: string
  name: string | null
  kind: string
  parent_id: string | null
  capacity: string | null
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

export function mapShelf(row: ShelfRow) {
  return {
    id: row.id,
    warehouseId: row.warehouse_id,
    warehouse_id: row.warehouse_id,
    code: row.code,
    name: row.name,
    kind: row.kind,
    parentId: row.parent_id,
    parent_id: row.parent_id,
    capacity: row.capacity,
    isActive: Boolean(row.is_active),
    is_active: Boolean(row.is_active),
    createdAt: row.created_at,
    created_at: row.created_at,
    updatedAt: row.updated_at,
    updated_at: row.updated_at,
  }
}

export function registerShelfRoutes(router: Router): void {
  // ─── GET /warehouses/:id/map ────────────────────────────────
  router.get('/warehouses/:id/map', (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const { id } = params
    const { workspaceId } = ctx

    const warehouse = db.get<{ id: string; name: string }>(
      'SELECT id, name FROM warehouse WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [id, workspaceId],
    )
    if (!warehouse) throw new NotFoundError('Warehouse', id)

    const shelves = db.all<ShelfRow>(
      'SELECT * FROM shelf WHERE warehouse_id = ? AND workspace_id = ? AND deleted_at IS NULL ORDER BY code ASC',
      [id, workspaceId],
    )

    return {
      warehouseId: id,
      warehouseName: warehouse.name,
      locations: shelves.map(mapShelf),
    }
  })

  // ─── POST /warehouses/:id/locations ─────────────────────────
  router.post('/warehouses/:id/locations', (c: RouteHandlerContext) => {
    const { db, ctx, params, body } = c
    const { id: warehouseId } = params
    const { workspaceId } = ctx

    const parsed = createStorageLocationSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
      throw new ValidationError(msg)
    }
    const data = parsed.data

    const now = new Date().toISOString()
    const id = generateUuid()
    const name = data.name?.trim() || null
    const kind = data.kind || 'bin'
    const parentId = data.parentId || null
    const capacity =
      data.capacity !== undefined && data.capacity !== null ? String(data.capacity) : null

    db.run(
      `INSERT INTO shelf (
        id, workspace_id, warehouse_id, code, name, kind, parent_id,
        capacity, is_active, created_at, updated_at, origin, sync_state
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'local', 'local_only')`,
      [id, workspaceId, warehouseId, data.code, name, kind, parentId, capacity, now, now],
    )

    const created = db.get<ShelfRow>('SELECT * FROM shelf WHERE id = ?', [id])
    return mapShelf(created!)
  })

  // ─── PATCH /storage-locations/:id ───────────────────────────
  router.patch('/storage-locations/:id', (c: RouteHandlerContext) => {
    const { db, ctx, params, body } = c
    const { id } = params
    const { workspaceId } = ctx
    const data = (body || {}) as Record<string, unknown>

    const existing = db.get<ShelfRow>(
      'SELECT * FROM shelf WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [id, workspaceId],
    )
    if (!existing) throw new NotFoundError('Storage location', id)

    const now = new Date().toISOString()
    const code = data.code !== undefined ? String(data.code).trim() : existing.code
    const name =
      data.name !== undefined ? (data.name ? String(data.name).trim() : null) : existing.name
    const kind = data.kind !== undefined ? String(data.kind).trim() : existing.kind
    const capacity =
      data.capacity !== undefined
        ? data.capacity
          ? String(data.capacity)
          : null
        : existing.capacity
    const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : existing.is_active

    db.run(
      `UPDATE shelf SET
        code = ?, name = ?, kind = ?, capacity = ?, is_active = ?, updated_at = ?
       WHERE id = ? AND workspace_id = ?`,
      [code, name, kind, capacity, isActive, now, id, workspaceId],
    )

    const updated = db.get<ShelfRow>('SELECT * FROM shelf WHERE id = ?', [id])
    return mapShelf(updated!)
  })

  // ─── POST /storage-locations/:id/place ──────────────────────
  router.post('/storage-locations/:id/place', (c: RouteHandlerContext) => {
    const { db, ctx, params, body } = c
    const { id } = params
    const { workspaceId } = ctx
    const data = (body || {}) as Record<string, unknown>

    const shelf = db.get<ShelfRow>(
      'SELECT * FROM shelf WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [id, workspaceId],
    )
    if (!shelf) throw new NotFoundError('Storage location', id)

    return {
      success: true,
      locationId: id,
      productId: data.productId,
      placedAt: new Date().toISOString(),
    }
  })
}
