// ============================================
// packages/validation/src/schemas/stock.ts
//
// The warehouse rule for a stock change, and the breakdown that shows where a
// product's stock is.
//
// ⚠️ THIS FILE IS A RULE, NOT A SERVER CAPABILITY.
//
// It moved out of `backend/src/services/inventory/warehouse-summary.domain.ts`
// in Phase 2 of the offline edition: the device has to decide the same thing
// with no server to ask, and «which warehouse did this stock go into» cannot
// have two answers. The domain file re-exports these declarations, so every
// existing import keeps resolving.
//
// ⚠️ WHY `stockEditWarehouse` EXISTS — BUG-080.
//
// A product-page stock edit recorded its movement with NO warehouse, while
// every sale named the warehouse it sold from. A refill of 30 landed in
// «بدون انبار»; sales took 10 out of the warehouse. The product page said 20
// and the warehouse said −10 for the same item, and both were arithmetically
// right. There is no default in this file: the cases are enumerated, and the
// one case that could be a guess (several warehouses, an edit) REFUSES instead
// and asks the person (CLAUDE.md §12).
// ============================================

export interface WarehouseRow {
  id: string
  name: string
  location: string | null
  is_active: boolean | null
}

export interface WarehouseStockRow {
  warehouse_id: string
  product_id: string
  quantity: number | string | null
}

const num = (value: unknown) => Number(value) || 0

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

export type StockEditRefusal = 'PRODUCT_WAREHOUSE_REQUIRED' | 'PRODUCT_WAREHOUSE_NOT_FOUND'

/**
 * The warehouse a product-page stock change (an edit, or opening stock) goes
 * into.
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
