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
