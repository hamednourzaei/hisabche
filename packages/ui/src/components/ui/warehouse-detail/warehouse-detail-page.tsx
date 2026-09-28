'use client'

import { KpiCard, KpiGrid } from '../kpi-card'
import { useState, useEffect } from 'react'
import { UnitSelect } from '../units/unit-select'
import { GHOST_ICON_BUTTON, OUTLINE_BUTTON } from '../button-classes'
import { cn } from '../../../lib/utils'
import {
  ArrowRight,
  Package,
  DollarSign,
  AlertTriangle,
  Loader2,
  Save,
  Trash2,
  Edit3,
  X,
  type LucideIcon,
  TrendingUp,
} from 'lucide-react'
import { MoneyInput } from '../money-input'

/* ═══════════════════════════════════════════════════════════════════════════
   ProductDetailPage v3 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   No external component dependencies
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠️ WAS `'piece' | 'kg' | 'liter' | 'meter' | 'box'` — FIVE OF FIFTEEN.
 *
 * `units` (phase-l-01) seeds fifteen codes and `unitSchema` accepts all of
 * them. Narrowing to five here did not merely hide options: `toUnitType`
 * coerced everything else to 'piece', so a product measured in grams opened
 * as «عدد» and SAVING the form wrote 'piece' over the real unit — a silent
 * data change, structurally the T1 currency-to-AFN defect. See T2.
 */
type UnitType = string

interface ProductData {
  name: string
  barcode: string
  sellPrice: number
  buyPrice: number
  quantity: number
  minStockLevel: number
  category: string
  unit: string
}

interface ProductEditValues {
  name: string
  barcode: string
  sellPrice: number
  buyPrice: number
  quantity: number
  minStockLevel: number
  category: string
  unit: UnitType
}

/**
 * ⚠️ NO LONGER A LIST, AND NO LONGER A COERCION.
 *
 * `UNIT_OPTIONS` held five hardcoded units and `toUnitType` mapped anything
 * else to 'piece'. The list now comes from the `units` table through
 * `<UnitSelect>`, and an unrecognised unit is displayed as itself rather than
 * replaced. `toUnitType` is kept only as identity so the display call sites
 * below read unchanged — it deliberately no longer substitutes anything.
 */
const toUnitType = (unit: string): UnitType => unit

// Shared style constants
const primaryBtn =
  'inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold text-white bg-[image:var(--gradient-brand)] shadow-sm shadow-[hsl(var(--color-primary)/0.15)] transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed motion-reduce:transition-none'
const inputBase =
  'w-full rounded-xl px-3 py-2.5 text-sm border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))] focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)] transition-colors duration-200 motion-reduce:transition-none'
const cardBase =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]'
const interactiveCard =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] transition-shadow duration-200 hover:shadow-lg'

const stockBadgeStyles: Record<string, string> = {
  success:
    'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))] border-[hsl(var(--color-success)/0.2)]',
  warning:
    'bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))] border-[hsl(var(--color-warning)/0.2)]',
  destructive:
    'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))] border-[hsl(var(--color-destructive)/0.2)]',
  secondary:
    'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))] border-[hsl(var(--border-default))]',
}

export interface ProductDetailPageProps {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  isLoading: boolean
  product: ProductData | null
  editing: boolean
  updatePending: boolean
  stockStatus: 'success' | 'warning' | 'destructive' | 'secondary'
  stockLabel: string
  profitPerUnit: number
  totalProfit: number
  totalValue: number
  onBack: () => void
  onStartEditing: () => void
  onCancelEditing: () => void
  onSave: (data: ProductEditValues) => void
  onDelete: () => void
  /** Expiry (request #95) — the batches panel, rendered by the container. */
  expiry?: React.ReactNode
  /** The product's money journey (evidence chain), rendered by the container. */
  journey?: React.ReactNode
  /** The product's extra barcodes (27 Sep 2026), rendered by the container. */
  barcodes?: React.ReactNode
}

