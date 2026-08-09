// ============================================
// BEHAVIOR FREEZE — web money / number / digit formatting.
//
// Characterization tests. They record what web does TODAY so the planned
// shared formatter cannot silently change a displayed or submitted figure.
//
// Web is the divergent platform. It has THREE separate formatting paths:
//
//   1. `formatCurrency` (lib/utils.ts)   — Intl `style: 'currency'`,
//                                          locale hardcoded to 'fa-AF',
//                                          up to 2 decimals, sign placed BY Intl
//   2. `formatThousands` (lib/thousands.ts) — regex grouping, Latin digits,
//                                          decimals preserved. Used by INPUTS.
//   3. ~43 raw `value.toLocaleString()` call sites across feature components,
//      which use the RUNTIME default locale and up to 3 decimals.
//
// Desktop and mobile use a fourth behaviour (integer-only, sign appended
// after). Those are frozen in their own suites. The differences are real and
// user-visible; see documents/PHASE_2_STAGE_0_MONEY_FREEZE.md.
// ============================================

import { describe, expect, it } from 'vitest'

import { toArabicNumbers, toPersianNumbers } from '../persian-numbers'
import { formatThousands, unformatThousands } from '../thousands'
import { formatCurrency } from '../utils'

// Intl separates the currency sign from the digits with U+00A0 NO-BREAK SPACE,
// not an ASCII space. Desktop and mobile use a plain ASCII space. Any naive
// string comparison between the two platforms' output fails on this alone.
const NBSP = ' '

describe('FREEZE: formatCurrency — Intl currency style, fa-AF, max 2 decimals', () => {
  it.each([
    ['AFN', `؋${NBSP}۱٬۲۳۴٫۵۷`],
    ['USD', `$${NBSP}۱٬۲۳۴٫۵۷`],
    ['PKR', `PKR${NBSP}۱٬۲۳۴٫۵۷`],
    ['IRR', `ریال${NBSP}۱٬۲۳۴٫۵۷`],
  ])('%s formats 1234.567 as %p', (code, expected) => {
    expect(formatCurrency(1234.567, code as 'AFN')).toBe(expected)
  })

  it('QUIRK: the separator is U+00A0, not ASCII space — desktop/mobile use ASCII', () => {
    expect(formatCurrency(1000, 'AFN')).toBe(`؋${NBSP}۱٬۰۰۰`)
    expect(formatCurrency(1000, 'AFN')).not.toBe('؋ ۱٬۰۰۰')
  })

  it('QUIRK: keeps up to 2 decimals — desktop and mobile show ZERO decimals', () => {
    // Same input, three different strings across the product:
    //   web      -> "؋ ۱٬۲۳۴٫۵۷"
    //   desktop  -> "۱٬۲۳۵ ؋"
    //   mobile   -> "۱٬۲۳۵ ؋"
    expect(formatCurrency(1234.567, 'AFN')).toContain('۱٬۲۳۴٫۵۷')
  })

  it('QUIRK: Intl places the sign BEFORE the amount; desktop/mobile append it AFTER', () => {
    expect(formatCurrency(1000, 'AFN').indexOf('؋')).toBe(0)
  })

  it('QUIRK: PKR and IRR render as "PKR" and "ریال", not the ₨ / ﷼ signs desktop and mobile use', () => {
    expect(formatCurrency(1, 'PKR')).toContain('PKR')
    expect(formatCurrency(1, 'PKR')).not.toContain('₨')
    expect(formatCurrency(1, 'IRR')).toContain('ریال')
    expect(formatCurrency(1, 'IRR')).not.toContain('﷼')
  })

  it('drops trailing decimals when the value is whole (minimumFractionDigits: 0)', () => {
    expect(formatCurrency(1000, 'AFN')).toBe(`؋${NBSP}۱٬۰۰۰`)
  })

  it('honours the explicit `en` locale with Latin digits', () => {
    expect(formatCurrency(1234.567, 'USD', 'en')).toBe('$1,234.57')
    expect(formatCurrency(1234.567, 'AFN', 'en')).toBe(`AFN${NBSP}1,234.57`)
  })

  it('formats zero and negatives', () => {
    expect(formatCurrency(0, 'AFN')).toBe(`؋${NBSP}۰`)
    // QUIRK: the trailing zero is dropped — "-$1,234.5", not "-$1,234.50".
    expect(formatCurrency(-1234.5, 'USD', 'en')).toBe('-$1,234.5')
  })
})

