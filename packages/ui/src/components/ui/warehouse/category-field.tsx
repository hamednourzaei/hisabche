'use client'

// ============================================
// «دسته‌بندی» of a product — the business's own words.
//
// A clothes shop has «شال» and «شلوار»; a goldsmith has «دستبند» and
// «گردنبند». The list is whatever THIS business has already used (the server's
// distinct categories), and a new one is made by typing it — there is no fixed
// list of trades in the product.
//
// The six categories the app used to ship with still read in the user's
// language; any other is shown exactly as it was typed.
// ============================================

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useProductCategories } from '@hisabche/api'

import { SelectField } from '../select-field'

type T = (key: string, fallback?: string) => string

/** The categories the app once fixed; kept only so they keep their translated names. */
export const SEEDED_CATEGORIES = [
  'general',
  'food',
  'electronics',
  'clothing',
  'construction',
  'medicine',
] as const

export const MAX_CATEGORY_LENGTH = 60

/** How a stored category reads on screen. */
export function categoryLabel(t: T, category: string | null | undefined): string {
  const value = (category ?? '').trim()
  if (!value) return ''
  return (SEEDED_CATEGORIES as readonly string[]).includes(value)
    ? t(`warehouse.categories.${value}`, value)
    : value
}

const field =
  'min-h-11 w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 text-sm text-[hsl(var(--fg-primary))]'

export function CategoryField({
  t,
  id,
  value,
  onChange,
  disabled,
}: {
  t: T
  id: string
  value: string
  onChange: (next: string) => void
  disabled?: boolean | undefined
}) {
  const known = useProductCategories()
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')

  // What this business has used, plus the value in hand (a product may carry a
  // category nothing else does) and «general», the one every product can have.
  const choices = [...new Set(['general', value, ...(known.data ?? [])])]
    .map((item) => item.trim())
    .filter((item) => item !== '')

  if (typing) {
    const commit = () => {
      const next = draft.trim().slice(0, MAX_CATEGORY_LENGTH)
      if (next) onChange(next)
      setTyping(false)
      setDraft('')
    }
    return (
      <div className="flex items-center gap-1.5" data-category-new>
        <input
          id={id}
          name="category"
          autoFocus
          value={draft}
          maxLength={MAX_CATEGORY_LENGTH}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commit()
            }
          }}
          placeholder={t('warehouse.categoryNewPlaceholder', 'مثلاً شال، دستبند، قطعات')}
          className={field}
        />
        <button
          type="button"
          onClick={commit}
          disabled={disabled || draft.trim() === ''}
          className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-[hsl(var(--border-default))] px-3 text-sm text-[hsl(var(--color-primary))] disabled:opacity-50"
        >
          {t('common.save', 'ذخیره')}
        </button>
        <button
          type="button"
          onClick={() => {
            setTyping(false)
            setDraft('')
          }}
          className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-[hsl(var(--border-default))] px-3 text-sm text-[hsl(var(--fg-secondary))]"
        >
          {t('common.cancel', 'انصراف')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5" data-category-field>
      <div className="min-w-0 flex-1">
        <SelectField
          id={id}
          value={value || 'general'}
          onChange={onChange}
          disabled={disabled === true}
          options={choices.map((item) => ({ value: item, label: categoryLabel(t, item) }))}
        />
      </div>
      <button
        type="button"
        onClick={() => setTyping(true)}
        disabled={disabled}
        aria-label={t('warehouse.categoryAdd', 'دسته‌بندی تازه')}
        title={t('warehouse.categoryAdd', 'دسته‌بندی تازه')}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[hsl(var(--border-default))] text-[hsl(var(--color-primary))] disabled:opacity-50"
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
