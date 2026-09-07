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

// ============================================
// PATCH 1 / L0.1 — the `currencies` table and the code must agree.
//
// ⚠️ THE TABLE HOLDS 162 CURRENCIES. THE PRODUCT CAN FORMAT 25.
//
// `currencies.is_active` marks which ones this build supports. If that set
// ever drifts from `CURRENCY_CODES` — someone activates a row without adding
// its precision to `FRACTION_DIGITS` — the picker starts offering a code the
// formatter cannot honour, and rule 9 makes that a WRONG AMOUNT rather than a
// missing option.
//
// The migration's UPDATE is the database half of this contract. This is the
// code half.
// ============================================

describe('the currencies migration activates exactly what the code supports', () => {
  const migration = read('docs/patch-01-currencies-migration.sql')

  /** The codes the migration marks active. */
  const activated = (): string[] => {
    const block = /SET is_active = true\s*\n\s*WHERE code IN \(([\s\S]*?)\);/.exec(migration)?.[1]
    expect(block, 'the activation UPDATE was not found').toBeDefined()
    return [...block!.matchAll(/'([A-Z]{3})'/g)].map((m) => m[1]!)
  }

  it('the migration seeds a full reference list', () => {
    // A table with only the 25 active codes would not be a reference table —
    // the point is that the other 137 exist and can be activated later.
    const seeded = [...migration.matchAll(/^ {2}\('([A-Z]{3})',/gm)].map((m) => m[1]!)
    expect(seeded.length).toBeGreaterThan(150)
    expect(new Set(seeded).size, 'duplicate code in the seed').toBe(seeded.length)
  })

  it('⚠️ the activated set is exactly CURRENCY_CODES', () => {
    const schema = read('packages/validation/src/schemas/common.schema.ts')
    const block = /export const CURRENCY_CODES = \[([\s\S]*?)\] as const/.exec(schema)?.[1]
    const codes = [...block!.matchAll(/'([A-Z]{3})'/g)].map((m) => m[1]!)

    expect([...activated()].sort()).toEqual([...codes].sort())
  })

  it('every activated code has a precision AND a sign', () => {
    // The same invariant as the section above, checked from the migration's
    // side: activating a code the formatter does not know produces money with
    // no precision contract.
    for (const code of activated()) {
      expect(
        FRACTION_DIGITS[code as keyof typeof FRACTION_DIGITS],
        `${code} is activated but has no precision`,
      ).toBeDefined()
      expect(
        CURRENCY_SIGN[code as keyof typeof CURRENCY_SIGN],
        `${code} is activated but has no sign`,
      ).toBeDefined()
    }
  })

  /**
   * ⚠️ THE FOUR CODES WHERE THE PRODUCT DELIBERATELY DEPARTS FROM ISO.
   *
   * ISO is right that the afghani has 100 pul and the rupee 100 paisa. Nobody
   * prices in them, so the product writes these four without minor units —
   * the DECIMAL POLICY note in money.ts — and that is what every screen and
   * every invoice uses.
   *
   * The table keeps the ISO value because a reference table that lies is
   * useless for anything else. This list is what makes the divergence
   * reviewable rather than accidental: any OTHER mismatch still fails.
   */
  const ISO_OVERRIDES: Record<string, { iso: number; product: number }> = {
    AFN: { iso: 2, product: 0 },
    IRR: { iso: 2, product: 0 },
    IRT: { iso: 2, product: 0 },
    PKR: { iso: 2, product: 0 },
  }

  it('the seeded precision matches the code, except the four stated overrides', () => {
    const rows = [...migration.matchAll(/^ {2}\('([A-Z]{3})',(?:[^\n]*?), (\d)\),?$/gm)]
    const seeded = new Map(rows.map((m) => [m[1]!, Number(m[2])]))

    for (const code of activated()) {
      const inTable = seeded.get(code)
      const inCode = FRACTION_DIGITS[code as keyof typeof FRACTION_DIGITS]
      expect(inTable, `${code} not found in the seed`).toBeDefined()

      const override = ISO_OVERRIDES[code]
      if (override) {
        // The divergence must be exactly the one documented — not merely
        // "different", which would let a typo pass as an override.
        expect(inTable, `${code} table value changed`).toBe(override.iso)
        expect(inCode, `${code} product value changed`).toBe(override.product)
        continue
      }

      expect(inTable, `${code}: table says ${inTable}, code says ${inCode}`).toBe(inCode)
    }
  })

  it('the migration documents every override it takes', () => {
    // An override that is real but undocumented is how the next reader
    // concludes the table is simply wrong and "fixes" it.
    for (const code of Object.keys(ISO_OVERRIDES)) {
      expect(migration, `${code} override is not explained`).toContain(code)
    }
    expect(migration).toContain('DELIBERATELY DEPARTS')
  })

  it('the metals carry 3 in the table, matching the product decision', () => {
    // ISO records "N.A." for these. The product prices them by weight and
    // uses a milligram; two decimals would round every gold invoice to the
    // centigram. The table follows the code, and the migration says so.
    const rows = [...migration.matchAll(/^ {2}\('(X[A-Z]{2})',(?:[^\n]*?), (\d)\),?$/gm)]
    const seeded = new Map(rows.map((m) => [m[1]!, Number(m[2])]))

    for (const metal of ['XAU', 'XAG', 'XPT', 'XPD']) {
      expect(seeded.get(metal), `${metal} precision in the table`).toBe(3)
    }
  })

  it('⚠️ no foreign key is added in the migration itself', () => {
    // G3: existing rows may hold currency values that predate any list, and a
    // FK added blind fails on exactly those. The statements are present but
    // commented, to be run only after the orphan count comes back zero.
    const live = migration
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')

    expect(live).not.toMatch(/ADD CONSTRAINT \w*currency\w*_fkey/i)
    // …and they ARE present as commented statements, so the operator has them.
    expect(migration).toContain('products_currency_fkey')
  })
})
