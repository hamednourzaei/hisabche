// packages/ui/src/lib/warehouse-mappers.ts
import type { RawProduct, Product } from './warehouse-types'
import { num } from './warehouse-format'

export const mapProducts = (
  products: RawProduct[] | undefined,
  t: (key: string) => string,
): Product[] => {
  if (!products) return []

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    quantity: num(p.quantity),
    sellPrice: num(p.sell_price ?? p.sellPrice),
    buyPrice: num(p.buy_price ?? p.buyPrice),
    minStockLevel: num(p.min_stock_level ?? p.minStockLevel ?? 5),
    unit: p.unit ?? t('warehouse.units.piece'),
    category: p.category ?? t('warehouse.categories.general'),
  }))
}
