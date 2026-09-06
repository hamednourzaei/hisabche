// ============================================
// J2.2 — a journal entry as a reconciliation candidate.
//
// `reconciliation.domain.ts` has modelled `kind: 'payment' | 'invoice' |
// 'journal'` since it was written, and the matcher scored all three. The
// LOADER only ever offered payments — not because that was the right scope,
// but because `bank_statement_lines.matched_to` was a bare uuid with no kind,
// so a match to anything else could not be resolved back.
//
// The consequence on a real statement: a bank fee, an interest credit and any
// manual adjustment had NO candidate at all. They are not payments. Every one
// of them sat unmatched forever, and the reconciliation difference they caused
// looked like a missing payment.
//
// What is tested here is the arithmetic that turns a journal entry into a
// candidate, because getting it wrong is silent — a wrong sign simply produces
// "no match found", which is what the screen showed anyway.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  scoreMatch,
  type BookEntry,
  type StatementLine,
} from '../services/banking/reconciliation.domain'

/**
 * The netting rule the service applies, extracted so it can be tested without
 * a database. Debit on a bank (asset) account is money IN — the same sign the
 * statement uses.
 */
function netMinorOf(lines: { debit: number; credit: number }[]): number {
  return lines.reduce(
    (sum, line) => sum + Math.round(((Number(line.debit) || 0) - (Number(line.credit) || 0)) * 100),
    0,
  )
}

const line = (over: Partial<StatementLine> = {}): StatementLine => ({
  id: 'line-1',
  onDate: '2026-03-10',
  amountMinor: -25_00,
  description: 'MONTHLY SERVICE CHARGE',
  externalRef: null,
  matchedTo: null,
  ...over,
})

const journal = (over: Partial<BookEntry> = {}): BookEntry => ({
  id: 'je-1',
  kind: 'journal',
  onDate: '2026-03-10',
  amountMinor: -25_00,
  reference: 'JE-2026-000041',
  partyName: 'Bank service charge',
  ...over,
})

describe('the netting rule', () => {
  it('reports the effect on the bank account, not the entry total', () => {
    // A four-line entry moving 500 through the bank and 500 through two other
    // accounts must offer 500, not its gross. The service filters the join to
    // this account, so only the bank's own lines arrive here.
    expect(netMinorOf([{ debit: 500, credit: 0 }])).toBe(500_00)
  })

  it('treats a debit on the bank as money IN', () => {
    // Same sign convention as the statement. Inverted, every candidate would
    // fail `Math.sign` in scoreMatch and the matcher would find nothing —
    // which is indistinguishable from having no candidates at all.
    expect(netMinorOf([{ debit: 250, credit: 0 }])).toBeGreaterThan(0)
    expect(netMinorOf([{ debit: 0, credit: 250 }])).toBeLessThan(0)
  })

  it('nets a two-sided entry on the same account', () => {
    expect(
      netMinorOf([
        { debit: 300, credit: 0 },
        { debit: 0, credit: 100 },
      ]),
    ).toBe(200_00)
  })

  it('rounds in minor units, so cents do not drift', () => {
    // Lesson 9: money is compared in integers. 33.33 − 0 must be exactly
    // 3333, not 3332.9999999999995.
    expect(netMinorOf([{ debit: 33.33, credit: 0 }])).toBe(33_33)
  })
})

describe('a bank fee finds its journal entry', () => {
  it('matches on amount and date', () => {
    // The case that had no candidate before: a service charge is a journal
    // entry, never a payment.
    const match = scoreMatch(line(), journal())

    expect(match).not.toBeNull()
    expect(match?.differenceMinor).toBe(0)
    expect(match?.reasons).toContain('exact_amount_and_date')
  })

  it('scores higher when the description names the entry', () => {
    const named = scoreMatch(line({ description: 'CHARGE JE-2026-000041' }), journal())
    const unnamed = scoreMatch(line(), journal())

    expect(named?.score ?? 0).toBeGreaterThan(unnamed?.score ?? 0)
  })

  it('refuses a candidate on the opposite side', () => {
    // A credit on the statement cannot be a debit in the books. Offering it
    // would suggest reconciling money out against money in.
    expect(scoreMatch(line({ amountMinor: 25_00 }), journal({ amountMinor: -25_00 }))).toBeNull()
  })

  it('refuses a candidate a month away', () => {
    expect(scoreMatch(line(), journal({ onDate: '2026-01-10' }))).toBeNull()
  })
})

describe('a zero-net entry is not a candidate', () => {
  it('is skipped rather than offered as a 0 match', () => {
    // An entry that debits and credits the bank equally did not move the bank
    // balance. Offering it would let someone reconcile a real statement line
    // against a no-op.
    expect(netMinorOf([{ debit: 100, credit: 100 }])).toBe(0)
  })
})
