// ============================================
// Colour tokens for React Native.
//
// Brand, semantic and the entire DARK theme are now DERIVED from
// @hisabche/design-tokens — the canonical source transcribed from
// packages/ui/src/styles/globals.css. They are no longer hand-copied and
// cannot drift.
//
// The LIGHT theme is deliberately NOT derived yet. See LEGACY_LIGHT below.
//
// `hslLegacy` emits the comma-separated CSS Color 3 form, because React
// Native's colour parser is not guaranteed to accept the modern
// space-separated syntax on every engine. Values are identical either way;
// this keeps the rendered strings byte-for-byte what they were before the
// migration (proved by __tests__/colors.snapshot.test.ts).
// ============================================

import { brand, brandGradientStops, darkTheme, hslLegacy, semantic } from '@hisabche/design-tokens'

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

// Brand + semantic hues are theme-independent on the web; only surfaces,
// text and lines flip. Derived from canonical — do not hardcode here.
const constants = {
  primary: hslLegacy(brand.primary),
  primaryFg: hslLegacy(brand.primaryFg),
  primaryHover: hslLegacy(brand.primaryHover),
  primaryLight: hslLegacy(brand.primaryLight),
  secondary: hslLegacy(brand.secondary),
  accent: hslLegacy(brand.accent),

  success: hslLegacy(semantic.success),
  successFg: hslLegacy(semantic.successFg),
  warning: hslLegacy(semantic.warning),
  warningFg: hslLegacy(semantic.warningFg),
  destructive: hslLegacy(semantic.destructive),
  destructiveFg: hslLegacy(semantic.destructiveFg),
  info: hslLegacy(semantic.info),
  infoFg: hslLegacy(semantic.infoFg),

  gradientBrand: brandGradientStops,
} as const

// ── Mobile-only tokens ─────────────────────────────────────────────────────
// The `*Soft` tints and `scrim` have no counterpart in globals.css: the web
// composes these inline per component, mobile needs them as named values for
// RN styles. They stay literal here until the web grows equivalents.
const darkSoft = {
  primarySoft: 'hsla(165, 75%, 51%, 0.14)',
  successSoft: 'hsla(142, 72%, 45%, 0.16)',
  warningSoft: 'hsla(38, 92%, 50%, 0.16)',
  destructiveSoft: 'hsla(0, 84%, 60%, 0.16)',
  infoSoft: 'hsla(199, 89%, 48%, 0.16)',
  scrim: 'rgba(6, 10, 14, 0.72)',
} as const

const lightSoft = {
  primarySoft: 'hsla(165, 75%, 40%, 0.12)',
  successSoft: 'hsla(142, 72%, 38%, 0.12)',
  warningSoft: 'hsla(38, 92%, 50%, 0.14)',
  destructiveSoft: 'hsla(0, 84%, 60%, 0.12)',
  infoSoft: 'hsla(199, 89%, 48%, 0.12)',
  scrim: 'rgba(16, 24, 32, 0.45)',
} as const

/** Fully derived from canonical — verified identical to the previous hand-copy. */
export const darkColors: ColorScheme = {
  ...constants,
  ...darkSoft,

  surfaceBase: hslLegacy(darkTheme.surfaceBase),
  surfaceMuted: hslLegacy(darkTheme.surfaceMuted),
  surfaceElevated: hslLegacy(darkTheme.surfaceElevated),
  surfaceOverlay: hslLegacy(darkTheme.surfaceOverlay),

  fgPrimary: hslLegacy(darkTheme.fgPrimary),
  fgSecondary: hslLegacy(darkTheme.fgSecondary),
  fgTertiary: hslLegacy(darkTheme.fgTertiary),

  borderDefault: hslLegacy(darkTheme.borderDefault),
  borderStrong: hslLegacy(darkTheme.borderStrong),

  glassBg: darkTheme.glassBg,
  glassBorder: darkTheme.glassBorder,
}

// ── LEGACY_LIGHT ───────────────────────────────────────────────────────────
// KNOWN DIVERGENCE, PRESERVED ON PURPOSE.
//
// globals.css v3.1 re-tuned the web light theme to a warm, low-saturation
// off-white (hue 40) with cool-grey text. This port predates that change and
// still carries the older teal-tinted palette (hue ~166-168). Eight tokens
// differ.
//
// It is NOT being aligned in this migration. Stage 2 is an architecture
// change; mixing a visible palette change into it would make any later UI
// regression impossible to attribute — migration or redesign? Aligning mobile
// light mode is its own reviewable change.
//
// The divergence is enforced, not merely commented: see
// __tests__/canonical-drift.test.ts, which fails BOTH if these drift further
// AND once they are aligned (at which point, delete this block and derive
// from `lightTheme` exactly as `darkColors` does above).
const LEGACY_LIGHT = {
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
} as const

export const lightColors: ColorScheme = {
  ...constants,
  ...lightSoft,
  ...LEGACY_LIGHT,
}
