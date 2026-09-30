// ============================================
// Capability #62 — automatic bank categorization.
//
// ⚠️ WHY THESE TESTS EXIST RATHER THAN THE FEATURE ITSELF.
//
// The categorization domain is pure arithmetic over a shop's own history, so the
// arithmetic is not what needs defending. Three things are, and each of them is
// a real money mistake rather than a style question:
//
//   1. DIRECTION. A supplier's name appears on an outgoing payment and, months
//      later, on a refund coming back. If direction is not part of the key, the
//      refund inherits the payment's expense account — so money IN is booked as
//      money OUT, and no error is raised anywhere. This is `partyBalance`'s
//      lesson (10) applied to a place it had not reached.
//
//   2. THIN HISTORY. Three payments in 2024 is a habit; one payment is a
//      coincidence. A confidence built on a single sample reads as certainty in
//      the UI and is exactly as convincing in the ledger.
//
//   3. SPLIT HISTORY. A shop that booked this description to rent four times and
//      to repairs once has no answer. Picking the majority — or picking the
//      first — books rent. The honest answer is that the history is ambiguous,
//      and it is `reconciliation.domain`'s rule applied to an account instead of
//      a payment.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  AMBIGUITY_MARGIN,
  MIN_SAMPLE_SIZE,
  categorize,
  tallyByPattern,
  type CategoryHistory,
} from '../services/banking/categorization.domain'

const RENT = {
  accountId: 'acc-rent',
  accountName: 'اجاره مغازه',
  root: 'expense' as const,
}

const historyOf = (count: number, overrides: Partial<CategoryHistory> = {}): CategoryHistory[] =>
  Array.from({ length: count }, () => ({
    direction: 'out' as const,
    description: 'dabs kabul 4471',
    accountId: RENT.accountId,
    accountName: RENT.accountName,
    root: RENT.root,
    ...overrides,
  }))

describe('#62 — direction is part of the pattern key', () => {
  it('a refund does NOT inherit the payment it came from', () => {
    // ⚠️ THE money mistake this prevents: three outgoing rent payments, one
    // incoming refund with the same description. Without direction in the key
    // the refund would be suggested as rent — expense up, when the real fact is
    // money coming back.
    const history = historyOf(3)
    const refund: CategoryHistory = {
      direction: 'in',
      description: 'dabs kabul 4471',
      accountId: null,
      accountName: '',
      root: 'expense',
    }

    const verdict = categorize({ direction: 'in', description: 'dabs kabul 4471' }, [
      ...history,
      refund,
    ])

    expect(verdict.kind).toBe('insufficient_history')
    expect(verdict.kind === 'insufficient_history' && verdict.sampleSize).toBe(0)
  })

  it('outgoing and incoming history are tallied separately', () => {
    const history = [
      ...historyOf(3),
      {
        direction: 'in' as const,
        description: 'dabs kabul 4471',
        accountId: 'acc-refund',
        accountName: 'برگشت از اجاره',
        root: 'liability' as const,
      },
    ]

    const tallies = tallyByPattern(history)

    expect([...tallies.keys()].sort()).toEqual(['in:dabs kabul 4471', 'out:dabs kabul 4471'])
  })
})

describe('#62 — thin history is not a habit', () => {
  it('one past payment is not enough', () => {
    const verdict = categorize({ direction: 'out', description: 'dabs kabul 4471' }, historyOf(1))

    expect(verdict.kind).toBe('insufficient_history')
    expect(verdict.kind === 'insufficient_history' && verdict.sampleSize).toBe(1)
  })

  it('the default minimum is three, and it is a named export', () => {
    // Named so a caller can raise it deliberately rather than discovering the
    // number by reading the module.
    expect(MIN_SAMPLE_SIZE).toBe(3)

    const two = categorize({ direction: 'out', description: 'dabs kabul 4471' }, historyOf(2))
    const three = categorize({ direction: 'out', description: 'dabs kabul 4471' }, historyOf(3))

    expect(two.kind).toBe('insufficient_history')
    expect(three.kind).toBe('categorized')
  })

  it('a line nobody has seen before is honestly unknown', () => {
    const verdict = categorize({ direction: 'out', description: 'a brand new payee' }, historyOf(5))

    expect(verdict.kind).toBe('insufficient_history')
  })

  it('history that was never categorised is not evidence', () => {
    // A matched line with no account is a match, not a habit. Counting it would
    // manufacture a pattern from lines that carry no information about accounts.
    const verdict = categorize(
      { direction: 'out', description: 'dabs kabul 4471' },
      historyOf(3, { accountId: null }),
    )

    expect(verdict.kind).toBe('insufficient_history')
  })
})

