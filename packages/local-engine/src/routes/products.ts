// ============================================
// packages/local-engine/src/routes/products.ts
//
// Products catalog, stock management, and opening stock.
// Money fields are stored as integer minor units.
// Quantities are maintained per warehouse in product_stock.
// Cost layers are created on opening stock ONLY when buyPrice > 0.
// ============================================

import {
  createProductSchema,
  normalizeBarcode,
  summarizeStock,
  updateProductSchema,
} from '@hisabche/validation'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

export interface ProductRow {
  id: string
  workspace_id: string
  name: string
  barcode: string | null
  sku: string | null
  category: string | null
  quantity: number
  unit: string | null
  min_stock_level: number
  buy_price: number
  sell_price: number
  wholesale_price: number | null
  is_active: number
  image_url: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export function mapProduct(raw: ProductRow) {
  return {
    id: raw.id,
    name: raw.name,
    barcode: raw.barcode,
    sku: raw.sku,
    category: raw.category,
    imageUrl: raw.image_url,
    image_url: raw.image_url,
    quantity: Number(raw.quantity),
    unit: raw.unit,
    minStockLevel: Number(raw.min_stock_level),
    min_stock_level: Number(raw.min_stock_level),
    buyPrice: raw.buy_price,
    buy_price: raw.buy_price,
    sellPrice: raw.sell_price,
    sell_price: raw.sell_price,
    wholesalePrice: raw.wholesale_price,
    wholesale_price: raw.wholesale_price,
    isActive: Boolean(raw.is_active),
    is_active: Boolean(raw.is_active),
    createdAt: raw.created_at,
    created_at: raw.created_at,
    updatedAt: raw.updated_at,
    updated_at: raw.updated_at,
  }
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

export function registerProductRoutes(router: Router): void {
  // ─── GET /products/categories ───────────────────────────────
  // ⚠️ Registered BEFORE /products/:id: the router takes the first match, so a
  // later literal would be read as an id. The server declares it first too.
  router.get('/products/categories', (c: RouteHandlerContext) => {
    const rows = c.db.all<{ category: string }>(
      `SELECT DISTINCT trim(category) AS category FROM product
       WHERE workspace_id = ? AND deleted_at IS NULL AND category IS NOT NULL AND trim(category) <> ''
       ORDER BY category`,
      [c.ctx.workspaceId],
    )
    return { categories: rows.map((row) => row.category) }
  })

  // ─── GET /products ──────────────────────────────────────────
  router.get('/products', (c: RouteHandlerContext) => {
    const { db, ctx, query } = c
    const { workspaceId } = ctx

    const search = query.search?.trim()
    const category = query.category?.trim()
    const isActive =
      query.isActive !== undefined ? query.isActive === 'true' || query.isActive === '1' : undefined
    const barcode = query.barcode?.trim()
    const warehouseId = query.warehouseId?.trim()
    const minPrice = query.minPrice ? Number(query.minPrice) : undefined
    const maxPrice = query.maxPrice ? Number(query.maxPrice) : undefined
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100)
    const page = Math.max(Number(query.page) || 1, 1)
    const offset = (page - 1) * limit

    const clauses: string[] = ['workspace_id = ?', 'deleted_at IS NULL']
    const params: unknown[] = [workspaceId]

    if (search) {
      const code = normalizeBarcode(search)
      clauses.push('(name LIKE ? OR barcode = ?)')
      params.push(`%${search}%`, code)
    }
    if (category) {
      clauses.push('category = ?')
      params.push(category)
    }
    if (isActive !== undefined) {
      clauses.push('is_active = ?')
      params.push(isActive ? 1 : 0)
    }
    if (barcode) {
      clauses.push('barcode = ?')
      params.push(normalizeBarcode(barcode))
    }
    if (minPrice !== undefined) {
      clauses.push('sell_price >= ?')
      params.push(minPrice)
    }
    if (maxPrice !== undefined) {
      clauses.push('sell_price <= ?')
      params.push(maxPrice)
    }

    if (warehouseId) {
      clauses.push(
        'id IN (SELECT product_id FROM product_stock WHERE workspace_id = ? AND warehouse_id = ? AND qty > 0)',
      )
      params.push(workspaceId, warehouseId)
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''

    const countRow = db.get<{ count: number }>(
      `SELECT count(*) as count FROM product ${where}`,
      params,
    )
    const total = countRow?.count ?? 0

    const rows = db.all<ProductRow>(
      `SELECT * FROM product ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    )

    let products = rows.map(mapProduct)

    if (query.lowStock !== undefined) {
      const lowStock = query.lowStock === 'true' || query.lowStock === '1'
      products = lowStock
        ? products.filter((p) => p.quantity <= p.minStockLevel)
        : products.filter((p) => p.quantity > p.minStockLevel)
    }

    return {
      products,
      total,
      hasMore: offset + limit < total,
      nextCursor: null,
      limit,
    }
  })

  // ─── GET /products/:id ──────────────────────────────────────
  // ─── GET /products/summary ─────────────────────────────────
  // The warehouse cards offline. Over EVERY active product, with the server's
  // own rule (summarizeStock) — without it each card read «نامعلوم» offline.
  // Registered before `/products/:id`, which would otherwise take «summary».
  router.get('/products/summary', (c: RouteHandlerContext) => {
    const rows = c.db.all<{ quantity: number; buy_price: number; min_stock_level: number }>(
      'SELECT quantity, buy_price, min_stock_level FROM product WHERE workspace_id = ? AND deleted_at IS NULL AND is_active = 1',
      [c.ctx.workspaceId],
    )
    return summarizeStock(rows)
  })

  router.get('/products/:id', (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const { id } = params
    const row = db.get<ProductRow>(
      'SELECT * FROM product WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [id, ctx.workspaceId],
    )
    if (!row) throw new NotFoundError('Product', id)
    return mapProduct(row)
  })

  // ─── POST /products ─────────────────────────────────────────
  router.post('/products', (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    const { workspaceId } = ctx
    const raw = (body || {}) as Record<string, unknown>
    const parsed = createProductSchema.safeParse(raw)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
      )
    }
    const data = parsed.data

    const now = new Date().toISOString()
    const id = (raw.id as string) || generateUuid()
    const name = data.name.trim()
    const barcode = data.barcode ? normalizeBarcode(String(data.barcode)) : null
    const sku = data.sku?.trim() || null
    const category = data.category?.trim() || 'general'
    const unit = data.unit?.trim() || 'piece'
    const minStockLevel = Number(data.minStockLevel) || 5
    const buyPrice = Number(data.buyPrice) || 0
    const sellPrice = Number(data.sellPrice) || 0
    const wholesalePrice =
      data.wholesalePrice !== undefined && data.wholesalePrice !== null
        ? Number(data.wholesalePrice)
        : null
    const isActive = data.isActive !== false ? 1 : 0
    const imageUrl = data.imageUrl || null
    const quantity = Number(data.quantity) || 0
    const warehouseId = data.warehouseId?.trim() || null

    return db.transaction(() => {
      // 1. Check barcode uniqueness in workspace
      if (barcode) {
        const existing = db.get<{ id: string }>(
          'SELECT id FROM product WHERE workspace_id = ? AND barcode = ? AND deleted_at IS NULL',
          [workspaceId, barcode],
        )
        if (existing) throw new ConflictError('BARCODE_TAKEN')
      }

      // 2. Insert product row
      db.run(
        `INSERT INTO product (
          id, workspace_id, name, barcode, sku, category, quantity, unit,
          min_stock_level, buy_price, sell_price, wholesale_price, is_active,
          image_url, created_at, updated_at, origin, sync_state
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
        [
          id,
          workspaceId,
          name,
          barcode,
          sku,
          category,
          quantity,
          unit,
          minStockLevel,
          buyPrice,
          sellPrice,
          wholesalePrice,
          isActive,
          imageUrl,
          now,
          now,
        ],
      )

      // 3. Handle opening stock
      if (quantity > 0) {
        // Resolve target warehouse
        let targetWh = warehouseId
        if (!targetWh) {
          const defaultWh = db.get<{ id: string }>(
            'SELECT id FROM warehouse WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1',
            [workspaceId],
          )
          targetWh = defaultWh?.id ?? null
        }

        if (targetWh) {
          // Record stock movement
          const movId = generateUuid()
          db.run(
            `INSERT INTO inventory_movement (
              id, workspace_id, product_id, type, quantity, reference, date,
              created_at, updated_at, origin, sync_state
            ) VALUES (?, ?, ?, 'purchase', ?, 'product_opening', ?, ?, ?, 'local', 'local_only')`,
            [movId, workspaceId, id, quantity, now.slice(0, 10), now, now],
          )

          // Update product_stock
          const stockId = generateUuid()
          db.run(
            `INSERT INTO product_stock (id, workspace_id, product_id, warehouse_id, qty, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(workspace_id, product_id, warehouse_id) DO UPDATE SET qty = qty + excluded.qty, updated_at = excluded.updated_at`,
            [stockId, workspaceId, id, targetWh, quantity, now, now],
          )
        }

        // 4. Cost layer: ONLY WHEN buyPrice > 0 (Unknown is not zero)
        if (buyPrice > 0) {
          const layerId = generateUuid()
          db.run(
            `INSERT INTO cost_layer (
              id, workspace_id, product_id, warehouse_id, source_type, source_id,
              received_qty, remaining_qty, unit_cost, currency, entry_date,
              created_at, updated_at, origin, sync_state
            ) VALUES (?, ?, ?, ?, 'product_opening', ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
            [
              layerId,
              workspaceId,
              id,
              targetWh,
              id,
              quantity,
              quantity,
              buyPrice,
              ctx.baseCurrency,
              now.slice(0, 10),
              now,
              now,
            ],
          )
        }
      }

      const inserted = db.get<ProductRow>(
        'SELECT * FROM product WHERE id = ? AND workspace_id = ?',
        [id, workspaceId],
      )
      if (!inserted) throw new NotFoundError('Product', id)
      return mapProduct(inserted)
    })
  })

  // ─── PATCH /products/:id ────────────────────────────────────
  router.patch('/products/:id', (c: RouteHandlerContext) => {
    const { db, ctx, params, body } = c
    const { id } = params
    const { workspaceId } = ctx
    const raw = (body || {}) as Record<string, unknown>
    const parsed = updateProductSchema.safeParse({ id, ...raw })
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
      )
    }
    const data = parsed.data

    const existing = db.get<ProductRow>(
      'SELECT * FROM product WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [id, workspaceId],
    )
    if (!existing) throw new NotFoundError('Product', id)

    const now = new Date().toISOString()
    const barcode =
      data.barcode !== undefined
        ? data.barcode
          ? normalizeBarcode(String(data.barcode))
          : null
        : existing.barcode

    if (barcode && barcode !== existing.barcode) {
      const duplicate = db.get<{ id: string }>(
        'SELECT id FROM product WHERE workspace_id = ? AND barcode = ? AND id <> ? AND deleted_at IS NULL',
        [workspaceId, barcode, id],
      )
      if (duplicate) throw new ConflictError('BARCODE_TAKEN')
    }

    const name = data.name !== undefined ? String(data.name).trim() : existing.name
    const sku = data.sku !== undefined ? (data.sku ? String(data.sku).trim() : null) : existing.sku
    const category = data.category !== undefined ? String(data.category).trim() : existing.category
    const unit = data.unit !== undefined ? String(data.unit).trim() : existing.unit
    const minStockLevel =
      data.minStockLevel !== undefined ? Number(data.minStockLevel) : existing.min_stock_level
    const buyPrice = data.buyPrice !== undefined ? Number(data.buyPrice) : existing.buy_price
    const sellPrice = data.sellPrice !== undefined ? Number(data.sellPrice) : existing.sell_price
    const wholesalePrice =
      data.wholesalePrice !== undefined
        ? data.wholesalePrice !== null
          ? Number(data.wholesalePrice)
          : null
        : existing.wholesale_price
    const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : existing.is_active
    const imageUrl =
      data.imageUrl !== undefined
        ? data.imageUrl
          ? String(data.imageUrl)
          : null
        : existing.image_url

    db.run(
      `UPDATE product SET
        name = ?, barcode = ?, sku = ?, category = ?, unit = ?, min_stock_level = ?,
        buy_price = ?, sell_price = ?, wholesale_price = ?, is_active = ?, image_url = ?,
        updated_at = ?
       WHERE id = ? AND workspace_id = ?`,
      [
        name,
        barcode,
        sku,
        category,
        unit,
        minStockLevel,
        buyPrice,
        sellPrice,
        wholesalePrice,
        isActive,
        imageUrl,
        now,
        id,
        workspaceId,
      ],
    )

    const updated = db.get<ProductRow>('SELECT * FROM product WHERE id = ? AND workspace_id = ?', [
      id,
      workspaceId,
    ])
    return mapProduct(updated!)
  })

  // ─── DELETE /products/:id ───────────────────────────────────
  router.delete('/products/:id', (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const { id } = params
    const { workspaceId } = ctx

    const existing = db.get<ProductRow>(
      'SELECT * FROM product WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [id, workspaceId],
    )
    if (!existing) throw new NotFoundError('Product', id)

    const now = new Date().toISOString()
    // Soft-archive
    db.run('UPDATE product SET is_active = 0, updated_at = ? WHERE id = ? AND workspace_id = ?', [
      now,
      id,
      workspaceId,
    ])
    return { success: true }
  })

  // ─── GET /products/:id/warehouse-breakdown ──────────────────
  router.get('/products/:id/warehouse-breakdown', (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const { id } = params
    const { workspaceId } = ctx

    const product = db.get<ProductRow>(
      'SELECT * FROM product WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [id, workspaceId],
    )
    if (!product) throw new NotFoundError('Product', id)

    const rows = db.all<{
      warehouse_id: string
      warehouse_name: string
      qty: number
    }>(
      `SELECT ps.warehouse_id, w.name as warehouse_name, ps.qty
       FROM product_stock ps
       JOIN warehouse w ON w.id = ps.warehouse_id
       WHERE ps.workspace_id = ? AND ps.product_id = ? AND ps.deleted_at IS NULL AND w.deleted_at IS NULL`,
      [workspaceId, id],
    )

    return rows.map((r) => ({
      warehouseId: r.warehouse_id,
      warehouseName: r.warehouse_name,
      quantity: Number(r.qty),
    }))
  })

  // ─── GET /products/:id/storage-locations ────────────────────
  router.get('/products/:id/storage-locations', (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const { id } = params
    const { workspaceId } = ctx

    const product = db.get<ProductRow>(
      'SELECT * FROM product WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [id, workspaceId],
    )
    if (!product) throw new NotFoundError('Product', id)

    const rows = db.all<{
      id: string
      warehouse_id: string
      code: string
      name: string | null
      kind: string
    }>(
      `SELECT id, warehouse_id, code, name, kind
       FROM shelf
       WHERE workspace_id = ? AND deleted_at IS NULL`,
      [workspaceId],
    )

    return rows.map((r) => ({
      locationId: r.id,
      warehouseId: r.warehouse_id,
      code: r.code,
      name: r.name,
      kind: r.kind,
    }))
  })
}
