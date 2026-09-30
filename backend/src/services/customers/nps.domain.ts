// ============================================
// Capabilities #108, #109, #13 — NPS and customer health.
// Engine N21 (customer side, continued).
//
// ⚠️ NPS IS NOT A PERCENTAGE AND NOT A RATIO OF "SATISFIED".
//
// The classic NPS divides respondents into promoters (9–10), passives (7–8) and
// detractors (0–6), then reports `% promoters − % detractors`. Every shortcut
// around that produces a number that looks like NPS and is not:
//
//   * averaging the SCORES and calling it NPS — an average of 8.2 is not a net
//     score, and reporting it as one tells a shop its customers are 8% happy
//   * dividing promoters by all respondents — that is a satisfaction rate, and a
//     shop with 60% promoters reports «60%» where the real figure is 20
//   * including the people who were never asked — which lowers every number
//     without saying anything
//
// So the score is computed ONLY from people who answered, and the respondent
// count travels with it. `null` when nobody answered — not 0, because 0 NPS
// means "every respondent is neutral" and "nobody answered" are not the same
// statement.
import type { OpenInvoice } from '../payments/payments.domain'

export type NpsCategory = 'promoter' | 'passive' | 'detractor'

export interface SurveyResponse {
  customerId: string
  /** 0–10. Clamped on the way in, because a survey app is attacker-controlled. */
  score: number
  answeredOn: string
  comment?: string | undefined
}

export interface NpsResult {
  /** The net score, or null when nobody answered. Never derived from a mean. */
  score: number | null
  counts: { promoters: number; passives: number; detractors: number; respondents: number }
  /**
   * ⚠️ WHO WAS ASKED. A net score without the size of the group it came from is
   * a net score from three people.
   */
  population: number
  /** Null when nobody answered, so the caller can say why there is no score. */
  reason: null | 'NO_RESPONSES'
}

/** The band a score falls in. 9 and 10 are promoters; 7 and 8 are passives. */
export function categorise(score: number): NpsCategory {
  if (score >= 9) return 'promoter'
  if (score >= 7) return 'passive'
  return 'detractor'
}

/**
 * The net promoter score.
 *
 * ⚠️ OUT OF 100 RESPONDENTS, NOT ALL CUSTOMERS. A shop with 400 customers and
 * 3 answers has a population of 3, and the score has to say so.
 */
export function netPromoterScore(
  responses: readonly SurveyResponse[],
  population: number,
): NpsResult {
  // ⚠️ EVERY RESPONSE GOES IN, clamped. The first version FILTERED on
  // `Number.isFinite` and then clamped inside the loop — so a response carrying
  // NaN vanished from the respondent count while a response carrying `12`
  // counted as a detractor. Both come from the same broken survey app: one
  // customer disappeared from the denominator, the other was filed against the
  // business that served them.
  //
  // So: clamp first, count everything.
  const answers = responses.map((r) => ({ ...r, score: normaliseScore(r.score) }))

  const counts = answers.reduce(
    (acc, r) => {
      const band = categorise(r.score)
      if (band === 'promoter') acc.promoters += 1
      else if (band === 'passive') acc.passives += 1
      else acc.detractors += 1
      return acc
    },
    { promoters: 0, passives: 0, detractors: 0, respondents: answers.length },
  )

  if (counts.respondents === 0) {
    return {
      score: null,
      counts,
      population,
      reason: 'NO_RESPONSES',
    }
  }

  const net = Math.round(((counts.promoters - counts.detractors) / counts.respondents) * 100)

  return { score: net, counts, population, reason: null }
}

/**
 * ⚠️ A SCORE ABOVE ITS RANGE IS CLAMPED, NOT REJECTED.
 *
 * A survey app is attacker-controlled and a `score: 12` from one that is. The
 * question is what happens next: rejecting the response means a survey app with
 * a bad max-field silently discards real feedback, and clamping means one
 * response is off by a little. Clamping, and the response stays in the count.
 */
export function normaliseScore(score: number): number {
  if (!Number.isFinite(score)) return 0
  return Math.max(0, Math.min(10, Math.round(score)))
}

// ─── Customer health (#13) ──────────────────────────────────────────────────

export type HealthBand = 'growing' | 'steady' | 'shrinking' | 'dormant' | 'unknown'

export interface HealthInput {
  customerId: string
  /** What they bought, by month, oldest first. */
  monthlySpend: readonly { month: string; amountMinor: number }[]
  /** How long ago they last bought, in days. Null when they never have. */
  daysSinceLastPurchase: number | null
  /** How many months in the series. Below this, a trend is a guess. */
  monthsObserved: number
}

