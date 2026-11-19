// ============================================
// packages/api/src/hooks/fx-trade-drafts.ts
//
// WP-07 — OFFLINE FX TRADE DRAFTS.
//
// Device-only routes go through localRequest, never apiClient: there is no
// server route for a draft, and the route-contract guards require that an
// apiClient hook name a real server endpoint. A draft moves no money; the
// server /api/exchange/trades still owns confirmation and accounting.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { asList } from '../lib/as-list'
import { getActiveWorkspaceId } from '../lib/active-workspace'
import { localRequest } from '../lib/client'

export interface FxTradeDraftRow {
  id: string
  trade_number: string | null
  side: 'buy' | 'sell'
  currency: string
  amount_minor: number
  rate: string
  book_currency: string
  book_amount_minor: number
  customer_id: string | null
  note: string | null
  status: 'quoted' | 'pending' | 'cancelled' | 'settled'
  needs_review: number
  client_request_id: string | null
  submitted_at: string | null
  created_at: string
  updated_at: string
}

export const fxDraftKeys = {
  all: ['fx', 'trade-drafts'] as const,
  list: (workspaceId: string) => [...fxDraftKeys.all, workspaceId, 'list'] as const,
  detail: (workspaceId: string, id: string) => [...fxDraftKeys.all, workspaceId, id] as const,
}

const ws = () => getActiveWorkspaceId() ?? ''

export function useFxTradeDrafts() {
  return useQuery({
    queryKey: fxDraftKeys.list(ws()),
    queryFn: async () =>
      asList<FxTradeDraftRow>(
        (await localRequest<{ data?: unknown }>('GET', '/local-fx/trade-drafts'))?.data,
        '/local-fx/trade-drafts',
      ),
  })
}

export function useFxTradeDraft(id: string | null) {
  return useQuery({
    queryKey: fxDraftKeys.detail(ws(), id ?? ''),
    queryFn: async () =>
      (await localRequest<FxTradeDraftRow>('GET', `/local-fx/trade-drafts/${id}`))!,
    enabled: Boolean(id),
  })
}

export function useCreateFxTradeDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) =>
      (await localRequest<FxTradeDraftRow>('POST', '/local-fx/trade-drafts', input))!,
    onSuccess: () => qc.invalidateQueries({ queryKey: fxDraftKeys.all }),
  })
}

export function useSubmitFxTradeDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      (await localRequest<FxTradeDraftRow>('POST', `/local-fx/trade-drafts/${id}/submit`, {}))!,
    onSuccess: () => qc.invalidateQueries({ queryKey: fxDraftKeys.all }),
  })
}

export function useCancelFxTradeDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      (await localRequest<FxTradeDraftRow>('POST', `/local-fx/trade-drafts/${id}/cancel`, {}))!,
    onSuccess: () => qc.invalidateQueries({ queryKey: fxDraftKeys.all }),
  })
}
