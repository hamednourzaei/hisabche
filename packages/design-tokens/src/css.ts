// ============================================
// Platform adapters.
//
// `hsl()` turns a bare triplet into a colour string every platform can parse,
// including React Native (which handles hsl()/hsla() natively).
//
// `cssVars()` emits the `--name: value` map for a theme. It is the bridge for
// DOM platforms. It is NOT wired into globals.css yet — doing that is Stage 2
// and must be verified against a visual diff, because a single reordering
// could change cascade behaviour.
// ============================================

import {
  brand,
  gradients,
  focusRing,
  semantic,
  themes,
  type HslTriplet,
  type ThemeName,
} from './color'
import { leading, motion, radius, space, typography, zIndex } from './scale'

/** "165 75% 51%" -> "hsl(165 75% 51%)". Parsed natively by both DOM and RN. */
export function hsl(triplet: HslTriplet): string {
  return `hsl(${triplet})`
}

/** "165 75% 51%", 0.14 -> "hsla(165 75% 51% / 0.14)". */
export function hsla(triplet: HslTriplet, alpha: number): string {
  return `hsla(${triplet} / ${alpha})`
}

/**
 * "165 75% 51%" -> "hsl(165, 75%, 51%)" — the comma-separated CSS Color 3
 * form. React Native's colour parser is not guaranteed to accept the modern
 * space-separated syntax on every engine/version, so RN consumers use this.
 * Both forms describe the identical colour.
 */
export function hslLegacy(triplet: HslTriplet): string {
  const [h, s, l] = triplet.split(/\s+/)
  return `hsl(${h}, ${s}, ${l})`
}

/**
 * The CSS custom properties for one theme, in the same names globals.css uses.
 * Legacy `--hisab-*` aliases are included because ~80 web components still
 * reference them; they resolve through `var()` exactly as they do today.
 */
export function cssVars(theme: ThemeName): Record<string, string> {
  const t = themes[theme]

  return {
    // Motion
    '--motion-scale': String(motion.scale),
    '--ease-out': motion.easeOut,
    '--ease-soft': motion.easeSoft,

    // Type scale
    '--text-hero': typography.hero.css,
    '--text-h1': typography.h1.css,
    '--text-h2': typography.h2.css,
    '--text-h3': typography.h3.css,
    '--text-body': typography.body.css,
    '--text-caption': typography.caption.css,
    '--text-legal': typography.legal.css,
    '--leading-tight': String(leading.tight),
    '--leading-normal': String(leading.normal),
    '--leading-relaxed': String(leading.relaxed),

    // Spacing
    ...Object.fromEntries(Object.entries(space).map(([k, v]) => [`--space-${k}`, v])),

    // Brand
    '--color-primary': brand.primary,
    '--color-primary-fg': brand.primaryFg,
    '--color-primary-hover': brand.primaryHover,
    '--color-primary-light': brand.primaryLight,
    '--color-secondary': brand.secondary,
    '--color-accent': brand.accent,
    '--color-dark': brand.dark,
    '--color-black': brand.black,

    // Semantic
    '--color-success': semantic.success,
    '--color-success-fg': semantic.successFg,
    '--color-warning': semantic.warning,
    '--color-warning-fg': semantic.warningFg,
    '--color-destructive': semantic.destructive,
    '--color-destructive-fg': semantic.destructiveFg,
    '--color-info': semantic.info,
    '--color-info-fg': semantic.infoFg,

    // Theme-dependent
    '--surface-base': t.surfaceBase,
    '--surface-muted': t.surfaceMuted,
    '--surface-elevated': t.surfaceElevated,
    '--surface-overlay': t.surfaceOverlay,
    '--fg-primary': t.fgPrimary,
    '--fg-secondary': t.fgSecondary,
    '--fg-tertiary': t.fgTertiary,
    '--border-default': t.borderDefault,
    '--border-strong': t.borderStrong,
    '--glass-bg': t.glassBg,
    '--glass-border': t.glassBorder,
    '--shadow-premium': t.shadowPremium,
    '--color-cyan': t.cyan,
    '--color-emerald': t.emerald,

    // Radii
    ...Object.fromEntries(Object.entries(radius).map(([k, v]) => [`--radius-${k}`, v])),

    // Z-index
    '--z-base': String(zIndex.base),
    '--z-dropdown': String(zIndex.dropdown),
    '--z-fab': String(zIndex.fab),
    '--z-sticky': String(zIndex.sticky),
    '--z-fixed': String(zIndex.fixed),
    '--z-overlay': String(zIndex.overlay),
    '--z-modal-backdrop': String(zIndex.modalBackdrop),
    '--z-modal': String(zIndex.modal),
    '--z-popover': String(zIndex.popover),
    '--z-tooltip': String(zIndex.tooltip),
    '--z-toast': String(zIndex.toast),
    '--z-cmdk': String(zIndex.cmdk),

    // Gradients / effects
    '--gradient-brand': gradients.brand,
    '--gradient-brand-hover': gradients.brandHover,
    '--gradient-success': gradients.success,
    '--glass-blur': 'blur(18px)',
    '--focus-ring': focusRing,

    // Legacy aliases — still referenced across packages/ui
    '--hisab-primary': 'var(--color-primary)',
    '--hisab-primary-fg': 'var(--color-primary-fg)',
    '--hisab-success': 'var(--color-success)',
    '--hisab-success-fg': 'var(--color-success-fg)',
    '--hisab-warning': 'var(--color-warning)',
    '--hisab-warning-fg': 'var(--color-warning-fg)',
    '--hisab-destructive': 'var(--color-destructive)',
    '--hisab-destructive-fg': 'var(--color-destructive-fg)',
    '--hisab-background': 'var(--surface-base)',
    '--hisab-foreground': 'var(--fg-primary)',
    '--hisab-card': 'var(--surface-elevated)',
    '--hisab-muted': 'var(--surface-muted)',
    '--hisab-muted-fg': 'var(--fg-secondary)',
    '--hisab-border': 'var(--border-default)',
    '--hisab-ring': 'var(--color-primary)',
    '--color-purple': 'var(--color-primary)',
  }
}

/** Ready-to-parse colour strings for React Native, which has no CSS variables. */
export function resolvedColors(theme: ThemeName) {
  const t = themes[theme]
  return {
    primary: hsl(brand.primary),
    primaryFg: hsl(brand.primaryFg),
    primaryHover: hsl(brand.primaryHover),
    primaryLight: hsl(brand.primaryLight),
    secondary: hsl(brand.secondary),
    accent: hsl(brand.accent),

    success: hsl(semantic.success),
    successFg: hsl(semantic.successFg),
    warning: hsl(semantic.warning),
    warningFg: hsl(semantic.warningFg),
    destructive: hsl(semantic.destructive),
    destructiveFg: hsl(semantic.destructiveFg),
    info: hsl(semantic.info),
    infoFg: hsl(semantic.infoFg),

    surfaceBase: hsl(t.surfaceBase),
    surfaceMuted: hsl(t.surfaceMuted),
    surfaceElevated: hsl(t.surfaceElevated),
    surfaceOverlay: hsl(t.surfaceOverlay),

    fgPrimary: hsl(t.fgPrimary),
    fgSecondary: hsl(t.fgSecondary),
    fgTertiary: hsl(t.fgTertiary),

    borderDefault: hsl(t.borderDefault),
    borderStrong: hsl(t.borderStrong),

    glassBg: t.glassBg,
    glassBorder: t.glassBorder,
  }
}
