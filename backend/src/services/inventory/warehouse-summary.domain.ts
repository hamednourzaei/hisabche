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

// ─── Moved to the shared package in Phase 2 of the offline edition ─────────
//
// The warehouse rule has to run on the device with no server to ask, so
// `stockEditWarehouse`, `checkAssign` and `productWarehouseBreakdown` now live
// in `packages/validation/src/schemas/stock.ts` and are re-exported here, so
// every existing import of this file keeps resolving.
export { checkAssign, productWarehouseBreakdown, stockEditWarehouse } from '@hisabche/validation'
export type {
  AssignRefusal,
  ProductWarehouseBreakdown,
  StockEditRefusal,
  WarehouseRow,
  WarehouseStockRow,
} from '@hisabche/validation'

// The warehouse list and detail moved to the shared package too, so the
// offline engine returns the same shape (packages/validation/.../warehouse-overview.ts).
import {
  warehouseProducts as sharedWarehouseProducts,
  type ProductStockRow,
  type WarehouseProduct,
  type WarehouseStockRow,
} from '@hisabche/validation'
import type { StockSummary } from './stock-summary.domain'

export { unassignedQuantities, warehouseOverview } from '@hisabche/validation'
export type {
  ProductStockRow,
  WarehouseOverview,
  WarehouseOverviewItem,
  WarehouseProduct,
} from '@hisabche/validation'

export function warehouseProducts(
  warehouseId: string | null,
  products: readonly ProductStockRow[],
  stock: readonly WarehouseStockRow[],
): { products: WarehouseProduct[]; summary: StockSummary } {
  const result = sharedWarehouseProducts(warehouseId, products, stock)
  return {
    ...result,
    products: result.products.map((product) => ({
      ...product,
      category: product.category ?? '',
    })),
  }
}

// ─── Where a stock change from the product page lands ───────────────────────
// `stockEditWarehouse` and `checkAssign` moved to
// `packages/validation/src/schemas/stock.ts` (Phase 2, offline edition) and are
// re-exported at the top of this file. The rule and its cases are documented
// there, beside the function.
