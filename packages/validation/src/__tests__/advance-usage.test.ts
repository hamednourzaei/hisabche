// ============================================
// packages/validation/src/__tests__/advance-usage.test.ts
//
// WP-05: an advance's USAGE is its own state model. The cases below are the
// ones a screen actually meets, including the two that used to be impossible
// to state: a partial refund beside an application, and a read that failed.
//
// Two currencies deliberately: the derivation works on integer minor units and
// never divides by 100, so AFN (0 digits) and USD (2 digits) produce the same
// states for the same figures.
// ============================================

import { describe, expect, it } from 'vitest'

import { advanceUsageOf } from '../schemas/universal-core/order-deposit.domain'

const AFN = (amountMinor: number) => ({
  amountMinor,
  appliedMinor: 0,
  refundedMinor: 0,
})

describe('advanceUsageOf — the money says what happened, not the document', () => {
  it('is unused while nothing has moved', () => {
    expect(advanceUsageOf(AFN(2_000))).toBe('unused')
    // USD 100.00 — the digits are irrelevant to the state, only the integers are.
    expect(advanceUsageOf(AFN(10_000))).toBe('unused')
  })

  it('is partially_applied while some money still sits there', () => {
    expect(advanceUsageOf({ ...AFN(2_000), appliedMinor: 500 })).toBe('partially_applied')
  })

  it('is fully_applied when applications consumed all of it', () => {
    expect(advanceUsageOf({ ...AFN(2_000), appliedMinor: 2_000 })).toBe('fully_applied')
  })

  it('is partially_refunded and fully_refunded for a refund that never settled an invoice', () => {
    expect(advanceUsageOf({ ...AFN(2_000), refundedMinor: 750 })).toBe('partially_refunded')
    expect(advanceUsageOf({ ...AFN(2_000), refundedMinor: 2_000 })).toBe('fully_refunded')
  })

  it('names the larger side when both happened and nothing is left', () => {
    expect(advanceUsageOf({ ...AFN(2_000), appliedMinor: 1_500, refundedMinor: 500 })).toBe(
      'fully_applied',
    )
    expect(advanceUsageOf({ ...AFN(2_000), appliedMinor: 500, refundedMinor: 1_500 })).toBe(
      'fully_refunded',
    )
  })

  it('keeps «partially applied» when a refund happened beside an application', () => {
    expect(advanceUsageOf({ ...AFN(2_000), appliedMinor: 500, refundedMinor: 500 })).toBe(
      'partially_applied',
    )
  })

  it('answers null for a figure that could not be read — never «unused»', () => {
    expect(advanceUsageOf({ amountMinor: 2_000, appliedMinor: null, refundedMinor: 0 })).toBeNull()
    expect(advanceUsageOf({ amountMinor: 2_000, appliedMinor: 0, refundedMinor: null })).toBeNull()
    expect(
      advanceUsageOf({ amountMinor: 2_000, appliedMinor: null, refundedMinor: null }),
    ).toBeNull()
  })

  it('refuses a fractional or negative figure instead of rounding it into a state', () => {
    expect(advanceUsageOf({ amountMinor: 2_000.5, appliedMinor: 0, refundedMinor: 0 })).toBeNull()
    expect(advanceUsageOf({ amountMinor: -1, appliedMinor: 0, refundedMinor: 0 })).toBeNull()
    expect(advanceUsageOf({ ...AFN(2_000), appliedMinor: -1 })).toBeNull()
  })

  it('calls a zero-value advance unused, not refunded', () => {
    expect(advanceUsageOf(AFN(0))).toBe('unused')
  })

  it('does not hide an overspend: the balance reports the fault, the state stays readable', () => {
    expect(advanceUsageOf({ ...AFN(1_000), appliedMinor: 1_200 })).toBe('fully_applied')
  })
})
