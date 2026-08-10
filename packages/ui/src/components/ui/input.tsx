import * as React from 'react'
import { cn } from '../../lib/utils'

/* ═══════════════════════════════════════════════════════════════════════════
   Input v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   Full RTL via logical CSS (start/end)
   ═══════════════════════════════════════════════════════════════════════════ */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  startIcon?: React.ReactNode
  endIcon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, startIcon, endIcon, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-sm font-medium text-[hsl(var(--fg-primary))]">{label}</label>
        )}
        <div className="relative">
          {/* Start icon (logical start = right in RTL) */}
          {startIcon && (
            <div className="absolute start-3 top-1/2 -translate-y-1/2 text-[hsl(var(--fg-tertiary))] pointer-events-none">
              {startIcon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              'flex h-10 w-full rounded-xl px-3 py-2 text-sm',
              'border border-[hsl(var(--border-default))]',
              'bg-[hsl(var(--surface-base))]',
              'text-[hsl(var(--fg-primary))]',
              'placeholder:text-[hsl(var(--fg-tertiary))]',
              'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[hsl(var(--fg-primary))]',
              'focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)]',
              'disabled:cursor-not-allowed disabled:opacity-40',
              'transition-colors duration-200',
              'motion-reduce:transition-none',
              startIcon && 'ps-10',
              endIcon && 'pe-10',
              className,
            )}
            ref={ref}
            {...props}
          />
          {/* End icon (logical end = left in RTL) */}
          {endIcon && (
            <div className="absolute end-3 top-1/2 -translate-y-1/2 text-[hsl(var(--fg-tertiary))] pointer-events-none">
              {endIcon}
            </div>
          )}
        </div>
      </div>
    )
  },
)

Input.displayName = 'Input'

export { Input }
