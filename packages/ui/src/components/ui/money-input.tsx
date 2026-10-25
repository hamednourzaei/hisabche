// packages/ui/src/components/ui/money-input.tsx
'use client'

import * as React from 'react'
import { cn } from '../../lib/utils'
import { useLocale } from 'next-intl'
import {
  caretAfter,
  readNumeralText,
  showNumeral,
  significantBefore,
} from '../../lib/numeral-input'
import { unformatThousands } from '../../lib/thousands'

/* ═══════════════════════════════════════════════════════════════════════════
   MoneyInput — thousand-separator formatted number input
   Drop-in replacement for <input type="number"> / <Input> on any
   price/amount/salary field. Displays "1,234,567" while `onChange` always
   receives the clean digit string (no separators) so callers can keep
   doing `Number(raw)` / `parseFloat(raw)` exactly as before.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface MoneyInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> {
  value: string | number | null | undefined
  onChange: (raw: string) => void
  label?: string
  startIcon?: React.ReactNode
  endIcon?: React.ReactNode
}

const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, className, label, startIcon, endIcon, ...props }, ref) => {
    const lang = useLocale()
    // The text is DERIVED from the value, in the language's own digits (Persian =
    // ۱٬۲۳۴, Dari and English = 1,234), grouped as it is typed. The value that
    // leaves the field is always the clean Latin digit string.
    const display = showNumeral(unformatThousands(value), lang, true)
    const inputRef = React.useRef<HTMLInputElement | null>(null)
    const caretRef = React.useRef<number | null>(null)

    React.useLayoutEffect(() => {
      const input = inputRef.current
      const wanted = caretRef.current
      caretRef.current = null
      if (!input || wanted === null || document.activeElement !== input) return
      const at = caretAfter(display, wanted)
      input.setSelectionRange(at, at)
    }, [display])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const field = e.target
      caretRef.current = significantBefore(field.value, field.selectionStart ?? field.value.length)
      onChange(readNumeralText(field.value))
    }

    const input = (
      <div className="relative">
        {startIcon && (
          <div className="absolute start-3 top-1/2 -translate-y-1/2 text-[hsl(var(--fg-tertiary))] pointer-events-none">
            {startIcon}
          </div>
        )}
        <input
          ref={(node) => {
            inputRef.current = node
            if (typeof ref === 'function') ref(node)
            else if (ref) ref.current = node
          }}
          type="text"
          inputMode="decimal"
          dir="ltr"
          value={display}
          onChange={handleChange}
          className={cn(
            'flex h-10 w-full rounded-xl px-3 py-2 text-sm text-end',
            'border border-[hsl(var(--border-default))]',
            'bg-[hsl(var(--surface-base))]',
            'text-[hsl(var(--fg-primary))]',
            'placeholder:text-[hsl(var(--fg-tertiary))]',
            'focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)]',
            'disabled:cursor-not-allowed disabled:opacity-40',
            'transition-colors duration-200',
            startIcon && 'ps-10',
            endIcon && 'pe-10',
            className,
          )}
          {...props}
        />
        {endIcon && (
          <div className="absolute end-3 top-1/2 -translate-y-1/2 text-[hsl(var(--fg-tertiary))] pointer-events-none">
            {endIcon}
          </div>
        )}
      </div>
    )

    if (!label) return input

    return (
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[hsl(var(--fg-primary))]">{label}</label>
        {input}
      </div>
    )
  },
)

MoneyInput.displayName = 'MoneyInput'

export { MoneyInput }
