// ============================================
// backend/src/utils/product.mapper.ts
// ============================================

/**
 * A `products` row, in the columns the mapper reads (13 Nov 2026: typed, was `Record<string, any>`).
 *
 * The selects differ — the invoice picker reads seven columns, the product page all of them — so
 * only the columns EVERY select names are required. A column a select left out maps to
 * `undefined`, exactly as it did before.
 */
export interface ProductRow {
  id: string
  name: string
  quantity: number
  unit: string
  min_stock_level: number
  sell_price: number
  barcode?: string | null
  sku?: string | null
  category?: string | null
  description?: string | null
  image_url?: string | null
  buy_price?: number | null
  wholesale_price?: number | null
  is_active?: boolean
  offering_type?: string | null
  offeringType?: string | null
  created_at?: string
  updated_at?: string
}

/** `object`: callers hand over typed selects and plain rows alike; it is read as a ProductRow. */
export function mapProduct(value: object) {
  const raw = value as ProductRow
  return {
    id: raw.id,
    name: raw.name,
    barcode: raw.barcode,
    sku: raw.sku,
    category: raw.category,
    description: raw.description,
    imageUrl: raw.image_url,
    quantity: raw.quantity,
    unit: raw.unit,
    minStockLevel: raw.min_stock_level,
    buyPrice: raw.buy_price,
    sellPrice: raw.sell_price,
    wholesalePrice: raw.wholesale_price,
    isActive: raw.is_active,
    offeringType: raw.offering_type ?? raw.offeringType ?? 'goods',
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  }
}
