// ============================================
// Canonical colour tokens.
//
// Source of truth: packages/ui/src/styles/globals.css (Hisabche v3.1,
// dark-first, Emerald/Teal). Values here are transcribed EXACTLY — the
// parity test in __tests__/parity.test.ts parses that CSS file and fails if
// a single triplet drifts, in either direction.
//
// Colours are stored as bare HSL triplets ("165 75% 51%") because that is the
// shape Tailwind's `hsl(var(--x) / <alpha-value>)` pattern needs on web. Use
// `hsl()` from ./css to get a React-Native-parsable string.
//
// Brand and semantic hues are theme-independent; only surfaces, text, lines
// and effects flip between dark and light.
// ============================================

/** A bare HSL triplet: "<hue> <saturation>% <lightness>%". */
export type HslTriplet = string

export const brand = {
  primary: '165 75% 51%',
  primaryFg: '210 40% 8%',
  primaryHover: '164 74% 47%',
  primaryLight: '166 76% 63%',
  secondary: '174 79% 28%',
  accent: '168 78% 56%',
  dark: '210 33% 9%',
  black: '213 29% 6%',
} as const

export const semantic = {
  success: '142 72% 38%',
  successFg: '0 0% 100%',
  warning: '38 92% 50%',
  warningFg: '192 55% 6%',
  destructive: '0 84% 60%',
  destructiveFg: '0 0% 100%',
  info: '199 89% 48%',
  infoFg: '0 0% 100%',
} as const

/** Surfaces, text, lines and effects — the parts that flip with the theme. */
export interface ThemeColors {
  surfaceBase: HslTriplet
  surfaceMuted: HslTriplet
  surfaceElevated: HslTriplet
  surfaceOverlay: HslTriplet

  fgPrimary: HslTriplet
  fgSecondary: HslTriplet
  fgTertiary: HslTriplet

  borderDefault: HslTriplet
  borderStrong: HslTriplet

  /** Non-HSL effect values, kept verbatim. */
  glassBg: string
  glassBorder: string
  shadowPremium: string

  /** Theme-dependent accent aliases. */
  cyan: HslTriplet
  emerald: HslTriplet
}

export const darkTheme: ThemeColors = {
  surfaceBase: '210 33% 9%',
  surfaceMuted: '206 28% 15%',
  surfaceElevated: '207 30% 12%',
  surfaceOverlay: '207 30% 12%',

  fgPrimary: '165 35% 97%',
  fgSecondary: '168 15% 65%',
  fgTertiary: '168 10% 50%',

  borderDefault: '206 26% 19%',
  borderStrong: '206 26% 26%',

  glassBg: 'rgba(16, 24, 32, 0.80)',
  glassBorder: 'rgba(36, 224, 176, 0.14)',
  shadowPremium: '0 10px 30px rgba(11, 15, 20, 0.20), 0 0 30px rgba(36, 224, 176, 0.10)',

  cyan: '168 78% 56%',
  emerald: '165 74% 63%',
}

// The light theme was deliberately re-tuned in v3.1: a warm, low-saturation
// off-white (hue 40) rather than a teal-tinted one, with cards staying pure
// white so they lift off the background without heavy shadows. Text is a very
// dark cool grey, never pure black. Do not "correct" these hues back toward
// the brand teal — the warmth is the decision.
export const lightTheme: ThemeColors = {
  surfaceBase: '40 16% 97%',
  surfaceMuted: '40 12% 94%',
  surfaceElevated: '0 0% 100%',
  surfaceOverlay: '40 14% 96%',

  fgPrimary: '220 18% 13%',
  fgSecondary: '220 9% 40%',
  fgTertiary: '220 7% 55%',

  borderDefault: '40 10% 88%',
  borderStrong: '40 10% 79%',

  glassBg: 'rgba(255, 255, 255, 0.78)',
  glassBorder: 'rgba(15, 127, 116, 0.10)',
  shadowPremium: '0 1px 2px rgba(16, 20, 24, 0.04), 0 12px 32px -12px rgba(16, 20, 24, 0.12)',

  cyan: '168 70% 46%',
  emerald: '165 70% 55%',
}

export const gradients = {
  brand: 'linear-gradient(135deg, #37E6C3 0%, #24E0B0 20%, #1FD3A3 45%, #0F7F74 70%, #0A6664 100%)',
  brandHover:
    'linear-gradient(135deg, #55E9C6 0%, #37E6C3 20%, #24E0B0 45%, #12897C 70%, #0C5957 100%)',
  success: 'linear-gradient(135deg, #37E6C3 0%, #1FD3A3 55%, #0F7F74 100%)',
} as const

/** Ordered stops of --gradient-brand, for platforms that cannot parse CSS gradients. */
export const brandGradientStops = ['#37E6C3', '#24E0B0', '#1FD3A3', '#0F7F74', '#0A6664'] as const

export const focusRing = '0 0 0 4px rgba(36, 224, 176, 0.20)'

export const themes = { dark: darkTheme, light: lightTheme } as const
export type ThemeName = keyof typeof themes
