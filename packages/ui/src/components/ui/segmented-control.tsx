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
//
// `branch` — this switch is the one that belongs to the hub tab it is under:
// it is placed in the middle of the page, right below the nearest `HubTabs`
// above it, with a line from the selected tab to each choice. With no tab bar
// above it the prop does nothing. ONE branch switch per tab.
//
// ⚠️ A choice never wraps. On a narrow screen the words and the padding get
// smaller (`clamp`) — «فهرست‌های قیمت» on two lines makes a row of pills into
// a ragged block.
// ============================================

import { createPortal } from 'react-dom'

import { cn } from '../../lib/utils'
import { useNearestBranchSlot } from './hub-branch'

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
  /** The switch of the selected hub tab: drawn under the tabs, joined by lines. */
  branch?: boolean | undefined
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
  branch = false,
}: SegmentedControlProps<T>) {
  const { anchor, slot } = useNearestBranchSlot(branch)
  const control = (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'flex w-fit max-w-full gap-1 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] p-1',
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
              'whitespace-nowrap rounded-lg px-[clamp(0.5rem,2.6vw,1rem)] py-1.5 text-[clamp(0.6875rem,3vw,0.875rem)] font-medium transition-colors motion-reduce:transition-none',
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

  // Not the tab's own switch, or no tab bar above it: where it was written.
  if (slot === undefined) return control
  // The anchor marks where it was written; the switch itself is drawn under
  // the tabs. Before the slot is found only the anchor renders — on the
  // server too.
  return (
    <>
      <span ref={anchor} hidden data-branch-anchor="" />
      {slot ? createPortal(control, slot) : null}
    </>
  )
}
