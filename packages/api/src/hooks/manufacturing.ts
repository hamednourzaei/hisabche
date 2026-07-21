// ============================================
// Manufacturing Hooks — TanStack Query
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'

// ═══ Types ═══
export interface BOM {
  id: string; productId: string; version: number; isActive: boolean;
  product?: { name: string }; items: BOMItem[];
}

export interface BOMItem {
  id: string; rawMaterialId: string; quantity: number; unitCost: number;
  rawMaterial?: { name: string; unit: string };
}

export interface WorkOrder {
  id: string; productId: string; quantity: number; bomId?: string;
  status: string; startDate?: string; endDate?: string;
  product?: { name: string };
}

// ═══ Query Keys ═══
export const manufacturingKeys = {
  all: ['manufacturing'] as const,
  boms: (productId?: string) => [...manufacturingKeys.all, 'boms', productId] as const,
  workOrders: (status?: string) => [...manufacturingKeys.all, 'workOrders', status] as const,
}

// ═══ Hooks ═══
export function useBOMs(productId?: string) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: manufacturingKeys.boms(productId),
    queryFn: async (): Promise<BOM[]> => {
      const { data } = await apiClient.get('/boms', {
        params: productId ? { productId } : {},
      })
      return data
    },
    enabled: authReady,
    staleTime: 2 * 60_000,
  })
}

export function useCreateBOM() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: any) => {
      const { data } = await apiClient.post('/boms', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: manufacturingKeys.all })
    },
  })
}

export function useWorkOrders(status?: string) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: manufacturingKeys.workOrders(status),
    queryFn: async (): Promise<WorkOrder[]> => {
      const { data } = await apiClient.get('/work-orders', {
        params: status ? { status } : {},
      })
      return data
    },
    enabled: authReady,
    staleTime: 30_000,
  })
}

export function useCreateWorkOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: any) => {
      const { data } = await apiClient.post('/work-orders', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: manufacturingKeys.all })
    },
  })
}

export function useCompleteWorkOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/work-orders/${id}/complete`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: manufacturingKeys.all })
    },
  })
}