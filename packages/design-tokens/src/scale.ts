// ============================================
// Non-colour scales: typography, spacing, radius, motion, z-index, density.
//
// Source of truth: packages/ui/src/styles/globals.css. Transcribed exactly;
// the parity test enforces it.
//
// The web type scale uses `clamp()` for fluid sizing. React Native cannot
// parse clamp, so each entry carries both the CSS expression and the
// resolved min/max in px — mobile picks a value, web emits the clamp.
// ============================================

export const typography = {
  hero: { css: 'clamp(2.25rem, 5vw, 4rem)', minPx: 36, maxPx: 64 },
  h1: { css: 'clamp(1.75rem, 4vw, 2.5rem)', minPx: 28, maxPx: 40 },
  h2: { css: 'clamp(1.35rem, 3vw, 1.75rem)', minPx: 21.6, maxPx: 28 },
  h3: { css: 'clamp(1.1rem, 2.5vw, 1.35rem)', minPx: 17.6, maxPx: 21.6 },
  body: { css: 'clamp(0.875rem, 2vw, 1rem)', minPx: 14, maxPx: 16 },
  caption: { css: '0.813rem', minPx: 13.008, maxPx: 13.008 },
  legal: { css: '0.688rem', minPx: 11.008, maxPx: 11.008 },
} as const

export const leading = {
  tight: 1.2,
  normal: 1.55,
  relaxed: 1.65,
} as const

/** rem values, matching --space-N. The key IS the N in the CSS variable. */
export const space = {
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
} as const

/** Same scale in px, for React Native which has no rem. 1rem = 16px. */
export const spacePx = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const

export const radius = {
  xs: '6px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  full: '9999px',
} as const

export const radiusPx = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const

export const motion = {
  scale: 1,
  easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
  easeSoft: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const

export const zIndex = {
  base: 0,
  dropdown: 10,
  fab: 15,
  sticky: 20,
  fixed: 25,
  overlay: 30,
  modalBackdrop: 35,
  modal: 40,
  popover: 45,
  tooltip: 48,
  toast: 50,
  cmdk: 55,
} as const

// ── Density ────────────────────────────────────────────────────────────────
// Not present in globals.css. Desktop already declares these four values in
// apps/desktop/src/styles.css; they are lifted here verbatim so density
// becomes a first-class token rather than a per-app override, and so that
// sharing a DOM primitive between web and desktop cannot silently import
// web's roomier spacing.
//
// `web` and `mobile` values are NOT yet applied anywhere — they exist so the
// contract is complete. Applying them is a later, visible change.

export interface Density {
  rowHeight: number
  sidebarWidth: number
  sidebarWidthCollapsed: number
  toolbarHeight: number
  /** Minimum interactive target. Platform a11y floor. */
  minTouchTarget: number
}

export const density = {
  /** Verbatim from apps/desktop/src/styles.css — do not change without a visual review. */
  desktop: {
    rowHeight: 40,
    sidebarWidth: 248,
    sidebarWidthCollapsed: 64,
    toolbarHeight: 52,
    minTouchTarget: 32,
  },
  web: {
    rowHeight: 48,
    sidebarWidth: 264,
    sidebarWidthCollapsed: 72,
    toolbarHeight: 56,
    minTouchTarget: 40,
  },
  mobile: {
    rowHeight: 64,
    sidebarWidth: 0,
    sidebarWidthCollapsed: 0,
    toolbarHeight: 56,
    minTouchTarget: 44,
  },
} as const satisfies Record<string, Density>

export type DensityName = keyof typeof density
