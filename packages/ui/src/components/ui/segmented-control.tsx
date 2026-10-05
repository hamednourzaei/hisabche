'use client'

// ============================================
// A segmented control — «همه | فروش | خرید».
//
// ONE component for «show me this part» inside a page: a few mutually exclusive
// choices, one always selected. The invoice table's type switch and the pricing
// tab's «تخفیف‌ها | فهرست‌های قیمت» are both this.
//
// It is not the hub's tab bar (`HubTabs`): that one moves between screens and
// lives in the address; this one changes what the screen you are on shows.
//
// Do not draw another one. Pass `options`, `value`, `onChange`.
// ============================================

import { cn } from '../../lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

export interface SegmentedControlProps<T extends string> {
  /** What is being chosen, for a screen reader. */
  label: string
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string | undefined
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'flex w-fit gap-1 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] p-1',
        className,
      )}
    >
      {options.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors motion-reduce:transition-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]',
              active
                ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))]'
                : 'text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))]',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
