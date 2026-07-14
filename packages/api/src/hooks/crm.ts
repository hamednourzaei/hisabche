// ============================================
// CRM Hooks — TanStack Query (Fixed Paths)
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'

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
  return useQuery({
    queryKey: crmKeys.interactions(customerId),
    queryFn: async (): Promise<Interaction[]> => {
      // ✅ Fix: /api/interactions (نه /api/crm/interactions)
      const { data } = await apiClient.get('/interactions', {
        params: customerId ? { customerId } : {},
      })
      return data
    },
    staleTime: 60_000,
  })
}

export function useCreateInteraction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: any) => {
      // ✅ Fix
      const { data } = await apiClient.post('/interactions', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.all })
    },
  })
}

export function useOpportunities(customerId?: string) {
  return useQuery({
    queryKey: crmKeys.opportunities(customerId),
    queryFn: async (): Promise<Opportunity[]> => {
      // ✅ Fix: /api/opportunities (نه /api/crm/opportunities)
      const { data } = await apiClient.get('/opportunities', {
        params: customerId ? { customerId } : {},
      })
      return data
    },
    staleTime: 60_000,
  })
}

export function useCreateOpportunity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: any) => {
      // ✅ Fix
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
      // ✅ Fix
      const { data } = await apiClient.patch(`/opportunities/${id}`, input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.all })
    },
  })
}