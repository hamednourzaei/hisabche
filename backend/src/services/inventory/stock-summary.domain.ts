// ============================================
// backend/src/services/inventory/stock-summary.domain.ts
//
// The warehouse page's stat cards, computed over EVERY product in the
// workspace — not over the page of products the table shows.
//
// Before this, the browser fetched `limit: 100` (also the route's cap) and
// reduced `quantity × sellPrice` over it. A shop with 400 products read the
// value of its newest 100 under «ارزش کل», with nothing saying so.
//
// The rules are the ones `calculateTotals` in the UI already used, moved here:
//   - value        = Σ quantity × sell_price
//   - out of stock = quantity ≤ 0 (an oversold -98 is out, not «low»)
//   - low stock    = 0 < quantity ≤ min_stock_level
// ============================================

/** The UI's fallback when a product has no level recorded (`mapProducts`). */
export const DEFAULT_MIN_STOCK_LEVEL = 5

export interface StockSummaryRow {
  quantity: number | string | null
  sell_price: number | string | null
  min_stock_level: number | string | null
}

export interface StockSummary {
  productCount: number
  totalValue: number
  lowStockCount: number
  outOfStockCount: number
}

export function summarizeStock(rows: readonly StockSummaryRow[]): StockSummary {
  let totalValue = 0
  let lowStockCount = 0
  let outOfStockCount = 0

  for (const row of rows) {
    const quantity = Number(row.quantity) || 0
    const minLevel =
      row.min_stock_level === null || row.min_stock_level === ''
        ? DEFAULT_MIN_STOCK_LEVEL
        : Number(row.min_stock_level) || 0
    totalValue += quantity * (Number(row.sell_price) || 0)
    if (quantity <= 0) outOfStockCount += 1
    else if (quantity <= minLevel) lowStockCount += 1
  }

  return {
    productCount: rows.length,
    // Money leaves the server as an integer in the minor unit (CLAUDE.md §1.3).
    totalValue: Math.round(totalValue),
    lowStockCount,
    outOfStockCount,
  }
}
