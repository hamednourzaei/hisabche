// ============================================
// Searchable, multi-selectable option list for onboarding.
//
// Used by both the business-type step and the currency step. The currency step
// asked for "the same search box as the business one", so it is one component
// rather than two that drift.
//
// Selection is a Set: a trader may genuinely run two businesses, and a shop may
// deal in two currencies. Single-select is expressed by passing `max={1}`.
// ============================================

'use client'

import { memo, useCallback, useMemo, useState } from 'react'
import { Check, Search } from 'lucide-react'

import { cn } from '../../../lib/utils'

export interface SearchableOption {
  id: string
  label: string
  /** Rendered before the label — a flag emoji for currencies, nothing for trades. */
  prefix?: string | undefined
}

export interface SearchableOptionListProps {
  options: readonly SearchableOption[]
  selected: ReadonlySet<string>
  onToggle: (id: string) => void
  placeholder: string
  emptyLabel: string
  /**
   * Pinned to both the top and the bottom of the results.
   *
   * Someone whose trade is missing should not have to read the whole list to
   * find that out, nor scroll back up once they have.
   */
  fallbackOption?: SearchableOption | undefined
  /** Rows visible before the list scrolls. */
  maxVisible?: number
}

const rowBase =
  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm transition-colors duration-150 motion-reduce:transition-none'

const CheckBox = memo(function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors duration-150',
        'motion-reduce:transition-none',
        checked
          ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary))]'
          : 'border-[hsl(var(--border-strong))]',
      )}
    >
      {checked && <Check className="size-3.5 text-[hsl(var(--color-primary-fg))]" />}
    </span>
  )
})
CheckBox.displayName = 'CheckBox'

export const SearchableOptionList = memo(function SearchableOptionList({
  options,
  selected,
  onToggle,
  placeholder,
  emptyLabel,
  fallbackOption,
  maxVisible = 7,
}: SearchableOptionListProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return options
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(term) || option.id.toLowerCase().includes(term),
    )
  }, [options, query])

  const renderRow = useCallback(
    (option: SearchableOption, key: string) => {
      const checked = selected.has(option.id)

      return (
        <button
          key={key}
          type="button"
          role="checkbox"
          aria-checked={checked}
          onClick={() => onToggle(option.id)}
          className={cn(
            rowBase,
            checked
              ? 'bg-[hsl(var(--color-primary)/0.08)] text-[hsl(var(--fg-primary))]'
              : 'text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
          )}
        >
          <CheckBox checked={checked} />
          {option.prefix && <span className="shrink-0 text-base">{option.prefix}</span>}
          <span className="min-w-0 flex-1 truncate">{option.label}</span>
        </button>
      )
    },
    [selected, onToggle],
  )

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl border px-3 py-2.5',
          'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))]',
          'focus-within:border-[hsl(var(--color-primary))]',
        )}
      >
        <Search className="size-4 shrink-0 text-[hsl(var(--fg-tertiary))]" aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full bg-transparent text-sm text-[hsl(var(--fg-primary))] outline-none placeholder:text-[hsl(var(--fg-tertiary))]"
        />
      </div>

      <div
        className="space-y-0.5 overflow-y-auto pe-1"
        style={{ maxHeight: `${maxVisible * 44}px` }}
      >
        {fallbackOption && renderRow(fallbackOption, 'fallback-top')}

        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-[hsl(var(--fg-tertiary))]">
            {emptyLabel}
          </p>
        ) : (
          filtered.map((option) => renderRow(option, option.id))
        )}

        {/* Same option, second position — see `fallbackOption`. Only worth
            repeating once the list is long enough to require scrolling. */}
        {fallbackOption &&
          filtered.length > maxVisible &&
          renderRow(fallbackOption, 'fallback-bottom')}
      </div>
    </div>
  )
})

SearchableOptionList.displayName = 'SearchableOptionList'
