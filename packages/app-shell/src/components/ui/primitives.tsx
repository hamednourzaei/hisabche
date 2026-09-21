// ============================================
// Desktop primitives — thin adapters over the shared web components.
//
// These used to be private reimplementations of Button / Input / Card / Badge /
// Skeleton. They looked close but were not: the desktop button was
// `rounded-[var(--radius-sm)]` (8px) where the web button is a pill, and its
// sizes were h-7/h-9/h-11 against web's h-9/h-10/h-11. Every desktop screen
// therefore rendered visibly squarer, smaller controls than the same screen in
// a browser.
//
// Now every one of them renders `packages/ui`, so desktop inherits web geometry
// by construction. What is left here is only a vocabulary adapter: desktop call
// sites say `variant="primary"` / `variant="danger"` / `tone="success"`, which
// the shared components spell `default` / `destructive` / `success`. Translating
// in one place beat editing eight call sites and leaves the desktop wording
// intact.
// ============================================

import React, {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import {
  Badge as SharedBadge,
  Button as SharedButton,
  Card as SharedCard,
  Input as SharedInput,
  Skeleton as SharedSkeleton,
} from '@hisabche/ui'

export { cn } from '@hisabche/ui'

// ─── Button ───────────────────────────────────────────────────────────────

/** Desktop's variant words. `primary` and `danger` are desktop spellings of the
 *  shared `default` and `destructive`. */
export type DesktopButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'
export type DesktopButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const VARIANT: Record<
  DesktopButtonVariant,
  'default' | 'secondary' | 'ghost' | 'outline' | 'destructive'
> = {
  primary: 'default',
  secondary: 'secondary',
  ghost: 'ghost',
  outline: 'outline',
  danger: 'destructive',
}

/** `md` is desktop's name for the shared default size. */
const SIZE: Record<DesktopButtonSize, 'default' | 'sm' | 'lg' | 'icon'> = {
  sm: 'sm',
  md: 'default',
  lg: 'lg',
  icon: 'icon',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: DesktopButtonVariant | undefined
  size?: DesktopButtonSize | undefined
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', ...props },
  ref,
) {
  return <SharedButton ref={ref} variant={VARIANT[variant]} size={SIZE[size]} {...props} />
})

// ─── Input ────────────────────────────────────────────────────────────────

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Desktop call sites mark a failed field with this; the shared Input carries
   *  the same state on `aria-invalid`, which its styles already key off. */
  invalid?: boolean | undefined
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, ...props },
  ref,
) {
  return <SharedInput ref={ref} aria-invalid={invalid || undefined} {...props} />
})

// ─── Card ─────────────────────────────────────────────────────────────────

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <SharedCard className={className}>{children}</SharedCard>
}

// ─── Badge ────────────────────────────────────────────────────────────────

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand'

/** Desktop tones onto shared variants. `info` has no shared equivalent and
 *  reads closest to `secondary`; `brand` is the default gradient badge. */
const TONE: Record<BadgeTone, 'default' | 'secondary' | 'destructive' | 'success' | 'warning'> = {
  neutral: 'secondary',
  success: 'success',
  warning: 'warning',
  danger: 'destructive',
  info: 'secondary',
  brand: 'default',
}

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <SharedBadge variant={TONE[tone]}>{children}</SharedBadge>
}

// ─── Skeleton ─────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <SharedSkeleton className={className} />
}
