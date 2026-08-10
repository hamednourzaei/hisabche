// ============================================
// Avatar renders server data — a customer name that may not exist. It used to
// call `.length` on the prop directly, so a single invoice with no customer
// and no invoice number crashed the whole invoice list through the error
// boundary. These pin the degraded cases.
// ============================================

import { avatarPresentation, PLACEHOLDER_INITIAL } from '../avatar'

describe('avatarPresentation', () => {
  it('takes the first letter of a single-word name', () => {
    expect(avatarPresentation('مجید').initials).toBe('م')
  })

  it('takes the first letter of the first two words only', () => {
    expect(avatarPresentation('مجید طلافروش زاده').initials).toBe('مط')
  })

  it('collapses repeated whitespace between words', () => {
    expect(avatarPresentation('Ali    Reza').initials).toBe('AR')
  })

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an empty string', ''],
    ['whitespace only', '   '],
  ])('falls back to a placeholder for %s rather than throwing', (_label, value) => {
    expect(() => avatarPresentation(value)).not.toThrow()
    expect(avatarPresentation(value).initials).toBe(PLACEHOLDER_INITIAL)
  })

  it('produces a usable hue even with no name', () => {
    // The hue feeds an hsl() string; NaN would render an invalid colour.
    const { hue } = avatarPresentation(undefined)
    expect(Number.isFinite(hue)).toBe(true)
    expect(hue).toBeGreaterThanOrEqual(0)
    expect(hue).toBeLessThan(360)
  })

  it('is deterministic — the same customer always looks the same', () => {
    expect(avatarPresentation('مجید').hue).toBe(avatarPresentation('مجید').hue)
  })

  it('ignores surrounding whitespace when deriving the colour', () => {
    expect(avatarPresentation('  مجید  ').hue).toBe(avatarPresentation('مجید').hue)
  })

  it('gives different names different hues', () => {
    expect(avatarPresentation('Ali').hue).not.toBe(avatarPresentation('Reza').hue)
  })

  it('keeps every hue inside the valid range', () => {
    for (const name of ['a', 'zzzzzzzzzzzzzzzz', 'مجید طلافروش', '12345', '!@#$%']) {
      const { hue } = avatarPresentation(name)
      expect(hue).toBeGreaterThanOrEqual(0)
      expect(hue).toBeLessThan(360)
    }
  })
})
