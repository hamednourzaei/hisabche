// ============================================
// Standing arrangements — recurring invoices (capability #63).
//
//   GET    /automations                     the workspace's arrangements
//   POST   /automations/recurring-invoice   define one from an invoice body
//   PATCH  /automations/:id                 rename, re-time, pause, resume
//   DELETE /automations/:id                 remove (history and invoices stay)
//   GET    /automations/:id/runs            every slot: ran / skipped / failed
//   POST   /automations/:id/run             issue today's now
//
// ⚠️ ONLINE ONLY. Defining or running an arrangement is not queued offline: the
// invoice it issues is created on the server, by the server's clock.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AutomationCadence,
  CreateRecurringInvoice,
  UpdateAutomation,
} from '@hisabche/validation'

import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'
import { dashboardKeys } from './dashboard'
import { invoiceKeys } from './invoices'
import { paymentKeys } from './payments'
import { warehouseKeys } from './warehouses'

export interface Automation {
  id: string
  name: string
  actionType: string
  cadence: AutomationCadence
  enabled: boolean
  /** Why it is off when the failure policy — not a person — switched it off. */
  disabledReason: string | null
  onFailure: 'stop' | 'keep' | 'ignore'
  attempts: number
  maxAttempts: number
  lastRunAt: string | null
  /** The next day it is due; null = never again (paused, or a one-off already past). */
  nextRunOn: string | null
  summary: {
    type: string | null
    total: number | null
    currency: string | null
    customerId: string | null
  }
  /** For a month-end arrangement: what it was told. Null for anything else. */
  monthEnd: { fiscalYearEndMonth: number; lock: boolean } | null
  createdAt: string
}

export interface AutomationRun {
  id: string
  /** The calendar day the run is FOR. */
  slot: string
  outcome: 'ran' | 'skipped' | 'failed'
  /** A code or a short reason. */
  detail: string
  documentType: string | null
  documentId: string | null
  createdAt: string
}

export const automationKeys = {
  all: ['automations'] as const,
  list: () => [...automationKeys.all, 'list'] as const,
  runs: (id: string) => [...automationKeys.all, 'runs', id] as const,
}

export function useAutomations(options: { enabled?: boolean } = {}) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: automationKeys.list(),
    queryFn: async (): Promise<Automation[]> => {
      const { data } = await apiClient.get<{ automations?: unknown }>('/automations')
      return asList<Automation>(data?.automations)
    },
    enabled: authReady && options.enabled !== false,
    staleTime: 60_000,
  })
}

export function useCreateRecurringInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateRecurringInvoice): Promise<Automation> => {
      const { data } = await apiClient.post<Automation>('/automations/recurring-invoice', input)
      return data
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: automationKeys.all }),
  })
}

export function useUpdateAutomation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string } & UpdateAutomation): Promise<Automation> => {
      const { id, ...patch } = input
      const { data } = await apiClient.patch<Automation>(`/automations/${id}`, patch)
      return data
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: automationKeys.all }),
  })
}

export function useRemoveAutomation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await apiClient.delete(`/automations/${id}`)
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: automationKeys.all }),
  })
}

export function useAutomationRuns(id: string | null) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: automationKeys.runs(id ?? ''),
    queryFn: async (): Promise<AutomationRun[]> => {
      const { data } = await apiClient.get<{ runs?: unknown }>(`/automations/${id}/runs`)
      return asList<AutomationRun>(data?.runs)
    },
    enabled: authReady && !!id,
    staleTime: 30_000,
  })
}

export function useRunAutomationNow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<{
        outcome: string
        reason?: string
        documentId?: string | null
      }>(`/automations/${id}/run`)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: automationKeys.all })
      // A run that issued an invoice changed everything an invoice changes.
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
      void queryClient.invalidateQueries({ queryKey: paymentKeys.all })
      void queryClient.invalidateQueries({ queryKey: warehouseKeys.all })
    },
  })
}

// ─── Month-end (capabilities #58 and #69) ───────────────────────────────────
//   POST /accounting/month-end      run the ordered close for one period, now
//   POST /automations/month-end     close each month automatically from now on

export type MonthEndStep =
  'depreciation' | 'fx_revaluation' | 'cost_repost' | 'year_end_close' | 'period_lock'

export interface MonthEndResult {
  fromDate: string
  toDate: string
  outcomes: Array<{
    step: MonthEndStep
    status: 'ok' | 'nothing_to_do' | 'failed'
    detail?: string
  }>
  /** Stated separately from «every step succeeded»: a run can finish unlocked. */
  locked: boolean
  failedAt?: MonthEndStep
}

export function useRunMonthEnd() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      fromDate: string
      toDate: string
      /** `MM-DD`; required by the route. */
      fiscalYearEnd: string
      closesYear: boolean
      lock: boolean
    }): Promise<MonthEndResult> => {
      const { data } = await apiClient.post<MonthEndResult>('/accounting/month-end', input)
      return { ...data, outcomes: asList<MonthEndResult['outcomes'][number]>(data?.outcomes) }
    },
    // A close posts entries and may seal the period: every statement is stale.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['accounting'] })
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}

export function useCreateMonthEndAutomation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      calendar: 'gregory' | 'persian'
      fiscalYearEndMonth: number
      lock: boolean
    }): Promise<Automation> => {
      const { data } = await apiClient.post<Automation>('/automations/month-end', input)
      return data
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: automationKeys.all }),
  })
}
