// ============================================
// CANONICAL DRIFT RATCHET — mobile tokens vs @hisabche/design-tokens.
//
// After the Stage 2 migration, brand/semantic/dark are DERIVED, so they
// cannot drift by construction. The assertions below still exist because
// "derived" is a property of the current implementation, not a guarantee —
// if someone hardcodes a value back in, these go red.
//
// The LIGHT theme is the interesting half. It is knowingly stale (globals.css
// v3.1 re-tuned the web light palette to warm hue-40; this port predates it).
// The "still diverges" block asserts the divergence AS IT IS. It fails in
// both useful directions:
//
//   * drifts further  -> red
//   * gets aligned    -> red, telling you to delete LEGACY_LIGHT and this
//                        block, and derive from `lightTheme`
// ============================================

import { brand, darkTheme, hslLegacy, lightTheme, semantic } from '@hisabche/design-tokens'

import { darkColors, lightColors } from '../colors'

describe('DERIVED: brand and semantic come from canonical', () => {
  it.each([
    ['primary', brand.primary],
    ['primaryFg', brand.primaryFg],
    ['primaryHover', brand.primaryHover],
    ['primaryLight', brand.primaryLight],
    ['secondary', brand.secondary],
    ['accent', brand.accent],
    ['success', semantic.success],
    ['successFg', semantic.successFg],
    ['warning', semantic.warning],
    ['warningFg', semantic.warningFg],
    ['destructive', semantic.destructive],
    ['destructiveFg', semantic.destructiveFg],
    ['info', semantic.info],
    ['infoFg', semantic.infoFg],
  ])('%s', (key, canonical) => {
    expect(darkColors[key as keyof typeof darkColors]).toBe(hslLegacy(canonical))
    expect(lightColors[key as keyof typeof lightColors]).toBe(hslLegacy(canonical))
  })
})

describe('DERIVED: the whole dark theme comes from canonical', () => {
  it.each([
    ['surfaceBase', darkTheme.surfaceBase],
    ['surfaceMuted', darkTheme.surfaceMuted],
    ['surfaceElevated', darkTheme.surfaceElevated],
    ['surfaceOverlay', darkTheme.surfaceOverlay],
    ['fgPrimary', darkTheme.fgPrimary],
    ['fgSecondary', darkTheme.fgSecondary],
    ['fgTertiary', darkTheme.fgTertiary],
    ['borderDefault', darkTheme.borderDefault],
    ['borderStrong', darkTheme.borderStrong],
  ])('%s', (key, canonical) => {
    expect(darkColors[key as keyof typeof darkColors]).toBe(hslLegacy(canonical))
  })

  it('glass effects are passed through verbatim', () => {
    expect(darkColors.glassBg).toBe(darkTheme.glassBg)
    expect(darkColors.glassBorder).toBe(darkTheme.glassBorder)
  })
})

describe('ALIGNED: the light theme now comes from canonical too', () => {
  it.each([
    ['surfaceBase', lightTheme.surfaceBase],
    ['surfaceMuted', lightTheme.surfaceMuted],
    ['surfaceElevated', lightTheme.surfaceElevated],
    ['surfaceOverlay', lightTheme.surfaceOverlay],
    ['fgPrimary', lightTheme.fgPrimary],
    ['fgSecondary', lightTheme.fgSecondary],
    ['fgTertiary', lightTheme.fgTertiary],
    ['borderDefault', lightTheme.borderDefault],
    ['borderStrong', lightTheme.borderStrong],
  ])('%s', (key, canonical) => {
    expect(lightColors[key as keyof typeof lightColors]).toBe(hslLegacy(canonical))
  })

  it('glass effects are passed through verbatim, like dark', () => {
    expect(lightColors.glassBg).toBe(lightTheme.glassBg)
    expect(lightColors.glassBorder).toBe(lightTheme.glassBorder)
  })

  it('NO token is stale any more — the drift is closed', () => {
    const comparable = [
      ['surfaceBase', lightTheme.surfaceBase],
      ['surfaceMuted', lightTheme.surfaceMuted],
      ['surfaceElevated', lightTheme.surfaceElevated],
      ['surfaceOverlay', lightTheme.surfaceOverlay],
      ['fgPrimary', lightTheme.fgPrimary],
      ['fgSecondary', lightTheme.fgSecondary],
      ['fgTertiary', lightTheme.fgTertiary],
      ['borderDefault', lightTheme.borderDefault],
      ['borderStrong', lightTheme.borderStrong],
    ] as const

    const stale = comparable.filter(
      ([key, canonical]) => lightColors[key as keyof typeof lightColors] !== hslLegacy(canonical),
    )
    expect(stale.map(([k]) => k)).toEqual([])
  })
})
