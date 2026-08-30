// ============================================
// Till (POS) hooks — TanStack Query
//
// ---------------------------------------------------------------------------
// THE ONE THING A TILL SCREEN MUST GET RIGHT
//
// `orderRef` is generated ONCE, on the device, before the request leaves — and
// re-sent unchanged on every retry. The server keys the sale on it, so a
// dropped response produces the same order back rather than a second sale.
//
// That means the ref must NOT be generated inside the mutation function:
// TanStack retries by calling it again, and a fresh ref on each attempt is
// exactly the double-sale this is meant to prevent. The caller makes the ref
// when the cashier hits "take payment" and passes it in.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'

// ═══ Types ═══

export type PosPaymentMethod = 'cash' | 'card' | 'transfer' | 'credit' | 'other'

export interface PosSession {
  id: string
  status: 'open' | 'closing' | 'closed' | 'force_closed'
  /** Minor units. Every money figure on this screen is an integer. */
  openingFloatMinor: number
  openedAt: string
  openedBy: string
  countedCashMinor: number | null
}

export interface SessionTotals {
  orderCount: number
  voidedCount: number
  grossSalesMinor: number
  byMethod: Record<PosPaymentMethod, number>
  /** What the drawer SHOULD hold. Derived by the server, never stored. */
  expectedCashMinor: number
  countedCashMinor: number | null
  /** counted − expected. Null until somebody has counted. */
  varianceMinor: number | null
}

export interface AbandonedSession {
  sessionId: string
  openedBy: string
  openedAt: string
  hoursOpen: number
  expectedCashMinor: number
  orderCount: number
}

export interface RecordOrderInput {
  sessionId: string
  /** Made by the CALLER, once, and reused on every retry. */
  orderRef: string
  totalMinor: number
  changeMinor: number
  payments: Array<{ method: PosPaymentMethod; amountMinor: number }>
  invoiceId?: string | null
}

export const tillKeys = {
  all: ['till'] as const,
  current: () => [...tillKeys.all, 'current'] as const,
  session: (id: string) => [...tillKeys.all, 'session', id] as const,
  abandoned: () => [...tillKeys.all, 'abandoned'] as const,
}

// ═══ Queries ═══

/** The caller's own open drawer, with its running totals. */
export function useCurrentSession() {
  const ready = useAuthReady()

  return useQuery({
    queryKey: tillKeys.current(),
    queryFn: async () => {
      const { data } = await apiClient.get('/pos/sessions/current')
      return data as { session: PosSession | null; totals?: SessionTotals }
    },
    enabled: ready,
    // A till is looked at constantly and its totals change with every sale.
    // Short and refetched on focus, rather than realtime: a cashier's own
    // device already knows what it just sold.
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  })
}

export function useSession(sessionId: string) {
  const ready = useAuthReady()

  return useQuery({
    queryKey: tillKeys.session(sessionId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/pos/sessions/${sessionId}`)
      return data as { session: PosSession; totals: SessionTotals }
    },
    enabled: ready && Boolean(sessionId),
  })
}

/**
 * Drawers open far longer than a shift.
 *
 * A supervisor's view: the money is in a till nobody can reach, and somebody
 * has to decide what happened to it.
 */
export function useAbandonedSessions(hours = 24) {
  const ready = useAuthReady()

  return useQuery({
    queryKey: [...tillKeys.abandoned(), hours],
    queryFn: async () => {
      const { data } = await apiClient.get('/pos/sessions/abandoned', { params: { hours } })
      return data as AbandonedSession[]
    },
    enabled: ready,
    staleTime: 60_000,
  })
}

// ═══ Mutations ═══

export function useOpenSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { openingFloatMinor: number; branchId?: string | null }) => {
      const { data } = await apiClient.post('/pos/sessions', input)
      return data as PosSession
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tillKeys.all })
    },
  })
}

/**
 * Take a sale.
 *
 * `retry` is deliberately ON. It is safe precisely because `orderRef` comes
 * from the caller and does not change between attempts — the server returns
 * the order it already has. Without that guarantee, retrying a payment would
 * be the worst possible default.
 */
export function useRecordOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sessionId, ...body }: RecordOrderInput) => {
      const { data } = await apiClient.post(`/pos/sessions/${sessionId}/orders`, body)
      return data
    },
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tillKeys.session(variables.sessionId) })
      queryClient.invalidateQueries({ queryKey: tillKeys.current() })
    },
  })
}

export function useRecordCashMovement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      sessionId,
      ...body
    }: {
      sessionId: string
      kind: 'cash_in' | 'cash_out'
      amountMinor: number
      /** Never optional: cash out of a drawer with no reason is a hole. */
      reason: string
    }) => {
      const { data } = await apiClient.post(`/pos/sessions/${sessionId}/cash`, body)
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tillKeys.session(variables.sessionId) })
      queryClient.invalidateQueries({ queryKey: tillKeys.current() })
    },
  })
}

/**
 * Count the drawer and close.
 *
 * NOT retried. The close posts the day to the ledger, and while the server
 * makes that idempotent, a silent retry would hide a genuine failure from the
 * person standing at the till — who is the one who can still count again.
 */
export function useCloseSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      sessionId,
      ...body
    }: {
      sessionId: string
      countedCashMinor: number
      varianceReason?: string
      force?: boolean
    }) => {
      const { data } = await apiClient.post(`/pos/sessions/${sessionId}/close`, body)
      return data as { session: PosSession; totals: SessionTotals; posted: boolean }
    },
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tillKeys.all })
    },
  })
}

export function useVoidOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data } = await apiClient.post(`/pos/orders/${orderId}/void`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tillKeys.all })
    },
  })
}
