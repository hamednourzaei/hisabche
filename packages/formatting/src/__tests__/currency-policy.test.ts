// ============================================
// STAGE 4 §8/§9 — the precision contract, and what still constrains the list.
//
// Precision is tested SEPARATELY from locale formatting: the contract is
// "USD carries two fraction digits", not "USD renders with a comma". Locale
// rendering is covered in money.test.ts and in each platform's freeze suite.
// ============================================

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { CURRENCY_SIGN, FRACTION_DIGITS, formatAmount, fractionDigits } from '../index'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../../..')
const read = (rel: string): string => readFileSync(resolve(repo, rel), 'utf8')

/** The product's active currencies. Mirrors currencyCodeSchema. */
const ACTIVE = ['AFN', 'USD', 'PKR', 'IRR'] as const

describe('precision contract, independent of locale', () => {
  it.each([
    ['AFN', 0],
    ['USD', 2],
    ['PKR', 0],
    ['IRR', 0],
  ] as const)('%s carries %i fraction digits', (currency, digits) => {
    expect(fractionDigits(currency)).toBe(digits)
  })

  it('the mapping is declared exactly once and covers every active currency', () => {
    for (const code of ACTIVE) expect(FRACTION_DIGITS[code]).toBeDefined()
  })

  // Locale-agnostic. The decimal separator is asked of Intl rather than
  // guessed, because "," is the DECIMAL mark in some locales and the GROUP
  // mark in others — guessing made this test read 1,235 as three decimals.
  const decimalSeparator = (locale: string): string =>
    new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === 'decimal')!.value

  const fractionLength = (formatted: string, locale: string): number => {
    const parts = formatted.split(decimalSeparator(locale))
    return parts.length > 1 ? parts[parts.length - 1]!.length : 0
  }

  it.each(['fa-IR', 'en', 'ps-AF'])('holds in the %s locale', (locale) => {
    expect(fractionLength(formatAmount(1234.5, 'AFN', locale), locale)).toBe(0)
    expect(fractionLength(formatAmount(1234.5, 'PKR', locale), locale)).toBe(0)
    expect(fractionLength(formatAmount(1234.5, 'IRR', locale), locale)).toBe(0)
    expect(fractionLength(formatAmount(1234.5, 'USD', locale), locale)).toBe(2)
  })

  it('§8 matrix: AFN 1234 groups without decimals, USD 1234.5 pads to .50', () => {
    expect(formatAmount(1234, 'AFN', 'en')).toBe('1,234')
    expect(formatAmount(1234.5, 'USD', 'en')).toBe('1,234.50')
    expect(formatAmount(1234, 'PKR', 'en')).toBe('1,234')
    expect(formatAmount(1234, 'IRR', 'en')).toBe('1,234')
  })
})

describe('§4 formatting never mutates the stored value', () => {
  it('a zero-decimal currency does not round the underlying number', () => {
    const stored = 100.5
    expect(formatAmount(stored, 'AFN', 'en')).toBe('101')
    expect(stored).toBe(100.5)
  })

  it('no exported formatter returns a number', () => {
    expect(typeof formatAmount(100.5, 'AFN', 'en')).toBe('string')
  })
})

describe('§9 the list is now open — and what still constrains it', () => {
  /**
   * ⚠️ THIS SECTION USED TO ASSERT THE OPPOSITE.
   *
   * It pinned `z.enum(['AFN','USD','PKR','IRR'])` and checked that EUR stayed
   * absent from seven files. That was a real product policy and it is recorded
   * in lesson 81 — the four-code list was a decision, not leftover hardcoding.
   *
   * The owner opened it (task T1): the business trades metals, and
   * `packages/ui-contract` already catalogued 25 codes including the ISO 4217
   * metal codes while onboarding filtered all but four of them out.
   *
   * The policy changed, so this test changed WITH it — deliberately, in the
   * same commit. What survives is the part that was never about which
   * currencies: an unknown code must not borrow another currency's precision.
   */

  it('every code the schema accepts has a precision', () => {
    // THE INVARIANT THAT REPLACED THE OLD ONE. Widening the schema without
    // extending FRACTION_DIGITS produces money with no precision contract —
    // a wrong amount, not a missing option.
    const schema = read('packages/validation/src/schemas/common.schema.ts')
    const block = /export const CURRENCY_CODES = \[([\s\S]*?)\] as const/.exec(schema)?.[1]
    expect(block, 'CURRENCY_CODES not found').toBeDefined()

    const codes = [...block!.matchAll(/'([A-Z]{3})'/g)].map((m) => m[1]!)
    expect(codes.length).toBeGreaterThan(20)

    for (const code of codes) {
      expect(
        FRACTION_DIGITS[code as keyof typeof FRACTION_DIGITS],
        `${code} has no precision in FRACTION_DIGITS`,
      ).toBeDefined()
      expect(
        CURRENCY_SIGN[code as keyof typeof CURRENCY_SIGN],
        `${code} has no sign in CURRENCY_SIGN`,
      ).toBeDefined()
    }
  })

  it('the precision tiers are the real ISO minor units', () => {
    // Spot-checks across all three tiers. Getting one of these wrong is a
    // rounding error of a factor of ten or a thousand on a real invoice.
    expect(fractionDigits('AFN')).toBe(0)
    expect(fractionDigits('JPY')).toBe(0)
    expect(fractionDigits('USD')).toBe(2)
    expect(fractionDigits('GBP')).toBe(2)
    expect(fractionDigits('IQD')).toBe(3)
  })

  it('⚠️ metals are priced to the milligram, not the centigram', () => {
    // XAU here means «one gram of gold» as the unit of account. Two decimals
    // would round every gold invoice to 10mg.
    for (const metal of ['XAU', 'XAG', 'XPT', 'XPD'] as const) {
      expect(fractionDigits(metal)).toBe(3)
    }
  })

  it('no code carries an invented symbol', () => {
    // Metals have no currency glyph. Saying «g» is honest; borrowing a symbol
    // that means another currency is not.
    for (const metal of ['XAU', 'XAG', 'XPT', 'XPD'] as const) {
      expect(CURRENCY_SIGN[metal]).toBe('g')
    }
  })
})

describe('§9 no silent fallback to another currency — UNCHANGED', () => {
  /**
   * The part of §9 that was never about which currencies are active. A code
   * outside the list must resolve to `undefined`, not to somebody else's
   * precision.
   *
   * ⚠️ The rogue code is now 'ZZZ'. It used to be 'GBP', which is an ACTIVE
   * currency since T1 — a test whose sentinel became real would have passed
   * for the wrong reason.
   */
  it('an unknown code cannot resolve to USD precision', () => {
    const rogue = 'ZZZ' as unknown as 'USD'
    expect(FRACTION_DIGITS[rogue]).toBeUndefined()
  })

  it('an unknown code gets no symbol', () => {
    const rogue = 'ZZZ' as unknown as 'USD'
    expect(CURRENCY_SIGN[rogue]).toBeUndefined()
  })
})
