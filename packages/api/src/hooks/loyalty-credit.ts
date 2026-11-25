// ============================================
// packages/api/src/hooks/loyalty-credit.ts
//
// G01 (Gift Cards), G02 (Store Credit) & G65 (Loyalty Points)
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'

export interface GiftCardRow {
  id: string
  code: string
  currency: string
  initial_balance_minor: number
  balance_minor: number
  is_active: boolean
  expires_at: string | null
}

export const loyaltyCreditKeys = {
  giftCards: ['gift-cards'] as const,
  storeCredit: (customerId: string) => ['store-credit', customerId] as const,
  loyalty: (customerId: string) => ['loyalty', customerId] as const,
}

export function useGiftCards() {
  const ready = useAuthReady()
  return useQuery({
    queryKey: loyaltyCreditKeys.giftCards,
    queryFn: async () => {
      const { data } = await apiClient.get('/gift-cards')
      return asList<GiftCardRow>((data as { giftCards?: unknown } | null)?.giftCards)
    },
    enabled: ready,
  })
}

export function useIssueGiftCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      code: string
      currency: string
      initialBalanceMinor: number
      expiresAt?: string | null
      customerId?: string | null
    }) => {
      const { data } = await apiClient.post('/gift-cards', input)
      return data as GiftCardRow
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: loyaltyCreditKeys.giftCards })
    },
  })
}

export function useRedeemGiftCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      code: string
      currency: string
      amountMinor: number
      invoiceId?: string | null
      idempotencyKey: string
    }) => {
      const { data } = await apiClient.post('/gift-cards/redeem', input)
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: loyaltyCreditKeys.giftCards })
    },
  })
}

export function useStoreCredit(customerId: string | null) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: loyaltyCreditKeys.storeCredit(customerId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get(`/store-credit/${customerId}`)
      return data as { customerId: string; balancesByCurrency: Record<string, number> }
    },
    enabled: ready && !!customerId,
  })
}

export function useIssueStoreCredit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      customerId: string
      currency: string
      amountMinor: number
      sourceInvoiceId?: string | null
      reason: string
      idempotencyKey: string
    }) => {
      const { data } = await apiClient.post('/store-credit', input)
      return data
    },
    onSuccess: (_res, vars) => {
      void qc.invalidateQueries({ queryKey: loyaltyCreditKeys.storeCredit(vars.customerId) })
    },
  })
}

export function useLoyaltyBalance(customerId: string | null) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: loyaltyCreditKeys.loyalty(customerId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get(`/loyalty/${customerId}`)
      return data as { customerId: string; pointsBalance: number }
    },
    enabled: ready && !!customerId,
  })
}

export function useMutateLoyaltyPoints() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      customerId: string
      kind: 'earn' | 'redeem' | 'adjust'
      points: number
      invoiceId?: string | null
      reason: string
      idempotencyKey: string
    }) => {
      const { data } = await apiClient.post('/loyalty/mutate', input)
      return data
    },
    onSuccess: (_res, vars) => {
      void qc.invalidateQueries({ queryKey: loyaltyCreditKeys.loyalty(vars.customerId) })
    },
  })
}
