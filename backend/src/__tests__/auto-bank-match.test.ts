// ============================================
// Capability #55 — automatic bank reconciliation, bounded.
//
// ⚠️ THIS FILE IS THE ARGUMENT AGAINST ITSELF.
//
// `reconciliation.domain.ts` refuses to reconcile automatically, and gives a
// reason: two invoices for the same amount from the same customer in the same
// week is ordinary, and the wrong guess sends a receipt to the wrong invoice.
// The customer who finds out is the one being chased for a debt they paid.
//
// So the tests below are mostly about what the automation REFUSES. A test that
// only checked «it matches the obvious one» would pass for an implementation
// that matched everything, which is the exact failure the existing engine
// refuses to risk.
//
// Four boundaries, each a real failure:
//
//   1. AMBIGUITY BEATS SCORE. A line with two identical candidates scores 1.0 on
//      both. Taking the first is a coin toss wearing the costume of certainty.
//   2. BANK CHARGES ARE NEVER AUTO-MATCHED. A bank's fee matches nothing in
//      the books, and the route that handles it properly (`difference_reason`)
//      is a different one.
//   3. THE DEFAULT IS NOTHING. `minScore: 0` means a shop that has not decided
//      gets no automation, not «all of it».
//   4. NOTHING IS WRITTEN. The output is a decision the caller may act on.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_AUTO_MATCH_SETTINGS,
  decideAutoMatches,
  isBankCharge,
} from '../services/banking/auto-match.domain'
import type { MatchSuggestion } from '../services/banking/reconciliation.domain'

const suggestion = (over: Partial<MatchSuggestion> = {}): MatchSuggestion => ({
  statementLineId: 'line-1',
  bookEntryId: 'entry-1',
  score: 1,
  reasons: ['exact_reference'],
  differenceMinor: 0,
  daysApart: 0,
  confidence: 'certain',
  isAmbiguous: false,
  ...over,
})

/** Automation switched on, the way a shop that wants it would configure it. */
const ON = { minScore: 0.9, allowedTiers: ['certain' as const] }

describe('#55 — the default is no automation at all', () => {
  it('a perfect match is still refused until the shop turns it on', () => {
    // ⚠️ G4. A shop that has never been asked about auto-matching gets a person
    // looking at every line. The cost is a minute; the cost of being wrong is a
    // customer.
    const report = decideAutoMatches([suggestion()])

    expect(DEFAULT_AUTO_MATCH_SETTINGS.minScore).toBe(0)
    expect(report.matched).toBe(0)
    expect(report.decisions[0]).toMatchObject({ kind: 'refused', reason: 'BELOW_THRESHOLD' })
  })
})

describe('#55 — ambiguity beats a perfect score', () => {
  it('a certain-scoring ambiguous line is refused', () => {
    // ⚠️ THE boundary that matters most. Two invoices, same amount, same week,
    // same customer: both score 1.0, and taking the first sends a receipt to the
    // wrong one.
    const report = decideAutoMatches([suggestion({ isAmbiguous: true })], ON)

    expect(report.matched).toBe(0)
    expect(report.decisions[0]).toMatchObject({ kind: 'refused', reason: 'AMBIGUOUS' })
  })

  it('a lower-scoring unambiguous line still matches', () => {
    const report = decideAutoMatches([suggestion({ score: 0.92 })], ON)

    expect(report.matched).toBe(1)
  })

  it('a high score below the threshold is refused', () => {
    const report = decideAutoMatches([suggestion({ score: 0.95 })], { ...ON, minScore: 0.99 })

    expect(report.matched).toBe(0)
    expect(report.decisions[0]).toMatchObject({ reason: 'BELOW_THRESHOLD' })
  })
})

