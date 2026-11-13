'use client'

// ============================================
// apps/admin/hooks/use-admin-ai-admin.ts
//
// V63 · A — reads and writes for the AI tab's new sections.
//
// Endpoints (verified against backend/src/routes/admin-ai.routes.ts):
//
//   GET    /admin/ai/fallbacks                     { fallbacks }
//   PUT    /admin/ai/fallbacks                     { entries }
//   GET    /admin/ai/prices                        { prices }
//   PUT    /admin/ai/prices                        one price
//   DELETE /admin/ai/prices/:id
//   GET    /admin/ai/usage?range=24h|7d|30d|90d    { range, since, until, rows }
//   GET    /admin/ai/budgets                       { budgets }
//   PUT    /admin/ai/budgets                       the platform ceiling
//   PUT    /admin/ai/budgets/workspace/:workspaceId  one workspace's ceiling
//   DELETE /admin/ai/budgets/:id
//   GET    /admin/ai/prompts                       { versions }
//   GET    /admin/ai/audit                         { events }
//
// ⚠️ EVERY WRITE CARRIES `X-Admin-Step-Up-Timestamp`. The server refuses a
// write without a TOTP check from the last five minutes, so the caller must
// open `StepUpDialog` first and pass the timestamp it returns.
//
// ⚠️ `costMicros` / `spentMicros` ARE `null` WHEN UNKNOWN — an unpriced model
// or a question whose tokens the provider did not report. The UI must render
// «—», never zero.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, asList } from '@hisabche/api'

export type AiProviderName = 'anthropic' | 'openai'
export type AiUsageRangeName = '24h' | '7d' | '30d' | '90d'

export interface AiFallbackItem {
  id: string
  position: number
  provider: AiProviderName
  model: string
  baseUrl: string | null
  timeoutMs: number
  isEnabled: boolean
  updatedAt: string
}

export interface AiFallbackDraft {
  position: number
  provider: AiProviderName
  model: string
  baseUrl: string | null
  timeoutMs: number
  isEnabled: boolean
}

export interface AiPriceItem {
  id: string
  provider: AiProviderName
  model: string
  currency: string
  inputMicrosPerMillion: number
  outputMicrosPerMillion: number
  updatedAt: string
}

export interface AiUsageRowItem {
  day: string
  provider: string
  model: string
  queries: number
  promptTokens: number | null
  completionTokens: number | null
  currency: string | null
  costMicros: number | null
  unpricedQueries: number
}

export interface AiBudgetItem {
  id: string
  scope: 'platform' | 'workspace'
  workspaceId: string | null
  currency: string
  monthlyLimitMicros: number
  alertPercent: number
  updatedAt: string
  spentMicros: number | null
  percentUsed: number | null
  unpricedQueries: number
}

export interface AiPromptVersionItem {
  version: number
  content: string
  createdBy: string | null
  createdAt: string
}

export interface AiAuditItem {
  id: string
  eventType: string
  adminEmail: string | null
  ipAddress: string | null
  userAgent: string | null
  details: Record<string, unknown>
  createdAt: string
}

const KEYS = {
  all: ['admin', 'ai', 'admin'] as const,
  fallbacks: () => [...KEYS.all, 'fallbacks'] as const,
  prices: () => [...KEYS.all, 'prices'] as const,
  usage: (range: AiUsageRangeName) => [...KEYS.all, 'usage', range] as const,
  budgets: () => [...KEYS.all, 'budgets'] as const,
  prompts: () => [...KEYS.all, 'prompts'] as const,
  audit: () => [...KEYS.all, 'audit'] as const,
}

const stepUp = (stepUpTimestamp: string) => ({
  headers: { 'X-Admin-Step-Up-Timestamp': stepUpTimestamp },
})

export function useAdminAiFallbacks() {
  return useQuery<AiFallbackItem[]>({
    queryKey: KEYS.fallbacks(),
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/ai/fallbacks')
      return asList<AiFallbackItem>(
        (data as { fallbacks?: unknown }).fallbacks,
        '/admin/ai/fallbacks',
      )
    },
    staleTime: 30_000,
  })
}

