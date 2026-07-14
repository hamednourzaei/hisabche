// ============================================
// Purchasing Hooks — TanStack Query
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'

// ═══ Types ═══
export interface PurchaseOrder {
  id: string; supplierId: string; orderDate: string;
  expectedDeliveryDate?: string; status: string; notes?: string;
  receivedAt?: string; supplier?: { name: string; phone: string; email: string };
  items: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string; productId: string; quantity: number;
  unitPrice: number; totalPrice: number;
  product?: { name: string; unit: string };
}

// ═══ Query Keys ═══
export const purchasingKeys = {
  all: ['purchasing'] as const,
  orders: () => [...purchasingKeys.all, 'orders'] as const,
  order: (id: string) => [...purchasingKeys.all, 'order', id] as const,
}

// ═══ Hooks ═══
export function usePurchaseOrders() {
  return useQuery({
    queryKey: purchasingKeys.orders(),
    queryFn: async (): Promise<PurchaseOrder[]> => {
      const { data } = await apiClient.get('/purchasing/orders')
      return data
    },
    staleTime: 60_000,
  })
}

export function usePurchaseOrder(id: string) {
  return useQuery({
    queryKey: purchasingKeys.order(id),
    queryFn: async (): Promise<PurchaseOrder> => {
      const { data } = await apiClient.get(`/purchasing/orders/${id}`)
      return data
    },
    enabled: !!id,
    staleTime: 60_000,
  })
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: any) => {
      const { data } = await apiClient.post('/purchasing/orders', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: purchasingKeys.orders() })
    },
  })
}

export function useReceiveGoods() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/purchasing/orders/${id}/receive`)
      return data
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: purchasingKeys.order(id) })
      queryClient.invalidateQueries({ queryKey: purchasingKeys.orders() })
    },
  })
}