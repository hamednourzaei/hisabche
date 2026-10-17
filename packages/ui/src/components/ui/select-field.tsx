'use client'

// ============================================
// packages/ui/src/components/ui/select-field.tsx
//
// T7 — ONE select in the product.
//
// ---------------------------------------------------------------------------
// WHY A WRAPPER AND NOT 26 HAND-CONVERSIONS
//
// Nineteen files still used a native `<select>`, so the product had two
// different dropdowns with different heights, different focus rings, and
// different behaviour on mobile. The owner asked for `select.tsx` everywhere.
//
// Converting each by hand means repeating the same five-element Radix
// structure 26 times, and repeating one specific trap 26 times:
//
// ⚠️ RADIX `SelectItem` THROWS ON AN EMPTY STRING VALUE.
//
// A native filter dropdown almost always starts with:
//
//     <option value="">همه</option>
//
// and `''` is exactly what Radix reserves to mean «nothing selected». A
// straight conversion compiles, renders, and then crashes the page the moment
// the list opens. That is a runtime error a type-check cannot catch and a
// visual diff would not show.
//
// This component owns that translation once: `''` is swapped for a private
// sentinel on the way in and swapped back on the way out, so callers keep
// using `''` for «all» exactly as they did with the native element.
// ---------------------------------------------------------------------------

import * as React from 'react'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { cn } from '../../lib/utils'

/**
 * Stands in for `''` inside Radix.
 *
 * Deliberately not a plausible domain value. A caller whose real option is
 * literally this string would collide — which is why it is not `all` or
 * `none`, both of which are real ids somewhere in this product.
 */
const EMPTY = '__select_field_empty__'

const toRadix = (value: string): string => (value === '' ? EMPTY : value)
const fromRadix = (value: string): string => (value === EMPTY ? '' : value)

export interface SelectFieldOption {
  value: string
  label: React.ReactNode
  disabled?: boolean
  /** What the search box matches when `label` is not plain text (name, SKU, barcode). */
  keywords?: string | undefined
}

export interface SelectFieldProps {
  value: string | null | undefined
  onChange: (value: string) => void
  options: readonly SelectFieldOption[]
  placeholder?: string
  disabled?: boolean
  /** Applied to the trigger — the native element's className goes here. */
  className?: string
  id?: string
  'aria-label'?: string
  name?: string
  /**
   * The API's name for what this select sets, so a refused save can find the
   * control and send the user to it (see `useServerFieldErrors`).
   *
   * ⚠️ It has to be declared HERE. A hyphenated JSX attribute is exempt from
   * excess-property checking, so passing `data-field` to a component that
   * does not forward it compiles cleanly and then does nothing at all.
   */
  'data-field'?: string
  /**
   * A search box at the top of the open list — for long lists (products,
   * customers). Matching ignores case, Arabic/Persian ی/ي and ک/ك, and the
   * zero-width non-joiner. The selected option always stays in the list, or
   * the trigger would lose its label.
   */
  searchable?: boolean | undefined
  searchPlaceholder?: string | undefined
  /** Shown when nothing matches. */
  noResultsText?: string | undefined
}

/** A form both «كالا» and «کالا» reduce to — what the search compares. */
export function searchKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u064A\u0649]/g, '\u06CC')
    .replace(/\u0643/g, '\u06A9')
    .replace(/\u200C/g, '')
    .trim()
}

function optionText(option: SelectFieldOption): string {
  return [typeof option.label === 'string' ? option.label : '', option.keywords ?? ''].join(' ')
}

export function SelectField({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
  id,
  name,
  'aria-label': ariaLabel,
  'data-field': dataField,
  searchable,
  searchPlaceholder,
  noResultsText,
}: SelectFieldProps) {
  const [query, setQuery] = React.useState('')
  // A stored value that is not in the list is RENDERED, not dropped. The old
  // native element showed nothing in that case and silently submitted the
  // first option; showing the raw value at least makes the mismatch visible.
  const known = options.some((option) => option.value === (value ?? ''))
  const hasValue = value !== null && value !== undefined
  const needle = searchable ? searchKey(query) : ''
  const shown = needle
    ? options.filter(
        (option) =>
          option.value === (value ?? '') || searchKey(optionText(option)).includes(needle),
      )
    : options

  return (
    <Select
      {...(hasValue ? { value: toRadix(value) } : {})}
      onValueChange={(next) => onChange(fromRadix(next))}
      {...(searchable ? { onOpenChange: (open: boolean) => (open ? null : setQuery('')) } : {})}
      disabled={Boolean(disabled)}
      {...(name ? { name } : {})}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        {...(dataField ? { 'data-field': dataField } : {})}
        className={cn('w-full', className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {searchable ? (
          <div className="sticky top-0 z-10 bg-[hsl(var(--surface-elevated))] p-1">
            <input
              type="search"
              value={query}
              autoFocus
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
              // Radix's typeahead would take every key typed here.
              onKeyDown={(event) => event.stopPropagation()}
              className="min-h-9 w-full rounded-md border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-2 text-sm text-[hsl(var(--fg-primary))]"
            />
          </div>
        ) : null}
        {searchable && needle && shown.every((option) => option.value === (value ?? '')) ? (
          <p className="px-2 py-3 text-center text-xs text-[hsl(var(--fg-tertiary))]">
            {noResultsText}
          </p>
        ) : null}
        {!known && hasValue && value !== '' ? <SelectItem value={value}>{value}</SelectItem> : null}

        {shown.map((option) => (
          <SelectItem
            key={option.value || EMPTY}
            value={toRadix(option.value)}
            disabled={Boolean(option.disabled)}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default SelectField
