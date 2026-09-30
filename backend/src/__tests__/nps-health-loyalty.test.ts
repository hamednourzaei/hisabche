// ============================================
// Engine N21 (continued) — NPS, customer health, loyalty tiers.
// Capabilities #108, #13, #109.
//
// ⚠️ NPS HAS THREE WRONG ANSWERS THAT ALL LOOK RIGHT.
//
//   * the AVERAGE of the scores, called NPS — an average of 8.2 is not a net
//     score, and a shop reading it concludes its customers are 8% happy
//   * promoters ÷ all respondents — a satisfaction rate. A shop with 60%
//     promoters and 20% detractors reports «60%» where the real NPS is 40
//   * everyone who was ASKED, including the ones who did not reply — which
//     lowers every number without saying anything about the business
//
// The score here is computed only from people who answered, and the RESPONDENT
// COUNT travels with it, because a net score from three people is a fact about
// three people.
//
// The other half of this file is the same discipline applied to growth and
// loyalty: a percentage with no baseline is null, and a dormant customer is not
// «shrinking».
// ============================================

import { describe, expect, it } from 'vitest'

import {
  MIN_MONTHS_FOR_A_TREND,
  categorise,
  customerHealth,
  loyaltyTier,
  netPromoterScore,
  normaliseScore,
} from '../services/customers/nps.domain'

const answer = (score: number, customerId = `c${score}`) => ({
  customerId,
  score,
  answeredOn: '2026-09-01',
})

describe('#108 — NPS is a net score, never a mean', () => {
  it('promoters minus detractors, over respondents', () => {
    // 6 promoters, 2 passives, 2 detractors ⇒ (6−2)/10 = 40.
    const responses = [
      ...Array.from({ length: 6 }, (_, i) => answer(10, `p${i}`)),
      ...Array.from({ length: 2 }, (_, i) => answer(8, `n${i}`)),
      ...Array.from({ length: 2 }, (_, i) => answer(3, `d${i}`)),
    ]

    const result = netPromoterScore(responses, 100)

    expect(result.score).toBe(40)
    expect(result.counts).toEqual({ promoters: 6, passives: 2, detractors: 2, respondents: 10 })
  })

  it('is NOT the average of the scores', () => {
    const responses = [
      ...Array.from({ length: 6 }, (_, i) => answer(10, `p${i}`)),
      ...Array.from({ length: 4 }, (_, i) => answer(3, `d${i}`)),
    ]

    const result = netPromoterScore(responses, 10)
    const mean = responses.reduce((s, r) => s + r.score, 0) / responses.length

    // ⚠️ Mean 7.2, net 20. A shop reporting «7.2 out of 10» is reporting a
    // satisfaction rate under a name that means something else.
    expect(mean).toBe(7.2)
    expect(result.score).toBe(20)
  })

  it('reports the population it came from', () => {
    // ⚠️ 400 customers, 10 answers. The number without this is 40 points of
    // information a shop would use to plan.
    const result = netPromoterScore([answer(10, 'a'), answer(9, 'b')], 400)

    expect(result.population).toBe(400)
    expect(result.counts.respondents).toBe(2)
  })

  it('no answers is NULL, not a score of zero', () => {
    // ⚠️ 0 NPS means «every respondent is neutral». «Nobody answered» is a
    // different statement, and reporting it as 0 tells a shop its customers are
    // indifferent rather than that nobody asked.
    const result = netPromoterScore([], 400)

    expect(result.score).toBeNull()
    expect(result.reason).toBe('NO_RESPONSES')
  })
})

describe('#108 — the bands, and a score from a broken app', () => {
  it('classifies 9 and 10 as promoters, 7 and 8 as passives', () => {
    expect(categorise(10)).toBe('promoter')
    expect(categorise(9)).toBe('promoter')
    expect(categorise(8)).toBe('passive')
    expect(categorise(7)).toBe('passive')
    expect(categorise(6)).toBe('detractor')
    expect(categorise(0)).toBe('detractor')
  })

  it('clamps an out-of-range score instead of discarding the response', () => {
    // ⚠️ A survey app is attacker-controlled. REJECTING the response means a
    // bug in someone's survey silently discards real feedback; clamping means
    // one answer is slightly off and the customer is still counted.
    expect(normaliseScore(12)).toBe(10)
    expect(normaliseScore(-3)).toBe(0)
    expect(normaliseScore(Number.NaN)).toBe(0)
    expect(normaliseScore(7.6)).toBe(8)
  })

  it('a clamped response still counts, as the band it clamps INTO', () => {
    // ⚠️ 12 clamps to 10 → PROMOTER. The first version filtered on
    // `Number.isFinite` and clamped separately inside the loop, so a NaN score
    // vanished from the respondent count while a `12` was filed as a detractor —
    // one customer silently removed from the denominator, another counted
    // against the business that served them.
    const result = netPromoterScore([answer(12, 'a'), answer(0, 'b'), answer(5, 'c')], 3)

    expect(result.counts.respondents).toBe(3)
    expect(result.counts.promoters).toBe(1)
    expect(result.counts.detractors).toBe(2)
    // (1 − 2) / 3
    expect(result.score).toBe(-33)
  })

  it('a NaN score counts as a detractor rather than vanishing', () => {
    // ⚠️ Disappearing is worse than being counted as neutral-to-negative: a
    // response that vanishes makes every other answer look better.
    const result = netPromoterScore(
      [
        answer(10, 'a'),
        answer(10, 'b'),
        { customerId: 'c', score: Number.NaN, answeredOn: '2026-09-01' },
      ],
      3,
    )

    expect(result.counts.respondents).toBe(3)
    expect(result.counts.detractors).toBe(1)
  })
})

