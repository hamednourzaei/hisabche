import { darkColors, lightColors } from '../../tokens/colors'
import { radius, spacing } from '../../tokens/layout'
import { typography } from '../../tokens/typography'

describe('design tokens', () => {
  it('keeps brand hues identical across themes', () => {
    expect(darkColors.primary).toBe(lightColors.primary)
    expect(darkColors.success).toBe(lightColors.success)
    expect(darkColors.gradientBrand).toEqual(lightColors.gradientBrand)
  })

  it('matches the web primary token exactly', () => {
    expect(darkColors.primary).toBe('hsl(165, 75%, 51%)')
  })

  it('flips surfaces and text between themes', () => {
    expect(darkColors.surfaceBase).not.toBe(lightColors.surfaceBase)
    expect(darkColors.fgPrimary).not.toBe(lightColors.fgPrimary)
  })

  it('exposes the full four-level surface ladder in both themes', () => {
    const keys = ['surfaceBase', 'surfaceMuted', 'surfaceElevated', 'surfaceOverlay'] as const
    keys.forEach((key) => {
      expect(darkColors[key]).toMatch(/^hsl/)
      expect(lightColors[key]).toMatch(/^hsl/)
    })
  })

  it('exposes a three-tier text ramp', () => {
    expect(new Set([darkColors.fgPrimary, darkColors.fgSecondary, darkColors.fgTertiary]).size).toBe(3)
  })

  it('uses tabular figures for every numeric variant', () => {
    const numeric = ['numeric', 'numericLarge', 'numericHero'] as const
    numeric.forEach((variant) => {
      expect(typography[variant].fontVariant).toContain('tabular-nums')
    })
  })

  it('keeps spacing and radius on the web scale', () => {
    expect(spacing.lg).toBe(16)
    expect(radius.lg).toBe(16)
  })
})