export interface CustomerHealth {
  customerId: string
  band: HealthBand
  /**
   * ⚠️ CHANGE PERCENTAGE, null when there is no comparable period. A customer
   * buying the same amount every month has 0%, and a customer who bought last
   * month for the first time has no baseline at all.
   */
  trendPercent: number | null
  monthsObserved: number
  reason: null | 'NOT_ENOUGH_MONTHS' | 'NEVER_BOUGHT'
}

/** Below this many months, a trend line is drawn through two points. */
export const MIN_MONTHS_FOR_A_TREND = 3

export function customerHealth(input: HealthInput): CustomerHealth {
  if (input.daysSinceLastPurchase === null) {
    return {
      customerId: input.customerId,
      band: 'unknown',
      trendPercent: null,
      monthsObserved: input.monthsObserved,
      reason: 'NEVER_BOUGHT',
    }
  }

  if (input.monthsObserved < MIN_MONTHS_FOR_A_TREND) {
    // ⚠️ NOT zero growth. Two months of spending that happen to be equal is a
    // coincidence, and calling it «steady» tells a shop its customer is stable
    // on the strength of two data points.
    return {
      customerId: input.customerId,
      band: 'unknown',
      trendPercent: null,
      monthsObserved: input.monthsObserved,
      reason: 'NOT_ENOUGH_MONTHS',
    }
  }

  const months = [...input.monthlySpend].sort((a, b) => a.month.localeCompare(b.month))
  const half = Math.ceil(months.length / 2)
  const recent = months.slice(months.length - half)
  const older = months.slice(0, months.length - half)

  const sum = (rows: typeof months) => rows.reduce((s, r) => s + r.amountMinor, 0)
  const olderTotal = sum(older)
  const recentTotal = sum(recent)

  // ⚠️ A PRIOR PERIOD OF ZERO HAS NO PERCENTAGE CHANGE. It did not stay flat and
  // it did not fall — there was nothing to fall from, and ∞ is not a number any
  // client can render.
  const trendPercent =
    olderTotal === 0 ? null : Math.round(((recentTotal - olderTotal) / olderTotal) * 100)

  // ⚠️ DORMANCY WINS OVER TREND. A customer whose spend fell 40% and who has
  // not bought in a year is not «shrinking» — that word implies they might come
  // back next month.
  if (input.daysSinceLastPurchase >= 180) {
    return {
      customerId: input.customerId,
      band: 'dormant',
      trendPercent,
      monthsObserved: input.monthsObserved,
      reason: null,
    }
  }

  const band: HealthBand =
    trendPercent === null
      ? 'growing'
      : trendPercent >= 10
        ? 'growing'
        : trendPercent <= -10
          ? 'shrinking'
          : 'steady'

  return {
    customerId: input.customerId,
    band,
    trendPercent,
    monthsObserved: input.monthsObserved,
    reason: null,
  }
}

/**
 * ⚠️ THE LOYALTY TIER, AS A LABEL ON FACTS THAT ALREADY EXIST.
 *
 * Loyalty (#109) is not a points balance invented here — it is a reading of
 * spending, frequency and recency, so that a shop can group customers without
 * maintaining a scheme it will have to honour. No points accrue, no discount
 * follows, and nothing here can be redeemed: those are product decisions with
 * real money behind them, and `G4` says not to guess them.
 */
export type LoyaltyTier = 'new' | 'regular' | 'loyal' | 'champion' | 'unknown'

export interface LoyaltyFacts {
  /** Distinct months they bought in. */
  activeMonths: number
  /** Recency, in days. */
  daysSinceLastPurchase: number | null
  /** How many separate times they came back. */
  repeatPurchases: number
}

export function loyaltyTier(facts: LoyaltyFacts): { tier: LoyaltyTier; why: string } {
  if (facts.daysSinceLastPurchase === null) {
    return { tier: 'unknown', why: 'has never bought' }
  }

  // ⚠️ RECENCY FIRST. A customer who bought every month for two years and then
  // stopped is not a champion; they are someone the shop has lost, and the tier
  // a customer sees on their own account should say so.
  if (facts.daysSinceLastPurchase > 365) {
    return { tier: 'unknown', why: 'has not bought in over a year' }
  }

  if (facts.activeMonths >= 12 && facts.repeatPurchases >= 12) {
    return {
      tier: 'champion',
      why: `bought in ${facts.activeMonths} months and came back ${facts.repeatPurchases} times`,
    }
  }
  if (facts.activeMonths >= 6) {
    return { tier: 'loyal', why: `bought in ${facts.activeMonths} months` }
  }
  if (facts.repeatPurchases >= 2 || facts.activeMonths >= 2) {
    return { tier: 'regular', why: `bought in ${facts.activeMonths} months` }
  }
  return { tier: 'new', why: 'has bought once' }
}

/** Every tier, in order, so a UI can render a scale rather than four labels. */
export const LOYALTY_TIERS: readonly LoyaltyTier[] = [
  'unknown',
  'new',
  'regular',
  'loyal',
  'champion',
]
