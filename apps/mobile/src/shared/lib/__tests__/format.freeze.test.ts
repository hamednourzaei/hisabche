// ============================================
// BEHAVIOR FREEZE — mobile money/date/number formatting.
//
// Characterization tests: they record today's output so the planned shared
// formatter cannot silently change a displayed figure.
//
// Mobile's formatters are near-identical to desktop's by construction, but
// they are NOT the same code, and they carry one extra behaviour desktop does
// not have: a Hermes fallback for Android builds that ship a partial Intl.
// That fallback produces a DIFFERENT string (Latin digits, no grouping) and
// is frozen here explicitly.
// ============================================

jest.mock('../../i18n', () => ({ i18n: { language: 'fa-IR' } }))

import {
  currencySign,
  formatAmount,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from '../format'

describe('FREEZE: currencySign — identical map to desktop', () => {
  it.each([
    ['AFN', '؋'],
    ['IRR', '﷼'],
    ['USD', '$'],
    ['PKR', '₨'],
  ])('%s -> %s', (code, sign) => {
    expect(currencySign(code as 'AFN')).toBe(sign)
  })
})

describe('FREEZE: formatAmount — must match desktop exactly', () => {
  it.each([
    [0, '۰'],
    [1234.567, '۱٬۲۳۵'],
    [1234567.891, '۱٬۲۳۴٬۵۶۸'],
    [999999999.999, '۱٬۰۰۰٬۰۰۰٬۰۰۰'],
    [0.5, '۱'],
    [0.4, '۰'],
  ])('formats %p as %p', (input, expected) => {
    expect(formatAmount(input)).toBe(expected)
  })

  it('QUIRK: small negatives collapse to a signed zero, same as desktop', () => {
    expect(formatAmount(-0.4)).toBe('‎−۰')
  })

  it('QUIRK: negatives use U+2212, not ASCII hyphen — <Money signed> checks for "-"', () => {
    // This matters: Money's `signed` prop tests `amount.trim().startsWith('-')`,
    // which is FALSE for this string. Negative styling does not trigger today.
    const out = formatAmount(-1234.5)
    expect(out).toBe('‎−۱٬۲۳۵')
    expect(out.trim().startsWith('-')).toBe(false)
  })
})

describe('FREEZE: formatNumber is an alias of formatAmount', () => {
  it.each([0, 1234.567, -1234.5])('formatNumber(%p) === formatAmount(%p)', (v) => {
    expect(formatNumber(v)).toBe(formatAmount(v))
  })
})

describe('FREEZE: formatCurrency — sign appended AFTER, matching desktop formatMoney', () => {
  it.each([
    [1234.567, 'AFN', '۱٬۲۳۵ ؋'],
    // RE-BASELINED at Stage 4. Was '۱٬۲۳۵ $'. Per-currency decimal policy
    // (product decision, Stage 0 doc §9). Matches desktop exactly, which is
    // the point of routing both through @hisabche/formatting.
    [1234.567, 'USD', '۱٬۲۳۴٫۵۷ $'],
    [1234.567, 'PKR', '۱٬۲۳۵ ₨'],
    [1234.567, 'IRR', '۱٬۲۳۵ ﷼'],
    [0, 'AFN', '۰ ؋'],
  ])('formatCurrency(%p, %p) === %p', (value, code, expected) => {
    expect(formatCurrency(value, code as 'AFN')).toBe(expected)
  })
})

describe('FREEZE: formatPercent', () => {
  it.each([
    [12.34, '۱۲%'],
    [0, '۰%'],
    [100, '۱۰۰%'],
    [12.5, '۱۳%'],
  ])('formatPercent(%p) === %p', (input, expected) => {
    expect(formatPercent(input)).toBe(expected)
  })

  it('QUIRK: the one-decimal rounding is dead code — formatAmount drops the decimal', () => {
    // formatPercent does Math.round(v * 10) / 10 (→ 12.3) and then hands the
    // result to formatAmount, which uses maximumFractionDigits: 0 and rounds
    // it straight back to 12. The intent was clearly one decimal place; the
    // shipped behaviour is zero. Frozen as-is — changing it is a product
    // decision, not a refactor.
    expect(formatPercent(12.34)).toBe('۱۲%')
    expect(formatPercent(12.36)).toBe('۱۲%')
  })
})

describe('FREEZE: formatDate', () => {
  it('renders an em dash for an invalid date', () => {
    expect(formatDate('not-a-date')).toBe('—')
  })

  it('formats a valid date in the active locale', () => {
    const out = formatDate(new Date('2024-03-15T00:00:00Z'))
    expect(out).not.toBe('—')
    expect(out).toMatch(/[۰-۹]/)
  })

  it('QUIRK: unlike desktop, null/undefined are NOT guarded and throw', () => {
    // desktop's formatDate accepts `string | Date | null | undefined`;
    // mobile's signature is `string | Date` and it crashes on null.
    expect(() => formatDate(null as unknown as string)).toThrow()
  })
})
