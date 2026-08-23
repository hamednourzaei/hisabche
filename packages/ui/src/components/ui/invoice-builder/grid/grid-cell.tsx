// ============================================
// One editable cell of the invoice grid.
//
// The cell renders from the COLUMN TYPE and nothing else. That is what keeps
// the grid generic: adding «IMEI» or «ساعت کار» needs no code here, because
// they are just a `text` and a `decimal` column.
//
// Typing writes the raw string straight through to the draft. Parsing and
// rounding happen once, in `@hisabche/validation`'s grid model, so a
// half-typed «12.» never becomes NaN in a total and the number the user sees
// is the number they typed.
// ============================================
'use client'

import { memo, useCallback } from 'react'
import type { KeyboardEvent } from 'react'
import { COLUMN, type InvoiceColumn } from '@hisabche/validation'

import { cn } from '../../../../lib/utils'

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
}

/** `inputMode` drives the on-screen keyboard a phone shows. */
function inputModeFor(type: InvoiceColumn['type']): 'text' | 'numeric' | 'decimal' {
  if (type === 'integer') return 'numeric'
  if (type === 'decimal' || type === 'currency' || type === 'percent') return 'decimal'
  return 'text'
}

const cellInputClass = cn(
  'w-full bg-transparent px-2 py-2 text-sm',
  'text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))]',
  'outline-none focus:bg-[hsl(var(--color-primary)/0.06)]',
  'rounded-[var(--radius-sm)]',
  'transition-colors duration-150 motion-reduce:transition-none',
)

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
}: GridCellProps) {
  const handleKey = useCallback(
    (event: KeyboardEvent<HTMLElement>) => onKeyDown(event, rowIndex, columnIndex),
    [onKeyDown, rowIndex, columnIndex],
  )

  // Numbers read left-to-right even inside an RTL invoice — that is how a
  // shopkeeper reads a price. The label columns stay RTL.
  const numeric =
    column.type === 'integer' ||
    column.type === 'decimal' ||
    column.type === 'currency' ||
    column.type === 'percent' ||
    column.type === 'computed'

  if (column.type === 'computed') {
    return (
      <div
        className="px-2 py-2 text-sm font-semibold tabular-nums text-[hsl(var(--fg-primary))]"
        dir="ltr"
        style={{ textAlign: 'end' }}
      >
        {computedText ?? '—'}
      </div>
    )
  }

  if (column.type === 'boolean') {
    const checked = value === 'true'
    return (
      <div className="flex items-center justify-center px-2 py-2">
        <input
          type="checkbox"
          checked={checked}
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

  if (column.type === 'select') {
    // The built-in واحد column offers translated units; a user-defined select
    // offers exactly the options they typed.
    const options =
      column.id === COLUMN.unit
        ? UNIT_CHOICES.map((u) => ({
            value: u,
            label: t(`unit.${u}`, u),
          }))
        : (column.options ?? []).map((o) => ({ value: o, label: o }))

    return (
      <select
        value={value}
        disabled={disabled}
        data-cell={`${rowIndex}-${columnIndex}`}
        onKeyDown={handleKey}
        onChange={(e) => onChange(e.target.value)}
        aria-label={column.label}
        className={cn(cellInputClass, 'cursor-pointer appearance-none')}
      >
        <option value="">—</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div className="relative">
      <input
        type={column.type === 'date' ? 'date' : 'text'}
        value={value}
        disabled={disabled}
        inputMode={inputModeFor(column.type)}
        data-cell={`${rowIndex}-${columnIndex}`}
        onKeyDown={handleKey}
        onChange={(e) => onChange(e.target.value)}
        aria-label={column.label}
        dir={numeric ? 'ltr' : undefined}
        style={numeric ? { textAlign: 'end' } : undefined}
        className={cn(cellInputClass, numeric && 'tabular-nums', hint && 'pb-4')}
      />
      {hint ? (
        <span
          dir="ltr"
          className="pointer-events-none absolute bottom-0.5 end-2 text-[10px] tabular-nums text-[hsl(var(--fg-tertiary))]"
        >
          {hint}
        </span>
      ) : null}
    </div>
  )
})

GridCell.displayName = 'GridCell'
