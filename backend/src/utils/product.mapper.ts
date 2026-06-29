// ============================================
// backend/src/utils/product.mapper.ts
// ============================================

export function mapProduct(raw: Record<string, any>) {
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
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  }
}