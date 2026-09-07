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
}: SelectFieldProps) {
  // A stored value that is not in the list is RENDERED, not dropped. The old
  // native element showed nothing in that case and silently submitted the
  // first option; showing the raw value at least makes the mismatch visible.
  const known = options.some((option) => option.value === (value ?? ''))
  const hasValue = value !== null && value !== undefined

  return (
    <Select
      {...(hasValue ? { value: toRadix(value) } : {})}
      onValueChange={(next) => onChange(fromRadix(next))}
      disabled={Boolean(disabled)}
      {...(name ? { name } : {})}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn('w-full', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {!known && hasValue && value !== '' ? <SelectItem value={value}>{value}</SelectItem> : null}

        {options.map((option) => (
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
