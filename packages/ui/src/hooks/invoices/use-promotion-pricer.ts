'use client'

// ============================================
// What a product costs when it is picked onto a SALE invoice: the price on the
// customer's price list when one applies (else the product's own sell price),
// less the promotions that are live today, cover it, and can be applied in the
// invoice's currency.
//
// The arithmetic is the shared engine's (`quotePrice`), and whether a list
// applies is the shared rule's (`priceListPricing`) — the server quotes with
// the same two functions.
//
// ⚠️ NOTHING LOADED = THE PRODUCT'S OWN PRICE. Offline, before the migrations,
// or on a failed read, a line is priced exactly as it always was; a discount or
// a list price is never guessed. A purchase is never priced by a sale rule.
//
// ⚠️ The result says whether it was discounted and from what, and which list
// priced it, so the picker can show it: a different price with no reason beside
// it would look like a mistake.
// ============================================

import { useCallback, useMemo } from 'react'
import { useCustomerPriceList, usePromotions } from '@hisabche/api'
import { toIsoDay } from '@hisabche/formatting'
import { useCurrencyStore, useInvoiceDraftStore } from '@hisabche/store'
import { priceListPricing, promotionsFor, quotePrice } from '@hisabche/validation'

import { productPrice, type PickerProduct } from '../../lib/invoices/products'

export interface PickedPrice {
  price: number
  /** The product's own sell price. */
  base: number
  discounted: boolean
  /** The price list that set the price, when one did. */
  listName?: string | undefined
}

export function usePromotionPricer(): (product: PickerProduct) => PickedPrice {
  const transactionType = useInvoiceDraftStore((s) => s.transactionType)
  const customerId = useInvoiceDraftStore((s) => s.customers[0]?.id ?? null)
  const currency = useCurrencyStore((s) => s.primaryCurrency)
  const isSale = transactionType === 'sale'
  const saved = usePromotions({ activeOnly: true, enabled: isSale })
  const customerList = useCustomerPriceList(customerId, { enabled: isSale })

  const promotions = useMemo(
    () => (isSale && saved.data ? promotionsFor(saved.data, currency) : []),
    [isSale, saved.data, currency],
  )
  const priceList = isSale && customerId ? (customerList.data ?? null) : null

  return useCallback(
    (product: PickerProduct): PickedPrice => {
      const base = productPrice(product)
      const today = toIsoDay(new Date())
      const onList = priceListPricing(priceList, product.id, currency, today)
      if (!onList.priceListId && (promotions.length === 0 || !(base > 0))) {
        return { price: base, base, discounted: false }
      }

      const quote = quotePrice(
        {
          productId: product.id,
          kind: 'sale',
          customerId,
          priceListId: onList.priceListId,
          quantity: 1,
        },
        { productId: product.id, baseUnitPrice: base, listPrices: onList.listPrices },
        promotions,
        today,
      )
      // A quote with a problem is not a price: fall back to the product's own.
      if (quote.problems.length > 0) return { price: base, base, discounted: false }
      const price = quote.unitPriceMinor / 100
      return {
        price,
        base,
        discounted: price < base,
        listName: onList.priceListId ? priceList?.name : undefined,
      }
    },
    [promotions, customerId, priceList, currency],
  )
}
