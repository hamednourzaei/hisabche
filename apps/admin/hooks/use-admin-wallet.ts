'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  apiClient,
  asList,
  type WalletBalance,
  type WalletMethodKind,
  type WalletPaymentMethod,
  type WalletTopup,
  type WalletTransaction,
} from '@hisabche/api'

/**
 * The platform's side of the business wallets.
 *
 * Endpoints (backend/src/routes/wallet.routes.ts, all behind platformAdminGuard):
 *
 *   GET   /admin/wallet/methods                       -> { methods }
 *   POST  /admin/wallet/methods                       { kind, currency, title, instructions, destination, isActive, sortOrder }
 *   PATCH /admin/wallet/methods/:id                   same body
 *   GET   /admin/wallet/topups?status=                -> { topups }  (oldest first)
 *   GET   /admin/wallet/topups/:id/receipt            -> { url }     (signed, five minutes)
 *   POST  /admin/wallet/topups/:id/approve            { creditedMinor?, note? }
 *   POST  /admin/wallet/topups/:id/reject             { note }       (required)
 *   GET   /admin/wallet/workspaces?q=                 -> { workspaces: [{ id, name, balances }] }
 *   GET   /admin/wallet/workspaces/:id/transactions   -> { transactions }
 *   POST  /admin/wallet/workspaces/:id/adjust         { currency, amountMinor (signed), note }
 *
 * Every money change is one Postgres function on the server; nothing here
 * computes a balance.
 */

export type TopupStatusFilter = WalletTopup['status'] | 'all'

export interface AdminWalletMethodInput {
  kind: WalletMethodKind
  currency: string
  title: string
  instructions: string
  destination: string
  isActive: boolean
  sortOrder: number
}

export interface AdminWalletWorkspace {
  id: string
  name: string
  balances: WalletBalance[]
}

export const adminWalletKeys = {
  all: ['admin', 'wallet'] as const,
  methods: () => [...adminWalletKeys.all, 'methods'] as const,
  topups: (status: TopupStatusFilter) => [...adminWalletKeys.all, 'topups', status] as const,
  search: (q: string) => [...adminWalletKeys.all, 'search', q] as const,
  ledger: (workspaceId: string) => [...adminWalletKeys.all, 'ledger', workspaceId] as const,
}

export function useAdminWalletMethods() {
  return useQuery({
    queryKey: adminWalletKeys.methods(),
    queryFn: async (): Promise<WalletPaymentMethod[]> => {
      const response = await apiClient.get('/admin/wallet/methods')
      return asList<WalletPaymentMethod>(response.data?.methods)
    },
    retry: false,
  })
}

export function useSaveWalletMethod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string | null; input: AdminWalletMethodInput }) => {
      const response = id
        ? await apiClient.patch(`/admin/wallet/methods/${id}`, input)
        : await apiClient.post('/admin/wallet/methods', input)
      return response.data as WalletPaymentMethod
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminWalletKeys.methods() })
    },
  })
}

export function useAdminTopups(status: TopupStatusFilter) {
  return useQuery({
    queryKey: adminWalletKeys.topups(status),
    queryFn: async (): Promise<WalletTopup[]> => {
      const response = await apiClient.get('/admin/wallet/topups', { params: { status } })
      return asList<WalletTopup>(response.data?.topups)
    },
    staleTime: 15_000,
    retry: false,
  })
}

/** A signed link to a receipt, fetched when the admin asks — it expires in minutes. */
export async function fetchTopupReceiptUrl(id: string): Promise<string> {
  const response = await apiClient.get(`/admin/wallet/topups/${id}/receipt`)
  return String(response.data?.url ?? '')
}

export function useDecideTopup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      input:
        | { id: string; decision: 'approve'; creditedMinor: number | null; note: string }
        | { id: string; decision: 'reject'; note: string },
    ) => {
      if (input.decision === 'approve') {
        await apiClient.post(`/admin/wallet/topups/${input.id}/approve`, {
          ...(input.creditedMinor !== null ? { creditedMinor: input.creditedMinor } : {}),
          ...(input.note.trim() ? { note: input.note.trim() } : {}),
        })
      } else {
        await apiClient.post(`/admin/wallet/topups/${input.id}/reject`, { note: input.note.trim() })
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminWalletKeys.all })
    },
  })
}

export function useAdminWalletSearch(q: string) {
  const query = q.trim()
  return useQuery({
    queryKey: adminWalletKeys.search(query),
    queryFn: async (): Promise<AdminWalletWorkspace[]> => {
      const response = await apiClient.get('/admin/wallet/workspaces', { params: { q: query } })
      return asList<AdminWalletWorkspace>(response.data?.workspaces)
    },
    enabled: query.length > 0,
    retry: false,
  })
}

export function useAdminWalletLedger(workspaceId: string | null) {
  return useQuery({
    queryKey: adminWalletKeys.ledger(workspaceId ?? ''),
    queryFn: async (): Promise<WalletTransaction[]> => {
      const response = await apiClient.get(`/admin/wallet/workspaces/${workspaceId}/transactions`)
      return asList<WalletTransaction>(response.data?.transactions)
    },
    enabled: workspaceId !== null,
    retry: false,
  })
}

export function useAdjustWallet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      workspaceId: string
      currency: string
      amountMinor: number
      note: string
    }) => {
      await apiClient.post(`/admin/wallet/workspaces/${input.workspaceId}/adjust`, {
        currency: input.currency,
        amountMinor: input.amountMinor,
        note: input.note.trim(),
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminWalletKeys.all })
    },
  })
}
