// ============================================
// Color tokens — derived 1:1 from the production web design system
// (packages/ui/src/styles/globals.css v3.1, Emerald/Teal, dark-first).
//
// React Native parses `hsl()` / `hsla()` natively, so the values stay
// character-identical to the web variables. Dark is the base theme; light
// is the override — same as the web.
// ============================================

export interface ColorScheme {
  // ── Brand ──
  primary: string
  primaryFg: string
  primaryHover: string
  primaryLight: string
  primarySoft: string
  secondary: string
  accent: string

  // ── Semantic ──
  success: string
  successFg: string
  successSoft: string
  warning: string
  warningFg: string
  warningSoft: string
  destructive: string
  destructiveFg: string
  destructiveSoft: string
  info: string
  infoFg: string
  infoSoft: string

  // ── Surfaces (4-level elevation ladder) ──
  surfaceBase: string
  surfaceMuted: string
  surfaceElevated: string
  surfaceOverlay: string

  // ── Text (3-tier ramp) ──
  fgPrimary: string
  fgSecondary: string
  fgTertiary: string

  // ── Lines ──
  borderDefault: string
  borderStrong: string

  // ── Effects ──
  glassBg: string
  glassBorder: string
  scrim: string

  /** Brand gradient stops, ordered. Matches --gradient-brand. */
  gradientBrand: readonly [string, string, string, string, string]
}

const BRAND_GRADIENT = ['#37E6C3', '#24E0B0', '#1FD3A3', '#0F7F74', '#0A6664'] as const

// Brand + semantic hues are theme-independent on the web; only surfaces,
// text and lines flip. Kept in one place so the two schemes cannot drift.
const constants = {
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

  gradientBrand: BRAND_GRADIENT,
} as const

export const darkColors: ColorScheme = {
  ...constants,

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

export const lightColors: ColorScheme = {
  ...constants,

  primarySoft: 'hsla(165, 75%, 40%, 0.12)',
  successSoft: 'hsla(142, 72%, 38%, 0.12)',
  warningSoft: 'hsla(38, 92%, 50%, 0.14)',
  destructiveSoft: 'hsla(0, 84%, 60%, 0.12)',
  infoSoft: 'hsla(199, 89%, 48%, 0.12)',

  surfaceBase: 'hsl(168, 25%, 98%)',
  surfaceMuted: 'hsl(166, 22%, 95%)',
  surfaceElevated: 'hsl(0, 0%, 100%)',
  surfaceOverlay: 'hsl(166, 22%, 95%)',

  fgPrimary: 'hsl(210, 33%, 9%)',
  fgSecondary: 'hsl(174, 15%, 38%)',
  fgTertiary: 'hsl(168, 8%, 53%)',

  borderDefault: 'hsl(166, 22%, 87%)',
  borderStrong: 'hsl(166, 22%, 77%)',

  glassBg: 'rgba(255, 255, 255, 0.82)',
  glassBorder: 'rgba(15, 127, 116, 0.12)',
  scrim: 'rgba(16, 24, 32, 0.45)',
}
