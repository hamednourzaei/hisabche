// ============================================
// Reading the product list out of an API response.
//
// `useProducts` resolves to `{ products, total }`. Two pickers were reading
// `data.data` and `Array.isArray(data)` instead, so both showed "no product
// found" against a full warehouse. One reader, used by both, so the shape is
// stated once.
// ============================================

export interface PickerProduct {
  id: string
  name: string
  /** Product code (SKU) — how two same-named goods are told apart. */
  sku?: string | null
  sell_price?: number | null
  sellPrice?: number | null
  unit?: string | null
  quantity?: number | null
}

export function readProducts(data: unknown): PickerProduct[] {
  if (Array.isArray(data)) return data as PickerProduct[]
  if (!data || typeof data !== 'object') return []

  const shape = data as { products?: unknown; data?: unknown; items?: unknown }
  const list = shape.products ?? shape.data ?? shape.items
  return Array.isArray(list) ? (list as PickerProduct[]) : []
}

/** The sell price, whichever casing the row came back in. */
export function productPrice(product: PickerProduct): number {
  return Number(product.sellPrice ?? product.sell_price ?? 0) || 0
}
