'use client'

// ============================================
// The three inputs every service-delivery form needs: a labelled control, its
// server error, and the one select that can be searched.
//
// ⚠️ NOT A NEW UI PRIMITIVE. `SelectField` and `Input` are the product's own;
// this file only adds the label/error pairing the dialogs share so the same
// markup is not written five times. It lives inside the feature folder, like
// `returns/` does, and nothing outside it imports it.
// ============================================

import type { ReactNode } from 'react'

import { Input } from '../input'
import { SelectField, type SelectFieldOption } from '../select-field'

export function Labeled({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string | undefined
  hint?: string | undefined
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-medium text-[hsl(var(--fg-secondary))]">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="block text-xs text-[hsl(var(--color-destructive))]">
          {error}
        </span>
      ) : null}
      {hint && !error ? (
        <span className="block text-xs text-[hsl(var(--fg-tertiary))]">{hint}</span>
      ) : null}
    </div>
  )
}

const selectClass =
  'h-10 w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 text-sm'

export function SelectInput({
  label,
  name,
  value,
  onChange,
  options,
  placeholder,
  error,
  hint,
  disabled,
  searchable,
  searchPlaceholder,
  noResultsText,
}: {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  options: readonly SelectFieldOption[]
  placeholder?: string | undefined
  error?: string | undefined
  hint?: string | undefined
  disabled?: boolean | undefined
  searchable?: boolean | undefined
  searchPlaceholder?: string | undefined
  noResultsText?: string | undefined
}) {
  return (
    <Labeled label={label} error={error} hint={hint}>
      <SelectField
        name={name}
        aria-label={label}
        value={value}
        onChange={onChange}
        options={options}
        className={selectClass}
        {...(placeholder ? { placeholder } : {})}
        {...(disabled ? { disabled } : {})}
        {...(searchable ? { searchable } : {})}
        {...(searchPlaceholder ? { searchPlaceholder } : {})}
        {...(noResultsText ? { noResultsText } : {})}
      />
    </Labeled>
  )
}

/** A clock time. The server stores `HH:mm`, so seconds are trimmed on the way in. */
export function TimeInput({
  label,
  name,
  value,
  onChange,
  error,
}: {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  error?: string | undefined
}) {
  return (
    <Labeled label={label} error={error}>
      <Input
        type="time"
        name={name}
        dir="ltr"
        className="tabular-nums"
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, 5))}
      />
    </Labeled>
  )
}
