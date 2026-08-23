// ============================================
// One editable cell of the invoice grid.
//
// The cell renders from the COLUMN TYPE and nothing else. That is what keeps
// the grid generic: adding «IMEI» or «ساعت کار» needs no code here, because
// they are just a `text` and a `decimal` column.
//
// Every control is the project's own — the shared Select, the shared date
// picker, the shared stepper. A native <select> inside a dark table renders a
// white popup with invisible items, which is exactly what it did here before.
//
// Typing writes the raw string straight through to the draft. Parsing and
// rounding happen once, in `@hisabche/validation`'s grid model, so a
// half-typed «12.» never becomes NaN in a total.
// ============================================
'use client'

import { memo, useCallback } from 'react'
import type { KeyboardEvent } from 'react'
import { COLUMN, type InvoiceColumn } from '@hisabche/validation'

import { cn } from '../../../../lib/utils'
import { JalaliDatePicker } from '../../jalali-datepicker'
import { NumberStepper } from '../../number-stepper'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../select'

/** The unit choices offered by the built-in واحد column. */
export const UNIT_CHOICES = [
  'piece',
  'gram',
  'kg',
  'meter',
  'liter',
  'box',
  'pack',
  'carton',
] as const

export interface GridCellProps {
  column: InvoiceColumn
  value: string
  /** Rendered instead of an input for `computed` columns. */
  computedText?: string
  /** Shown under the value — e.g. the invoice-currency equivalent. */
  hint?: string | undefined
  rowIndex: number
  columnIndex: number
  disabled?: boolean
  t: (key: string, fallback?: string) => string
  onChange: (value: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>, rowIndex: number, columnIndex: number) => void
  /** Replaces the plain input for the description column. */
  slot?: React.ReactNode
}

/**
 * The focus treatment.
 *
 * `inset` rather than an outline ring: an outline is painted OUTSIDE the
 * element's box, so on a table cell it bled up over the sticky header and the
 * row above. An inset shadow stays inside the cell, always.
 */
const cellBase = cn(
  'h-9 w-full min-w-0 bg-transparent px-2 text-sm',
  'text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))]',
  'outline-none',
  'focus:bg-[hsl(var(--color-primary)/0.07)]',
  'focus:shadow-[inset_0_0_0_1.5px_hsl(var(--color-primary))]',
  'transition-colors duration-150 motion-reduce:transition-none',
)

/** Every numeric column shares one font stack so columns line up visually. */
const numericFont = 'tabular-nums [font-variant-numeric:tabular-nums] font-medium'

function isNumericType(type: InvoiceColumn['type']): boolean {
  return (
    type === 'integer' ||
    type === 'decimal' ||
    type === 'currency' ||
    type === 'percent' ||
    type === 'computed'
  )
}

export const GridCell = memo(function GridCell({
  column,
  value,
  computedText,
  hint,
  rowIndex,
  columnIndex,
  disabled = false,
  t,
  onChange,
  onKeyDown,
  slot,
}: GridCellProps) {
  const handleKey = useCallback(
    (event: KeyboardEvent<HTMLElement>) => onKeyDown(event, rowIndex, columnIndex),
    [onKeyDown, rowIndex, columnIndex],
  )

  // ── computed ───────────────────────────────────────────────────────────
  if (column.type === 'computed') {
    return (
      <div
        dir="ltr"
        className={cn('px-2 py-2 text-end text-sm text-[hsl(var(--fg-primary))]', numericFont)}
      >
        {computedText ?? '—'}
      </div>
    )
  }

  // ── description (product picker lives here) ────────────────────────────
  if (slot) return <div className="px-1 py-0.5">{slot}</div>

  // ── boolean ────────────────────────────────────────────────────────────
  if (column.type === 'boolean') {
    return (
      <div className="flex h-9 items-center justify-center px-2">
        <input
          type="checkbox"
          checked={value === 'true'}
          disabled={disabled}
          data-cell={`${rowIndex}-${columnIndex}`}
          onKeyDown={handleKey}
          onChange={(e) => onChange(e.target.checked ? 'true' : '')}
          aria-label={column.label}
          className="size-4 accent-[hsl(var(--color-primary))]"
        />
      </div>
    )
  }

  // ── date ───────────────────────────────────────────────────────────────
  if (column.type === 'date') {
    return (
      <div className="px-1 py-0.5">
        <JalaliDatePicker
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="h-9 min-h-0 rounded-[var(--radius-sm)] px-2 text-xs"
        />
      </div>
    )
  }

  // ── select (units, or the user's own choice list) ──────────────────────
  if (column.type === 'select') {
    const options =
      column.id === COLUMN.unit
        ? UNIT_CHOICES.map((u) => ({ value: u, label: t(`unit.${u}`, u) }))
        : (column.options ?? []).map((o) => ({ value: o, label: o }))

    // Radix treats "" as uncontrolled, so an empty cell omits `value`
    // entirely rather than passing undefined through a required prop.
    return (
      <Select {...(value ? { value } : {})} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          data-cell={`${rowIndex}-${columnIndex}`}
          onKeyDown={handleKey}
          aria-label={column.label}
          className={cn(
            'h-9 min-h-0 w-full rounded-none border-0 bg-transparent px-2 text-sm',
            'focus:bg-[hsl(var(--color-primary)/0.07)]',
            'focus:shadow-[inset_0_0_0_1.5px_hsl(var(--color-primary))]',
          )}
        >
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="min-h-0 py-2">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  // ── numbers and money ──────────────────────────────────────────────────
  if (isNumericType(column.type)) {
    return (
      <div className="relative">
        <NumberStepper
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          // Money moves in useful jumps; a weight or a count moves by one.
          step={column.type === 'currency' ? 1000 : column.type === 'percent' ? 1 : 1}
          precision={column.precision}
          {...(typeof column.precision === 'number' && column.type === 'percent'
            ? { min: 0, max: 100 }
            : { min: 0 })}
          groupThousands={column.type === 'currency'}
          {...(column.suffix ? { suffix: column.suffix } : {})}
          data-cell={`${rowIndex}-${columnIndex}`}
          onKeyDown={handleKey}
          aria-label={column.label}
          className={cn(
            'h-9 px-1',
            'focus-within:bg-[hsl(var(--color-primary)/0.07)]',
            'focus-within:shadow-[inset_0_0_0_1.5px_hsl(var(--color-primary))]',
            'transition-colors duration-150 motion-reduce:transition-none',
            hint && 'pb-3',
          )}
          inputClassName={cn('text-sm', numericFont)}
        />
        {hint ? (
          <span
            dir="ltr"
            className="pointer-events-none absolute bottom-0 end-6 text-[10px] tabular-nums text-[hsl(var(--fg-tertiary))]"
          >
            {hint}
          </span>
        ) : null}
      </div>
    )
  }

  // ── text ───────────────────────────────────────────────────────────────
  return (
    <input
      type="text"
      value={value}
      disabled={disabled}
      data-cell={`${rowIndex}-${columnIndex}`}
      onKeyDown={handleKey}
      onChange={(e) => onChange(e.target.value)}
      aria-label={column.label}
      className={cellBase}
    />
  )
})

GridCell.displayName = 'GridCell'
