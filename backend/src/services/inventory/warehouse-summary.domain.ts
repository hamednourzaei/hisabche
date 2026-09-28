// ============================================
// backend/src/services/inventory/warehouse-summary.domain.ts
//
// Multi-warehouse (request #90): the warehouse list and one warehouse's stock,
// with the same stat cards the stock page shows for the whole business.
//
// ⚠️ «UNASSIGNED» IS SHOWN, NOT HIDDEN.
//
// `products.quantity` counts every movement; `warehouse_stock` counts only the
// movements that named a warehouse (stock_movements_project). Opening stock,
// product-page edits and sales recorded while a workspace had several
// warehouses carry no warehouse, so Σ warehouse_stock is usually LESS than the
// product total. The difference is real stock that is simply not in any
// warehouse yet. Dropping it would make «ارزش کل» of the warehouses disagree
// with the stock page; assigning it to a warehouse by guess would be §12.
// ============================================

import { summarizeStock, type StockSummary } from './stock-summary.domain'

export interface WarehouseRow {
  id: string
  name: string
  location: string | null
  is_active: boolean | null
}

export interface ProductStockRow {
  id: string
  name: string
  sku: string | null
  unit: string | null
  quantity: number | string | null
  sell_price: number | string | null
  buy_price: number | string | null
  min_stock_level: number | string | null
  /** The product's cover (its first gallery image); '' or null = none. */
  image_url?: string | null | undefined
}

export interface WarehouseStockRow {
  warehouse_id: string
  product_id: string
  quantity: number | string | null
}

export interface WarehouseOverviewItem {
  id: string
  name: string
  location: string
  isActive: boolean
  summary: StockSummary
}

export interface WarehouseOverview {
  warehouses: WarehouseOverviewItem[]
  /** Stock in no warehouse. `null` when there is none. */
  unassigned: StockSummary | null
}

export interface WarehouseProduct {
  id: string
  name: string
  sku: string
  unit: string
  /** Quantity in THIS warehouse. */
  quantity: number
  /** The product's total across the business (all warehouses + unassigned). */
  totalQuantity: number
  sellPrice: number
  buyPrice: number
  minStockLevel: number | null
  /** The cover image, or null — the list shows a thumbnail when there is one. */
  imageUrl: string | null
}

const num = (value: unknown) => Number(value) || 0

function summaryFor(entries: Array<{ quantity: number; product: ProductStockRow }>): StockSummary {
  return summarizeStock(
    entries.map((entry) => ({
      quantity: entry.quantity,
      sell_price: entry.product.sell_price,
      min_stock_level: entry.product.min_stock_level,
    })),
  )
}

/** Per-warehouse quantity of every product, plus what is in no warehouse. */
export function unassignedQuantities(
  products: readonly ProductStockRow[],
  stock: readonly WarehouseStockRow[],
): Map<string, number> {
  const assigned = new Map<string, number>()
  for (const row of stock) {
    assigned.set(row.product_id, (assigned.get(row.product_id) ?? 0) + num(row.quantity))
  }
  const result = new Map<string, number>()
  for (const product of products) {
    const rest = num(product.quantity) - (assigned.get(product.id) ?? 0)
    if (rest !== 0) result.set(product.id, rest)
  }
  return result
}

export function warehouseOverview(
  warehouses: readonly WarehouseRow[],
  products: readonly ProductStockRow[],
  stock: readonly WarehouseStockRow[],
): WarehouseOverview {
  const productById = new Map(products.map((product) => [product.id, product]))

  const items = warehouses.map((warehouse) => {
    const entries = stock
      .filter((row) => row.warehouse_id === warehouse.id)
      .flatMap((row) => {
        const product = productById.get(row.product_id)
        return product ? [{ quantity: num(row.quantity), product }] : []
      })
    return {
      id: warehouse.id,
      name: warehouse.name,
      location: warehouse.location ?? '',
      isActive: warehouse.is_active !== false,
      summary: summaryFor(entries),
    }
  })

  const rest = unassignedQuantities(products, stock)
  const unassignedEntries = [...rest].flatMap(([productId, quantity]) => {
    const product = productById.get(productId)
    return product ? [{ quantity, product }] : []
  })

  return {
    warehouses: items,
    unassigned: unassignedEntries.length > 0 ? summaryFor(unassignedEntries) : null,
  }
}