describe('#55 — the confidence tier is what the shop allows, not what the scorer says', () => {
  it('a «likely» match is refused when only «certain» is allowed', () => {
    const report = decideAutoMatches([suggestion({ confidence: 'likely', score: 0.95 })], ON)

    expect(report.matched).toBe(0)
    expect(report.decisions[0]).toMatchObject({ reason: 'TIER_NOT_ALLOWED' })
  })

  it('a shop that opts in to «likely» gets it', () => {
    const report = decideAutoMatches([suggestion({ confidence: 'likely', score: 0.95 })], {
      minScore: 0.9,
      allowedTiers: ['certain', 'likely'],
    })

    expect(report.matched).toBe(1)
  })

  it('the tier check runs BEFORE ambiguity, and says so', () => {
    // ⚠️ An ambiguous line in a disallowed tier is reported as TIER_NOT_ALLOWED,
    // because that is the setting the shop has to change. Reporting AMBIGUOUS
    // would point at a rule the shop cannot influence.
    const report = decideAutoMatches(
      [suggestion({ confidence: 'possible', isAmbiguous: true })],
      ON,
    )

    expect(report.decisions[0]).toMatchObject({ reason: 'TIER_NOT_ALLOWED' })
  })
})

describe('#55 — a bank charge is never matched automatically', () => {
  it('recognises the ways a bank writes its own fees', () => {
    for (const text of [
      'ACCOUNT MAINTENANCE FEE',
      'Service charge',
      'OVERDRAFT PROTECTION',
      'POS FEE',
      'ATM withdrawal charge',
      'SMS notification',
      'MONTHLY STATEMENT FEE',
    ]) {
      expect(isBankCharge(text), text).toBe(true)
    }
  })

  it('does not treat an ordinary payment as a charge', () => {
    // ⚠️ The list is short ON PURPOSE. A long one would start matching a
    // supplier whose name contains «fee», and mis-matching a real payment is a
    // worse error than leaving a fee unmatched.
    for (const text of [
      'PAYMENT FROM AHMED MOHAMMED',
      'INV-2026-0042 SETTLEMENT',
      'TRANSFER TO SUPPLIER',
    ]) {
      expect(isBankCharge(text), text).toBe(false)
    }
  })

  it('a charge line is refused with its own reason, not as a low score', () => {
    // ⚠️ «these are fees, go and handle them properly» and «these matched
    // poorly, try again» are different pieces of work.
    const report = decideAutoMatches([suggestion({ score: 1 })], ON, {
      'line-1': 'ACCOUNT MAINTENANCE FEE',
    })

    expect(report.matched).toBe(0)
    expect(report.decisions[0]).toMatchObject({ reason: 'BANK_CHARGE', score: 1 })
  })

  it('the charge check runs FIRST, before the tier and the score', () => {
    const report = decideAutoMatches([suggestion({ confidence: 'possible', score: 0.2 })], ON, {
      'line-1': 'OVERDRAFT FEE',
    })

    expect(report.decisions[0]).toMatchObject({ reason: 'BANK_CHARGE' })
  })

  it('a MISSING description is not assumed to be a charge', () => {
    // ⚠️ Guessing a fee from an absent string would divert a real payment into
    // the wrong bucket. Absent means unknown, and unknown is treated as
    // ordinary.
    const report = decideAutoMatches([suggestion()], ON, {})

    expect(report.matched).toBe(1)
  })
})

describe('#55 — the report accounts for every line', () => {
  it('matched + refused equals the number of suggestions', () => {
    const report = decideAutoMatches(
      [
        suggestion({ statementLineId: 'l1' }),
        suggestion({ statementLineId: 'l2', isAmbiguous: true }),
        suggestion({ statementLineId: 'l3', confidence: 'possible' }),
      ],
      ON,
      { l1: 'PAYMENT', l2: 'PAYMENT', l3: 'PAYMENT' },
    )

    expect(report.decisions).toHaveLength(3)
    expect(report.matched + report.refused).toBe(3)
    expect(report.matched).toBe(1)
    expect(report.refused).toBe(2)
  })

  it('returns a partner id, never writes anything', () => {
    // ⚠️ The output is a decision. Acting on it is `reconcileLine`, which
    // already exists and already records who did it — an engine that wrote
    // here would be a second path into the books.
    const report = decideAutoMatches([suggestion({ bookEntryId: 'entry-42' })], ON)

    expect(report.decisions[0]).toMatchObject({ kind: 'auto', partnerId: 'entry-42' })
  })
})
