// ============================================
// Capability #81 — what undoing an action will do, asked before it is done.
//
//   GET /compensation?route=<METHOD /path>
//
// `plan: null` means the server does not know what undoing that command does —
// and `warn` is then true: an unknown effect is itself the thing to say.
// ============================================

import { useQuery } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'

export type CompensationKind =
  | 'invoice_create'
  | 'invoice_cancel'
  | 'payment_record'
  | 'payment_cancel'
  | 'purchase_order_create'
  | 'stock_adjust'
  | 'budget_commit'

export interface CompensationAnswer {
  route: string
  plan: {
    kind: CompensationKind
    strategy: 'reverse' | 'void' | 'release' | 'none'
    /** Undoing writes its own entry in the books. */
    touchesBooks: boolean
    /** It cannot be undone automatically. */
    needsHuman: boolean
  } | null
  warn: boolean
}

export function useCompensationPlan(route: string, options: { enabled?: boolean } = {}) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: ['compensation', route] as const,
    queryFn: async (): Promise<CompensationAnswer> => {
      const { data } = await apiClient.get<CompensationAnswer>('/compensation', {
        params: { route },
      })
      return data
    },
    enabled: authReady && options.enabled !== false,
    // What a command does is fixed for a release of the product.
    staleTime: 60 * 60_000,
  })
}
