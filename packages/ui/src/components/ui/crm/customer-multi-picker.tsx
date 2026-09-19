'use client'

import { useState, useCallback, useMemo, useEffect, memo } from 'react'
import { useTranslations } from 'next-intl'
import { Check, ChevronsUpDown, Plus, Users, Loader2, X } from 'lucide-react'
import { useCustomers, useCreateCustomer } from '@hisabche/api'
import { cn } from '../../../lib/utils'

/* ═══════════════════════════════════════════════════════════════════════════
   CustomerMultiPicker — multi-select variant of CustomerPicker, scoped to
   the CRM task-assignment form. Built as a dedicated component (instead of
   adding a multi-select mode to CustomerPicker) to avoid touching the 10+
   existing single-select call sites of CustomerPicker.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface CustomerOption {
  id: string
  name: string
  phone: string
}

interface CustomerMultiPickerProps {
  value: CustomerOption[]
  onChange: (customers: CustomerOption[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export const CustomerMultiPicker = memo(function CustomerMultiPicker({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: CustomerMultiPickerProps) {
  const tOriginal = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0])
    return v && v !== key ? v : (fallback ?? key)
  }

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [quickName, setQuickName] = useState('')
  const [quickPhone, setQuickPhone] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, isLoading } = useCustomers({
    page: 1,
    limit: 25,
    sortDirection: 'desc',
    search: debouncedSearch || undefined,
  })
  const createCustomer = useCreateCustomer()

  const filtered = useMemo(() => (data?.customers || []).slice(0, 25), [data])
  const selectedIds = useMemo(() => new Set(value.map((c) => c.id)), [value])

  /**
   * ⚠️ ADD-ONLY (request #98-ب): «هر مشتری که سلکت شد رنگش عوض بشه و دیگه
   * دوبار قابل سلکت نباشه».
   *
   * This used to toggle, so a second click on a row that LOOKED selected
   * silently removed it — in a list where the same customer can scroll past
   * twice after a search, that is how someone loses a customer from a task
   * without noticing. Removing is still possible, but only where it reads as
   * removing: the ✕ on the chip below.
   */
  const select = useCallback(
    (customerId: string) => {
      if (selectedIds.has(customerId)) return
      const customer = filtered.find((c) => c.id === customerId)
      if (!customer) return
      onChange([
        ...value,
        { id: customer.id ?? '', name: customer.fullName, phone: customer.phone ?? '' },
      ])
    },
    [filtered, selectedIds, value, onChange],
  )

  const remove = useCallback(
    (customerId: string) => onChange(value.filter((c) => c.id !== customerId)),
    [value, onChange],
  )

  const handleQuickCreate = useCallback(async () => {
    const trimmed = quickName.trim()
    if (!trimmed) return
    setCreateError(null)
    try {
      const nc = await createCustomer.mutateAsync({
        type: 'cash',
        fullName: trimmed,
        ...(quickPhone.trim() && { phone: quickPhone.trim() }),
        openingBalance: 0,
        isActive: true,
      })
      onChange([...value, { id: nc.id ?? '', name: nc.fullName, phone: nc.phone ?? '' }])
      setQuickName('')
      setQuickPhone('')
    } catch {
      setCreateError(t('customer.createError', 'خطا در ایجاد مشتری'))
    }
  }, [quickName, quickPhone, createCustomer, value, onChange, t])

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm',
          'border border-[hsl(var(--border-default))]',
          'bg-[hsl(var(--surface-base))]',
          'text-[hsl(var(--fg-primary))]',
          'hover:border-[hsl(var(--color-primary)/0.4)]',
          'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary)/0.3)]',
          disabled && 'cursor-not-allowed opacity-40',
        )}
      >
        <span className="flex items-center gap-2 truncate text-start">
          <Users className="size-4 shrink-0 text-[hsl(var(--fg-tertiary))]" aria-hidden="true" />
          {value.length > 0 ? (
            <span className="font-medium">
              {value.length === 1
                ? value[0]?.name
                : t('crm.customersSelectedCount', `${value.length} مشتری انتخاب شده`)}
            </span>
          ) : (
            <span className="text-[hsl(var(--fg-tertiary))]">
              {placeholder || t('crm.pickCustomersPlaceholder', 'انتخاب مشتری‌ها...')}
            </span>
          )}
        </span>
        <ChevronsUpDown
          className="size-4 shrink-0 text-[hsl(var(--fg-tertiary))]"
          aria-hidden="true"
        />
      </button>

      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--color-primary)/0.1)] px-2.5 py-1 text-xs font-medium text-[hsl(var(--color-primary))]"
            >
              {c.name}
              <button
                type="button"
                onClick={() => remove(c.id)}
                aria-label={t('action.remove', 'حذف')}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={cn(
              'absolute z-50 mt-1 w-full overflow-hidden rounded-2xl',
              'border border-[hsl(var(--border-strong))]',
              'bg-[hsl(var(--surface-elevated))]',
              'shadow-lg',
            )}
          >
            <div className="p-2">
              <div className="border-b border-[hsl(var(--border-default))] pb-2 mb-2">
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('action.search', 'جستجو') + '...'}
                  className={cn(
                    'w-full rounded-lg px-3 py-2 text-sm',
                    'border border-[hsl(var(--border-default))]',
                    'bg-[hsl(var(--surface-base))]',
                    'text-[hsl(var(--fg-primary))]',
                    'placeholder:text-[hsl(var(--fg-tertiary))]',
                    'focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)]',
                  )}
                />
              </div>

              <div className="max-h-64 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2
                      className="size-5 animate-spin text-[hsl(var(--fg-tertiary))]"
                      aria-hidden="true"
                    />
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="p-4 text-center text-sm text-[hsl(var(--fg-tertiary))]">
                    {t('customer.noCustomers', 'مشتری‌ای پیدا نشد')}
                  </p>
                ) : (
                  filtered.map((customer) => {
                    const id = customer.id ?? ''
                    const checked = selectedIds.has(id)
                    return (
                      <div
                        key={id}
                        role="option"
                        aria-selected={checked}
                        aria-disabled={checked}
                        onClick={() => select(id)}
                        className={cn(
                          'relative flex select-none items-center justify-between rounded-lg px-3 py-2.5 text-sm outline-none',
                          'min-h-[44px]',
                          'transition-colors duration-100',
                          checked
                            ? // Already on the task: coloured in, and not a
                              // target any more. Colour alone would be the only
                              // signal for a reader who cannot see it, so the
                              // ✓ and `aria-disabled` carry it too.
                              'cursor-default bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]'
                            : 'cursor-pointer text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--color-primary)/0.08)]',
                        )}
                      >
                        <div>
                          <p className="font-medium">{customer.fullName}</p>
                          {customer.phone && (
                            <p
                              className={cn(
                                'text-xs',
                                checked
                                  ? 'text-[hsl(var(--color-success))]'
                                  : 'text-[hsl(var(--fg-tertiary))]',
                              )}
                            >
                              {customer.phone}
                            </p>
                          )}
                        </div>
                        {checked && (
                          <span className="flex shrink-0 items-center gap-1 text-xs font-medium">
                            <Check className="size-4" aria-hidden="true" />
                            {t('crm.customerAlreadyPicked', 'انتخاب شده')}
                          </span>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              <div className="border-t border-[hsl(var(--border-default))] pt-3 mt-2">
                {createError && (
                  <p className="mb-2 text-xs text-[hsl(var(--color-destructive))]" role="alert">
                    {createError}
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  <input
                    value={quickName}
                    onChange={(e) => {
                      setQuickName(e.target.value)
                      setCreateError(null)
                    }}
                    placeholder={t('customer.quickCreate', 'ایجاد سریع مشتری')}
                    className={cn(
                      'flex-1 rounded-lg px-3 py-2 text-sm',
                      'border border-[hsl(var(--border-default))]',
                      'bg-[hsl(var(--surface-base))]',
                      'text-[hsl(var(--fg-primary))]',
                      'placeholder:text-[hsl(var(--fg-tertiary))]',
                      'focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)]',
                    )}
                  />
                  {quickName.trim() && (
                    <input
                      type="tel"
                      value={quickPhone}
                      onChange={(e) => setQuickPhone(e.target.value)}
                      placeholder={t('customer.phoneOptional', 'شماره تماس (اختیاری)')}
                      className={cn(
                        'rounded-lg px-3 py-2 text-sm',
                        'border border-[hsl(var(--border-default))]',
                        'bg-[hsl(var(--surface-base))]',
                        'text-[hsl(var(--fg-primary))]',
                        'placeholder:text-[hsl(var(--fg-tertiary))]',
                        'focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)]',
                      )}
                    />
                  )}
                  <button
                    type="button"
                    onClick={handleQuickCreate}
                    disabled={!quickName.trim() || createCustomer.isPending}
                    className={cn(
                      'flex shrink-0 items-center justify-center gap-1 rounded-lg px-3 py-2',
                      'text-sm font-medium text-white',
                      'bg-[image:var(--gradient-brand)]',
                      'transition-all duration-200',
                      'hover:brightness-110',
                      'disabled:opacity-40 disabled:cursor-not-allowed',
                    )}
                  >
                    {createCustomer.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Plus className="size-4" aria-hidden="true" />
                    )}
                    {t('action.add', 'افزودن')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
})

CustomerMultiPicker.displayName = 'CustomerMultiPicker'
