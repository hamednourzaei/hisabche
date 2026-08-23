// ============================================
// A number field with the two little arrows.
//
// The native `type="number"` spinner is not usable here: Chrome hides it until
// hover, Firefox draws it differently, it cannot be styled, and it sits on the
// wrong side in RTL. This draws its own, so a shopkeeper nudging a quantity or
// a tax rate gets the same control everywhere in the product.
//
// The value stays a STRING all the way through. Parsing happens once, in the
// money engine — a field that reformats what you typed while you type it is
// how "12." becomes "12" and the next keystroke lands in the wrong place.
// ============================================
'use client'

import * as React from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

import { cn } from '../../lib/utils'

export interface NumberStepperProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> {
  value: string
  onValueChange: (next: string) => void
  step?: number
  min?: number
  max?: number
  /** Decimals kept when stepping. Typing is never rounded. */
  precision?: number
  /** Groups thousands while the field is not focused. */
  groupThousands?: boolean
  /** Rendered inside the field, before the arrows. */
  suffix?: string
  inputClassName?: string
}

function parse(raw: string): number {
  const latin = raw
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/٫/g, '.')
    .replace(/[^0-9.-]/g, '')
  const value = parseFloat(latin)
  return Number.isFinite(value) ? value : 0
}

/** `35700000` → `35,700,000`, leaving any decimal part alone. */
export function groupThousandsText(raw: string): string {
  if (!raw) return ''
  const negative = raw.trim().startsWith('-')
  const cleaned = raw.replace(/[^0-9.]/g, '')
  if (!cleaned) return ''
  const [whole = '', ...rest] = cleaned.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const decimals = rest.length ? `.${rest.join('')}` : ''
  return `${negative ? '-' : ''}${grouped}${decimals}`
}

export const NumberStepper = React.forwardRef<HTMLInputElement, NumberStepperProps>(
  function NumberStepper(
    {
      value,
      onValueChange,
      step = 1,
      min,
      max,
      precision = 0,
      groupThousands = false,
      suffix,
      className,
      inputClassName,
      disabled,
      onKeyDown,
      onFocus,
      onBlur,
      ...props
    },
    ref,
  ) {
    const [focused, setFocused] = React.useState(false)
    const [hovered, setHovered] = React.useState(false)

    const clamp = React.useCallback(
      (n: number) => {
        let next = n
        if (typeof min === 'number') next = Math.max(min, next)
        if (typeof max === 'number') next = Math.min(max, next)
        const factor = 10 ** precision
        return Math.round(next * factor) / factor
      },
      [min, max, precision],
    )

    const bump = React.useCallback(
      (direction: 1 | -1) => {
        if (disabled) return
        onValueChange(String(clamp(parse(value) + direction * step)))
      },
      [disabled, onValueChange, clamp, value, step],
    )

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        bump(1)
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        bump(-1)
      }
      onKeyDown?.(event)
    }

    // Grouping is applied only while the field is at rest, so the caret never
    // jumps over a comma that appeared mid-word.
    const shown = !focused && groupThousands ? groupThousandsText(value) : value

    const arrow = cn(
      'flex h-1/2 w-full items-center justify-center',
      'text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--color-primary))]',
      'transition-colors duration-150 motion-reduce:transition-none',
      'disabled:opacity-30 disabled:hover:text-[hsl(var(--fg-tertiary))]',
    )

    /**
     * The arrows are an affordance for the field you are working in, not
     * permanent furniture.
     *
     * Shown on hover, on focus, and while the field has a value being edited.
     * Otherwise they are hidden AND take no width, so a narrow grid cell is
     * not permanently 20px shorter for a control nobody is using — which is
     * what pushed them outside the cell on small screens.
     *
     * `pointer:coarse` keeps them permanently visible on touch, where there is
     * no hover to reveal them with.
     */
    const arrowsShown = focused || hovered

    return (
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          'group/stepper relative flex items-stretch overflow-hidden',
          disabled && 'opacity-50',
          className,
        )}
      >
        <input
          ref={ref}
          value={shown}
          disabled={disabled}
          inputMode="decimal"
          dir="ltr"
          onKeyDown={handleKeyDown}
          onFocus={(e) => {
            setFocused(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            onBlur?.(e)
          }}
          onChange={(e) => onValueChange(e.target.value.replace(/,/g, ''))}
          className={cn(
            'w-full min-w-0 bg-transparent text-end tabular-nums outline-none',
            'text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))]',
            inputClassName,
          )}
          {...props}
        />

        {suffix ? (
          <span className="self-center px-1 text-[10px] text-[hsl(var(--fg-tertiary))]">
            {suffix}
          </span>
        ) : null}

        {/* Width collapses to zero when idle, so the arrows can never overflow
            the cell they live in. Always visible on touch — see above. */}
        <div
          aria-hidden="true"
          className={cn(
            'flex shrink-0 flex-col self-stretch overflow-hidden',
            'transition-[width,opacity] duration-150 motion-reduce:transition-none',
            arrowsShown ? 'w-5 opacity-100' : 'w-0 opacity-0',
            '[@media(pointer:coarse)]:w-5 [@media(pointer:coarse)]:opacity-100',
          )}
        >
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => bump(1)}
            aria-hidden="true"
            className={arrow}
          >
            <ChevronUp className="size-3" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => bump(-1)}
            aria-hidden="true"
            className={arrow}
          >
            <ChevronDown className="size-3" />
          </button>
        </div>
      </div>
    )
  },
)
