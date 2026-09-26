'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@hisabche/api'

/**
 * Platform AI configuration.
 *
 * Endpoints (verified against backend/src/routes/ai-chat.routes.ts — not
 * assumed):
 *
 *   GET /ai/config              -> AiConfigStatus | null
 *   PUT /ai/config              { provider, baseUrl?, model, apiKey?, … }
 *   PUT /ai/quota/:workspaceId  { monthlyLimit, note }
 *
 * All three are behind `platformAdminGuard`. A workspace `owner` cannot reach
 * them: the API key bills the product owner, not the shop.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ THE KEY IS NEVER READ BACK
 *
 * `GET /ai/config` returns `hasApiKey: boolean`. There is no endpoint that
 * returns the key, masked or otherwise, and there must not be — a masked key
 * is still part of a secret plus proof the rest exists.
 *
 * The consequence for this UI: the key field is always empty on load, and
 * SUBMITTING IT EMPTY MUST NOT ERASE THE STORED KEY. The server omits the
 * field when it is blank; the form below relies on that.
 */

export interface AiConfigStatus {
  provider: 'anthropic' | 'openai'
  baseUrl: string | null
  model: string
  systemPrompt: string
  topupContact: string
  isEnabled: boolean
  /** Whether a key is stored. Not the key. */
  hasApiKey: boolean
  updatedAt: string | null
}

export interface SaveAiConfigInput {
  provider: 'anthropic' | 'openai'
  baseUrl?: string | null
  model: string
  /** Omit or leave blank to keep the stored key. */
  apiKey?: string
  systemPrompt: string
  topupContact: string
  isEnabled: boolean
}

export const adminAiKeys = {
  all: ['admin', 'ai'] as const,
  config: () => [...adminAiKeys.all, 'config'] as const,
}

export function useAdminAiConfig() {
  return useQuery({
    queryKey: adminAiKeys.config(),
    queryFn: async (): Promise<AiConfigStatus | null> => {
      const { data } = await apiClient.get('/ai/config')
      return (data as AiConfigStatus) ?? null
    },
  })
}

export function useSaveAdminAiConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SaveAiConfigInput) => {
      // The blank key is stripped HERE as well as on the server. Belt and
      // braces on the one field whose accidental erasure takes the feature
      // down for every customer at once.
      const body: Record<string, unknown> = { ...input }
      if (!input.apiKey || !input.apiKey.trim()) delete body.apiKey

      const { data } = await apiClient.put('/ai/config', body)
      return data as AiConfigStatus
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminAiKeys.all })
    },
  })
}

export function useSetWorkspaceAiQuota() {
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
      // Workspace in the URL, not the body — Law 8, and the convention every
      // other admin route already follows.
      const { data } = await apiClient.put(`/ai/quota/${workspaceId}`, {
        monthlyLimit,
        note: note ?? '',
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminAiKeys.all })
    },
  })
}

export interface TestAiConfigInput {
  provider: 'anthropic' | 'openai'
  baseUrl?: string | null
  model: string
  /** Omit or leave blank to test with the stored key. */
  apiKey?: string
}

export interface AiTestResult {
  ok: boolean
  /** The provider's HTTP status; null when it could not be reached. */
  status: number | null
  latencyMs: number
  /** Success: the start of the model's reply. Failure: the provider's own message. */
  detail: string
}

/**
 * `POST /ai/config/test` — one tiny real call with the form's values. Saves
 * nothing, so it can be run before «save» and before enabling.
 */
export function useTestAdminAiConfig() {
  return useMutation({
    mutationFn: async (input: TestAiConfigInput): Promise<AiTestResult> => {
      const body: Record<string, unknown> = { ...input }
      if (!input.apiKey || !input.apiKey.trim()) delete body.apiKey
      const { data } = await apiClient.post('/ai/config/test', body)
      return data as AiTestResult
    },
  })
}
