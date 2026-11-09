'use client'

// ============================================
// ONE filter control for a `DataTable` that filters by more than one thing.
//
// Owner request (8 Nov 2026): a toolbar with «همه · همه‌ی شعبه‌ها · همه‌ی
// انبارها» side by side was three selects for one question — «show me only
// …». It is now one button, «فیلتر», that opens one menu with a section per
// dimension (status, branch, warehouse, …). The button says how many
// dimensions are narrowing the table, and «پاک کردن» returns them all to «all».
//
// A table with a single dimension keeps `TableFilterSelect`.
// ============================================

import { Check, Filter } from 'lucide-react'

import { cn } from '../../../lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../dropdown-menu'

export interface TableFilterGroup {
  /** Stable id of the dimension — «status», «branch». */
  id: string
  /** Section heading inside the menu. */
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
  /** The value that means «no filter». */
  allValue?: string | undefined
}

export interface TableFilterMenuProps {
  /** The button's text — «فیلتر». */
  label: string
  /** «پاک کردن فیلترها». */
  clearLabel: string
  /** Dimensions with nothing to choose from are left out by the caller. */
  groups: readonly TableFilterGroup[]
}

export function TableFilterMenu({ label, clearLabel, groups }: TableFilterMenuProps) {
  const offered = groups.filter((group) => group.options.length > 1)
  if (offered.length === 0) return null

  const active = offered.filter((group) => group.value !== (group.allValue ?? 'all'))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-table-filter-menu=""
        className={cn(
          'inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] border px-3 text-sm font-medium',
          'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] text-[hsl(var(--fg-primary))]',
          'transition-colors hover:border-[hsl(var(--border-strong))]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]',
          active.length > 0 && 'border-[hsl(var(--color-primary)/0.5)]',
        )}
      >
        <Filter
          className={cn(
            'size-4 shrink-0',
            active.length > 0
              ? 'text-[hsl(var(--color-primary))]'
              : 'text-[hsl(var(--fg-tertiary))]',
          )}
          aria-hidden="true"
        />
        <span>{label}</span>
        {active.length > 0 ? (
          <span
            data-active-filters={active.length}
            className="inline-flex min-w-5 items-center justify-center rounded-full bg-[hsl(var(--color-primary))] px-1.5 text-[11px] font-bold leading-5 text-[hsl(var(--color-primary-fg))]"
          >
            {active.length}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {offered.map((group, index) => (
          <div key={group.id} data-filter-group={group.id}>
            {index > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="text-xs text-[hsl(var(--fg-tertiary))]">
              {group.label}
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup value={group.value} onValueChange={group.onChange}>
              {group.options.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </div>
        ))}
        {active.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-filter-clear=""
              onSelect={() => {
                for (const group of active) group.onChange(group.allValue ?? 'all')
              }}
            >
              <Check className="size-4" aria-hidden="true" />
              {clearLabel}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
