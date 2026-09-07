// ============================================
// packages/api/src/hooks/ai-chat.ts
//
// T13 — asking the assistant a question.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'

export interface AiQuota {
  limit: number
  used: number
  remaining: number
  source: 'override' | 'plan'
  plan: string
}

export interface AiAvailability {
  quota: AiQuota
  /** False when no provider is configured — the button should not appear. */
  isConfigured: boolean
  /** Where to ask for more questions once the allowance is gone. */
  topupContact: string
}

export interface AiAnswer {
  answer: string
  /** Which reporting views the figures came from. */
  usedViews: string[]
  quota: AiQuota
}

/** The server refused because the account is out of questions this month. */
export interface AiQuotaExceeded {
  code: 'AI_QUOTA_EXCEEDED'
  topupContact: string
  quota: AiQuota
}

export const aiKeys = {
  all: ['ai'] as const,
  availability: () => [...aiKeys.all, 'availability'] as const,
}

export function useAiAvailability() {
  const ready = useAuthReady()

  return useQuery({
    queryKey: aiKeys.availability(),
    queryFn: async (): Promise<AiAvailability> => {
      const { data } = await apiClient.get('/ai/quota')
      return data as AiAvailability
    },
    enabled: ready,
    staleTime: 60 * 1000,
  })
}

/**
 * Ask a question.
 *
 * ⚠️ A 429 is a RESULT, not a failure to swallow. The server answers it with
 * the top-up contact attached, because that is the one thing the person needs
 * next; the caller can read it off `error.quotaExceeded`.
 */
export function useAskAi() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (question: string): Promise<AiAnswer> => {
      try {
        const { data } = await apiClient.post('/ai/ask', { question })
        return data as AiAnswer
      } catch (err) {
        const response = (err as { response?: { status?: number; data?: unknown } }).response
        if (response?.status === 429) {
          const payload = response.data as AiQuotaExceeded
          const wrapped = new Error('AI_QUOTA_EXCEEDED') as Error & {
            quotaExceeded: AiQuotaExceeded
          }
          wrapped.quotaExceeded = payload
          throw wrapped
        }
        throw err
      }
    },
    onSettled: () => {
      // The allowance moved whether the question succeeded or was refused.
      queryClient.invalidateQueries({ queryKey: aiKeys.availability() })
    },
  })
}

// ─── Platform admin ───────────────────────────────────────────────────

export interface AiConfigStatus {
  provider: 'anthropic' | 'openai'
  baseUrl: string | null
  model: string
  systemPrompt: string
  topupContact: string
  isEnabled: boolean
  /**
   * ⚠️ Whether a key is stored — never the key, never part of it. The server
   * has no endpoint that returns it, deliberately.
   */
  hasApiKey: boolean
  updatedAt: string | null
}

export function useAiConfig() {
  const ready = useAuthReady()

  return useQuery({
    queryKey: [...aiKeys.all, 'config'],
    queryFn: async (): Promise<AiConfigStatus | null> => {
      const { data } = await apiClient.get('/ai/config')
      return (data as AiConfigStatus) ?? null
    },
    enabled: ready,
  })
}

export function useSaveAiConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      provider: 'anthropic' | 'openai'
      baseUrl?: string | null
      model: string
      /** Omit to keep the stored key. Sending '' would erase it. */
      apiKey?: string
      systemPrompt: string
      topupContact: string
      isEnabled: boolean
    }) => {
      const { data } = await apiClient.put('/ai/config', input)
      return data as AiConfigStatus
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiKeys.all })
    },
  })
}

export function useSetAiQuota() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      workspaceId,
      monthlyLimit,
      note,
    }: {
      workspaceId: string
      /** Null returns the workspace to its plan allowance. 0 means «none». */
      monthlyLimit: number | null
      note?: string
    }) => {
      // The workspace is a URL segment, not a body field — Law 8 bans a
      // client-supplied workspace in a body, and the admin surface already
      // takes it as a param everywhere else.
      const { data } = await apiClient.put(`/ai/quota/${workspaceId}`, {
        monthlyLimit,
        note: note ?? '',
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiKeys.all })
    },
  })
}
