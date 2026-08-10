// ============================================
// Adaptive layout for React Native.
//
// The breakpoints are the web app's, verbatim (`packages/ui/tailwind.config.ts`
// → `screens`). Reusing them is the point: a tablet in landscape is 1024pt wide
// and must make the same layout decision the browser makes at 1024px, or the
// two renderers disagree about what "wide enough for two columns" means.
//
// This is a hook rather than a module constant because a tablet rotates. A
// value read once at import time would leave the app in portrait layout after
// the user turns the device.
// ============================================

import { useWindowDimensions } from 'react-native'

/** Web `screens`, in order. Values are the same numbers Tailwind uses. */
export const BREAKPOINTS = {
  xs: 480,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const

export type BreakpointKey = keyof typeof BREAKPOINTS

/**
 * Device class, named for the layout decision rather than the hardware.
 *
 *   phone   — one column, bottom tabs, full-width cards
 *   tablet  — two columns where the content earns it, wider gutters
 *   wide    — tablet in landscape and desktop-class widths
 */
export type DeviceClass = 'phone' | 'tablet' | 'wide'

export interface Layout {
  width: number
  height: number
  device: DeviceClass
  isPhone: boolean
  isTablet: boolean
  /** True on tablet and wider — the common test for "may use two columns". */
  isWide: boolean
  isLandscape: boolean
  /**
   * Columns a card grid should use.
   *
   * Web's dashboard KPI grid is `grid-cols-2 lg:grid-cols-4`; matching that
   * here is what keeps a tablet from rendering the phone's single column
   * stretched to 1024pt, which is the failure this layer exists to prevent.
   */
  columns: number
  /**
   * Page gutter. Phones use `spacing.lg` (16); wider screens get more, the same
   * way the web shell grows its padding past the `sm` breakpoint.
   */
  gutter: number
  /**
   * Cap on readable content width. Unbounded on a phone; on a tablet a
   * full-bleed form line becomes uncomfortably long, so it is centred instead.
   */
  contentMaxWidth: number | undefined
}

function classify(width: number): DeviceClass {
  if (width >= BREAKPOINTS.lg) return 'wide'
  if (width >= BREAKPOINTS.md) return 'tablet'
  return 'phone'
}

export function useLayout(): Layout {
  const { width, height } = useWindowDimensions()

  const device = classify(width)
  const isTablet = device === 'tablet'
  const isWide = device !== 'phone'

  return {
    width,
    height,
    device,
    isPhone: device === 'phone',
    isTablet,
    isWide,
    isLandscape: width > height,
    columns: device === 'wide' ? 4 : device === 'tablet' ? 2 : 1,
    gutter: device === 'phone' ? 16 : 24,
    contentMaxWidth: device === 'phone' ? undefined : device === 'tablet' ? 720 : 960,
  }
}

/**
 * Pick a value per device class, falling back to the narrower one.
 *
 * `responsive({ phone: 1, tablet: 2 })` on a wide screen returns 2 — a layout
 * only has to name the widths where it actually changes.
 */
export function responsive<T>(values: { phone: T; tablet?: T; wide?: T }, device: DeviceClass): T {
  if (device === 'wide') return values.wide ?? values.tablet ?? values.phone
  if (device === 'tablet') return values.tablet ?? values.phone
  return values.phone
}
