// ============================================
// BEHAVIOR FREEZE — desktop money/date formatting.
//
// These are CHARACTERIZATION tests. They record what the code does TODAY,
// including the parts that are arguably wrong (see "known quirks" below).
// They exist so that the planned move to a shared formatter cannot silently
// change a displayed invoice figure.
//
// If one of these fails, the formatter's OUTPUT changed. That is either a
// deliberate, reviewed decision — update the expectation and say why in the
// commit — or a regression. It is never "just a test being annoying".
//
// Locale note: `formatAmount` reads `i18n.language`, defaulting to 'fa-IR'.
// fa-IR and fa-AF produce identical output for plain grouped numbers, so
// these expectations hold for both.
// ============================================

jest.mock('@/shared/i18n', () => ({ i18n: { language: 'fa-IR' } }))

import { CURRENCY_CODES, currencySign, formatAmount, formatDate, formatMoney } from '../currency'

describe('FREEZE: currencySign', () => {
  it('maps every code in the shared Zod union', () => {
    expect(CURRENCY_CODES).toEqual(expect.arrayContaining(['AFN', 'IRR', 'USD', 'PKR']))
  })

  it.each([
    ['AFN', '؋'],
    ['IRR', '﷼'],
    ['USD', '$'],
    ['PKR', '₨'],
  ])('%s -> %s', (code, sign) => {
    expect(currencySign(code as 'AFN')).toBe(sign)
  })
})

describe('FREEZE: formatAmount — fa-IR, maximumFractionDigits: 0', () => {
  it.each([
    // [input, frozen output]
    [0, '۰'],
    [1234.567, '۱٬۲۳۵'],
    [1234567.891, '۱٬۲۳۴٬۵۶۸'],
    [999999999.999, '۱٬۰۰۰٬۰۰۰٬۰۰۰'],
    [0.5, '۱'],
  ])('formats %p as %p', (input, expected) => {
    expect(formatAmount(input)).toBe(expected)
  })

  it('uses Persian digits and the Arabic thousands separator U+066C', () => {
    expect(formatAmount(1000)).toBe('۱٬۰۰۰')
    expect(formatAmount(1000)).toContain('٬')
  })

  // ── Known quirks, frozen deliberately ──────────────────────────────────

  it('QUIRK: rounds half away from zero, so 0.5 displays as 1 — decimals are never shown', () => {
    expect(formatAmount(0.5)).toBe('۱')
    expect(formatAmount(0.4)).toBe('۰')
  })

  it('QUIRK: small negatives collapse to a signed zero ("−۰")', () => {
    // U+200E LEFT-TO-RIGHT MARK then U+2212 MINUS SIGN — not ASCII "-".
    expect(formatAmount(-0.4)).toBe('‎−۰')
  })

  it('QUIRK: negatives use U+2212 MINUS SIGN prefixed by U+200E, not ASCII hyphen', () => {
    const out = formatAmount(-1234.5)
    expect(out).toBe('‎−۱٬۲۳۵')
    expect(out).not.toContain('-')
  })
})

describe('FREEZE: formatMoney — sign is appended AFTER the amount', () => {
  it.each([
    [1234.567, 'AFN', '۱٬۲۳۵ ؋'],
    // RE-BASELINED at Stage 4. Was '۱٬۲۳۵ $'.
    // Per-currency decimal policy (product decision, Stage 0 doc §9): USD
    // displays 2 decimals, every other active currency displays 0. This is
    // the ONLY value in this suite the canonicalisation changed.
    [1234.567, 'USD', '۱٬۲۳۴٫۵۷ $'],
    [1234.567, 'PKR', '۱٬۲۳۵ ₨'],
    [1234.567, 'IRR', '۱٬۲۳۵ ﷼'],
    [0, 'AFN', '۰ ؋'],
  ])('formatMoney(%p, %p) === %p', (value, code, expected) => {
    expect(formatMoney(value, code as 'AFN')).toBe(expected)
  })

  it('USD pads to exactly two decimals even when whole', () => {
    expect(formatMoney(1000, 'USD')).toBe('۱٬۰۰۰٫۰۰ $')
  })

  it('CONTRACT: amount and sign are separated by exactly one ASCII space', () => {
    expect(formatMoney(1, 'AFN')).toBe('۱ ؋')
  })
})

describe('FREEZE: formatDate', () => {
  it.each([null, undefined, '', 'not-a-date'])('renders an em dash for %p', (input) => {
    expect(formatDate(input as string)).toBe('—')
  })

  it('formats a valid date with year/month/day in the active locale', () => {
    // Asserting shape, not the exact Jalali string: the ICU data behind the
    // month name varies by Node build, and pinning it would make this test
    // fail on a Node upgrade for no product reason.
    const out = formatDate(new Date('2024-03-15T00:00:00Z'))
    expect(out).not.toBe('—')
    expect(out).toMatch(/[۰-۹]/)
  })
})
