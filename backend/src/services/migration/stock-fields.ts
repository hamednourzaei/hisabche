// ============================================
// backend/src/services/migration/stock-fields.ts
//
// The mapping key of a «quantity in this warehouse» column. Imports nothing,
// so the validator and the stock planner can both name the field.
// ============================================

/** Mapping key of a warehouse quantity column: this prefix + the warehouse id. */
export const WAREHOUSE_STOCK_PREFIX = 'warehouseStock:'

export const warehouseStockField = (warehouseId: string): string =>
  `${WAREHOUSE_STOCK_PREFIX}${warehouseId}`

export const warehouseOfStockField = (field: string): string | null =>
  field.startsWith(WAREHOUSE_STOCK_PREFIX) ? field.slice(WAREHOUSE_STOCK_PREFIX.length) : null
