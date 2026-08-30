// ============================================
// Offline conflict hooks — TanStack Query
//
// ---------------------------------------------------------------------------
// WHAT A CONFLICT IS HERE
//
// A write that happened on a device while it was offline, which the server
// refused because the record had moved on underneath it. Both versions are
// kept and NEITHER is applied until a person decides — that is the whole
// contract, and this screen is the only place the decision can be made.
//
// A conflict is therefore not a notification to dismiss. It is money that has
// not been recorded yet, sitting in a queue, and every day it waits is a day
// the books are wrong in a way nobody can see from the books.
//
// `resolve` is never retried. It rewrites a financial record on the strength
// of somebody's judgement; a silent second attempt after a lost response is
// the last thing that should happen to it.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'

// ═══ Types ═══

export type ConflictEntity =
  'invoice' | 'payment' | 'journal_entry' | 'customer' | 'product' | 'transaction'

export type ResolutionChoice = 'keep_server' | 'keep_client' | 'merge'

export interface FieldDivergence {
  field: string
  serverValue: unknown
  clientValue: unknown
  /**
   * Money, quantity, or the identity of what was traded.
   *
   * The one flag that decides whether a person must look at this. It is
   * computed from an explicit per-entity list on the server, never guessed
   * from the field name.
   */
  financial: boolean
}

export interface Conflict {
  id: string
  entityType: ConflictEntity
  entityId: string
  mutationId: string
  operation: string
  serverVersion: number | null
  serverRow: Record<string, unknown>
  clientVersion: number | null
  clientPayload: Record<string, unknown>
  divergences: FieldDivergence[]
  hasFinancialDivergence: boolean
  status: 'open' | 'resolved' | 'superseded'
  resolution: string | null
  resolutionReason: string | null
  resolvedBy: string | null
  resolvedAt: string | null
  createdAt: string
}

export interface ResolveConflictInput {
  conflictId: string
  choice: ResolutionChoice
  /** Required for `merge`: which side each diverging field takes. */
  fieldChoices?: Record<string, 'server' | 'client'>
  /** Never optional. A financial correction with no reason is unauditable. */
  reason: string
}

export const conflictKeys = {
  all: ['conflicts'] as const,
  list: (status: string) => [...conflictKeys.all, 'list', status] as const,
  detail: (id: string) => [...conflictKeys.all, 'detail', id] as const,
}

// ═══ Queries ═══

export function useConflicts(status: 'open' | 'resolved' | 'all' = 'open') {
  const ready = useAuthReady()

  return useQuery({
    queryKey: conflictKeys.list(status),
    queryFn: async () => {
      const { data } = await apiClient.get('/conflicts', { params: { status } })
      return data as Conflict[]
    },
    enabled: ready,
    // Short, and refetched on focus: a conflict can arrive the moment another
    // device syncs, and a queue that looks empty when it is not is the one
    // state this screen must never show.
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  })
}

export function useConflict(conflictId: string) {
  const ready = useAuthReady()

  return useQuery({
    queryKey: conflictKeys.detail(conflictId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/conflicts/${conflictId}`)
      return data as Conflict
    },
    enabled: ready && Boolean(conflictId),
    staleTime: 0,
  })
}

/** Open conflicts only — what the sidebar badge counts. */
export function useOpenConflictCount() {
  const conflicts = useConflicts('open')
  return conflicts.data?.length ?? 0
}

// ═══ Mutations ═══

export function useResolveConflict() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ conflictId, ...body }: ResolveConflictInput) => {
      const { data } = await apiClient.post(`/conflicts/${conflictId}/resolve`, body)
      return data
    },
    retry: false,
    onSuccess: () => {
      // Everything, not just this conflict: resolving one writes the record it
      // is about, so invoices, payments and stock may all have moved.
      queryClient.invalidateQueries({ queryKey: conflictKeys.all })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}
