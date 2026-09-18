'use client'

// ============================================
// What an invoice's warehouse holds of each product (request #94).
//
// ⚠️ WHY THE PICKER CANNOT JUST SHOW `products.quantity`.
//
// That figure is the whole business. With several warehouses, selling from the
// one in front of you while the stock sits in another building reads as "12 in
// stock" and takes the shelf negative. The picker therefore shows the quantity
// IN THE INVOICE'S WAREHOUSE, and says which warehouse that is.
//
// No warehouse chosen (or only one exists and it is not set yet) → `inWarehouse`
// is false and the caller shows the business-wide figure, exactly as before.
// ============================================

import { useMemo } from 'react'
import { useWarehouseDetail } from '@hisabche/api'
import { useInvoiceDraftStore } from '@hisabche/store'

export interface InvoiceWarehouseStock {
  /** True when the invoice names a warehouse and its stock has been read. */
  inWarehouse: boolean
  warehouseName: string
  /** Quantity in that warehouse, per product id. Missing = none there. */
  quantityOf: (productId: string) => number | null
  isLoading: boolean
}

export function useInvoiceWarehouseStock(): InvoiceWarehouseStock {
  const warehouseId = useInvoiceDraftStore((state) => state.warehouseId)
  const detail = useWarehouseDetail(warehouseId)

  const byProduct = useMemo(() => {
    const map = new Map<string, number>()
    for (const product of detail.data?.products ?? []) map.set(product.id, product.quantity)
    return map
  }, [detail.data])

  return {
    inWarehouse: !!warehouseId && !!detail.data,
    warehouseName: detail.data?.warehouse?.name ?? '',
    // 0 is a real answer («none here»); null means «not known».
    quantityOf: (productId: string) => (byProduct.has(productId) ? byProduct.get(productId)! : 0),
    isLoading: !!warehouseId && detail.isLoading,
  }
}
