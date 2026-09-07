// ============================================
// packages/api/src/hooks/billing.ts
// Billing Hooks — TanStack Query
// ============================================

'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'
import type { Plan, Subscription } from '@hisabche/validation'

// ─── Types ──────────────────────────────────────────────────────

export interface BillingPlan {
  plan: Plan
  name: string
  priceMonthly: number | null
  priceYearly: number | null
  /**
   * The currency the plan prices are in — declared by the server (ISO 4217).
   *
   * ⚠️ Optional only so a client built against an older server keeps working.
   * When it is absent the UI must NOT substitute a currency of its own: a
   * hardcoded `$` in the pricing component is how this went undeclared for so
   * long, and a wrong currency on a price is worse than a missing one.
   */
  currency?: string
  limits: any
  featureKeys: string[]
}

export interface UsageReport {
  usage: {
    invoices: number
    users: number
    workspaces: number
    transactions: number
  }
  limits: any
  plan: Plan
  isTrial: boolean
}

export interface TrialStatus {
  isTrial: boolean
  daysLeft: number
  ended: boolean
  graceDaysLeft: number
  isInGracePeriod: boolean
}

// ─── Query Keys ──────────────────────────────────────────────────

export const billingKeys = {
  all: ['billing'] as const,
  plans: () => [...billingKeys.all, 'plans'] as const,
  subscription: () => [...billingKeys.all, 'subscription'] as const,
  usage: () => [...billingKeys.all, 'usage'] as const,
  trialStatus: () => [...billingKeys.all, 'trial-status'] as const,
}

// ─── Hooks ──────────────────────────────────────────────────────

// ۱. دریافت لیست پلن‌ها — این یکی عمومی است (بدون login هم قابل مشاهده)، پس گیت نشده
export function usePlans() {
  return useQuery({
    queryKey: billingKeys.plans(),
    queryFn: async (): Promise<BillingPlan[]> => {
      const { data } = await apiClient.get('/billing/plans')
      return data
    },
    staleTime: 10 * 60 * 1000, // ۱۰ دقیقه
  })
}

// ۲. دریافت اشتراک فعلی — نیازمند احراز هویت
export function useSubscription() {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: billingKeys.subscription(),
    queryFn: async (): Promise<Subscription> => {
      const { data } = await apiClient.get('/billing/subscription')
      return data
    },
    enabled: authReady,
    staleTime: 60 * 1000, // ۱ دقیقه
  })
}

// ۳. دریافت وضعیت Trial — نیازمند احراز هویت
export function useTrialStatus() {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: billingKeys.trialStatus(),
    queryFn: async (): Promise<TrialStatus> => {
      const { data } = await apiClient.get('/billing/trial-status')
      return data
    },
    enabled: authReady,
    staleTime: 60 * 1000, // ۱ دقیقه
  })
}

// ۴. دریافت گزارش مصرف — نیازمند احراز هویت
export function useUsage() {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: billingKeys.usage(),
    queryFn: async (): Promise<UsageReport> => {
      const { data } = await apiClient.get('/billing/usage')
      return data
    },
    enabled: authReady,
    staleTime: 2 * 60 * 1000, // ۲ دقیقه
  })
}

// ۵. ارتقا به پلن جدید
export function useUpgrade() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ plan, interval }: { plan: Plan; interval: 'month' | 'year' }) => {
      const { data } = await apiClient.post('/billing/upgrade', { plan, interval })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.subscription() })
      queryClient.invalidateQueries({ queryKey: billingKeys.usage() })
      queryClient.invalidateQueries({ queryKey: billingKeys.trialStatus() })
    },
  })
}

// ۶. لغو اشتراک
export function useCancelSubscription() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/billing/cancel')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.subscription() })
    },
  })
}
