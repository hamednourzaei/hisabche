'use client'

// ============================================
// A filter for a `DataTable`: the filter icon and the shared select.
//
// ONE control for «show only the rows that are …» on any table — pass it in the
// table's `actions`. It changes what the table HOLDS; the table, its search,
// its saved views and its column settings stay exactly where they are.
//
// The first option is «all». The value is the caller's own (a status, a kind);
// this component does not know what is being filtered.
// ============================================

import { Filter } from 'lucide-react'

import { cn } from '../../../lib/utils'
import { SelectField, type SelectFieldOption } from '../select-field'

export interface TableFilterSelectProps {
  /** What is being filtered — «وضعیت». Read by a screen reader; shown as a tooltip. */
  label: string
  value: string
  options: readonly SelectFieldOption[]
  onChange: (value: string) => void
  /** The value that means «no filter» — the icon is tinted when anything else is chosen. */
  allValue?: string
}

export function TableFilterSelect({
  label,
  value,
  options,
  onChange,
  allValue = 'all',
}: TableFilterSelectProps) {
  const filtering = value !== allValue
  return (
    <div className="flex items-center gap-1.5" title={label}>
      <Filter
        className={cn(
          'size-4 shrink-0',
          filtering ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--fg-tertiary))]',
        )}
        aria-hidden="true"
      />
      <SelectField
        name="filter"
        aria-label={label}
        value={value}
        onChange={onChange}
        options={options}
        className="h-9 min-w-32 rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-2.5 text-sm text-[hsl(var(--fg-primary))]"
      />
    </div>
  )
}
