import { describe, expect, it } from 'vitest'

import { rateFromPair } from '../lib/warehouse/rate-from-pair'

const known: Record<string, number | null> = { USD: 60, IRT: null, XAU: null }
const lookup = (code: string) => known[code] ?? null

describe('rateFromPair', () => {
  it('«۳٬۰۰۰ افغانی = ۱٬۰۰۰٬۰۰۰ تومان» → 0.003 AFN per toman', () => {
    expect(
      rateFromPair({ amount: 3000, code: 'AFN' }, { amount: 1_000_000, code: 'IRT' }, lookup),
    ).toEqual({
      ok: true,
      code: 'IRT',
      afnPerUnit: 0.003,
    })
  })

  it('«۱ دالر = ۶۵ افغانی» → 65', () => {
    expect(rateFromPair({ amount: 1, code: 'USD' }, { amount: 65, code: 'AFN' }, lookup)).toEqual({
      ok: true,
      code: 'USD',
      afnPerUnit: 65,
    })
  })

  it('neither side afghani: bridged through the one that has a rate («۱ گرم طلا = ۱۰۰ دالر»)', () => {
    expect(rateFromPair({ amount: 1, code: 'XAU' }, { amount: 100, code: 'USD' }, lookup)).toEqual({
      ok: true,
      code: 'XAU',
      afnPerUnit: 6000,
    })
  })

  it('refuses the same currency, a zero amount, and two unknown rates', () => {
    expect(
      rateFromPair({ amount: 1, code: 'USD' }, { amount: 1, code: 'USD' }, lookup),
    ).toMatchObject({ reason: 'same' })
    expect(
      rateFromPair({ amount: 0, code: 'USD' }, { amount: 1, code: 'AFN' }, lookup),
    ).toMatchObject({ reason: 'amount' })
    expect(
      rateFromPair({ amount: 1, code: 'XAU' }, { amount: 1, code: 'IRT' }, lookup),
    ).toMatchObject({
      reason: 'unknownBridge',
    })
  })
})
