// WP-07: offline FX draft rules reuse the SAME BigInt conversion as the server,
// never a second /100 conversion, and never invent money from a bad rate.

import { describe, expect, it } from 'vitest'
import {
  fxDraftBookAmountMinor,
  fxDraftNeedsReview,
  fxDraftTransitionAllowed,
} from '../schemas/universal-core/fx-drafts.domain'

describe('offline FX draft rules (WP-07)', () => {
  it('locks a USD → AFN draft amount with the shared decimal engine', () => {
    // 1 USD = 70.25 AFN; 10,000 USD cents = 100 USD => 7,025 AFN
    // (AFN has 0 decimals, so the minor unit equals the whole unit).
    const minor = fxDraftBookAmountMinor({
      amountMinor: 10_000,
      rate: '70.25',
      currency: 'USD',
      bookCurrency: 'AFN',
    })
    expect(minor).toBe(7_025)
  })

  it('a two-decimal book currency keeps its own digits, not AFN’s', () => {
    const minor = fxDraftBookAmountMinor({
      amountMinor: 1_000,
      rate: '1.5',
      currency: 'USD',
      bookCurrency: 'EUR',
    })
    expect(minor).toBe(1_500)
  })

  it('never prices a bad or missing rate as zero', () => {
    for (const rate of ['', 'abc', '-1', '0']) {
      expect(
        fxDraftBookAmountMinor({
          amountMinor: 100,
          rate,
          currency: 'USD',
          bookCurrency: 'AFN',
        }),
      ).toBeNull()
    }
  })

  it('only the documented transitions are allowed', () => {
    expect(fxDraftTransitionAllowed('quoted', 'pending')).toBe(true)
    expect(fxDraftTransitionAllowed('quoted', 'cancelled')).toBe(true)
    expect(fxDraftTransitionAllowed('pending', 'settled')).toBe(true)
    expect(fxDraftTransitionAllowed('quoted', 'settled')).toBe(false)
    expect(fxDraftTransitionAllowed('cancelled', 'pending')).toBe(false)
  })

  it('a sell with an unknown or short server position needs review', () => {
    expect(fxDraftNeedsReview(null, 500)).toBe(true)
    expect(fxDraftNeedsReview(499, 500)).toBe(true)
    expect(fxDraftNeedsReview(500, 500)).toBe(false)
  })
})
