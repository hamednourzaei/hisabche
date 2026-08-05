import React from 'react'

import { cn } from './primitives'

export interface FilterOption<T extends string> {
  value: T
  label: string
  count?: number | undefined
}

export interface FilterTabsProps<T extends string> {
  options: readonly FilterOption<T>[]
  value: T
  onChange: (value: T) => void
}

export function FilterTabs<T extends string>({ options, value, onChange }: FilterTabsProps<T>) {
  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-[hsl(var(--border-default))] px-4 py-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'h-7 rounded-[var(--radius-xs)] px-3 text-xs transition-colors',
            option.value === value
              ? 'bg-[hsl(var(--color-primary)/0.14)] text-[hsl(var(--color-primary))]'
              : 'text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]'
          )}
        >
          {option.label}
          {option.count !== undefined ? ` (${option.count})` : ''}
        </button>
      ))}
    </div>
  )
}
