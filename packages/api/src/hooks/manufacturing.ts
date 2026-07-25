// ============================================
// Manufacturing Hooks — TanStack Query
// FIXED: اضافه شدن Realtime روی جداول boms، bom_items و work_orders.
//
// ⚠️ پیش‌نیاز قبل از استفاده از این فایل: طبق چک RLS، هر سه جدول
// (boms, bom_items, work_orders) در حال حاضر rowsecurity=true دارند
// ولی هیچ policy ای برایشان تعریف نشده (deny by default) — یعنی
// subscription های زیر بدون خطا، ولی بی‌صدا هیچ eventای دریافت
// نخواهند کرد تا زمانی که policy های SELECT مناسب اضافه شوند.
// اسکریپت SQL لازم جداگانه ارائه می‌شود.
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'
import { useRealtime } from './useRealtime'

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

  // ✅ FIX: subscription realtime برای جدول boms — با
  // manufacturingKeys.all، هم BOM ها و هم work orders پوشش داده
  // می‌شوند.
  useRealtime({ table: 'boms', queryKey: manufacturingKeys.all as unknown as string[] })

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

  // ✅ FIX: subscription realtime مستقل برای جدول work_orders —
  // جدا از boms چون جدول متفاوتی است، ولی هر دو همان
  // manufacturingKeys.all را invalidate می‌کنند.
  useRealtime({ table: 'work_orders', queryKey: manufacturingKeys.all as unknown as string[] })

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