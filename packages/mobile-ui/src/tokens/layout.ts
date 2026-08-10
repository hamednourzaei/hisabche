// ============================================
// Spacing / radius / elevation tokens.
// Web tokens are rem based (1rem = 16px) — converted once, here.
// ============================================

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 48,
} as const

export type SpacingKey = keyof typeof spacing

// Matches --radius-* on the web. Cards sit at `2xl` (24px), the same value
// web's `rounded-2xl` card surface resolves to.
export const radius = {
  none: 0,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const

export type RadiusKey = keyof typeof radius

export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const
export const MIN_TOUCH_TARGET = 44

/** Motion budget — every value stays inside one 60 FPS frame budget per step. */
export const duration = {
  instant: 90,
  fast: 160,
  normal: 240,
  slow: 320,
} as const

export const elevation = {
  none: {},
  sm: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  /** Brand-tinted glow used by the hero KPI and the FAB. */
  brand: {
    shadowColor: '#24E0B0',
    shadowOpacity: 0.32,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
} as const

export type ElevationKey = keyof typeof elevation
