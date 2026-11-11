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
import { useCustomerPriceList, useLatestMetalRate, usePromotions } from '@hisabche/api'
import { fractionDigits, toIsoDay } from '@hisabche/formatting'
import { useCurrencyStore, useInvoiceDraftStore } from '@hisabche/store'
import {
  applyPrice,
  priceListPricing,
  promotionsFor,
  quoteGoldItemPrice,
  quotePrice,
  type GoldLineSnapshot,
} from '@hisabche/validation'

import { productPrice, type PickerProduct } from '../../lib/invoices/products'

export interface PickedPrice {
  price: number
  /** The product's own sell price. */
  base: number
  discounted: boolean
  /** The price list that set the price, when one did. */
  listName?: string | undefined
  /** Locked gold-rate snapshot when priced from the workspace's daily rate board. */
  goldSnapshot?: GoldLineSnapshot | undefined
}

export function usePromotionPricer(): (product: PickerProduct) => PickedPrice {
  const transactionType = useInvoiceDraftStore((s) => s.transactionType)
  const customerId = useInvoiceDraftStore((s) => s.customers[0]?.id ?? null)
  const currency = useCurrencyStore((s) => s.primaryCurrency)
  const isSale = transactionType === 'sale'
  const saved = usePromotions({ activeOnly: true, enabled: isSale })
  const customerList = useCustomerPriceList(customerId, { enabled: isSale })
  const metalRate = useLatestMetalRate()

  const promotions = useMemo(
    () => (isSale && saved.data ? promotionsFor(saved.data, currency) : []),
    [isSale, saved.data, currency],
  )
  const priceList = isSale && customerId ? (customerList.data ?? null) : null

  return useCallback(
    (product: PickerProduct): PickedPrice => {
      const base = productPrice(product)
      const today = toIsoDay(new Date())

      // Weighted gold lines price through quoteGoldItemPrice + applyPrice with a locked snapshot
      // whenever a daily 24K rate is present on the board.
      if (isSale && product.unit === 'gram' && (metalRate.data?.rate24kMinorPerGram ?? 0) > 0) {
        const rate24k = metalRate.data!.rate24kMinorPerGram
        const goldQuote = quoteGoldItemPrice(
          { productId: product.id, kind: 'sale', customerId, quantity: 1 },
          {
            karat: 24,
            netWeightMg: 1000,
            rateSnapshot: {
              rate24kMinorPerGram: rate24k,
              capturedAt: metalRate.data?.createdAt ?? `${today}T00:00:00.000Z`,
              capturedBy: metalRate.data?.setBy ?? 'system',
            },
            makingChargeType: 'fixed',
            makingChargeValue: 0,
          },
          undefined,
          promotions,
          today,
        )
        const [appliedGold] = applyPrice([{ productId: product.id, quantity: 1 }], [goldQuote])
        const scale = Math.pow(10, fractionDigits(currency))
        if (goldQuote.problems.length === 0 && appliedGold?.unitPrice != null) {
          const goldUnitPrice = Math.round(appliedGold.unitPrice * 100) / scale
          return {
            price: goldUnitPrice,
            base: goldUnitPrice,
            discounted: false,
            ...(appliedGold.goldSnapshot ? { goldSnapshot: appliedGold.goldSnapshot } : {}),
          }
        }
      }

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
      const [applied] = applyPrice([{ productId: product.id, quantity: 1 }], [quote])
      const price = applied?.unitPrice ?? quote.unitPriceMinor / 100
      return {
        price,
        base,
        discounted: price < base,
        listName: onList.priceListId ? priceList?.name : undefined,
      }
    },
    [promotions, customerId, priceList, currency, isSale, metalRate.data],
  )
}