/** One warehouse's products (or, with `warehouseId = null`, the unassigned stock). */
export function warehouseProducts(
  warehouseId: string | null,
  products: readonly ProductStockRow[],
  stock: readonly WarehouseStockRow[],
): { products: WarehouseProduct[]; summary: StockSummary } {
  const quantities =
    warehouseId === null
      ? unassignedQuantities(products, stock)
      : new Map(
          stock
            .filter((row) => row.warehouse_id === warehouseId)
            .map((row) => [row.product_id, num(row.quantity)] as const),
        )

  const rows = products
    .filter((product) => quantities.has(product.id))
    .map((product) => ({ product, quantity: quantities.get(product.id) ?? 0 }))

  return {
    products: rows
      .map(({ product, quantity }) => ({
        id: product.id,
        name: product.name,
        sku: product.sku ?? '',
        unit: product.unit ?? '',
        quantity,
        totalQuantity: num(product.quantity),
        sellPrice: num(product.sell_price),
        buyPrice: num(product.buy_price),
        minStockLevel:
          product.min_stock_level === null || product.min_stock_level === ''
            ? null
            : num(product.min_stock_level),
        imageUrl: product.image_url || null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    summary: summaryFor(rows),
  }
}

export type AssignRefusal =
  'WAREHOUSE_ASSIGN_QUANTITY_INVALID' | 'WAREHOUSE_ASSIGN_EXCEEDS_UNASSIGNED'

/**
 * Moving stock that is in no warehouse INTO one. Capped by what is actually
 * unassigned: assigning more would invent stock in the warehouse that the
 * business does not have.
 */
export function checkAssign(quantity: number, unassigned: number): AssignRefusal | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return 'WAREHOUSE_ASSIGN_QUANTITY_INVALID'
  if (quantity > unassigned) return 'WAREHOUSE_ASSIGN_EXCEEDS_UNASSIGNED'
  return null
}

// ─── Where a stock change from the product page lands ───────────────────────

export type StockEditRefusal = 'PRODUCT_WAREHOUSE_REQUIRED' | 'PRODUCT_WAREHOUSE_NOT_FOUND'

/**
 * The warehouse a product-page stock change (an edit, or opening stock) goes
 * into.
 *
 * ⚠️ WHY THIS EXISTS: an edit used to record its movement with NO warehouse.
 * Sales name the warehouse they sell from, so a business with warehouses
 * ended up with the refill in «بدون انبار» and every sale subtracted from the
 * warehouse: the product page said 20, the warehouse said −10 («تمام شده»)
 * for the same item. Both were right, and neither explained the other.
 *
 *   named warehouse     → that one (must be live in this workspace)
 *   no warehouses       → none (there is nowhere else for it to be)
 *   exactly one         → that one — not a guess, the only place stock can be
 *   several, an edit    → refused: the person says which (never guessed, §12)
 *   several, creation   → none, as documented for opening stock; the form
 *                         offers the warehouse and «افزودن کالا به انبار» moves
 *                         it later
 */
export function stockEditWarehouse(
  warehouses: readonly WarehouseRow[],
  requested: string | null | undefined,
  mode: 'edit' | 'create',
): { warehouseId: string | null } | { refusal: StockEditRefusal } {
  const live = warehouses.filter((w) => w.is_active !== false)
  if (requested) {
    return live.some((w) => w.id === requested)
      ? { warehouseId: requested }
      : { refusal: 'PRODUCT_WAREHOUSE_NOT_FOUND' }
  }
  if (live.length === 0) return { warehouseId: null }
  if (live.length === 1) return { warehouseId: (live[0] as WarehouseRow).id }
  return mode === 'edit' ? { refusal: 'PRODUCT_WAREHOUSE_REQUIRED' } : { warehouseId: null }
}

export interface ProductWarehouseBreakdown {
  /** `products.quantity` — every movement, the figure the product page shows. */
  total: number
  /** Every live warehouse, with this product's quantity there (0 when none). */
  warehouses: Array<{ id: string; name: string; quantity: number }>
  /** total − Σ warehouses: stock in no warehouse. Can be negative, and is said so. */
  unassigned: number
}

/**
 * Where one product's stock is. The product page shows this next to the total,
 * so «20» and a warehouse's «−10» are visibly the same stock: −10 there, 30 in
 * no warehouse.
 */
export function productWarehouseBreakdown(
  total: number,
  warehouses: readonly WarehouseRow[],
  stock: readonly WarehouseStockRow[],
): ProductWarehouseBreakdown {
  const rows = warehouses.map((w) => ({
    id: w.id,
    name: w.name,
    quantity: stock
      .filter((s) => s.warehouse_id === w.id)
      .reduce((sum, s) => sum + num(s.quantity), 0),
  }))
  const inWarehouses = rows.reduce((sum, r) => sum + r.quantity, 0)
  return { total, warehouses: rows, unassigned: total - inWarehouses }
}