export function useSaveAdminAiFallbacks() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      entries: AiFallbackDraft[]
      stepUpTimestamp: string
    }): Promise<AiFallbackItem[]> => {
      const { data } = await apiClient.put(
        '/admin/ai/fallbacks',
        { entries: input.entries },
        stepUp(input.stepUpTimestamp),
      )
      return asList<AiFallbackItem>(
        (data as { fallbacks?: unknown }).fallbacks,
        '/admin/ai/fallbacks',
      )
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEYS.all })
    },
  })
}

export function useAdminAiPrices() {
  return useQuery<AiPriceItem[]>({
    queryKey: KEYS.prices(),
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/ai/prices')
      return asList<AiPriceItem>((data as { prices?: unknown }).prices, '/admin/ai/prices')
    },
    staleTime: 30_000,
  })
}

export function useSaveAdminAiPrice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      provider: AiProviderName
      model: string
      currency: string
      inputMicrosPerMillion: number
      outputMicrosPerMillion: number
      stepUpTimestamp: string
    }) => {
      const { stepUpTimestamp, ...body } = input
      const { data } = await apiClient.put('/admin/ai/prices', body, stepUp(stepUpTimestamp))
      return asList<AiPriceItem>((data as { prices?: unknown }).prices, '/admin/ai/prices')
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEYS.all })
    },
  })
}

export function useDeleteAdminAiPrice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; stepUpTimestamp: string }) => {
      await apiClient.delete(`/admin/ai/prices/${input.id}`, stepUp(input.stepUpTimestamp))
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEYS.all })
    },
  })
}

export function useAdminAiUsage(range: AiUsageRangeName) {
  return useQuery<AiUsageRowItem[]>({
    queryKey: KEYS.usage(range),
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/ai/usage', { params: { range } })
      return asList<AiUsageRowItem>((data as { rows?: unknown }).rows, '/admin/ai/usage')
    },
    staleTime: 60_000,
  })
}

export function useAdminAiBudgets() {
  return useQuery<AiBudgetItem[]>({
    queryKey: KEYS.budgets(),
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/ai/budgets')
      return asList<AiBudgetItem>((data as { budgets?: unknown }).budgets, '/admin/ai/budgets')
    },
    staleTime: 30_000,
  })
}

export function useSaveAdminAiBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      scope: 'platform' | 'workspace'
      workspaceId?: string | undefined
      currency: string
      monthlyLimitMicros: number
      alertPercent: number
      stepUpTimestamp: string
    }) => {
      const body = {
        currency: input.currency,
        monthlyLimitMicros: input.monthlyLimitMicros,
        alertPercent: input.alertPercent,
      }
      // The workspace is in the URL — a workspace id in a body is the shape the
      // constitution guard forbids, and every other admin route does it this way.
      const url =
        input.scope === 'workspace'
          ? `/admin/ai/budgets/workspace/${input.workspaceId}`
          : '/admin/ai/budgets'
      const { data } = await apiClient.put(url, body, stepUp(input.stepUpTimestamp))
      return asList<AiBudgetItem>((data as { budgets?: unknown }).budgets, '/admin/ai/budgets')
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEYS.all })
    },
  })
}

export function useDeleteAdminAiBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; stepUpTimestamp: string }) => {
      await apiClient.delete(`/admin/ai/budgets/${input.id}`, stepUp(input.stepUpTimestamp))
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEYS.all })
    },
  })
}

export function useAdminAiPrompts() {
  return useQuery<AiPromptVersionItem[]>({
    queryKey: KEYS.prompts(),
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/ai/prompts')
      return asList<AiPromptVersionItem>(
        (data as { versions?: unknown }).versions,
        '/admin/ai/prompts',
      )
    },
    staleTime: 60_000,
  })
}

export function useAdminAiAudit() {
  return useQuery<AiAuditItem[]>({
    queryKey: KEYS.audit(),
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/ai/audit')
      return asList<AiAuditItem>((data as { events?: unknown }).events, '/admin/ai/audit')
    },
    staleTime: 60_000,
  })
}
