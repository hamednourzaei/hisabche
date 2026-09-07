// ============================================
// T10 — converting an amount for display, and refusing to when it cannot.
//
// ---------------------------------------------------------------------------
// WHAT THE OWNER ASKED FOR
//
//   «اگر کاربر در onboarding فلزات را انتخاب کرد، هر جایی که مبلغ نشان داده
//    می‌شود باید بتواند انتخاب کند بر چه مبنایی ببیند»
//
// and then clarified that gold is only an example — any currency.
//
// So: the dashboard's «فروش کل» of ۱۵٬۰۰۰٬۰۰۰ AFN shown instead as grams of
// gold, or as dollars, or as anything the shop keeps a rate for.
//
// ---------------------------------------------------------------------------
// ⚠️ WHY THE REFUSAL CASES ARE MOST OF THIS FILE
//
// The client had four hardcoded rates and a `fetchRates` that called nothing.
// Twenty-one of twenty-five currencies — including all four metals, which is
// the case actually being asked for — had no rate at all.
//
// A converted amount is indistinguishable from a real one. If this returned
// the amount unconverted, or reused a stale quote, or averaged something, the
// dashboard would show a confident number that is simply wrong, and nobody
// would have any reason to doubt it. So every unknown returns null and the UI
// says «rate not set» instead.
// ============================================

import { describe, expect, it } from 'vitest'

import { convertVia, rateOn, type RateQuote } from '../hooks/currency-rates'

const BASE = 'AFN'

const quotes: RateQuote[] = [
  // One gram of gold is 8,500 AFN on the 10th, 8,600 on the 12th.
  { currency: 'XAU', rate: 8_500, onDate: '2026-03-10' },
  { currency: 'XAU', rate: 8_600, onDate: '2026-03-12' },
  { currency: 'USD', rate: 70, onDate: '2026-03-10' },
]

describe('the rate for a date is the latest one ON OR BEFORE it', () => {
  it('uses the quote from that exact day', () => {
    expect(rateOn(quotes, 'XAU', '2026-03-12')).toBe(8_600)
  })

  it('falls back to the most recent EARLIER quote', () => {
    // The 11th has no quote of its own; the 10th's is the last thing anyone
    // knew on that day.
    expect(rateOn(quotes, 'XAU', '2026-03-11')).toBe(8_500)
  })

  it('⚠️ never uses a LATER quote', () => {
    // Valuing the 9th with the 10th's rate means restating a past figure with
    // information nobody had at the time. The backend's revaluation domain
    // refuses this too; the client must not do it just because it has
    // tomorrow's quote sitting in a cache.
    expect(rateOn(quotes, 'XAU', '2026-03-09')).toBeNull()
  })

  it('returns null for a currency with no quote at all', () => {
    expect(rateOn(quotes, 'XAG', '2026-03-12')).toBeNull()
  })

  it('treats a non-positive rate as no rate', () => {
    // A zero rate would divide by zero and produce Infinity on the dashboard.
    expect(
      rateOn([{ currency: 'EUR', rate: 0, onDate: '2026-03-10' }], 'EUR', '2026-03-10'),
    ).toBeNull()
  })
})

describe('the gold example, which is what was actually asked for', () => {
  it('۱۵٬۰۰۰٬۰۰۰ افغانی reads as grams of gold', () => {
    const grams = convertVia(15_000_000, BASE, 'XAU', BASE, quotes, '2026-03-12')
    // 15,000,000 / 8,600
    expect(grams).toBeCloseTo(1744.186, 3)
  })

  it('and back again returns the original amount', () => {
    const grams = convertVia(15_000_000, BASE, 'XAU', BASE, quotes, '2026-03-12')!
    expect(convertVia(grams, 'XAU', BASE, BASE, quotes, '2026-03-12')).toBeCloseTo(15_000_000, 6)
  })

  it("the same total on an earlier day uses that day's rate", () => {
    // Not a rounding detail: at 8,500 it is a different number of grams, and
    // showing today's rate against last week's sales would misstate both.
    expect(convertVia(15_000_000, BASE, 'XAU', BASE, quotes, '2026-03-10')).toBeCloseTo(1764.706, 3)
  })
})

describe('any currency, not just metals', () => {
  it('converts base to a foreign currency', () => {
    expect(convertVia(14_000, BASE, 'USD', BASE, quotes, '2026-03-10')).toBe(200)
  })

  it('converts between two non-base currencies through the base', () => {
    // 17 grams of gold at 8,500 = 144,500 AFN = 2,064.28 USD at 70.
    expect(convertVia(17, 'XAU', 'USD', BASE, quotes, '2026-03-10')).toBeCloseTo(2064.2857, 4)
  })

  it('the base currency needs no row in the table', () => {
    // `rate` is base-per-unit, so the base is 1 by definition. Requiring a row
    // would make the most common currency the one most likely to be missing.
    expect(convertVia(500, BASE, BASE, BASE, [], '2026-03-12')).toBe(500)
  })
})

describe('⚠️ it refuses rather than guessing', () => {
  it('returns null when the target has no rate', () => {
    // The real state of this product for 21 of 25 currencies.
    expect(convertVia(15_000_000, BASE, 'XAG', BASE, quotes, '2026-03-12')).toBeNull()
  })

  it('returns null when the SOURCE has no rate', () => {
    expect(convertVia(100, 'XPT', 'USD', BASE, quotes, '2026-03-12')).toBeNull()
  })

  it('returns null with no quotes at all', () => {
    expect(convertVia(100, BASE, 'USD', BASE, [], '2026-03-12')).toBeNull()
  })

  it('never returns the amount unconverted as a fallback', () => {
    // The precise defect this replaces: `convertAmount` used to
    // `return amount` with a console warning, so 100 USD came back as 100 and
    // was then labelled AFN. A wrong figure wearing the shape of a right one.
    const result = convertVia(100, 'USD', 'XAG', BASE, quotes, '2026-03-12')
    expect(result).not.toBe(100)
    expect(result).toBeNull()
  })

  it('a same-currency conversion is identity, not a lookup', () => {
    // Otherwise a shop whose own currency has no row could not display its own
    // amounts.
    expect(convertVia(999, 'XAG', 'XAG', BASE, [], '2026-03-12')).toBe(999)
  })
})
