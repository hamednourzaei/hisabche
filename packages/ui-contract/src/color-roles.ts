// ============================================
// Semantic colour roles.
//
// A role describes MEANING ("the colour of secondary body text"). Canonical
// tokens supply the VALUE. This file must never contain a hex, hsl or rgb
// literal — the contract test scans for exactly that.
//
//   CANONICAL TOKENS  ->  SEMANTIC CONTRACT  ->  PLATFORM ADAPTER  ->  COMPONENT
//
// Roles were derived from what the repository already renders (mobile
// TextTone/BadgeTone, desktop BadgeTone/buttonVariants, web Status). No role
// was invented that has no consumer today.
// ============================================

import type { ThemeColors, ThemeName } from '@hisabche/design-tokens'
import { brand, semantic, themes, type HslTriplet } from '@hisabche/design-tokens'

export type TextRole = 'text.primary' | 'text.secondary' | 'text.tertiary' | 'text.onBrand'

export type SurfaceRole = 'surface.base' | 'surface.muted' | 'surface.elevated' | 'surface.overlay'

export type BorderRole = 'border.default' | 'border.strong'

export type InteractiveRole =
  | 'interactive.primary'
  | 'interactive.primaryHover'
  | 'interactive.primaryLight'
  | 'interactive.onPrimary'
  | 'interactive.secondary'
  | 'interactive.accent'

export type StatusRole =
  | 'status.success'
  | 'status.onSuccess'
  | 'status.warning'
  | 'status.onWarning'
  | 'status.danger'
  | 'status.onDanger'
  | 'status.info'
  | 'status.onInfo'

export type SemanticColor = TextRole | SurfaceRole | BorderRole | InteractiveRole | StatusRole

/** Where a role's value comes from. Theme-dependent roles flip with the theme. */
export type ColorSource =
  | { readonly from: 'brand'; readonly key: keyof typeof brand }
  | { readonly from: 'semantic'; readonly key: keyof typeof semantic }
  | { readonly from: 'theme'; readonly key: keyof ThemeColors }

/**
 * The single mapping from meaning to canonical token. Exhaustive by
 * construction: `Record<SemanticColor, ...>` makes the compiler reject a new
 * role that has no mapping, and a mapping for a role that does not exist.
 */
export const SEMANTIC_COLORS = {
  'text.primary': { from: 'theme', key: 'fgPrimary' },
  'text.secondary': { from: 'theme', key: 'fgSecondary' },
  'text.tertiary': { from: 'theme', key: 'fgTertiary' },
  'text.onBrand': { from: 'brand', key: 'primaryFg' },

  'surface.base': { from: 'theme', key: 'surfaceBase' },
  'surface.muted': { from: 'theme', key: 'surfaceMuted' },
  'surface.elevated': { from: 'theme', key: 'surfaceElevated' },
  'surface.overlay': { from: 'theme', key: 'surfaceOverlay' },

  'border.default': { from: 'theme', key: 'borderDefault' },
  'border.strong': { from: 'theme', key: 'borderStrong' },

  'interactive.primary': { from: 'brand', key: 'primary' },
  'interactive.primaryHover': { from: 'brand', key: 'primaryHover' },
  'interactive.primaryLight': { from: 'brand', key: 'primaryLight' },
  'interactive.onPrimary': { from: 'brand', key: 'primaryFg' },
  'interactive.secondary': { from: 'brand', key: 'secondary' },
  'interactive.accent': { from: 'brand', key: 'accent' },

  'status.success': { from: 'semantic', key: 'success' },
  'status.onSuccess': { from: 'semantic', key: 'successFg' },
  'status.warning': { from: 'semantic', key: 'warning' },
  'status.onWarning': { from: 'semantic', key: 'warningFg' },
  'status.danger': { from: 'semantic', key: 'destructive' },
  'status.onDanger': { from: 'semantic', key: 'destructiveFg' },
  'status.info': { from: 'semantic', key: 'info' },
  'status.onInfo': { from: 'semantic', key: 'infoFg' },
} as const satisfies Record<SemanticColor, ColorSource>

/** Resolve a role to its canonical HSL triplet. Pure lookup, no formatting. */
export function resolveColor(role: SemanticColor, theme: ThemeName): HslTriplet {
  const source: ColorSource = SEMANTIC_COLORS[role]
  if (source.from === 'brand') return brand[source.key]
  if (source.from === 'semantic') return semantic[source.key]
  return themes[theme][source.key] as HslTriplet
}

/** Roles whose value depends on the active theme. */
export function isThemeDependent(role: SemanticColor): boolean {
  return SEMANTIC_COLORS[role].from === 'theme'
}

export const SEMANTIC_COLOR_ROLES = Object.keys(SEMANTIC_COLORS) as readonly SemanticColor[]
