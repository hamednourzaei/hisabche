// ============================================
// Purchasing Hooks — TanStack Query
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'
import { useRealtime } from './useRealtime'
import { asList } from '../lib/as-list'
import { useIntentKey } from '../lib/intent-key'

// ═══ Types ═══
export interface PurchaseOrder {
  id: string
  supplierId: string
  orderDate: string
  expectedDeliveryDate?: string
  status: string
  notes?: string
  receivedAt?: string
  supplier?: { name: string; phone: string; email: string }
  items: PurchaseOrderItem[]
}

export interface PurchaseOrderItem {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  totalPrice: number
  product?: { name: string; unit: string }
}

// ═══ Query Keys ═══
export const purchasingKeys = {
  all: ['purchasing'] as const,
  orders: () => [...purchasingKeys.all, 'orders'] as const,
  order: (id: string) => [...purchasingKeys.all, 'order', id] as const,
}

// ═══ Hooks ═══
export function usePurchaseOrders() {
  const authReady = useAuthReady()

  // ✅ FIX: subscription realtime برای جدول purchase_orders — با
  // purchasingKeys.all، هم لیست هم جزئیات هر سفارش پوشش داده می‌شوند.
  useRealtime({ table: 'purchase_orders', queryKey: purchasingKeys.all as unknown as string[] })

  return useQuery({
    queryKey: purchasingKeys.orders(),
    queryFn: async (): Promise<PurchaseOrder[]> => {
      // ✅ FIX: مسیر واقعی route در بک‌اند /api/purchase-orders است
      // (نه /api/purchasing/orders)
      const { data } = await apiClient.get('/purchase-orders')
      return asList<PurchaseOrder>(data)
    },
    enabled: authReady,
    staleTime: 60_000,
  })
}

export function usePurchaseOrder(id: string) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: purchasingKeys.order(id),
    queryFn: async (): Promise<PurchaseOrder> => {
      const { data } = await apiClient.get(`/purchase-orders/${id}`)
      return data
    },
    enabled: authReady && !!id,
    staleTime: 60_000,
  })
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient()
  // Same key while the same order is retried after a lost response, so the
  // server returns the first order instead of creating (and budgeting) a second.
  const intent = useIntentKey('po')
  return useMutation({
    mutationFn: async (input: any) => {
      const { data } = await apiClient.post('/purchase-orders', input, {
        headers: { 'Idempotency-Key': intent.current() },
      })
      return data
    },
    onError: (error) => intent.settle(error),
    onSuccess: () => {
      intent.settle()
      queryClient.invalidateQueries({ queryKey: purchasingKeys.orders() })
    },
  })
}

export function useReceiveGoods() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/purchase-orders/${id}/receive`)
      return data
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: purchasingKeys.order(id) })
      queryClient.invalidateQueries({ queryKey: purchasingKeys.orders() })
    },
  })
}
