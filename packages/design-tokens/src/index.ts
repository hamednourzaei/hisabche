// ============================================
// @hisabche/design-tokens — the single source of truth for Hisabche's visual
// language, consumed by web (DOM), desktop (Electron/DOM) and mobile (RN).
//
// Zero dependencies, zero JSX, zero framework. A colour exists in exactly one
// place in this repository: packages/design-tokens/src/color.ts.
//
// The values are transcribed from packages/ui/src/styles/globals.css and are
// held to it by src/__tests__/parity.test.ts, which parses that CSS at test
// time. Neither side can drift without a red test.
// ============================================

export {
  brand,
  semantic,
  darkTheme,
  lightTheme,
  themes,
  gradients,
  brandGradientStops,
  focusRing,
  type HslTriplet,
  type ThemeColors,
  type ThemeName,
} from './color'

export {
  typography,
  leading,
  space,
  spacePx,
  radius,
  radiusPx,
  motion,
  zIndex,
  density,
  type Density,
  type DensityName,
} from './scale'

export { hsl, hsla, hslLegacy, cssVars, resolvedColors } from './css'