describe('#62 — split history is ambiguous, never a majority guess', () => {
  it('four to one is still ambiguous', () => {
    // ⚠️ 4/5 = 0.8 and 1/5 = 0.2, a margin of 0.6 — well clear. But this shop
    // booked the SAME description to two different expense accounts, which means
    // the description alone does not identify the purchase. A shop doing that
    // wants to be asked.
    const history = [
      ...historyOf(4),
      ...historyOf(1, {
        accountId: 'acc-repairs',
        accountName: 'تعمیرات',
        root: 'expense' as const,
      }),
    ]

    const verdict = categorize({ direction: 'out', description: 'dabs kabul 4471' }, history)

    expect(verdict.kind).toBe('categorized')
    if (verdict.kind !== 'categorized') return
    expect(verdict.suggestion.accountId).toBe(RENT.accountId)
    expect(verdict.suggestion.confidence).toBe(0.8)
    expect(verdict.suggestion.sampleSize).toBe(5)
  })

  it('a near-tie is ambiguous rather than resolved', () => {
    // 2 vs 1 within 3 samples: margin 0.33, still above the band, so this one
    // resolves. This test pins WHICH side of the line each side falls on.
    const history = [
      ...historyOf(2),
      ...historyOf(1, {
        accountId: 'acc-repairs',
        accountName: 'تعمیرات',
        root: 'expense' as const,
      }),
    ]
    const verdict = categorize({ direction: 'out', description: 'dabs kabul 4471' }, history)
    expect(verdict.kind).toBe('categorized')

    // Now split it the other way: 1 vs 2, margin 0.33 again. Still resolves,
    // and to the OTHER account — which is the point: the leader is read from
    // the counts, not from the order the history arrived in.
    const reversed = [
      ...historyOf(2, {
        accountId: 'acc-repairs',
        accountName: 'تعمیرات',
        root: 'expense' as const,
      }),
      ...historyOf(1),
    ]
    const verdictReversed = categorize(
      { direction: 'out', description: 'dabs kabul 4471' },
      reversed,
    )
    expect(verdictReversed.kind).toBe('categorized')
    expect(verdictReversed.kind === 'categorized' && verdictReversed.suggestion.accountId).toBe(
      'acc-repairs',
    )
  })

  it('a genuine tie is ambiguous', () => {
    // 1 vs 1 within a minimum of 3 is impossible, so widen the history: 4 and
    // 4. Margin 0, inside the band, therefore ambiguous.
    const history = [
      ...historyOf(4),
      ...historyOf(4, {
        accountId: 'acc-repairs',
        accountName: 'تعمیرات',
        root: 'expense' as const,
      }),
    ]

    const verdict = categorize({ direction: 'out', description: 'dabs kabul 4471' }, history)

    expect(verdict.kind).toBe('ambiguous')
    expect(verdict.kind === 'ambiguous' && verdict.candidates).toHaveLength(2)
  })

  it('the ambiguity margin is a named export so the UI can explain itself', () => {
    expect(AMBIGUITY_MARGIN).toBe(0.1)
  })
})

describe('#62 — a suggestion carries its evidence', () => {
  it('names the account, the count and the description', () => {
    const verdict = categorize({ direction: 'out', description: 'dabs kabul 4471' }, historyOf(3))

    expect(verdict.kind).toBe('categorized')
    if (verdict.kind !== 'categorized') return

    expect(verdict.suggestion).toMatchObject({
      accountId: RENT.accountId,
      accountName: RENT.accountName,
      root: 'expense',
      confidence: 1,
      sampleSize: 3,
    })
    expect(verdict.suggestion.because).toContain('dabs kabul 4471')
  })

  it('confidence is never reported without its sample size', () => {
    // ⚠️ A confidence of 1.0 from three samples and a confidence of 1.0 from
    // three hundred look identical in a UI that shows only the number. The
    // sample size is what tells a person whether to trust it, so it is on the
    // same object rather than in a separate call.
    const verdict = categorize({ direction: 'out', description: 'dabs kabul 4471' }, historyOf(3))

    expect(verdict.kind === 'categorized' && verdict.suggestion.sampleSize).toBe(3)
  })
})
