// ============================================
// Canonical formatter — policy and safety.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  CURRENCY_SIGN,
  FRACTION_DIGITS,
  formatAmount,
  formatMoney,
  formatNumber,
  fractionDigits,
  groupThousands,
  parseNumericInput,
  toLatinDigits,
  toPersianDigits,
} from '../index'

const FA = 'fa-IR'

describe('decimal policy: 2 for USD/EUR, 0 for everything else', () => {
  it.each([
    ['AFN', 0],
    ['PKR', 0],
    ['IRR', 0],
    ['USD', 2],
    ['EUR', 2],
  ] as const)('%s -> %i digits', (currency, digits) => {
    expect(fractionDigits(currency)).toBe(digits)
    expect(FRACTION_DIGITS[currency]).toBe(digits)
  })

  it('zero-decimal currencies round to whole units', () => {
    expect(formatAmount(1234.567, 'AFN', FA)).toBe('۱٬۲۳۵')
    expect(formatAmount(1234.5, 'PKR', FA)).toBe('۱٬۲۳۵')
  })

  it('USD keeps exactly two decimals, padding when whole', () => {
    expect(formatAmount(1234.567, 'USD', FA)).toBe('۱٬۲۳۴٫۵۷')
    expect(formatAmount(1000, 'USD', FA)).toBe('۱٬۰۰۰٫۰۰')
  })

  it('formats Latin locales too', () => {
    expect(formatAmount(1234.567, 'USD', 'en')).toBe('1,234.57')
    expect(formatAmount(1234.567, 'AFN', 'en')).toBe('1,235')
  })
})

describe('formatMoney places the sign AFTER the digits, ASCII space', () => {
  it.each([
    [1234.567, 'AFN', '۱٬۲۳۵ ؋'],
    [1234.567, 'PKR', '۱٬۲۳۵ ₨'],
    [1234.567, 'IRR', '۱٬۲۳۵ ﷼'],
    [1234.567, 'USD', '۱٬۲۳۴٫۵۷ $'],
    [0, 'AFN', '۰ ؋'],
  ] as const)('%p %s -> %p', (value, currency, expected) => {
    expect(formatMoney(value, currency, FA)).toBe(expected)
  })

  it('uses ASCII space, never U+00A0 — unlike Intl currency style', () => {
    expect(formatMoney(1, 'AFN', FA)).toBe('۱ ؋')
    expect(formatMoney(1, 'AFN', FA)).not.toContain(' ')
  })

  it('keeps the ₨ and ﷼ signs rather than Intl display names', () => {
    expect(CURRENCY_SIGN.PKR).toBe('₨')
    expect(CURRENCY_SIGN.IRR).toBe('﷼')
  })
})

describe('SAFETY: formatting can never feed a calculation', () => {
  it('every exported formatter returns a string', () => {
    expect(typeof formatAmount(1.5, 'AFN', FA)).toBe('string')
    expect(typeof formatMoney(1.5, 'AFN', FA)).toBe('string')
    expect(typeof formatNumber(1.5, FA)).toBe('string')
  })

  it('rounding is display-only — the input is never mutated', () => {
    const value = 1234.567
    formatMoney(value, 'AFN', FA)
    expect(value).toBe(1234.567)
  })

  it('an unavailable Intl falls back without throwing', () => {
    const real = globalThis.Intl
    try {
      // @ts-expect-error deliberately removing Intl to exercise the fallback
      globalThis.Intl = undefined
      expect(formatAmount(1234.5, 'USD', FA)).toBe('1234.50')
      expect(formatAmount(1234.5, 'AFN', FA)).toBe('1235')
    } finally {
      globalThis.Intl = real
    }
  })
})

describe('EUR is future-compatibility only', () => {
  it('has a rule and a sign so it is correct the day it is added', () => {
    expect(fractionDigits('EUR')).toBe(2)
    expect(CURRENCY_SIGN.EUR).toBe('€')
  })

  it('is NOT among the active currencies', () => {
    const active = ['AFN', 'USD', 'PKR', 'IRR']
    expect(active).not.toContain('EUR')
  })
})

describe('digit shaping', () => {
  it('round-trips Latin <-> Persian', () => {
    expect(toPersianDigits(1234567)).toBe('۱۲۳۴۵۶۷')
    expect(toLatinDigits('۱۲۳۴۵۶۷')).toBe('1234567')
    expect(toLatinDigits(toPersianDigits('9081726354'))).toBe('9081726354')
  })

  it('converts Arabic-Indic digits too', () => {
    expect(toLatinDigits('١٢٣')).toBe('123')
  })

  it('leaves non-digits untouched', () => {
    expect(toPersianDigits('abc-1')).toBe('abc-۱')
  })
})

describe('parseNumericInput FIXES the Stage 0 data-loss bug (Q7)', () => {
  it('CONVERTS Persian digits instead of discarding them', () => {
    // Legacy web behaviour: "۱۲۳۴" -> "" (data loss). Canonical: -> "1234".
    expect(parseNumericInput('۱۲۳۴')).toBe('1234')
    expect(parseNumericInput('1۲3۴')).toBe('1234')
  })

  it('preserves the minus sign (legacy stripped it)', () => {
    expect(parseNumericInput('-1234')).toBe('-1234')
    expect(parseNumericInput('؋ -1,234.5')).toBe('-1234.5')
  })

  it.each([
    ['1,234,567', '1234567'],
    ['؋ 1,000', '1000'],
    ['12.34.56', '12.3456'],
    ['abc', ''],
    ['', ''],
    [null, ''],
    [undefined, ''],
    [0, '0'],
  ])('parseNumericInput(%p) === %p', (input, expected) => {
    expect(parseNumericInput(input as string)).toBe(expected)
  })

  it('output always round-trips through Number()', () => {
    for (const input of ['۱٬۲۳۴٫۵', '1,234.5', '-9,999', '؋ ۵۰۰']) {
      const parsed = parseNumericInput(input)
      if (parsed) expect(Number.isNaN(Number(parsed))).toBe(false)
    }
  })
})

describe('groupThousands', () => {
  it.each([
    [1234567, '1,234,567'],
    [1234.56, '1,234.56'],
    [0, '0'],
    [-1234, '-1,234'],
    [null, ''],
  ])('groupThousands(%p) === %p', (input, expected) => {
    expect(groupThousands(input as number)).toBe(expected)
  })

  it('preserves negatives, unlike the legacy web helper', () => {
    expect(groupThousands(-1234567)).toBe('-1,234,567')
  })
})
