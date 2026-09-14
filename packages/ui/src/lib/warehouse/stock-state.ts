// packages/ui/src/lib/warehouse/stock-state.ts
//
// ONE rule for «out / low / in stock», shared by the product list and the
// product page. They disagreed: the page tested `quantity === 0`, so a product
// at −98 read «کم‌موجود» on its own page and «تمام‌شده» in the list.
// A negative on-hand is out of stock (more was sold than was ever recorded).

export type StockState = 'out' | 'low' | 'ok'

export function stockStateOf(quantity: number, minStockLevel: number): StockState {
  if (quantity <= 0) return 'out'
  if (quantity <= minStockLevel) return 'low'
  return 'ok'
}

export const STOCK_TONE = { out: 'destructive', low: 'warning', ok: 'success' } as const
export const STOCK_LABEL_KEY = {
  out: 'warehouse.outOfStock',
  low: 'warehouse.lowStock',
  ok: 'warehouse.inStock',
} as const
