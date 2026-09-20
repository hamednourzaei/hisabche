// ============================================
// backend/src/services/plan-pricing.ts
//
// ⚠️ THE ONE PLACE A PLAN'S PRICE IS WRITTEN DOWN.
//
// These numbers lived as literals inside `GET /api/billing/plans`
// (`key === 'pro' ? 12 : null`). Nothing else could read them, so anything
// needing the amount somebody paid — the referral commission, for one — had no
// source but the plan's NAME, and a commission inferred from a name is an
// invented figure in a financial product.
//
// ---------------------------------------------------------------------------
// ⚠️ ITS OWN MODULE, AND THAT IS THE WHOLE POINT.
//
// It first lived in `billing.service.ts`. But `billing.service` credits a
// referral on activation, so it imports the Referral Core — and the Referral
// Core needs the price, so it imported `billing.service` back. That is a
// module cycle: `billing.service → referral/index → referral.service →
// billing.service`.
//
// Node resolves a cycle by handing the second importer a PARTIALLY INITIALISED
// module. `referralService` was therefore `undefined` at the moment
// `billing.service`'s module body ran, and the first call into it threw —
// which is what answered `GET /api/referrals` with a 500 while every unit test
// passed, because the tests import the leaves directly and never close the
// loop (راهنمای سشن §۸: TDZ is almost always a module cycle).
//
// A constants module that imports nothing cannot be part of a cycle.
//
// ---------------------------------------------------------------------------
// `null` means «not priced here»: `free` costs nothing and `enterprise` is
// negotiated. A null price is NOT zero, and nothing may treat it as zero — a
// 10% commission on a null is «unknown», not «۰».
//
// ⚠️ The currency is USD because the pricing page has always rendered a
// hardcoded `$`. That records what is charged today; it is not a new decision,
// and the owner should confirm it — everything else in this product prices in
// the workspace's own currency.
// ============================================

import type { Plan } from '@hisabche/validation'

export const PLAN_PRICING: Record<
  Plan,
  { monthly: number | null; yearly: number | null; currency: string }
> = {
  free: { monthly: null, yearly: null, currency: 'USD' },
  pro: { monthly: 12, yearly: 99, currency: 'USD' },
  enterprise: { monthly: null, yearly: null, currency: 'USD' },
}

/**
 * Month or year, read from the period a subscription actually carries.
 *
 * ⚠️ DERIVED FROM BOTH ENDS, NEVER GUESSED. `subscriptions` has no interval
 * column, and a commission calculated against the wrong interval is wrong by a
 * factor of eight. `upgradePatch` writes `period_end` one month or twelve
 * months out, so the distance answers it exactly — and anything unparseable
 * falls back to the SMALLER interval, which under-pays rather than over-pays
 * on bad data.
 */
export function intervalOfPeriod(periodStart: string, periodEnd: string | null): 'month' | 'year' {
  if (!periodEnd) return 'month'
  const start = Date.parse(periodStart)
  const end = Date.parse(periodEnd)
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 'month'
  // ~100 days: far above one month, far below one year. Nothing legitimate
  // lands near this boundary.
  return end - start > 100 * 24 * 60 * 60 * 1000 ? 'year' : 'month'
}
