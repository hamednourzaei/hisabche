// ============================================
// backend/src/services/inventory/buy-price.domain.ts
//
// «قیمت خرید» on a product = what it was LAST bought for (owner, 18 Oct 2026:
// «قبلاً ۲۰ میلیون می‌خریدم، الان ۲۵ — انبار هنوز ۲۰ نشان می‌دهد»).
//
// Nothing wrote `products.buy_price` after a purchase: it kept the number typed
// when the product was made, so every warehouse table, the stock value and the
// product page showed the first price forever.
//
// ⚠️ What this does NOT touch:
//   · the sale price — a new cost is not a decision to charge more;
//   · cost layers, COGS and posted journals — each purchase already has its
//     own layer at its own price (FIFO/AVCO read those, never this column);
//   · a line in another unit or another currency it cannot convert honestly —
//     skipped, the old price stays (§12: no guessed figure).
// ============================================

export interface PurchaseLineForPrice {
  productId: string
  quantity: number
  unitPrice: number
  /** The unit the line was bought in. */
  unit: string | null
}

export interface ProductForPrice {
  id: string
  unit: string | null
  /** The currency `buy_price` is held in; null = the books currency. */
  currency: string | null
}

export interface PurchaseForPrice {
  /** The invoice's currency; null = the books currency. */
  currency: string | null
  /** Books currency per one unit of the invoice's currency, when it differs. */
  exchangeRate: number | null
  booksCurrency: string
  lines: readonly PurchaseLineForPrice[]
}

/**
 * The new `buy_price` per product this purchase sets. A product absent from
 * the result keeps its price.
 *
 * Several lines of one product: the last one wins (it is the last price seen).
 */
export function latestBuyPrices(
  purchase: PurchaseForPrice,
  products: ReadonlyMap<string, ProductForPrice>,
): Map<string, number> {
  const out = new Map<string, number>()
  const invoiceCurrency = purchase.currency || purchase.booksCurrency

  for (const line of purchase.lines) {
    const product = products.get(line.productId)
    if (!product) continue
    if (!(line.quantity > 0) || !(line.unitPrice > 0)) continue
    // A price per gram is not a price per piece.
    if ((line.unit || 'piece') !== (product.unit || 'piece')) continue

    const productCurrency = product.currency || purchase.booksCurrency
    let price: number | null = null
    if (productCurrency === invoiceCurrency) {
      price = line.unitPrice
    } else if (
      productCurrency === purchase.booksCurrency &&
      purchase.exchangeRate !== null &&
      purchase.exchangeRate > 0
    ) {
      price = line.unitPrice * purchase.exchangeRate
    }
    if (price === null || !Number.isFinite(price)) continue
    out.set(line.productId, Math.round(price * 10_000) / 10_000)
  }

  return out
}
