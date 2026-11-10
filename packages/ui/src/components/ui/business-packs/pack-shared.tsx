'use client'

// ============================================
// What the business-pack screens share (10 Nov 2026): one translate-with-
// fallback, money in minor units, and the option lists every form needs —
// read from the SAME hooks the rest of the product uses (customers,
// employees, warehouses, products, departments). Nothing here keeps its own
// copy of a list.
// ============================================

import { useMemo, type ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  asList,
  useCustomers,
  useDepartments,
  useEmployees,
  useProducts,
  useWarehouseOverview,
} from '@hisabche/api'
import { FRACTION_DIGITS, formatMoney, type KnownCurrency } from '@hisabche/formatting'

import { translateOr } from '../../../lib/translate-or'
import { typedNumber } from '../../../lib/typed-number'
import { SelectField, type SelectFieldOption, type SelectFieldProps } from '../select-field'

export type Translate = (key: string, fallback?: string) => string

/** `t(key, fallback)` — the key is in all three locales; the fallback guards a stale bundle. */
export function usePackT(): Translate {
  const t = useTranslations()
  return useMemo(
    () =>
      (key: string, fallback = '') =>
        translateOr(t, key, fallback),
    [t],
  )
}

export const packCard =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4 sm:p-5'

export function digitsOf(currency: string): number {
  return (FRACTION_DIGITS as Record<string, number>)[currency] ?? 2
}

/** Minor units → «1,250 افغانی». */
export function useMoneyText() {
  const locale = useLocale()
  return useMemo(
    () => (minor: number, currency: string) =>
      formatMoney(minor / 10 ** digitsOf(currency), currency as KnownCurrency, locale),
    [locale],
  )
}

/** «12.5» typed in a currency → minor units; null when it is not an amount. */
export function typedMinor(text: string, currency: string): number | null {
  const value = typedNumber(text)
  if (value === null || value < 0) return null
  return Math.round(value * 10 ** digitsOf(currency))
}

export function useCustomerOptions(): SelectFieldOption[] {
  const customers = useCustomers({ page: 1, limit: 100, sortDirection: 'desc' })
  return useMemo(() => {
    const raw = customers.data as { customers?: unknown; data?: unknown } | unknown[] | undefined
    const list = Array.isArray(raw)
      ? raw
      : asList<unknown>(
          (raw as { customers?: unknown })?.customers ?? (raw as { data?: unknown })?.data,
        )
    return (
      list as Array<{ id?: string; fullName?: string; full_name?: string; phone?: string | null }>
    )
      .filter((c): c is typeof c & { id: string } => Boolean(c.id))
      .map((c) => ({
        value: c.id,
        label: c.fullName ?? c.full_name ?? c.id.slice(0, 8),
        ...(c.phone ? { keywords: c.phone } : {}),
      }))
  }, [customers.data])
}

/** `GET /api/employees` is snake_case (CLAUDE.md) — read it as such. */
export function useEmployeeOptions(): SelectFieldOption[] {
  const employees = useEmployees({ page: 1, limit: 100 })
  return useMemo(() => {
    const raw = employees.data as { data?: unknown; employees?: unknown } | unknown[] | undefined
    const list = Array.isArray(raw)
      ? raw
      : asList<unknown>(
          (raw as { data?: unknown })?.data ?? (raw as { employees?: unknown })?.employees,
        )
    return (list as Array<{ id?: string; first_name?: string | null; last_name?: string | null }>)
      .filter((e): e is typeof e & { id: string } => Boolean(e.id))
      .map((e) => ({
        value: e.id,
        label: [e.first_name, e.last_name].filter(Boolean).join(' ') || e.id.slice(0, 8),
      }))
  }, [employees.data])
}

export function useWarehouseOptions(): SelectFieldOption[] {
  const overview = useWarehouseOverview()
  return useMemo(
    () =>
      (overview.data?.warehouses ?? [])
        .filter((w) => w.isActive !== false)
        .map((w) => ({ value: w.id, label: w.name })),
    [overview.data],
  )
}

/** Products, split by what they are: goods (on a shelf) or services. */
export function useProductOptions(kind: 'goods' | 'service'): SelectFieldOption[] {
  const products = useProducts({ limit: 100 })
  return useMemo(() => {
    const raw = products.data as { products?: unknown; data?: unknown } | unknown[] | undefined
    const list = Array.isArray(raw)
      ? raw
      : asList<unknown>(
          (raw as { products?: unknown })?.products ?? (raw as { data?: unknown })?.data,
        )
    return (list as Array<{ id?: string; name?: string; offeringType?: string | null }>)
      .filter((p): p is typeof p & { id: string } => Boolean(p.id))
      .filter((p) =>
        kind === 'service'
          ? p.offeringType === 'service'
          : p.offeringType !== 'service' && p.offeringType !== 'package',
      )
      .map((p) => ({ value: p.id, label: p.name ?? p.id.slice(0, 8) }))
  }, [products.data, kind])
}

/** HR departments (hair, nails, skin): the salon's departments are these, not a second list. */
export function useDepartmentOptions(): SelectFieldOption[] {
  const departments = useDepartments()
  return useMemo(
    () =>
      (departments.data ?? [])
        .filter((d): d is { id: string; name?: string } => Boolean(d.id))
        .map((d) => ({ value: d.id, label: d.name ?? d.id.slice(0, 8) })),
    [departments.data],
  )
}

/** Name of an option's value, or a short id when it is not in the list. */
export function labelOf(
  options: readonly SelectFieldOption[],
  value: string | null | undefined,
): ReactNode {
  if (!value) return '—'
  return options.find((o) => o.value === value)?.label ?? value.slice(0, 8)
}

/** «Not set up yet» — the migration has not run; never shown as an empty list (§7.6). */
export function NotReady({ t, migration }: { t: Translate; migration: string }) {
  return (
    <p role="status" className={`${packCard} text-sm text-[hsl(var(--fg-secondary))]`}>
      {t('businessPacks.notReady', 'این بخش هنوز راه‌اندازی نشده است (اسکریپت دیتابیس اجرا نشده).')}{' '}
      <code className="text-xs">{migration}</code>
    </p>
  )
}

/** A SelectField with its visible label (SelectField itself takes only `aria-label`). */
export function LabeledSelect({
  label,
  ...props
}: SelectFieldProps & { label?: string | undefined }) {
  if (!label) return <SelectField {...props} />
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-[hsl(var(--fg-secondary))]">{label}</span>
      <SelectField aria-label={label} {...props} />
    </label>
  )
}
