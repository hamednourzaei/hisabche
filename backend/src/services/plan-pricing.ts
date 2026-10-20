// ============================================
// backend/src/services/plan-pricing.ts
//
// ⚠️ THE ONE PLACE A PLAN'S PRICE IS WRITTEN DOWN.
//
// Commercial model (owner, 20 Oct 2026):
//   - FREE: 0 (lifetime 50 invoices allowance)
//   - OFFLINE: 12,000,000 Toman shown (120,000,000 IRR stored) / year
//   - ONLINE_500: 30,000,000 Toman shown (300,000,000 IRR stored) / year
//   - ONLINE_1000: 40,000,000 Toman shown (400,000,000 IRR stored) / year
//   - ONLINE_1500: 45,000,000 Toman shown (450,000,000 IRR stored) / year
//
// Stored in IRR (ISO code) and displayed in تومان (1 Toman = 10 IRR).
// Price versioning is supported: each entry has version, currency,
// effectiveFrom.
// ============================================

import type { FeaturePlan } from '@hisabche/validation'

export type PricingPlan = FeaturePlan | 'free' | 'pro' | 'enterprise'

export interface PlanPriceEntry {
  plan: PricingPlan
  version: number
  currency: 'IRR' | 'USD' | 'AFN'
  monthly: number | null
  yearly: number | null
  tomanMonthly: number | null
  tomanYearly: number | null
  effectiveFrom: string
}

export function tomanToStoredIrr(toman: number): number {
  return Math.round(toman * 10)
}

export function storedIrrToToman(irr: number): number {
  return Math.round(irr / 10)
}

/** Price catalog version 1 (20 Oct 2026) */
export const PLAN_PRICES_V1: readonly PlanPriceEntry[] = [
  {
    plan: 'FREE',
    version: 1,
    currency: 'IRR',
    monthly: null,
    yearly: null,
    tomanMonthly: null,
    tomanYearly: null,
    effectiveFrom: '2026-10-20T00:00:00Z',
  },
  {
    plan: 'OFFLINE',
    version: 1,
    currency: 'IRR',
    monthly: null,
    yearly: 120_000_000,
    tomanMonthly: null,
    tomanYearly: 12_000_000,
    effectiveFrom: '2026-10-20T00:00:00Z',
  },
  {
    plan: 'ONLINE_500',
    version: 1,
    currency: 'IRR',
    monthly: null,
    yearly: 300_000_000,
    tomanMonthly: null,
    tomanYearly: 30_000_000,
    effectiveFrom: '2026-10-20T00:00:00Z',
  },
  {
    plan: 'ONLINE_1000',
    version: 1,
    currency: 'IRR',
    monthly: null,
    yearly: 400_000_000,
    tomanMonthly: null,
    tomanYearly: 40_000_000,
    effectiveFrom: '2026-10-20T00:00:00Z',
  },
  {
    plan: 'ONLINE_1500',
    version: 1,
    currency: 'IRR',
    monthly: null,
    yearly: 450_000_000,
    tomanMonthly: null,
    tomanYearly: 45_000_000,
    effectiveFrom: '2026-10-20T00:00:00Z',
  },
]

export interface PlanPriceValues {
  monthly: number | null
  yearly: number | null
  currency: string
  tomanMonthly?: number | null
  tomanYearly?: number | null
  version?: number
}

export const PLAN_PRICING: Record<PricingPlan, PlanPriceValues> = {
  FREE: {
    monthly: null,
    yearly: null,
    currency: 'IRR',
    tomanMonthly: null,
    tomanYearly: null,
    version: 1,
  },
  OFFLINE: {
    monthly: null,
    yearly: 120_000_000,
    currency: 'IRR',
    tomanMonthly: null,
    tomanYearly: 12_000_000,
    version: 1,
  },
  ONLINE_500: {
    monthly: null,
    yearly: 300_000_000,
    currency: 'IRR',
    tomanMonthly: null,
    tomanYearly: 30_000_000,
    version: 1,
  },
  ONLINE_1000: {
    monthly: null,
    yearly: 400_000_000,
    currency: 'IRR',
    tomanMonthly: null,
    tomanYearly: 40_000_000,
    version: 1,
  },
  ONLINE_1500: {
    monthly: null,
    yearly: 450_000_000,
    currency: 'IRR',
    tomanMonthly: null,
    tomanYearly: 45_000_000,
    version: 1,
  },
  // Legacy aliases
  free: { monthly: null, yearly: null, currency: 'USD' },
  pro: { monthly: 12, yearly: 99, currency: 'USD' },
  enterprise: { monthly: null, yearly: null, currency: 'USD' },
}

export function getPlanPrice(
  plan: string,
  currency: string = 'IRR',
  version: number = 1,
): PlanPriceEntry | null {
  const match = PLAN_PRICES_V1.find(
    (entry) => entry.plan === plan && entry.currency === currency && entry.version === version,
  )
  return match ?? null
}

/**
 * Month or year, read from the period a subscription actually carries.
 */
export function intervalOfPeriod(periodStart: string, periodEnd: string | null): 'month' | 'year' {
  if (!periodEnd) return 'month'
  const start = Date.parse(periodStart)
  const end = Date.parse(periodEnd)
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 'month'
  return end - start > 100 * 24 * 60 * 60 * 1000 ? 'year' : 'month'
}
