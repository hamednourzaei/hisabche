// ============================================
// The invoice's product list — one rule for the desktop cell and the phone sheet.
//
// ⚠️ THE PHONE HAD ITS OWN, AND IT WAS WRONG IN THREE WAYS.
//
// The mobile picker asked `useProducts` for 30 rows and showed them flat: no
// warehouse (a gearbox held in two warehouses was one line, its stock the
// total), the SELL price on a purchase invoice, and an exhausted product
// pickable on a sale. The desktop cell had all three right through
// `pickerRows`. This hook is that cell's logic, so both screens list, price
// and pick the same way (G2).
// ============================================
'use client'

import { useMemo } from 'react'
import { useProducts, useStockPlacement } from '@hisabche/api'
import { useInvoiceDraftStore } from '@hisabche/store'

import { productCost, readProducts, type PickerProduct } from '../../lib/invoices/products'
import { pickerRows, type PickerRow } from '../../lib/invoices/picker-rows'
import { usePromotionPricer, type PickedPrice } from './use-promotion-pricer'

export type PickAs = 'sale' | 'component'

export interface PickedProduct {
  id: string
  name: string
  price: string
  unit: string
}

export function usePickerRows(search: string, pickAs: PickAs = 'sale') {
  // Where stock is, and which warehouses this person may sell from.
  const placement = useStockPlacement()
  const listedByWarehouse = (placement.data?.warehouses.length ?? 0) > 0
  const transactionType = useInvoiceDraftStore((state) => state.transactionType)
  const warehouseId = useInvoiceDraftStore((state) => state.warehouseId)
  const branchId = useInvoiceDraftStore((state) => state.branchId)
  const setField = useInvoiceDraftStore((state) => state.setField)

  // ⚠️ The warehouse goes to the SERVER (owner, 18 Oct 2026): narrowing a page
  // of 100 here hid a warehouse's 101st product. Only a purchase SEARCH asks
  // the whole catalogue — that is how a product first arrives in a warehouse.
  const scopeToWarehouse =
    listedByWarehouse &&
    warehouseId !== null &&
    pickAs !== 'component' &&
    !(transactionType === 'purchase' && search !== '')
  const { data, isLoading } = useProducts({
    ...(search ? { search } : {}),
    ...(scopeToWarehouse ? { warehouseId } : {}),
    limit: listedByWarehouse ? 100 : 20,
  })

  const products = useMemo<PickerProduct[]>(() => readProducts(data), [data])

  const rows = useMemo<PickerRow[]>(
    () =>
      pickerRows({
        products,
        placement: placement.data,
        warehouseId,
        branchId,
        mode:
          pickAs === 'component'
            ? 'component'
            : transactionType === 'purchase'
              ? 'purchase'
              : 'sale',
        searching: search !== '',
      }),
    [products, placement.data, warehouseId, branchId, pickAs, transactionType, search],
  )

  // A sale line is priced with the live promotions; a PURCHASE line and a
  // component at what the business pays (the buy price).
  const promoPrice = usePromotionPricer()
  const selling = pickAs === 'sale' && transactionType !== 'purchase'
  const priceOf = (product: PickerProduct): PickedPrice => {
    if (selling) return promoPrice(product)
    const cost = productCost(product)
    return { price: cost, base: cost, discounted: false }
  }

  /**
   * What a picked row puts on the line, or null when it may not be picked.
   * Picked from «all warehouses»: the line's warehouse becomes the invoice's,
   * so the stock that leaves is the stock that was shown.
   */
  const pick = (row: PickerRow): PickedProduct | null => {
    if (row.exhausted) return null
    if (row.warehouseId && !warehouseId) setField('warehouseId', row.warehouseId)
    return {
      id: row.product.id,
      name: row.product.name,
      price: String(priceOf(row.product).price),
      unit: row.product.unit ?? 'piece',
    }
  }

  /** Products the server found before the warehouse rule — tells «not here» from «nothing». */
  const productCount = products.length
  return { rows, isLoading, warehouseId, productCount, priceOf, pick, selling }
}
