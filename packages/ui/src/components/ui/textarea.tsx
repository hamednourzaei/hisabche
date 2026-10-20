import * as React from 'react'
import { cn } from '../../lib/utils'

/* ═══════════════════════════════════════════════════════════════════════════
   Textarea v1 — Hisabche Design Language
   ✅ Matches Input tokens and borders
   ✅ Zero hardcoded colors — all tokens from design system
   ✅ Logical RTL padding
   ═══════════════════════════════════════════════════════════════════════════ */

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-sm font-medium text-[hsl(var(--fg-primary))]">{label}</label>
        )}
        <textarea
          className={cn(
            'flex min-h-[80px] w-full rounded-xl px-3 py-2 text-sm',
            'border border-[hsl(var(--border-default))]',
            'bg-[hsl(var(--surface-base))]',
            'text-[hsl(var(--fg-primary))]',
            'placeholder:text-[hsl(var(--fg-tertiary))]',
            'focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)]',
            'disabled:cursor-not-allowed disabled:opacity-40',
            'transition-colors duration-200',
            'motion-reduce:transition-none',
            className,
          )}
          ref={ref}
          {...props}
        />
      </div>
    )
  },
)
Textarea.displayName = 'Textarea'

export { Textarea }
