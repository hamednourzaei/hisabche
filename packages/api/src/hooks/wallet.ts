// ============================================
// packages/api/src/hooks/wallet.ts
//
// The business's wallet — one per WORKSPACE (docs/wallet-01-migration.sql,
// backend/src/routes/wallet.routes.ts). Every figure is an integer in the
// currency's MINOR unit; nothing here does arithmetic on money.
//
// ⚠️ Paying a plan sends the PLAN, never an amount: the price is the server's
// (plan-pricing.ts). The Idempotency-Key is one per intent, so a retry after a
// lost response answers with the first payment instead of paying twice.
// ============================================

'use client'

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { useIntentKey } from '../lib/intent-key'
import { useAuthReady } from './useAuthReady'
import { billingKeys } from './billing'

export interface WalletBalance {
  currency: string
  balanceMinor: number
}

export type WalletMethodKind = 'card_to_card' | 'foreign_currency'

export interface WalletPaymentMethod {
  id: string
  kind: WalletMethodKind
  currency: string
  title: string
  instructions: string
  destination: string
  isActive: boolean
  sortOrder: number
}

export type WalletTransactionKind = 'topup' | 'adjustment' | 'subscription_payment'

export interface WalletTransaction {
  id: string
  currency: string
  amountMinor: number
  balanceAfter: number
  kind: WalletTransactionKind
  referenceType: string | null
  referenceId: string | null
  note: string | null
  createdAt: string
}

export type WalletTopupStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface WalletTopup {
  id: string
  workspaceId: string
  methodId: string
  currency: string
  amountMinor: number
  creditedAmountMinor: number | null
  payerReference: string
  cardLast4: string | null
  paidAt: string
  hasReceipt: boolean
  status: WalletTopupStatus
  memberNote: string | null
  adminNote: string | null
  createdAt: string
  decidedAt: string | null
}

export interface WalletOverview {
  balances: WalletBalance[]
  /** Only the active methods — the ones a business may pay into. */
  methods: WalletPaymentMethod[]
}

export interface WalletTopupInput {
  methodId: string
  amountMinor: number
  payerReference: string
  cardLast4?: string | null | undefined
  /** YYYY-MM-DD (Gregorian — it goes to Postgres). */
  paidAt: string
  note?: string | undefined
  /** The receipt's bytes as base64; the server decides its type from them. */
  receipt?: { base64: string } | undefined
}

export const walletKeys = {
  all: ['wallet'] as const,
  overview: () => [...walletKeys.all, 'overview'] as const,
  transactions: () => [...walletKeys.all, 'transactions'] as const,
  topups: () => [...walletKeys.all, 'topups'] as const,
}

/** Balances per currency and the payment methods the platform offers. */
export function useWallet(options: { enabled?: boolean | undefined } = {}) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: walletKeys.overview(),
    queryFn: async ({ signal }): Promise<WalletOverview> => {
      const { data } = await apiClient.get('/wallet', { signal })
      const body = (data ?? {}) as Partial<WalletOverview>
      return {
        balances: asList<WalletBalance>(body.balances),
        methods: asList<WalletPaymentMethod>(body.methods),
      }
    },
    enabled: authReady && options.enabled !== false,
    staleTime: 30_000,
    // A 403 (no workspace.manage) or a 503 (migration not run) is an answer,
    // not a blip — retrying only delays saying so.
    retry: false,
  })
}

/** The ledger, newest first, 50 at a time (keyset on created_at). */
export function useWalletTransactions() {
  const authReady = useAuthReady()
  return useInfiniteQuery({
    queryKey: walletKeys.transactions(),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }): Promise<WalletTransaction[]> => {
      const { data } = await apiClient.get('/wallet/transactions', {
        params: pageParam ? { before: pageParam } : {},
        signal,
      })
      return asList<WalletTransaction>((data as { transactions?: unknown } | null)?.transactions)
    },
    getNextPageParam: (last) => (last.length === 50 ? last[last.length - 1]?.createdAt : undefined),
    enabled: authReady,
    retry: false,
  })
}

export function useWalletTopups() {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: walletKeys.topups(),
    queryFn: async ({ signal }): Promise<WalletTopup[]> => {
      const { data } = await apiClient.get('/wallet/topups', { signal })
      return asList<WalletTopup>((data as { topups?: unknown } | null)?.topups)
    },
    enabled: authReady,
    retry: false,
  })
}

export function useRequestWalletTopup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: WalletTopupInput): Promise<WalletTopup> => {
      const { data } = await apiClient.post('/wallet/topups', input)
      return data as WalletTopup
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: walletKeys.topups() })
    },
  })
}

export function useCancelWalletTopup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/wallet/topups/${id}/cancel`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: walletKeys.topups() })
    },
  })
}

export interface WalletPayResult {
  requestId: string
  subscriptionId: string | null
  balanceAfter: number
  replayed: boolean
}

/** Buy a plan with the wallet: debit and activation are one server transaction. */
export function usePayUpgradeFromWallet() {
  const queryClient = useQueryClient()
  const intent = useIntentKey('wallet-pay')
  return useMutation({
    mutationFn: async (input: {
      plan: 'pro' | 'enterprise'
      interval: 'month' | 'year'
      walletCurrency: string
    }): Promise<WalletPayResult> => {
      const { data } = await apiClient.post('/wallet/pay-upgrade', input, {
        headers: { 'Idempotency-Key': intent.current() },
      })
      return data as WalletPayResult
    },
    onError: (error) => intent.settle(error),
    onSuccess: () => {
      intent.settle()
      void queryClient.invalidateQueries({ queryKey: walletKeys.all })
      void queryClient.invalidateQueries({ queryKey: billingKeys.all })
    },
  })
}
