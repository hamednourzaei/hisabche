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
import { asList } from '../lib/as-list'

// ═══ Types ═══
export type TaskStatus = 'pending' | 'in_progress' | 'completed'

export interface InteractionCustomer {
  id: string
  name: string
  phone: string | null
}

export interface InteractionStatusEvent {
  status: TaskStatus
  changedAt: string
  changedBy?: string
}

/**
 * How one customer on a task turned out.
 *
 * A customer with no entry has not been attempted yet — that is not the same
 * as a recorded failure, and progress counts must keep them apart.
 */
export interface CustomerOutcome {
  customerId: string
  outcome: 'done' | 'failed'
  recordedAt: string
  recordedBy: 'owner' | 'employee'
  /** Always present on a failure — the schema rejects ❌ without a reason. */
  note?: string
}

export interface Interaction {
  id: string
  customerId: string
  type: string
  subject: string
  content: string
  interactionDate: string
  createdAt: string
  status: TaskStatus
  publicToken?: string | null
  employeeId?: string | null
  employeeName?: string | null
  customers?: InteractionCustomer[]
  statusHistory?: InteractionStatusEvent[]
  customerOutcomes?: CustomerOutcome[]
}

export interface Opportunity {
  id: string
  customerId: string
  title: string
  description: string
  stage: string
  value: number
  probability: number
  expectedCloseDate?: string
  createdAt: string
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
      return asList<Interaction>(data)
    },
    enabled: authReady,
    staleTime: 60_000,
  })
}

export interface CreateInteractionInput {
  customerId: string
  customerIds?: string[]
  type: string
  subject: string
  content?: string
  employeeId?: string
  employeeName?: string
}

export function useCreateInteraction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateInteractionInput) => {
      const { data } = await apiClient.post('/interactions', input)
      return data as Interaction
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.all })
    },
  })
}

// ✅ Owner-side authenticated status override — separate from the
// public-token path an assigned employee uses (see public task hooks).
export function useUpdateInteractionStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const { data } = await apiClient.patch(`/interactions/${id}/status`, { status })
      return data as Interaction
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.all })
    },
  })
}

export interface RecordCustomerOutcomeInput {
  customerId: string
  outcome: 'done' | 'failed'
  note?: string
}

/** Owner-side record of how one customer on a task went. */
export function useRecordCustomerOutcome() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: RecordCustomerOutcomeInput & { id: string }) => {
      const { data } = await apiClient.patch(`/interactions/${id}/customer-outcome`, input)
      return data as Interaction
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.all })
    },
  })
}

/**
 * Subjects this user has already used, newest first.
 *
 * Long-lived: the list only grows when a task is created, and a stale entry
 * costs nothing but a missing suggestion.
 */
export function useSubjectSuggestions() {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: [...crmKeys.all, 'subjects'] as const,
    queryFn: async () => {
      const { data } = await apiClient.get('/interactions/subjects')
      return asList<string>(data)
    },
    enabled: authReady,
    staleTime: 5 * 60 * 1000,
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
      return asList<Opportunity>(data)
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
