// ============================================
// CRM Hooks — TanStack Query (Fixed Paths)
// FIXED: اضافه شدن Realtime روی جداول interactions و opportunities.
// پیش‌نیاز: هر دو جدول RLS فعال داشتند ولی هیچ policy ای نداشتند
// (deny by default) — قبل از اضافه شدن این realtime، policy های
// SELECT (user_id = auth.uid()) برای هر دو جدول در Supabase اضافه
// شد، وگرنه subscription بی‌صدا هیچ eventای دریافت نمی‌کرد.
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'
import { useRealtime } from './useRealtime'

// ═══ Types ═══
export interface Interaction {
  id: string; customerId: string; type: string; subject: string;
  content: string; interactionDate: string; createdAt: string;
}

export interface Opportunity {
  id: string; customerId: string; title: string; description: string;
  stage: string; value: number; probability: number;
  expectedCloseDate?: string; createdAt: string;
}

// ═══ Query Keys ═══
export const crmKeys = {
  all: ['crm'] as const,
  interactions: (customerId?: string) => [...crmKeys.all, 'interactions', customerId] as const,
  opportunities: (customerId?: string) => [...crmKeys.all, 'opportunities', customerId] as const,
}

// ═══ Hooks ═══
export function useInteractions(customerId?: string) {
  const authReady = useAuthReady()

  // ✅ FIX: subscription realtime برای جدول interactions — با
  // crmKeys.all، هم interactions هم opportunities (با هر customerId)
  // پوشش داده می‌شوند.
  useRealtime({ table: 'interactions', queryKey: crmKeys.all as unknown as string[] })

  return useQuery({
    queryKey: crmKeys.interactions(customerId),
    queryFn: async (): Promise<Interaction[]> => {
      // ✅ Fix: /api/interactions (نه /api/crm/interactions)
      const { data } = await apiClient.get('/interactions', {
        params: customerId ? { customerId } : {},
      })
      return data
    },
    enabled: authReady,
    staleTime: 60_000,
  })
}

export function useCreateInteraction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: any) => {
      const { data } = await apiClient.post('/interactions', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.all })
    },
  })
}

export function useOpportunities(customerId?: string) {
  const authReady = useAuthReady()

  // ✅ FIX: subscription realtime مستقل برای جدول opportunities —
  // جدا از interactions چون جدول متفاوتی است، ولی هر دو همان
  // crmKeys.all را invalidate می‌کنند.
  useRealtime({ table: 'opportunities', queryKey: crmKeys.all as unknown as string[] })

  return useQuery({
    queryKey: crmKeys.opportunities(customerId),
    queryFn: async (): Promise<Opportunity[]> => {
      // ✅ Fix: /api/opportunities (نه /api/crm/opportunities)
      const { data } = await apiClient.get('/opportunities', {
        params: customerId ? { customerId } : {},
      })
      return data
    },
    enabled: authReady,
    staleTime: 60_000,
  })
}

export function useCreateOpportunity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: any) => {
      const { data } = await apiClient.post('/opportunities', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.all })
    },
  })
}

export function useUpdateOpportunity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: any) => {
      const { data } = await apiClient.patch(`/opportunities/${id}`, input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.all })
    },
  })
}