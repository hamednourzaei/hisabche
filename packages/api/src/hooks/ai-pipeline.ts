// ============================================
// packages/api/src/hooks/ai-pipeline.ts
//
// Asking the assistant to DO something (`ai_pipeline_v2`).
//
// A request in words becomes a RUN. The server understands it, asks for what is
// missing, and answers with a proposal — a diff. The proposal waits in THE
// approval queue (hooks/ai-requests.ts): approving and rejecting are that
// queue's, not this file's. Nothing is written until a person approves, and what is written goes through the same route the screens
// use. The shapes here are the server's (`RunView` in pipeline.service.ts).
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { aiKeys, type AiQuotaExceeded } from './ai-chat'
import { useAuthReady } from './useAuthReady'

export type AiPipelineOperation =
  'create_invoice' | 'register_payment' | 'create_customer' | 'update_customer'

export type AiPipelineStatus =
  | 'understanding'
  | 'needs_input'
  | 'proposed'
  | 'approved'
  | 'executed'
  | 'failed'
  | 'needs_review'
  | 'rejected'
  | 'refused'

export interface AiPipelineQuestion {
  id: string
  field:
    | 'customer'
    | 'items'
    | 'product'
    | 'quantity'
    | 'unitPrice'
    | 'amount'
    | 'invoice'
    | 'fullName'
    | 'changes'
  kind: 'choice' | 'text' | 'number'
  reason: 'missing' | 'not_found' | 'ambiguous'
  subject?: string
  options?: Array<{ value: string; label: string; hint?: string }>
}

export interface AiPipelineChange {
  entity: 'invoice' | 'invoice_line' | 'payment' | 'customer'
  field: string
  from: unknown
  to: unknown
}

export interface AiPipelineWarning {
  code: string
  detail?: Record<string, string | number>
}

export interface AiPipelineProposal {
  operation: AiPipelineOperation
  action: 'create' | 'update'
  entity: 'invoice' | 'payment' | 'customer'
  subject: string | null
  changes: AiPipelineChange[]
  warnings: AiPipelineWarning[]
  exactMatches: boolean
}

export interface AiPipelineStep {
  id: string
  stage: string
  outcome: 'ok' | 'stopped' | 'failed'
  actorId: string | null
  detail: Record<string, unknown>
  createdAt: string
}

export interface AiPipelineRun {
  id: string
  requestText: string
  dryRun: boolean
  operation: AiPipelineOperation | null
  status: AiPipelineStatus
  questions: AiPipelineQuestion[]
  proposal: AiPipelineProposal | null
  reasonCode: string | null
  requestedBy: string
  approvedBy: string | null
  approvedAt: string | null
  autoApproved: boolean
  resultStatus: number | null
  result: {
    number?: string | null
    code?: string
    mismatches?: Array<{ field: string; expected: unknown; actual: unknown }>
  } | null
  entityType: 'invoice' | 'payment' | 'customer' | null
  entityId: string | null
  createdAt: string
  /** Its row in the approval queue — what approve and reject are called with. */
  requestId: string | null
  /** Whether the signed-in person may approve it. The server decides again on approval. */
  canApprove: boolean
  /** The requester may not run it themselves: a manager or owner must approve. */
  needsApprover: boolean
  steps: AiPipelineStep[]
}

export interface AiPipelineSettings {
  enabled: boolean
  autoApproveNonFinancial: boolean
  /** False until the database migration has been run. */
  available: boolean
  /** Whether the signed-in person may change these (the owner). */
  canManage: boolean
  /** Whether the approval queue is theirs to read (a manager or the owner). */
  canDecide: boolean
}

export const aiPipelineKeys = {
  all: ['ai-pipeline'] as const,
  settings: () => [...aiPipelineKeys.all, 'settings'] as const,
}

export function useAiPipelineSettings() {
  const ready = useAuthReady()
  return useQuery({
    queryKey: aiPipelineKeys.settings(),
    queryFn: async (): Promise<AiPipelineSettings> => {
      const { data } = await apiClient.get<AiPipelineSettings>('/ai/pipeline/settings')
      return data
    },
    enabled: ready,
    staleTime: 60 * 1000,
  })
}

export function useSaveAiPipelineSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      enabled: boolean
      autoApproveNonFinancial: boolean
    }): Promise<AiPipelineSettings> => {
      const { data } = await apiClient.put<AiPipelineSettings>('/ai/pipeline/settings', input)
      return data
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(aiPipelineKeys.settings(), settings)
    },
  })
}

/** The run a response carries. */
const runOf = (data: unknown): AiPipelineRun => (data as { run: AiPipelineRun }).run

/**
 * A run that wrote something changed invoices, balances, stock and the
 * dashboard at once — every cached figure is stale, so everything is refetched
 * rather than a list of keys being guessed.
 */
const WROTE: readonly AiPipelineStatus[] = ['executed', 'needs_review']

function useRunMutation<Input>(send: (input: Input) => Promise<AiPipelineRun>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: send,
    onSuccess: (run) => {
      // A clean non-financial change may have run by rule, right here.
      if (WROTE.includes(run.status)) void queryClient.invalidateQueries()
    },
    onSettled: () => {
      // A run spends one unit of the monthly allowance.
      void queryClient.invalidateQueries({ queryKey: aiKeys.availability() })
    },
  })
}

/**
 * Start a run. A 429 is a result, not a failure to swallow: the server sends
 * the top-up contact with it, readable off `error.quotaExceeded`.
 */
export function useStartAiPipelineRun() {
  return useRunMutation(async (input: { request: string; dryRun: boolean }) => {
    try {
      const { data } = await apiClient.post('/ai/pipeline/runs', input)
      return runOf(data)
    } catch (err) {
      const response = (err as { response?: { status?: number; data?: unknown } }).response
      if (response?.status === 429) {
        const wrapped = new Error('AI_QUOTA_EXCEEDED') as Error & {
          quotaExceeded: AiQuotaExceeded
        }
        wrapped.quotaExceeded = response.data as AiQuotaExceeded
        throw wrapped
      }
      throw err
    }
  })
}

export function useAnswerAiPipelineRun() {
  return useRunMutation(
    async (input: { runId: string; answers: Record<string, string | number> }) => {
      const { data } = await apiClient.post(`/ai/pipeline/runs/${input.runId}/answers`, {
        answers: input.answers,
      })
      return runOf(data)
    },
  )
}

/** Give up a run that is still asking questions. Nothing was proposed yet. */
export function useCancelAiPipelineRun() {
  return useRunMutation(async (runId: string) => {
    const { data } = await apiClient.post(`/ai/pipeline/runs/${runId}/cancel`)
    return runOf(data)
  })
}
