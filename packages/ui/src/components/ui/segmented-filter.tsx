'use client'

// ============================================
// packages/ui/src/components/ui/segmented-filter.tsx
//
// The «همه / فروش / خرید» pill group the invoices list opens with, as one
// component for the list screens that follow the same structure.
//
// It filters what is already loaded; it never changes what is fetched. The
// classes are the invoices `TypeFilter`'s, byte for byte, so a list screen
// built on this looks like the invoices list rather than like a cousin of it.
// ============================================

import { cn } from '../../lib/utils'
import { FOCUS_RING } from './focus-ring'

export interface SegmentedFilterOption<V extends string> {
  value: V
  label: string
}

export interface SegmentedFilterProps<V extends string> {
  /** Accessible name of the group — says what is being filtered. */
  label: string
  value: V
  options: readonly SegmentedFilterOption<V>[]
  onChange: (value: V) => void
}

export function SegmentedFilter<V extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedFilterProps<V>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] p-1"
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
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
              FOCUS_RING,
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
