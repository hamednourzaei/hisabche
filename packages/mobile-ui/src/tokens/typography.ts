// ============================================
// Typography — Vazirmatn, mapped onto the web type scale.
//
// Financial figures get their own ramp: tabular figures, tighter leading and
// negative tracking so long amounts stay dense and readable at a glance.
// ============================================

import type { TextStyle } from 'react-native'

// Only Regular and Bold ship with the app (matching apps/web/public/fonts).
export const fontFamily = {
  regular: 'Vazirmatn-Regular',
  medium: 'Vazirmatn-Bold',
  bold: 'Vazirmatn-Bold',
} as const

export const fontSize = {
  legal: 11,
  caption: 13,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 22,
  '2xl': 28,
  '3xl': 34,
  '4xl': 42,
} as const

export type TypographyVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'caption'
  | 'legal'
  | 'numeric'
  | 'numericLarge'
  | 'numericHero'

/** Tabular figures keep digits from shifting as amounts change. */
const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] }

export const typography: Record<TypographyVariant, TextStyle> = {
  display: { fontFamily: fontFamily.bold, fontSize: fontSize['3xl'], lineHeight: 42, letterSpacing: -0.6 },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, lineHeight: 30, letterSpacing: -0.3 },
  heading: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, lineHeight: 26, letterSpacing: -0.2 },
  subheading: { fontFamily: fontFamily.medium, fontSize: fontSize.base, lineHeight: 24 },
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.base, lineHeight: 25 },
  bodyStrong: { fontFamily: fontFamily.medium, fontSize: fontSize.base, lineHeight: 25 },
  label: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, lineHeight: 20 },
  caption: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, lineHeight: 18 },
  legal: { fontFamily: fontFamily.regular, fontSize: fontSize.legal, lineHeight: 16 },

  numeric: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    lineHeight: 28,
    letterSpacing: -0.4,
    ...TABULAR,
  },
  numericLarge: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    lineHeight: 34,
    letterSpacing: -0.8,
    ...TABULAR,
  },
  numericHero: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['4xl'],
    lineHeight: 50,
    letterSpacing: -1.4,
    ...TABULAR,
  },
}
