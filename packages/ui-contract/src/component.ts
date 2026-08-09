// ============================================
// Component contracts — variants and tones, with the platform aliases that
// already exist in the codebase mapped onto them.
//
// IMPORTANT: this file changes nothing at runtime. The three platforms keep
// their current union names and their current rendering. What this adds is a
// canonical vocabulary plus a compiler-checked translation, so the drift is
// explicit instead of accidental.
//
// The drift found in the audit:
//
//   concept    | mobile        | desktop  | web
//   -----------|---------------|----------|--------
//   brand tone | 'primary'     | 'brand'  | —
//   error tone | 'destructive' | 'danger' | 'danger'
//
// Canonical choice: 'brand' and 'danger'.
//   * 'brand' because 'primary' is already overloaded — it names the Button's
//     main variant AND the text role for body copy.
//   * 'danger' because two of three platforms already use it, and it reads as
//     a tone rather than an action ('destructive' is the action).
// ============================================

import type { SemanticColor } from './color-roles'

// ─── Tone ──────────────────────────────────────────────────────────────────

/** Canonical tone vocabulary for Badge, StatusChip and any tonal surface. */
export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'

/** The role a tone paints its foreground with. Background is the soft variant. */
export const TONE_FOREGROUND = {
  neutral: 'text.secondary',
  brand: 'interactive.primary',
  success: 'status.success',
  warning: 'status.warning',
  danger: 'status.danger',
  info: 'status.info',
} as const satisfies Record<Tone, SemanticColor>

/** Existing mobile `BadgeTone` (packages/mobile-ui/src/components/badge.tsx). */
export type MobileBadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'destructive' | 'info'

/** Existing desktop `BadgeTone` (apps/desktop/src/components/ui/primitives.tsx). */
export type DesktopBadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand'

export const MOBILE_TONE_ALIAS = {
  neutral: 'neutral',
  primary: 'brand',
  success: 'success',
  warning: 'warning',
  destructive: 'danger',
  info: 'info',
} as const satisfies Record<MobileBadgeTone, Tone>

export const DESKTOP_TONE_ALIAS = {
  neutral: 'neutral',
  brand: 'brand',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
} as const satisfies Record<DesktopBadgeTone, Tone>

// ─── Text ──────────────────────────────────────────────────────────────────

/** Existing mobile `TextTone` (packages/mobile-ui/src/components/text.tsx). */
export type MobileTextTone =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'onBrand'

export const MOBILE_TEXT_TONE_ROLE = {
  primary: 'text.primary',
  secondary: 'text.secondary',
  tertiary: 'text.tertiary',
  brand: 'interactive.primary',
  success: 'status.success',
  warning: 'status.warning',
  danger: 'status.danger',
  info: 'status.info',
  onBrand: 'text.onBrand',
} as const satisfies Record<MobileTextTone, SemanticColor>

// ─── Button ────────────────────────────────────────────────────────────────

/** Canonical Button variants. Matches desktop's existing cva variants exactly. */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'

/** Matches desktop's existing sizes exactly. */
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonContract {
  readonly background: SemanticColor | null
  readonly foreground: SemanticColor
  readonly border: SemanticColor | null
}

export const BUTTON_VARIANTS = {
  primary: {
    background: 'interactive.primary',
    foreground: 'interactive.onPrimary',
    border: null,
  },
  secondary: {
    background: 'surface.muted',
    foreground: 'text.primary',
    border: null,
  },
  ghost: { background: null, foreground: 'text.secondary', border: null },
  outline: {
    background: null,
    foreground: 'text.primary',
    border: 'border.default',
  },
  danger: {
    background: 'status.danger',
    foreground: 'status.onDanger',
    border: null,
  },
} as const satisfies Record<ButtonVariant, ButtonContract>

// ─── Dialog ────────────────────────────────────────────────────────────────

/**
 * What a dialog is FOR, not how it renders. The platform adapter picks the
 * surface: web `dialog.tsx`/`sheet.tsx`, desktop modal/side panel, mobile
 * `bottom-sheet.tsx`/`Modal`.
 */
export type DialogRole = 'confirm' | 'pick' | 'form' | 'detail'

export const DIALOG_SURFACE = {
  confirm: { web: 'modal', desktop: 'modal', mobile: 'modal' },
  pick: { web: 'sheet', desktop: 'panel', mobile: 'bottomSheet' },
  form: { web: 'modal', desktop: 'panel', mobile: 'fullScreen' },
  detail: { web: 'page', desktop: 'masterDetail', mobile: 'stackScreen' },
} as const satisfies Record<DialogRole, Record<'web' | 'desktop' | 'mobile', string>>
