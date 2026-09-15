import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '../../lib/utils'
import { Loader2 } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════════════════
   Button v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   No class-variance-authority dependency
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Types ─────────────────────────────────────────────────────────────────

type ButtonVariant =
  'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'success'

type ButtonSize = 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  loading?: boolean
  fullWidth?: boolean
  variant?: ButtonVariant
  size?: ButtonSize
}

// ─── Style Maps ────────────────────────────────────────────────────────────

const variantStyles: Record<ButtonVariant, string> = {
  default:
    'bg-[image:var(--gradient-brand)] text-white hover:brightness-110 shadow-sm shadow-[hsl(var(--color-primary)/0.15)]',
  destructive:
    'bg-[hsl(var(--color-destructive))] text-white hover:brightness-110 shadow-sm shadow-[hsl(var(--color-destructive)/0.15)]',
  outline:
    'border border-[hsl(var(--border-default))] bg-transparent text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
  secondary:
    'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted)/0.8)]',
  ghost:
    'bg-transparent text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
  link: 'bg-transparent text-[hsl(var(--color-primary))] underline-offset-4 hover:underline p-0 h-auto',
  success:
    'bg-[hsl(var(--color-success))] text-white hover:brightness-110 shadow-sm shadow-[hsl(var(--color-success)/0.15)]',
}

const sizeStyles: Record<ButtonSize, string> = {
  default: 'h-10 px-4 py-2 rounded-full',
  sm: 'h-9 px-3 rounded-full text-xs',
  lg: 'h-11 px-8 rounded-full',
  icon: 'h-10 w-10 rounded-full',
  'icon-sm': 'h-8 w-8 rounded-full',
}

// ─── Component ─────────────────────────────────────────────────────────────

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'default',
      asChild = false,
      loading = false,
      fullWidth = false,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button'

    return (
      <Comp
        ref={ref}
        className={cn(
          // Base
          'inline-flex items-center justify-center gap-2',
          'whitespace-nowrap text-sm font-bold',
          'transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary)/0.5)] focus-visible:ring-offset-1',
          'disabled:pointer-events-none disabled:opacity-40',
          'active:scale-[0.98]',
          'motion-reduce:transition-none motion-reduce:active:scale-100',
          // Variant
          variantStyles[variant],
          // Size (skip for link variant)
          variant !== 'link' && sizeStyles[size],
          // Full width
          fullWidth && 'w-full',
          // Custom
          className,
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="size-4 animate-spin shrink-0" aria-hidden="true" />}
        {children}
      </Comp>
    )
  },
)

Button.displayName = 'Button'

export { Button }
export type { ButtonVariant, ButtonSize }
