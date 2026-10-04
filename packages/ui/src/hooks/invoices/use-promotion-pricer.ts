'use client'

// ============================================
// What a product costs when it is picked onto a SALE invoice: its own sell
// price, less the promotions that are live today, cover it, and can be applied
// in the invoice's currency.
//
// The arithmetic is the shared engine's (`quotePrice`) — the server quotes with
// the same function.
//
// ⚠️ NO PROMOTIONS LOADED = THE PRODUCT'S OWN PRICE. Offline, before the
// migration, or on a failed read, a line is priced exactly as it always was;
// a discount is never guessed. A purchase is never discounted by a sale rule.
//
// ⚠️ The result says whether it was discounted and from what, so the picker can
// show it: a lower price with no reason beside it would look like a mistake.
// ============================================

import { useCallback, useMemo } from 'react'
import { usePromotions } from '@hisabche/api'
import { toIsoDay } from '@hisabche/formatting'
import { useCurrencyStore, useInvoiceDraftStore } from '@hisabche/store'
import { promotionsFor, quotePrice } from '@hisabche/validation'

import { productPrice, type PickerProduct } from '../../lib/invoices/products'

export interface PickedPrice {
  price: number
  /** The product's own sell price. */
  base: number
  discounted: boolean
}

export function usePromotionPricer(): (product: PickerProduct) => PickedPrice {
  const transactionType = useInvoiceDraftStore((s) => s.transactionType)
  const customerId = useInvoiceDraftStore((s) => s.customers[0]?.id ?? null)
  const currency = useCurrencyStore((s) => s.primaryCurrency)
  const isSale = transactionType === 'sale'
  const saved = usePromotions({ activeOnly: true, enabled: isSale })

  const promotions = useMemo(
    () => (isSale && saved.data ? promotionsFor(saved.data, currency) : []),
    [isSale, saved.data, currency],
  )

  return useCallback(
    (product: PickerProduct): PickedPrice => {
      const base = productPrice(product)
      if (promotions.length === 0 || !(base > 0)) return { price: base, base, discounted: false }

      const quote = quotePrice(
        { productId: product.id, kind: 'sale', customerId, quantity: 1 },
        { productId: product.id, baseUnitPrice: base },
        promotions,
        toIsoDay(new Date()),
      )
      // A quote with a problem is not a price: fall back to the product's own.
      if (quote.problems.length > 0) return { price: base, base, discounted: false }
      const price = quote.unitPriceMinor / 100
      return { price, base, discounted: price < base }
    },
    [promotions, customerId],
  )
}
