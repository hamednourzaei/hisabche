import { describe, expect, it } from 'vitest'

import { formatCompactCount } from '../compact'

describe('formatCompactCount', () => {
  it.each([
    [0, '0'],
    [12, '12'],
    [999, '999'],
    [1000, '1k'],
    [1300, '1.3k'],
    [1399, '1.3k'],
    [1999, '1.9k'],
    [12_450, '12.4k'],
    [999_999, '999.9k'],
    [1_000_000, '1M'],
    [1_250_000, '1.2M'],
    [-5, '0'],
    [12.8, '12'],
  ])('en: %i → %s', (n, expected) => {
    expect(formatCompactCount(n, 'en')).toBe(expected)
  })

  it('fa digits follow the language, the suffix stays k / M', () => {
    expect(formatCompactCount(0, 'fa')).toBe('۰')
    expect(formatCompactCount(999, 'fa')).toBe('۹۹۹')
    expect(formatCompactCount(1000, 'fa')).toMatch(/^۱k$/)
    expect(formatCompactCount(1300, 'fa')).toMatch(/^۱.۳k$/)
    expect(formatCompactCount(1999, 'fa')).toMatch(/^۱.۹k$/)
    expect(formatCompactCount(999_999, 'fa')).toMatch(/^۹۹۹.۹k$/)
    expect(formatCompactCount(1_000_000, 'fa')).toMatch(/^۱M$/)
    expect(formatCompactCount(-10, 'fa')).toBe('۰')
    expect(formatCompactCount(12.8, 'fa')).toBe('۱۲')
  })

  it('af digits follow the Dari locale, the suffix stays k / M', () => {
    expect(formatCompactCount(0, 'af')).toBe('۰')
    expect(formatCompactCount(999, 'af')).toBe('۹۹۹')
    expect(formatCompactCount(1000, 'af')).toMatch(/^۱k$/)
    expect(formatCompactCount(1999, 'af')).toMatch(/^۱.۹k$/)
    expect(formatCompactCount(999_999, 'af')).toMatch(/^۹۹۹.۹k$/)
    expect(formatCompactCount(1_000_000, 'af')).toMatch(/^۱M$/)
    expect(formatCompactCount(-5, 'af')).toBe('۰')
    expect(formatCompactCount(12.8, 'af')).toBe('۱۲')
  })
})
