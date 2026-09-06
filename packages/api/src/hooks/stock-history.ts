// ============================================
// packages/api/src/hooks/stock-history.ts
//
// H4 — the movements behind a product's on-hand figure.
//
// Phase C made `stock_movements` the source of truth for quantity and
// `products.quantity` a trigger-maintained projection. So the number a
// shopkeeper argues with most is derived from rows nothing in the app could
// read. This is the read.
// ============================================

import { useQuery } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'
import { useRealtime } from './useRealtime'

export interface StockMovementRecord {
  id: string
  /** 'sale' | 'purchase' | 'production' | 'transfer' | 'adjustment' … */
  type: string
  /** SIGNED — negative is stock leaving. The sum of these IS the on-hand. */
  quantity: number
  referenceType: string | null
  referenceId: string | null
  notes: string | null
  fromWarehouseId: string | null
  toWarehouseId: string | null
  createdAt: string | null
  /** Running total after this movement, oldest first. */
  balance: number
}

export interface StockHistory {
  productId: string
  productName: string
  /** `SUM(quantity)` over the movements returned. */
  movementTotal: number
  /** `products.quantity` as stored — shown when it disagrees, never hidden. */
  storedQuantity: number
  movements: StockMovementRecord[]
}

export const stockHistoryKeys = {
  all: ['stock-history'] as const,
  detail: (productId: string) => ['stock-history', productId] as const,
}

export function useStockHistory(productId: string | undefined) {
  const authReady = useAuthReady()

  // A sale, an arrival or a transfer changes this answer. Subscribed at the
  // root key so any product's open history refreshes — the panel is opened
  // precisely when someone suspects the figure is stale.
  useRealtime({
    table: 'stock_movements',
    queryKey: stockHistoryKeys.all as unknown as string[],
  })

  return useQuery({
    queryKey: stockHistoryKeys.detail(productId ?? ''),
    queryFn: async (): Promise<StockHistory> => {
      const { data } = await apiClient.get(`/products/${productId}/stock-history`)
      return data
    },
    enabled: authReady && Boolean(productId),
    staleTime: 0,
  })
}
