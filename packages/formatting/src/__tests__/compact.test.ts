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
    [12_450, '12.4k'],
    [999_999, '999.9k'],
    [1_250_000, '1.2M'],
  ])('en: %i → %s', (n, expected) => {
    expect(formatCompactCount(n, 'en')).toBe(expected)
  })

  it('fa digits follow the language, the suffix stays k', () => {
    expect(formatCompactCount(1300, 'fa')).toMatch(/^۱.۳k$/)
    expect(formatCompactCount(999, 'fa')).toBe('۹۹۹')
  })
})
