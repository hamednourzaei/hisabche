'use client'

// ============================================
// packages/ui/src/components/ui/accounting/components/ledger-table.tsx
//
// The table primitives every accounting statement shares, and the one place
// money is turned into text.
//
// ---------------------------------------------------------------------------
// WHAT THIS FIXES — three real defects, not styling
//
// 1. `value.toLocaleString()` WITH NO LOCALE.
//
//    Every accounting tab called it bare, so the number took the BROWSER's
//    locale. Two people in the same shop, on the same figure, saw «۱۲٬۵۰۰» and
//    "12,500" — and a CSV exported from one did not match the screen of the
//    other. The app already knows its language; `useLocale()` and
//    `resolveIntlLocale` have existed in `@hisabche/formatting` the whole time
//    and this module never called them.
//
// 2. NO TABULAR FIGURES.
//
//    Proportional digits are different widths, so a right-aligned column of
//    them does not line up — a 1 is narrower than a 8, and the decimal points
//    wander. On a ledger that is the single most important typographic
//    property, and it was a one-class fix nobody had made.
//
// 3. THE DIFFERENCE CELL WENT BLANK WHEN ZERO.
//
//    A balanced trial balance rendered an EMPTY cell, and an unbalanced one
//    rendered a number in the same weight as every other number. The one
//    figure on the screen that must be impossible to miss looked like all the
//    others — and "empty" is indistinguishable from "not computed". Lesson 6
//    in this repo is about the trial balance hiding its own imbalance; this is
//    the same failure at the presentation layer.
//
// ---------------------------------------------------------------------------
// ON THE SIZING
//
// The tabs each carried `text-[9px] md:text-[10px] lg:text-xs` on headers and
// `px-2 md:px-3 lg:px-4` on every cell. Nine-pixel text is below anything
// readable, and a three-breakpoint value on every single property is noise
// that hides the two places where responsive behaviour actually matters.
//
// One scale, defined here, used by every statement.
// ============================================

import { memo, type ReactNode } from 'react'
import { useLocale } from 'next-intl'
import { resolveIntlLocale, type UiLanguage } from '@hisabche/formatting'

import { cn } from '../../../../lib/utils'

// ─── The scale ──────────────────────────────────────────────────────────────

/** Cell padding. One value, not three breakpoints on every element. */
export const CELL = 'px-4 py-2.5'

/**
 * `tabular-nums` is the load-bearing class. Without it a right-aligned money
 * column does not align, because proportional digits have different widths.
 */
export const NUMERIC = 'text-end tabular-nums'

// ─── Formatting ─────────────────────────────────────────────────────────────

/**
 * Format a ledger figure for display.
 *
 * `zeroAs` decides what nothing looks like. On a ledger an em dash reads better
 * than `0` for a side that was not used — but it must be a CHOICE, because in a
 * TOTAL row a zero is a real and important value.
 */
export function useLedgerNumber() {
  const locale = resolveIntlLocale(useLocale() as UiLanguage)

  return (value: number, zeroAs: 'dash' | 'zero' = 'dash'): string => {
    if (!Number.isFinite(value)) return '—'
    if (value === 0 && zeroAs === 'dash') return '—'

    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(value)
  }
}

// ─── Primitives ─────────────────────────────────────────────────────────────

export const LedgerTable = memo(function LedgerTable({
  children,
  caption,
}: {
  children: ReactNode
  caption?: string
}) {
  return (
    // Its own horizontal scroll: a wide statement must never make the PAGE
    // scroll sideways.
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  )
})

export const LedgerHead = memo(function LedgerHead({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-[hsl(var(--surface-elevated))]">
      <tr className="border-b border-[hsl(var(--border-default))]">{children}</tr>
    </thead>
  )
})

export const LedgerTh = memo(function LedgerTh({
  children,
  numeric = false,
  colSpan,
}: {
  children: ReactNode
  numeric?: boolean
  colSpan?: number
}) {
  return (
    <th
      colSpan={colSpan}
      scope="col"
      className={cn(
        CELL,
        'text-xs font-medium text-[hsl(var(--fg-tertiary))]',
        numeric ? NUMERIC : 'text-start',
      )}
    >
      {children}
    </th>
  )
})

export const LedgerRow = memo(function LedgerRow({
  children,
  onClick,
  /** H3 will make account rows drill into their journal lines. */
  interactive = false,
}: {
  children: ReactNode
  onClick?: (() => void) | undefined
  interactive?: boolean
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'border-b border-[hsl(var(--border-default)/0.5)] last:border-0',
        'transition-colors hover:bg-[hsl(var(--surface-muted))]',
        interactive && 'cursor-pointer',
      )}
    >
      {children}
    </tr>
  )
})

export const LedgerTd = memo(function LedgerTd({
  children,
  numeric = false,
  strong = false,
  muted = false,
  mono = false,
  colSpan,
}: {
  children: ReactNode
  numeric?: boolean
  strong?: boolean
  muted?: boolean
  mono?: boolean
  colSpan?: number
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        CELL,
        numeric ? NUMERIC : 'text-start',
        mono && 'font-mono text-xs',
        strong ? 'font-semibold' : 'font-normal',
        muted ? 'text-[hsl(var(--fg-tertiary))]' : 'text-[hsl(var(--fg-primary))]',
      )}
    >
      {children}
    </td>
  )
})

/** The totals row. Heavier rule above it, because it is a different kind of row. */
export const LedgerFoot = memo(function LedgerFoot({ children }: { children: ReactNode }) {
  return (
    <tfoot>
      <tr className="border-t-2 border-[hsl(var(--border-strong),var(--border-default))] bg-[hsl(var(--surface-muted)/0.4)]">
        {children}
      </tr>
    </tfoot>
  )
})

// ─── The one figure that must not be quiet ──────────────────────────────────

/**
 * The trial balance difference.
 *
 * Zero is stated, not left blank: an empty cell cannot be told apart from a
 * figure that was never computed, and "the books balance" is the single most
 * useful thing this report says.
 *
 * Non-zero is loud. An out-of-balance ledger rendered in the same weight as a
 * balanced one is a report that does not report — which is exactly the shape of
 * lesson 6, where the old balance sheet dropped the rows that would have shown
 * the problem and then agreed with itself.
 */
export const LedgerDifference = memo(function LedgerDifference({
  value,
  balancedLabel,
  outOfBalanceLabel,
}: {
  value: number
  balancedLabel: string
  outOfBalanceLabel: string
}) {
  const format = useLedgerNumber()
  const balanced = Math.abs(value) < 0.005

  if (balanced) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--color-success)/0.12)] px-2.5 py-1 text-xs font-medium text-[hsl(var(--color-success))]">
        {balancedLabel}
      </span>
    )
  }

  return (
    <span
      // `role="alert"` so a screen reader announces an unbalanced ledger rather
      // than leaving it as one more number in a column.
      role="alert"
      className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--color-destructive)/0.12)] px-2.5 py-1 text-xs font-bold tabular-nums text-[hsl(var(--color-destructive))]"
    >
      {outOfBalanceLabel} {format(value, 'zero')}
    </span>
  )
})
