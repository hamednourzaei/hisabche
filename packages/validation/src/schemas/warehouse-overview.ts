// ============================================
// packages/validation/src/schemas/warehouse-overview.ts
//
// The warehouse list and one warehouse's stock — moved here from
// backend/src/services/inventory/warehouse-summary.domain.ts so the offline
// engine answers /warehouses/overview and /warehouses/:id/detail with the SAME
// shape and rule as the server. The local engine had its own shape (no
// `summary`) and the warehouse page crashed offline on `summary.productCount`.
//
// «Unassigned» stock is shown, not hidden — see the backend file's header.
// ============================================

import { summarizeStock, type StockSummary } from './stock-summary'
import type { WarehouseRow, WarehouseStockRow } from './stock'

export interface ProductStockRow {
  id: string
  name: string
  sku: string | null
  unit: string | null
  quantity: number | string | null
  sell_price: number | string | null
  buy_price: number | string | null
  min_stock_level: number | string | null
  category?: string | null | undefined
  /** The product's cover (its first gallery image); '' or null = none. */
  image_url?: string | null | undefined
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
  /** The product's category; '' when none is recorded. */
  category: string
  /** The cover image, or null — the list shows a thumbnail when there is one. */
  imageUrl: string | null
}

const num = (value: unknown) => Number(value) || 0

function summaryFor(entries: Array<{ quantity: number; product: ProductStockRow }>): StockSummary {
  return summarizeStock(
    entries.map((entry) => ({
      quantity: entry.quantity,
      buy_price: entry.product.buy_price,
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
        category: product.category ?? '',
        imageUrl: product.image_url || null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    summary: summaryFor(rows),
  }
}