export function ProductDetailPage({
  t,
  fmt,
  isLoading,
  product,
  editing,
  updatePending,
  stockStatus,
  stockLabel,
  profitPerUnit,
  totalProfit,
  totalValue,
  onBack,
  onStartEditing,
  onCancelEditing,
  onSave,
  onDelete,
  expiry,
  journey,
  barcodes,
}: ProductDetailPageProps) {
  const [editValues, setEditValues] = useState<ProductEditValues>({
    name: '',
    barcode: '',
    sellPrice: 0,
    buyPrice: 0,
    quantity: 0,
    minStockLevel: 0,
    category: 'general',
    unit: 'piece',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof ProductEditValues, string>>>({})

  useEffect(() => {
    if (product) {
      setEditValues({
        name: product.name,
        barcode: product.barcode,
        sellPrice: product.sellPrice,
        buyPrice: product.buyPrice,
        quantity: product.quantity,
        minStockLevel: product.minStockLevel,
        category: product.category,
        unit: toUnitType(product.unit),
      })
    }
  }, [product])

  const handleEditChange = (field: keyof ProductEditValues, value: string | number | UnitType) => {
    setEditValues((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ProductEditValues, string>> = {}
    if (!editValues.name.trim()) newErrors.name = t('product.nameRequired', 'نام محصول الزامی است')
    if (editValues.sellPrice < 0)
      newErrors.sellPrice = t('validation.min', 'مقدار نمی‌تواند منفی باشد')
    if (editValues.buyPrice < 0)
      newErrors.buyPrice = t('validation.min', 'مقدار نمی‌تواند منفی باشد')
    if (editValues.quantity < 0)
      newErrors.quantity = t('validation.min', 'مقدار نمی‌تواند منفی باشد')
    if (editValues.minStockLevel < 0)
      newErrors.minStockLevel = t('validation.min', 'مقدار نمی‌تواند منفی باشد')
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (validateForm()) onSave(editValues)
  }

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2
          className="size-8 animate-spin text-[hsl(var(--color-primary))]"
          aria-hidden="true"
        />
      </div>
    )
  }

  // ── Not Found ──
  if (!product) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Package className="size-16 text-[hsl(var(--fg-tertiary))]" aria-hidden="true" />
        <p className="text-lg text-[hsl(var(--fg-secondary))]">
          {t('warehouse.notFound', 'محصول پیدا نشد')}
        </p>
        <button type="button" onClick={onBack} className={OUTLINE_BUTTON}>
          {t('action.back', 'بازگشت به گدام')}
        </button>
      </div>
    )
  }

  const badgeStyle = stockBadgeStyles[stockStatus] ?? stockBadgeStyles.secondary

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label={t('common.back', 'بازگشت')}
            className={GHOST_ICON_BUTTON}
          >
            <ArrowRight className="size-5" aria-hidden="true" />
          </button>
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
            {editing ? t('action.edit', 'ویرایش') : product.name}
          </h1>
          {!editing && (
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border shrink-0',
                badgeStyle,
              )}
            >
              {stockLabel} ({product.quantity})
            </span>
          )}
        </div>

        <div className="flex gap-2">
          {editing ? (
            <>
              <button type="button" onClick={onCancelEditing} className={OUTLINE_BUTTON}>
                <X className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t('action.cancel', 'انصراف')}</span>
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={updatePending}
                className={primaryBtn}
              >
                {updatePending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="size-4" aria-hidden="true" />
                )}
                <span className="hidden sm:inline">{t('action.save', 'ذخیره')}</span>
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onStartEditing} className={OUTLINE_BUTTON}>
                <Edit3 className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t('action.edit', 'ویرایش')}</span>
              </button>
              <button
                type="button"
                onClick={onDelete}
                className={cn(
                  OUTLINE_BUTTON,
                  'hover:bg-[hsl(var(--color-destructive)/0.1)] hover:text-[hsl(var(--color-destructive))] hover:border-[hsl(var(--color-destructive)/0.3)]',
                )}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t('action.delete', 'حذف')}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Product Details Card ── */}
      <div className={cardBase}>
        <div className="p-6 sm:p-8 space-y-6">
          {editing ? (
            /* ── Edit Form ── */
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--fg-primary))] mb-1.5">
                  {t('warehouse.productName', 'نام محصول')}
                </label>
                <input
                  type="text"
                  value={editValues.name}
                  onChange={(e) => handleEditChange('name', e.target.value)}
                  placeholder={t('warehouse.productNamePlaceholder', 'نام محصول را وارد کنید')}
                  className={cn(inputBase, errors.name && 'border-[hsl(var(--color-destructive))]')}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-[hsl(var(--color-destructive))]" role="alert">
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Barcode — a string, always (a leading zero is part of it) */}
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--fg-primary))] mb-1.5">
                  {t('barcode.label', 'بارکد')}
                </label>
                <input
                  type="text"
                  name="barcode"
                  dir="ltr"
                  autoComplete="off"
                  value={editValues.barcode}
                  onChange={(e) => handleEditChange('barcode', e.target.value)}
                  // A scanner ends every code with Enter: it must not submit the form.
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.preventDefault()
                  }}
                  placeholder={t('barcode.hint', 'بارکد را اسکن یا تایپ کنید')}
                  className={inputBase}
                />
              </div>

              {/* Prices */}
              <div className="grid grid-cols-2 gap-4">
                {(['sellPrice', 'buyPrice'] as const).map((field) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-[hsl(var(--fg-primary))] mb-1.5">
                      {t(`warehouse.${field}`, field === 'sellPrice' ? 'قیمت فروش' : 'قیمت خرید')}{' '}
                      (AFN)
                    </label>
                    <MoneyInput
                      value={editValues[field]}
                      onChange={(raw) => handleEditChange(field, parseFloat(raw) || 0)}
                      className={cn(
                        inputBase,
                        'h-auto',
                        errors[field] && 'border-[hsl(var(--color-destructive))]',
                      )}
                    />
                    {errors[field] && (
                      <p className="mt-1 text-sm text-[hsl(var(--color-destructive))]" role="alert">
                        {errors[field]}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Quantity, Min Stock, Unit */}
              <div className="grid grid-cols-3 gap-4">
                {(['quantity', 'minStockLevel'] as const).map((field) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-[hsl(var(--fg-primary))] mb-1.5">
                      {t(
                        `warehouse.${field === 'minStockLevel' ? 'minStock' : field}`,
                        field === 'minStockLevel' ? 'حداقل موجودی' : 'تعداد',
                      )}
                    </label>
                    <input
                      type="number"
                      value={editValues[field]}
                      onChange={(e) => handleEditChange(field, parseInt(e.target.value) || 0)}
                      className={cn(
                        inputBase,
                        errors[field] && 'border-[hsl(var(--color-destructive))]',
                      )}
                    />
                    {errors[field] && (
                      <p className="mt-1 text-sm text-[hsl(var(--color-destructive))]" role="alert">
                        {errors[field]}
                      </p>
                    )}
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-medium text-[hsl(var(--fg-primary))] mb-1.5">
                    {t('warehouse.unit', 'واحد')}
                  </label>
                  {/* Was a native <select> over five hardcoded units. Now the
                      shared picker, fed by the `units` table (T2). */}
                  <UnitSelect
                    value={editValues.unit}
                    onChange={(unit) => handleEditChange('unit', unit)}
                    className={cn(inputBase, 'appearance-none')}
                    t={t}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* ── View Mode ── */
            <>
              {/* The product's own KPI row — these were bare label/value
                  pairs with no card around them (a local `InfoBox`). */}
              <KpiGrid>
                <KpiCard
                  icon={DollarSign}
                  label={t('warehouse.sellPrice', 'قیمت فروش')}
                  value={`${fmt(product.sellPrice)} AFN`}
                />
                <KpiCard
                  icon={DollarSign}
                  label={t('warehouse.buyPrice', 'قیمت خرید')}
                  value={`${fmt(product.buyPrice)} AFN`}
                />
                <KpiCard
                  icon={Package}
                  label={t('warehouse.quantity', 'تعداد')}
                  value={`${product.quantity} ${t(`warehouse.units.${toUnitType(product.unit)}`, product.unit)}`}
                />
                <KpiCard
                  icon={AlertTriangle}
                  label={t('warehouse.minStock', 'حداقل موجودی')}
                  value={`${product.minStockLevel}`}
                />
              </KpiGrid>
              <div className="grid grid-cols-2 gap-4 border-t border-[hsl(var(--border-default))] pt-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-[hsl(var(--fg-secondary))]">
                    {t('warehouse.category', 'دسته‌بندی')}
                  </p>
                  <p className="font-medium text-[hsl(var(--fg-primary))]">{product.category}</p>
                </div>
                <div>
                  <p className="text-xs text-[hsl(var(--fg-secondary))]">
                    {t('warehouse.unit', 'واحد')}
                  </p>
                  <p className="font-medium text-[hsl(var(--fg-primary))]">
                    {t(`warehouse.units.${toUnitType(product.unit)}`, product.unit)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[hsl(var(--fg-secondary))]">
                    {t('warehouse.totalValue', 'ارزش کل موجودی')}
                  </p>
                  <p className="font-bold text-[hsl(var(--color-primary))]">
                    {fmt(totalValue)} AFN
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Profit cards — the product's KPI row, three across ── */}
      <KpiGrid className="sm:grid-cols-3">
        <KpiCard
          icon={Package}
          label={t('warehouse.currentStock', 'موجودی فعلی')}
          value={product.quantity}
        />
        <KpiCard
          icon={TrendingUp}
          label={t('warehouse.profitPerUnit', 'سود هر واحد')}
          value={`${fmt(profitPerUnit)} AFN`}
        />
        <KpiCard
          icon={TrendingUp}
          label={t('warehouse.totalProfit', 'سود کل موجودی')}
          value={`${fmt(totalProfit)} AFN`}
        />
      </KpiGrid>

      {barcodes}
      {expiry}
      {journey}
    </div>
  )
}
