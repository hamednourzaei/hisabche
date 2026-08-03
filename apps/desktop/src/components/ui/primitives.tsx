// ============================================
// Desktop primitives.
//
// Styling comes entirely from the web design tokens (globals.css v3.1) via
// Tailwind classes — no colour, spacing or radius is written by hand here.
// Dense by default: desktop rows are 40px, not mobile's 56px.
// ============================================

import React, { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { twMerge } from 'tailwind-merge'
import clsx, { type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// ─── Button ───────────────────────────────────────────────
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] font-medium ' +
    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))] ' +
    'disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap',
  {
    variants: {
      variant: {
        primary:
          'bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))] hover:bg-[hsl(var(--color-primary-hover))]',
        secondary:
          'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-overlay))]',
        ghost: 'text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]',
        outline:
          'border border-[hsl(var(--border-default))] text-[hsl(var(--fg-primary))] hover:border-[hsl(var(--border-strong))]',
        danger:
          'bg-[hsl(var(--color-destructive))] text-[hsl(var(--color-destructive-fg))] hover:opacity-90',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs',
        md: 'h-9 px-3.5 text-sm',
        lg: 'h-11 px-5 text-sm',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, ...props },
  ref
) {
  return <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
})

// ─── Input ────────────────────────────────────────────────
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid}
      className={cn(
        'h-9 w-full rounded-[var(--radius-sm)] bg-[hsl(var(--surface-muted))] px-3 text-sm',
        'text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))]',
        'border border-[hsl(var(--border-default))] outline-none',
        'focus:border-[hsl(var(--color-primary))]',
        invalid && 'border-[hsl(var(--color-destructive))]',
        className
      )}
      {...props}
    />
  )
})

// ─── Card ─────────────────────────────────────────────────
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-md)] border border-[hsl(var(--border-default))]',
        'bg-[hsl(var(--surface-elevated))] p-4',
        className
      )}
    >
      {children}
    </div>
  )
}

// ─── Badge ────────────────────────────────────────────────
export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand'

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: 'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]',
  success: 'bg-[hsl(var(--color-success)/0.15)] text-[hsl(var(--color-success))]',
  warning: 'bg-[hsl(var(--color-warning)/0.15)] text-[hsl(var(--color-warning))]',
  danger: 'bg-[hsl(var(--color-destructive)/0.15)] text-[hsl(var(--color-destructive))]',
  info: 'bg-[hsl(var(--color-info)/0.15)] text-[hsl(var(--color-info))]',
  brand: 'bg-[hsl(var(--color-primary)/0.15)] text-[hsl(var(--color-primary))]',
}

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        BADGE_TONE[tone]
      )}
    >
      {children}
    </span>
  )
}

// ─── Skeleton ─────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-[var(--radius-xs)] bg-[hsl(var(--surface-muted))]', className)} />
}
