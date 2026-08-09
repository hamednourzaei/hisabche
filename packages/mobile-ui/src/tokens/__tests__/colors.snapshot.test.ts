// ============================================
// RUNTIME SNAPSHOT — the exact colour values mobile renders today.
//
// Captured BEFORE colors.ts was migrated onto @hisabche/design-tokens, by
// executing the module and serialising its exports. Written as explicit
// literals rather than a jest snapshot file so the values are reviewable in
// the diff and cannot be silently regenerated with `-u`.
//
// Stage 2 is an architecture migration. It must not change a single rendered
// colour. If this suite stays green across the refactor, that is proved.
//
// The eight stale LIGHT tokens are included deliberately. They diverge from
// canonical (see design-tokens' drift ratchet) and that divergence is being
// PRESERVED on purpose — fixing it is a separate, visually reviewable change.
// ============================================

import { darkColors, lightColors } from '../colors'

const BRAND_AND_SEMANTIC = {
  primary: 'hsl(165, 75%, 51%)',
  primaryFg: 'hsl(210, 40%, 8%)',
  primaryHover: 'hsl(164, 74%, 47%)',
  primaryLight: 'hsl(166, 76%, 63%)',
  secondary: 'hsl(174, 79%, 28%)',
  accent: 'hsl(168, 78%, 56%)',
  success: 'hsl(142, 72%, 38%)',
  successFg: 'hsl(0, 0%, 100%)',
  warning: 'hsl(38, 92%, 50%)',
  warningFg: 'hsl(192, 55%, 6%)',
  destructive: 'hsl(0, 84%, 60%)',
  destructiveFg: 'hsl(0, 0%, 100%)',
  info: 'hsl(199, 89%, 48%)',
  infoFg: 'hsl(0, 0%, 100%)',
  gradientBrand: ['#37E6C3', '#24E0B0', '#1FD3A3', '#0F7F74', '#0A6664'],
}

const DARK_BASELINE = {
  ...BRAND_AND_SEMANTIC,

  primarySoft: 'hsla(165, 75%, 51%, 0.14)',
  successSoft: 'hsla(142, 72%, 45%, 0.16)',
  warningSoft: 'hsla(38, 92%, 50%, 0.16)',
  destructiveSoft: 'hsla(0, 84%, 60%, 0.16)',
  infoSoft: 'hsla(199, 89%, 48%, 0.16)',

  surfaceBase: 'hsl(210, 33%, 9%)',
  surfaceMuted: 'hsl(206, 28%, 15%)',
  surfaceElevated: 'hsl(207, 30%, 12%)',
  surfaceOverlay: 'hsl(207, 30%, 12%)',

  fgPrimary: 'hsl(165, 35%, 97%)',
  fgSecondary: 'hsl(168, 15%, 65%)',
  fgTertiary: 'hsl(168, 10%, 50%)',

  borderDefault: 'hsl(206, 26%, 19%)',
  borderStrong: 'hsl(206, 26%, 26%)',

  glassBg: 'rgba(16, 24, 32, 0.80)',
  glassBorder: 'rgba(36, 224, 176, 0.14)',
  scrim: 'rgba(6, 10, 14, 0.72)',
}

const LIGHT_BASELINE = {
  ...BRAND_AND_SEMANTIC,

  primarySoft: 'hsla(165, 75%, 40%, 0.12)',
  successSoft: 'hsla(142, 72%, 38%, 0.12)',
  warningSoft: 'hsla(38, 92%, 50%, 0.14)',
  destructiveSoft: 'hsla(0, 84%, 60%, 0.12)',
  infoSoft: 'hsla(199, 89%, 48%, 0.12)',

  // ── The eight stale tokens. Preserved on purpose. ──
  surfaceBase: 'hsl(168, 25%, 98%)',
  surfaceMuted: 'hsl(166, 22%, 95%)',
  surfaceOverlay: 'hsl(166, 22%, 95%)',
  fgPrimary: 'hsl(210, 33%, 9%)',
  fgSecondary: 'hsl(174, 15%, 38%)',
  fgTertiary: 'hsl(168, 8%, 53%)',
  borderDefault: 'hsl(166, 22%, 87%)',
  borderStrong: 'hsl(166, 22%, 77%)',
  glassBg: 'rgba(255, 255, 255, 0.82)',

  // ── Agrees with canonical ──
  surfaceElevated: 'hsl(0, 0%, 100%)',

  glassBorder: 'rgba(15, 127, 116, 0.12)',
  scrim: 'rgba(16, 24, 32, 0.45)',
}

describe('SNAPSHOT: mobile dark theme renders identical values', () => {
  it('matches the pre-migration baseline exactly', () => {
    expect(darkColors).toEqual(DARK_BASELINE)
  })

  it.each(Object.entries(DARK_BASELINE))('%s', (key, expected) => {
    expect(darkColors[key as keyof typeof darkColors]).toEqual(expected)
  })
})

describe('SNAPSHOT: mobile light theme renders identical values', () => {
  it('matches the pre-migration baseline exactly', () => {
    expect(lightColors).toEqual(LIGHT_BASELINE)
  })

  it.each(Object.entries(LIGHT_BASELINE))('%s', (key, expected) => {
    expect(lightColors[key as keyof typeof lightColors]).toEqual(expected)
  })
})

describe('SNAPSHOT: the two schemes expose exactly the same keys', () => {
  it('no key is added or dropped by the migration', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort())
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(DARK_BASELINE).sort())
  })
})