describe('#13 — health needs a baseline, and dormancy beats a trend', () => {
  const months = (...amounts: number[]) =>
    amounts.map((amountMinor, i) => ({
      month: `2026-${String(i + 1).padStart(2, '0')}`,
      amountMinor,
    }))

  it('growing when the recent half is up', () => {
    const health = customerHealth({
      customerId: 'c1',
      monthlySpend: months(100, 100, 150, 150, 200),
      daysSinceLastPurchase: 10,
      monthsObserved: 5,
    })

    expect(health.band).toBe('growing')
    expect(health.trendPercent).toBeGreaterThan(0)
  })

  it('too few months is unknown, NOT zero growth', () => {
    // ⚠️ Two equal months is a coincidence, and calling it «steady» tells a shop
    // its customer is stable on the strength of two points.
    const health = customerHealth({
      customerId: 'c1',
      monthlySpend: months(100, 100),
      daysSinceLastPurchase: 5,
      monthsObserved: 2,
    })

    expect(health.band).toBe('unknown')
    expect(health.trendPercent).toBeNull()
    expect(health.reason).toBe('NOT_ENOUGH_MONTHS')
    expect(MIN_MONTHS_FOR_A_TREND).toBe(3)
  })

  it('a prior period of ZERO has no percentage change', () => {
    // ⚠️ It did not stay flat and it did not fall — there was nothing to fall
    // from, and Infinity is not a number any client can render.
    const health = customerHealth({
      customerId: 'c1',
      monthlySpend: months(0, 0, 500, 500, 500),
      daysSinceLastPurchase: 5,
      monthsObserved: 5,
    })

    expect(health.trendPercent).toBeNull()
    expect(health.band).toBe('growing')
  })

  it('DORMANT wins over a falling trend', () => {
    // ⚠️ «Shrinking» implies they might come back next month. A customer whose
    // spend fell and who has not bought in a year is someone the shop has lost.
    const health = customerHealth({
      customerId: 'c1',
      monthlySpend: months(100, 100, 100, 10, 5),
      daysSinceLastPurchase: 400,
      monthsObserved: 5,
    })

    expect(health.band).toBe('dormant')
  })

  it('a customer who never bought has no band to give', () => {
    const health = customerHealth({
      customerId: 'c1',
      monthlySpend: [],
      daysSinceLastPurchase: null,
      monthsObserved: 0,
    })

    expect(health.band).toBe('unknown')
    expect(health.reason).toBe('NEVER_BOUGHT')
  })
})

describe('#109 — a loyalty tier is a LABEL on facts, not a points scheme', () => {
  it('recency beats history', () => {
    // ⚠️ The customer who bought every month for two years and then stopped.
    // Calling them a champion is what a points system does, because they still
    // have points — and it is why this is a label and not a balance.
    const tier = loyaltyTier({ activeMonths: 24, repeatPurchases: 24, daysSinceLastPurchase: 400 })

    expect(tier.tier).toBe('unknown')
    expect(tier.why).toContain('over a year')
  })

  it('a customer with a long history and recent buying is a champion', () => {
    const tier = loyaltyTier({ activeMonths: 14, repeatPurchases: 14, daysSinceLastPurchase: 20 })

    expect(tier.tier).toBe('champion')
  })

  it('a first-time buyer is new', () => {
    expect(
      loyaltyTier({ activeMonths: 1, repeatPurchases: 0, daysSinceLastPurchase: 3 }).tier,
    ).toBe('new')
  })

  it('a customer who came back is at least regular', () => {
    expect(
      loyaltyTier({ activeMonths: 3, repeatPurchases: 3, daysSinceLastPurchase: 10 }).tier,
    ).toBe('regular')
  })

  it('every tier says why, because a label nobody can check is decoration', () => {
    for (const facts of [
      { activeMonths: 0, repeatPurchases: 0, daysSinceLastPurchase: null },
      { activeMonths: 1, repeatPurchases: 0, daysSinceLastPurchase: 3 },
      { activeMonths: 14, repeatPurchases: 14, daysSinceLastPurchase: 20 },
    ]) {
      const tier = loyaltyTier(facts)
      expect(tier.why.length, JSON.stringify(facts)).toBeGreaterThan(5)
    }
  })
})
