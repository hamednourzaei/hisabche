'use client'

// ============================================
// packages/api/src/hooks/referrals.ts
//
// The referral programme, as the page reads it.
//
// ⚠️ SCOPED TO THE CALLER BY THE SERVER. There is no user id in any request
// here — `/api/referrals` answers for whoever holds the token, so a client
// cannot ask about somebody else's commissions.
// ============================================

import { useQuery } from '@tanstack/react-query'

import { apiClient } from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'

export interface ReferralRow {
  id: string
  name: string
  signedUpAt: string
  plan: string | null
  interval: string | null
  /** Net of reversals, in the smallest currency unit. */
  commissionMinor: number
  baseAmountMinor: number
  currency: string | null
  paidPeriods: number
  periodsRemaining: number
  isActive: boolean
  status: 'pending' | 'credited' | 'paid' | 'void' | 'none'
}

export interface ReferralSummary {
  referredCount: number
  activeCount: number
  thisMonthMinor: number
  totalMinor: number
  pendingMinor: number
  /** null when currencies are mixed — there is no single total then. */
  currency: string | null
  currencies: string[]
  payoutThresholdMinor: number
}

export interface ReferralTerms {
  rateBps: number
  signupDiscountBps: number
  periodLimit: number
  attributionWindowDays: number
  payoutThresholdMinor: number
}

export interface ReferralOverview {
  /** null until the migration has been run — the page says so explicitly. */
  code: string | null
  summary: ReferralSummary
  referrals: ReferralRow[]
  terms: ReferralTerms
}

export const referralKeys = {
  all: ['referrals'] as const,
  overview: () => [...referralKeys.all, 'overview'] as const,
}

const EMPTY_SUMMARY: ReferralSummary = {
  referredCount: 0,
  activeCount: 0,
  thisMonthMinor: 0,
  totalMinor: 0,
  pendingMinor: 0,
  currency: null,
  currencies: [],
  payoutThresholdMinor: 0,
}

export function useReferralOverview() {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: referralKeys.overview(),
    queryFn: async (): Promise<ReferralOverview> => {
      const { data } = await apiClient.get('/referrals')
      const body = data as Partial<ReferralOverview> | null

      return {
        code: typeof body?.code === 'string' ? body.code : null,
        summary: { ...EMPTY_SUMMARY, ...(body?.summary ?? {}) },
        // ⚠️ `asList` — a type annotation is not a runtime check, and this list
        // is rendered (راهنمای سشن §۷٫۲).
        referrals: asList<ReferralRow>(body?.referrals),
        terms: {
          rateBps: body?.terms?.rateBps ?? 0,
          signupDiscountBps: body?.terms?.signupDiscountBps ?? 0,
          periodLimit: body?.terms?.periodLimit ?? 0,
          attributionWindowDays: body?.terms?.attributionWindowDays ?? 0,
          payoutThresholdMinor: body?.terms?.payoutThresholdMinor ?? 0,
        },
      }
    },
    // ⚠️ NOT gated on a workspace. Somebody who has just signed up and has no
    // workspace yet still has a referral link, and that is exactly when they
    // are most likely to share it.
    enabled: authReady,
    staleTime: 60_000,
  })
}

/**
 * The link somebody shares.
 *
 * ⚠️ BUILT FROM THE BROWSER'S OWN ORIGIN, never a hardcoded domain: the same
 * build serves the staging host and the desktop app, and a link pointing at
 * the wrong one silently credits nobody.
 */
export function referralLink(code: string | null, lang = 'fa'): string | null {
  if (!code) return null
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://hisabche.com'
  return `${origin}/${lang}/signup?ref=${encodeURIComponent(code)}`
}
