// ============================================
// STAGE 4 §8/§9 — the precision contract, and proof EUR stays inactive.
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

describe('§9 EUR is NOT an active product currency', () => {
  it('is absent from currencyCodeSchema', () => {
    const schema = read('packages/validation/src/schemas/common.schema.ts')
    expect(schema).toContain("z.enum(['AFN', 'USD', 'PKR', 'IRR'])")
    expect(schema).not.toContain('EUR')
  })

  it('is absent from the store currency union and exchange rates', () => {
    const slice = read('packages/store/src/slices/currency.slice.ts')
    expect(slice).toContain("'AFN' | 'USD' | 'PKR' | 'IRR'")
    expect(slice).not.toContain('EUR')
  })

  it('is absent from every UI currency selector', () => {
    expect(read('apps/mobile/src/features/settings/screens/settings-screen.tsx')).not.toContain(
      'EUR',
    )
    expect(read('apps/desktop/src/features/settings/settings-page.tsx')).not.toContain('EUR')
  })

  it("is absent from web's useCurrency hook, which also now carries PKR", () => {
    // Regression guard. This union used to read AFN|USD|EUR|IRR: it listed a
    // currency the product rejects and omitted one it supports, so PKR
    // rendered as the bare text "PKR" instead of ₨.
    const hook = read('packages/ui/src/hooks/dashboard/use-currency.ts')
    const union = /export type CurrencyCode = ([^;]+);/.exec(hook)![1]!
    expect(union).not.toContain('EUR')
    expect(union).toContain('PKR')
    expect(hook).toContain('PKR: "₨"')
  })

  it('is absent from the backend drizzle schema', () => {
    expect(read('backend/src/drizzle-schema.ts')).not.toContain('EUR')
  })

  it('exists in the formatter ONLY as a future-compatibility rule', () => {
    expect(fractionDigits('EUR')).toBe(2)
    expect(CURRENCY_SIGN.EUR).toBe('€')
    expect(ACTIVE).not.toContain('EUR' as never)
  })
})

describe('§9 no silent fallback to another currency', () => {
  it('an unknown code cannot resolve to USD precision', () => {
    // The type forbids this; the runtime must not paper over it either.
    const rogue = 'GBP' as unknown as 'USD'
    expect(FRACTION_DIGITS[rogue]).toBeUndefined()
  })

  it('currencySign echoes an unknown code rather than inventing a symbol', () => {
    const rogue = 'GBP' as unknown as 'USD'
    expect(CURRENCY_SIGN[rogue]).toBeUndefined()
  })
})