describe('FREEZE: formatThousands — the INPUT path. Latin digits, decimals preserved.', () => {
  it.each([
    [1234567, '1,234,567'],
    ['1234567', '1,234,567'],
    [0, '0'],
    ['0', '0'],
    [1234.56, '1,234.56'],
    ['1234.5', '1,234.5'],
    [null, ''],
    [undefined, ''],
    ['', ''],
  ])('formatThousands(%p) === %p', (input, expected) => {
    expect(formatThousands(input as string)).toBe(expected)
  })

  it('CRITICAL: never emits Persian digits — the value round-trips to Number()', () => {
    const shown = formatThousands(1234567.89)
    expect(shown).toBe('1,234,567.89')
    expect(Number(unformatThousands(shown))).toBe(1234567.89)
  })

  it('QUIRK: null/undefined/"" collapse to an empty string, but 0 survives as "0"', () => {
    expect(formatThousands(0)).toBe('0')
    expect(formatThousands('0')).toBe('0')
    expect(formatThousands(null)).toBe('')
    expect(formatThousands(undefined)).toBe('')
    expect(formatThousands('')).toBe('')
  })

  it('QUIRK: strips the minus sign — negative amounts lose their sign in inputs', () => {
    expect(formatThousands(-1234)).toBe('1,234')
    expect(unformatThousands('-1234')).toBe('1234')
  })
})

describe('FREEZE: unformatThousands — what actually reaches the API', () => {
  it.each([
    ['1,234,567', '1234567'],
    ['۱۲۳', '123'],
    ['1,234.56', '1234.56'],
    ['1.2.3', '1.23'],
    ['؋ 1,000', '1000'],
    ['abc', ''],
    [null, ''],
  ])('unformatThousands(%p) === %p', (input, expected) => {
    expect(unformatThousands(input as string)).toBe(expected)
  })

  it('FIXED (was Q7): Persian and Arabic-Indic digits are CONVERTED, not discarded', () => {
    // Stage 0 froze the broken behaviour: pasting "۱۲۳۴" submitted "" and a
    // mixed "1۲3۴" submitted "13". That is the user's own keyboard producing
    // values the form silently threw away. Now converted before stripping.
    expect(unformatThousands('۱۲۳۴')).toBe('1234')
    expect(unformatThousands('1۲3۴')).toBe('1234')
    expect(unformatThousands('١٢٣')).toBe('123')
  })

  it('the converted value still round-trips through Number()', () => {
    expect(Number(unformatThousands('۱٬۲۳۴'))).toBe(1234)
  })

  it('keeps only the first decimal point', () => {
    expect(unformatThousands('12.34.56')).toBe('12.3456')
  })
})

describe('FREEZE: persian-numbers — display-only digit shaping', () => {
  it.each([
    [0, '۰'],
    [1234567, '۱۲۳۴۵۶۷'],
    ['1,234.56', '۱,۲۳۴.۵۶'],
    ['abc', 'abc'],
  ])('toPersianNumbers(%p) === %p', (input, expected) => {
    expect(toPersianNumbers(input as string)).toBe(expected)
  })

  it('QUIRK: shapes digits but NOT separators — "," and "." stay Latin', () => {
    // Intl would produce "٬" (U+066C) and "٫" (U+066B). This helper does not,
    // so a value passed through formatThousands + toPersianNumbers looks
    // different from the same value passed through Intl.
    expect(toPersianNumbers('1,234.56')).toBe('۱,۲۳۴.۵۶')
    expect(toPersianNumbers('1,234.56')).not.toContain('٬')
  })

  it('toArabicNumbers uses the Arabic-Indic set, distinct from the Persian set', () => {
    expect(toArabicNumbers(123)).toBe('١٢٣')
    expect(toArabicNumbers(123)).not.toBe(toPersianNumbers(123))
  })

  it('is idempotent on already-shaped input', () => {
    expect(toPersianNumbers('۱۲۳')).toBe('۱۲۳')
  })
})
