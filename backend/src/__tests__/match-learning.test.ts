// ============================================
// backend/src/__tests__/match-learning.test.ts
//
// N1 — what previous reconciliations teach the next one.
//
// The existing `scoreMatch` already handles reference, amount, date and party.
// This is the signal it did not have: a shop whose electricity bill arrives
// every month as «DABS KABUL 4471» has matched that to the same supplier
// eleven times, and the twelfth was scored from scratch.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  MAX_LEARNED_BONUS,
  learnPatterns,
  learnedBonus,
  normaliseDescription,
  type PastMatch,
} from '../services/banking/match-learning.domain'

const monthly = (n: number): PastMatch[] =>
  Array.from({ length: n }, (_, i) => ({
    // A different invoice number every month — the same payee.
    description: `DABS KABUL ${4400 + i}`,
    counterpartyId: 'supplier-dabs',
  }))

describe('the description is reduced to the part that repeats', () => {
  it('strips the digits that change every month', () => {
    // ⚠️ Keeping them would make every month a new, unlearnable pattern.
    expect(normaliseDescription('DABS KABUL 4471')).toBe(normaliseDescription('DABS KABUL 4482'))
  })

  it('ignores punctuation and short noise words', () => {
    expect(normaliseDescription('PMT/ DABS  KABUL, to')).toBe('PMT DABS KABUL')
  })

  it('a description of only digits normalises to nothing', () => {
    // A reference number is `scoreMatch`'s business — it has an exact rule for
    // it worth 0.7. Learning from it here would double-count the same signal.
    expect(normaliseDescription('4471 8899')).toBe('')
  })
})

describe('what the history teaches', () => {
  it('learns a payee seen enough times', () => {
    const learned = learnPatterns(monthly(11))
    const hit = learned.get(normaliseDescription('DABS KABUL 4471'))
    expect(hit).toMatchObject({ counterpartyId: 'supplier-dabs', consistency: 1 })
  })

  it('⚠️ learns nothing from one or two sightings', () => {
    // Two coincidences are not a pattern, and acting on them would make the
    // first mistake self-reinforcing.
    expect(learnPatterns(monthly(2)).size).toBe(0)
    expect(learnPatterns(monthly(3)).size).toBe(1)
  })

  it('⚠️ a pattern used for many different parties teaches nothing usable', () => {
    // «TRANSFER» has gone to forty people. Its most common counterparty might
    // be 8% of cases; suggesting it is worse than suggesting nothing.
    const noisy: PastMatch[] = Array.from({ length: 12 }, (_, i) => ({
      description: 'TRANSFER RECEIVED',
      counterpartyId: `party-${i}`,
    }))
    const learned = learnPatterns(noisy)
    const hit = learned.get('TRANSFER RECEIVED')
    expect(hit!.consistency).toBeLessThan(0.2)
    // And the bonus refuses it.
    expect(learnedBonus('TRANSFER RECEIVED', hit!.counterpartyId, learned).bonus).toBe(0)
  })
})

describe('the bonus', () => {
  const learned = learnPatterns(monthly(11))

  it('fires for the counterparty the history points at', () => {
    const { bonus, pattern } = learnedBonus('DABS KABUL 9001', 'supplier-dabs', learned)
    expect(bonus).toBeGreaterThan(0)
    expect(pattern).toBe('DABS KABUL')
  })

  it('does NOT fire for a different counterparty', () => {
    expect(learnedBonus('DABS KABUL 9001', 'supplier-other', learned).bonus).toBe(0)
  })

  it('does not fire without a counterparty', () => {
    expect(learnedBonus('DABS KABUL 9001', null, learned).bonus).toBe(0)
    expect(learnedBonus('DABS KABUL 9001', undefined, learned).bonus).toBe(0)
  })

  it('⚠️ can never outweigh an exact reference match', () => {
    // `exact_reference` is 0.7 in the existing scorer. A learned habit that
    // could beat a quoted reference number would let «what we usually do»
    // override «what this line actually says».
    expect(MAX_LEARNED_BONUS).toBeLessThan(0.5)
    expect(learnedBonus('DABS KABUL 9001', 'supplier-dabs', learned).bonus).toBeLessThanOrEqual(
      MAX_LEARNED_BONUS,
    )
  })

  it('grows with the depth of the history, and saturates', () => {
    const thin = learnPatterns(monthly(3))
    const deep = learnPatterns(monthly(40))

    const thinBonus = learnedBonus('DABS KABUL 1', 'supplier-dabs', thin).bonus
    const deepBonus = learnedBonus('DABS KABUL 1', 'supplier-dabs', deep).bonus

    expect(thinBonus).toBeGreaterThan(0)
    expect(deepBonus).toBeGreaterThan(thinBonus)
    // Saturated — forty confirmations is not four times more convincing than
    // ten, and an uncapped term would eventually beat every hard signal.
    expect(deepBonus).toBeLessThanOrEqual(MAX_LEARNED_BONUS)
  })

  it('an empty history teaches nothing and breaks nothing', () => {
    expect(learnPatterns([]).size).toBe(0)
    expect(learnedBonus('ANYTHING', 'p1', new Map()).bonus).toBe(0)
  })
})
