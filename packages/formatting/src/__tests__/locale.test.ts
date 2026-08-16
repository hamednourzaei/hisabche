// ============================================
// Numbers rendered in Persian digits while the UI is in English was a
// long-standing complaint. The cause was components hardcoding 'fa-AF'/'fa-IR'
// instead of resolving from the active language. These pin the mapping.
// ============================================

import { describe, expect, it } from 'vitest'

import { resolveIntlLocale, usesLatinDigits } from '../locale'

describe('resolveIntlLocale', () => {
  it.each([
    ['fa', 'fa-IR'],
    ['fa-IR', 'fa-IR'],
    ['af', 'fa-AF'],
    ['fa-AF', 'fa-AF'],
    ['en', 'en'],
  ])('maps %s to %s', (input, expected) => {
    expect(resolveIntlLocale(input)).toBe(expected)
  })

  it('keeps Dari distinct from Iranian Persian', () => {
    // The two differ in calendar and month names, not only digits.
    expect(resolveIntlLocale('af')).not.toBe(resolveIntlLocale('fa'))
  })

  it.each([[null], [undefined], [''], ['de']])('falls back to Persian for %s', (input) => {
    expect(resolveIntlLocale(input as string | null | undefined)).toBe('fa-IR')
  })
})

describe('digit system', () => {
  it('reports Latin digits only for English', () => {
    expect(usesLatinDigits('en')).toBe(true)
    expect(usesLatinDigits('fa')).toBe(false)
    expect(usesLatinDigits('af')).toBe(false)
  })

  it('actually renders Latin digits for English', () => {
    // The whole point of the mapping — guard against a locale string that
    // resolves but still formats with Persian numerals.
    expect(new Intl.NumberFormat(resolveIntlLocale('en')).format(1234)).toMatch(/^[\d,]+$/)
  })

  it('renders Persian digits for Persian', () => {
    const formatted = new Intl.NumberFormat(resolveIntlLocale('fa')).format(1234)
    expect(formatted).not.toMatch(/[0-9]/)
  })
})
