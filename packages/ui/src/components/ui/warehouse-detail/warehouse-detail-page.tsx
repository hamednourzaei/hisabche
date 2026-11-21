'use client'

import Image from 'next/image'
import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Barcode,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Edit3,
  Factory,
  FileText,
  History,
  ImagePlus,
  Layers,
  LayoutGrid,
  Loader2,
  Package,
  Ruler,
  Save,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  X,
  type LucideIcon,
} from 'lucide-react'

import { useAdjustOnChange } from '../../../hooks/use-adjust-on-change'
import { cn } from '../../../lib/utils'
import { GHOST_ICON_BUTTON, OUTLINE_BUTTON } from '../button-classes'
import { Dialog, DialogContent, DialogTitle } from '../dialog'
import { KpiCard, KpiGrid } from '../kpi-card'
import { MoneyInput } from '../money-input'
import { SelectField } from '../select-field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../tabs'
import { UnitSelect } from '../units/unit-select'
import { CategoryField, categoryLabel } from '../warehouse/category-field'

/* ═══════════════════════════════════════════════════════════════════════════
   ProductDetailPage v4 — the light, tabbed product page (owner, 20 Nov 2026).

   Header → four money cards → product aside (right) + tabbed workspace (left).
   The aside carries the cover — or the upload control when there is no cover.
   Every capability still has a home: variants, kits, notes/expiry/waste, units,
   stock history, and the four panels that open over the page.

   Tokens only: the tints below carry the semantic token at alpha, so the same
   classes read on the light and the dark theme.
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

/** The four panels the product page opens as tiles (owner, 17 Oct 2026). */
type SectionKey = 'manufacturing' | 'customFields' | 'images' | 'barcodes'

/** The tabs of the workspace. Conditional ones are built from the props. */
type TabKey = 'variants' | 'kits' | 'notes' | 'units' | 'history' | 'more'

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
  /** Where a quantity change lands (BUG-080). '' = not chosen. */
  warehouseId: string
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
  'inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold text-[hsl(var(--color-primary-fg))] bg-[image:var(--gradient-brand)] shadow-sm shadow-[hsl(var(--color-primary)/0.15)] transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed motion-reduce:transition-none'
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

/** One line of the product aside: a quiet label, a value that keeps its place. */
function DetailRow({
  label,
  value,
  ltr = false,
}: {
  label: string
  value: React.ReactNode
  ltr?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-dashed border-[hsl(var(--border-default))] py-2 last:border-0">
      <dt className="shrink-0 text-xs text-[hsl(var(--fg-secondary))]">{label}</dt>
      <dd
        {...(ltr ? { dir: 'ltr' as const } : {})}
        className="min-w-0 text-end text-xs font-bold tabular-nums text-[hsl(var(--fg-primary))]"
      >
        {value}
      </dd>
    </div>
  )
}

export interface ProductDetailPageProps {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  /** The books currency, from the server. Absent = no label, never a guess. */
  currency?: string | undefined
  isLoading: boolean
  product: ProductData | null
  editing: boolean
  updatePending: boolean
  stockStatus: 'success' | 'warning' | 'destructive' | 'secondary'
  stockLabel: string
  /** The product's own status; null when it was not read. */
  isActive?: boolean | null
  profitPerUnit: number
  totalProfit: number
  /** Stock value at BUYING price — what the shelf cost to fill. */
  purchaseValue: number
  /** Stock value at SELLING price — what it can sell for. */
  totalValue: number
  onBack: () => void
  onStartEditing: () => void
  onCancelEditing: () => void
  onSave: (data: ProductEditValues) => void
  onDelete: () => void
  /** The first image — the cover the aside shows. */
  coverImage?: { url: string; altText: string } | null
  /** The cover read is still running; not the same answer as «no cover». */
  imagesLoading?: boolean
  /** The cover read failed; never render that as «no cover». */
  imagesError?: boolean
  onRetryImages?: (() => void) | undefined
  /** The tab order follows the reading direction of the language. */
  dir?: 'rtl' | 'ltr'
  /** Expiry (request #95) — the batches panel, rendered by the container. */
  expiry?: React.ReactNode
  /** Industry-specific sections (serials, fitments, warranties). */
  specialties?: React.ReactNode
  /** «افزایش و کاهش موجودی» WITH the money journey inside it (17 Oct 2026). */
  movements?: React.ReactNode
  /** The assign form when stock sits in no warehouse — hidden when there is none. */
  stockPanel?: React.ReactNode
  /** Where the stock is, per warehouse (BUG-080) — the aside line. */
  stockPosition?: React.ReactNode
  /** The product's extra barcodes (27 Sep 2026), rendered by the container. */
  barcodes?: React.ReactNode
  /** The product's images (28 Sep 2026), rendered by the container. */
  images?: React.ReactNode
  /** The business's own fields on this product, rendered by the container. */
  customFields?: React.ReactNode
  /** What the product is made of, its cost and its production history. */
  manufacturing?: React.ReactNode
  /** Notes colleagues left on this product, rendered by the container. */
  notes?: React.ReactNode
  /** The tab of variants + the size × colour stock grid. */
  variants?: React.ReactNode
  /** What a bundle (kit) is made of. */
  kits?: React.ReactNode
  /** Goods that left without a sale. */
  waste?: React.ReactNode
  /** The buying/selling units editor. */
  units?: React.ReactNode
  /**
   * The business's warehouses. A quantity change lands in one: with several,
   * the person picks it; with one, it is that one; with none, nowhere.
   */
  stockWarehouses: Array<{ id: string; name: string }>
}

export function ProductDetailPage({
  t,
  fmt,
  currency,
  isLoading,
  product,
  editing,
  updatePending,
  stockStatus,
  stockLabel,
  isActive = null,
  profitPerUnit,
  totalProfit,
  purchaseValue,
  totalValue,
  onBack,
  onStartEditing,
  onCancelEditing,
  onSave,
  onDelete,
  coverImage = null,
  imagesLoading = false,
  imagesError = false,
  onRetryImages,
  dir = 'rtl',
  expiry,
  specialties,
  movements,
  stockPanel,
  stockPosition,
  barcodes,
  images,
  customFields,
  manufacturing,
  notes,
  variants,
  kits,
  waste,
  units,
  stockWarehouses,
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
    warehouseId: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof ProductEditValues, string>>>({})
  /** Which tile's panel is open over the page — null is «none». */
  const [openSection, setOpenSection] = useState<SectionKey | null>(null)
  /** The workspace tab. `null` means «the first one this business has». */
  const [activeTab, setActiveTab] = useState<TabKey | null>(null)

  useAdjustOnChange([product], () => {
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
        warehouseId: '',
      })
    }
  })

  const handleEditChange = (field: keyof ProductEditValues, value: string | number | UnitType) => {
    setEditValues((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const quantityChanged = !!product && editValues.quantity !== product.quantity

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ProductEditValues, string>> = {}
    if (!editValues.name.trim()) newErrors.name = t('product.nameRequired', 'نام محصول الزامی است')
    if (editValues.sellPrice < 0)
      newErrors.sellPrice = t('validation.min', 'مقدار نمی‌تواند منفی باشد')
    if (editValues.buyPrice < 0)
      newErrors.buyPrice = t('validation.min', 'مقدار نمی‌تواند منفی باشد')
    if (editValues.quantity < 0)
      newErrors.quantity = t('validation.min', 'مقدار نمی‌تواند منفی باشد')
    if (quantityChanged && stockWarehouses.length > 1 && !editValues.warehouseId)
      newErrors.warehouseId = t('warehouse.byWarehouse.pickRequired')
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
  const unitLabel = t(`warehouse.units.${toUnitType(product.unit)}`, product.unit)
  const category = categoryLabel(t, product.category)
  const statusStyle = isActive ? stockBadgeStyles.success : stockBadgeStyles.secondary

  const tiles: Array<{ id: SectionKey; icon: LucideIcon; label: string }> = [
    { id: 'manufacturing', icon: Factory, label: t('manufacturing.panel.title', 'ساخت و تولید') },
    {
      id: 'customFields',
      icon: SlidersHorizontal,
      label: t('customFields.title', 'فیلدهای اختصاصی'),
    },
    { id: 'images', icon: ImagePlus, label: t('productImages.title', 'عکس‌های کالا') },
    { id: 'barcodes', icon: Barcode, label: t('barcode.extraTitle', 'بارکدهای دیگر این کالا') },
  ]
  const openTile = tiles.find((tile) => tile.id === openSection)

  const tabItems: Array<{ id: TabKey; label: string; icon: LucideIcon }> = [
    ...(variants
      ? [{ id: 'variants' as const, label: t('warehouse.tabVariants'), icon: LayoutGrid }]
      : []),
    ...(kits ? [{ id: 'kits' as const, label: t('warehouse.tabKits'), icon: Layers }] : []),
    { id: 'notes' as const, label: t('warehouse.tabNotes'), icon: FileText },
    ...(units ? [{ id: 'units' as const, label: t('warehouse.tabUnits'), icon: Ruler }] : []),
    { id: 'history' as const, label: t('warehouse.stockHistory'), icon: History },
    { id: 'more' as const, label: t('warehouse.tabMore'), icon: SlidersHorizontal },
  ]
  const currentTab: TabKey =
    activeTab && tabItems.some((tab) => tab.id === activeTab)
      ? activeTab
      : (tabItems[0]?.id ?? 'notes')

  return (
    <div className="space-y-5">
      {/* ── Trail + back ── */}
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('common.back', 'بازگشت')}
          className={GHOST_ICON_BUTTON}
        >
          {dir === 'ltr' ? (
            <ArrowLeft className="size-4" aria-hidden="true" />
          ) : (
            <ArrowRight className="size-4" aria-hidden="true" />
          )}
        </button>
        <nav
          aria-label={t('warehouse.breadcrumb', 'مسیر')}
          className="flex min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap text-xs text-[hsl(var(--fg-tertiary))] scrollbar-hide"
        >
          <button
            type="button"
            onClick={onBack}
            className="transition-colors hover:text-[hsl(var(--fg-primary))]"
          >
            {t('nav.warehouse', 'انبار')}
          </button>
          {dir === 'ltr' ? (
            <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <ChevronLeft className="size-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>{t('common.product', 'کالا')}</span>
          {dir === 'ltr' ? (
            <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <ChevronLeft className="size-3.5 shrink-0" aria-hidden="true" />
          )}
          <span aria-current="page" className="truncate font-bold text-[hsl(var(--fg-primary))]">
            {product.name}
          </span>
        </nav>
      </div>

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-[hsl(var(--color-primary)/0.16)] bg-[hsl(var(--color-primary)/0.08)] text-[hsl(var(--color-primary))]">
            <Package className="size-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--fg-primary))]">
                {editing ? t('action.edit', 'ویرایش') : product.name}
              </h1>
              {!editing && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold shrink-0',
                    badgeStyle,
                  )}
                >
                  <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                  {stockLabel} ({fmt(product.quantity)} {unitLabel})
                </span>
              )}
              {!editing && isActive !== null && (
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold shrink-0',
                    statusStyle,
                  )}
                >
                  {isActive ? t('common.active', 'فعال') : t('common.inactive', 'غیرفعال')}
                </span>
              )}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[hsl(var(--fg-tertiary))]">
              <span>
                {t('warehouse.category', 'دسته‌بندی')}:{' '}
                <b className="font-semibold text-[hsl(var(--fg-secondary))]">{category || '—'}</b>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {t('warehouse.unit', 'واحد')}:{' '}
                <b className="font-semibold text-[hsl(var(--fg-secondary))]">{unitLabel}</b>
              </span>
              {product.barcode ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t('warehouse.barcode', 'بارکد')}:{' '}
                    <b dir="ltr" className="font-semibold text-[hsl(var(--fg-secondary))]">
                      {product.barcode}
                    </b>
                  </span>
                </>
              ) : null}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <button
                type="button"
                onClick={onCancelEditing}
                className={cn(OUTLINE_BUTTON, 'flex-1 justify-center sm:flex-none')}
              >
                <X className="size-4" aria-hidden="true" />
                <span>{t('action.cancel', 'انصراف')}</span>
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={updatePending}
                className={cn(primaryBtn, 'flex-1 justify-center sm:flex-none')}
              >
                {updatePending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="size-4" aria-hidden="true" />
                )}
                <span>{t('action.save', 'ذخیره')}</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onStartEditing}
                className={cn(
                  OUTLINE_BUTTON,
                  'flex-1 justify-center border-[hsl(var(--color-primary)/0.3)] bg-[hsl(var(--color-primary)/0.04)] text-[hsl(var(--color-primary))] sm:flex-none',
                )}
              >
                <Edit3 className="size-4" aria-hidden="true" />
                <span>{t('action.edit', 'ویرایش')}</span>
              </button>
              <button
                type="button"
                onClick={onDelete}
                className={cn(
                  OUTLINE_BUTTON,
                  'flex-1 justify-center border-[hsl(var(--color-destructive)/0.3)] bg-[hsl(var(--color-destructive)/0.03)] text-[hsl(var(--color-destructive))] hover:bg-[hsl(var(--color-destructive)/0.1)] hover:text-[hsl(var(--color-destructive))] hover:border-[hsl(var(--color-destructive)/0.3)] sm:flex-none',
                )}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                <span>{t('action.delete', 'حذف')}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        /* ── Edit form ── */
        <div className={cardBase}>
          <div className="space-y-4 p-4 sm:p-6">
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(['sellPrice', 'buyPrice'] as const).map((field) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-[hsl(var(--fg-primary))] mb-1.5">
                    {t(`warehouse.${field}`, field === 'sellPrice' ? 'قیمت فروش' : 'قیمت خرید')}
                    {currency ? ` (${currency})` : ''}
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

            <div>
              <label
                htmlFor="product-category"
                className="mb-1.5 block text-sm font-medium text-[hsl(var(--fg-primary))]"
              >
                {t('warehouse.category', 'دسته‌بندی')}
              </label>
              <CategoryField
                t={t}
                id="product-category"
                value={editValues.category}
                onChange={(next) => handleEditChange('category', next)}
              />
            </div>

            {/* Quantity, Unit. The minimum-stock field was removed (owner,
                13 October); a product keeps the minimum it already has. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(['quantity'] as const).map((field) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-[hsl(var(--fg-primary))] mb-1.5">
                    {t('warehouse.quantity', 'تعداد')}
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

            {/* Where a quantity change lands (BUG-080): never «no warehouse»
                when the business has warehouses. */}
            {quantityChanged && stockWarehouses.length > 1 && (
              <div data-field="warehouseId">
                <label className="block text-sm font-medium text-[hsl(var(--fg-primary))] mb-1.5">
                  {t('warehouse.byWarehouse.editWarehouse')}
                </label>
                <SelectField
                  name="warehouseId"
                  value={editValues.warehouseId}
                  onChange={(value) => handleEditChange('warehouseId', value)}
                  placeholder={t('warehouse.byWarehouse.pickWarehouse')}
                  options={stockWarehouses.map((w) => ({ value: w.id, label: w.name }))}
                />
                {errors.warehouseId && (
                  <p className="mt-1 text-sm text-[hsl(var(--color-destructive))]" role="alert">
                    {errors.warehouseId}
                  </p>
                )}
              </div>
            )}
            {quantityChanged && stockWarehouses.length === 1 && (
              <p className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('warehouse.byWarehouse.editOnly')}: {stockWarehouses[0]?.name}
              </p>
            )}
          </div>
        </div>
      ) : (
        /* ── View: money cards, then the aside + tabbed workspace ── */
        <>
          <KpiGrid className="sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              tone="warning"
              icon={DollarSign}
              label={t('warehouse.sellPrice', 'قیمت فروش')}
              value={`${fmt(product.sellPrice)}${currency ? ` ${currency}` : ''}`}
              hint={t('warehouse.perUnit', 'برای هر واحد')}
            />
            <KpiCard
              tone="info"
              icon={DollarSign}
              label={t('warehouse.buyPrice', 'قیمت خرید')}
              value={`${fmt(product.buyPrice)}${currency ? ` ${currency}` : ''}`}
              hint={t('warehouse.perUnit', 'برای هر واحد')}
            />
            <KpiCard
              tone="success"
              icon={Package}
              label={t('warehouse.totalBuyValue', 'ارزش کل خرید')}
              value={`${fmt(purchaseValue)}${currency ? ` ${currency}` : ''}`}
              hint={t('warehouse.atBuyPrice', 'به قیمت خرید')}
            />
            <KpiCard
              tone="primary"
              icon={TrendingUp}
              label={t('warehouse.totalSellValue', 'ارزش کل فروش')}
              value={`${fmt(totalValue)}${currency ? ` ${currency}` : ''}`}
              hint={t('warehouse.atSellPrice', 'به قیمت فروش')}
            />
          </KpiGrid>

          <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
            {/* ── Product aside ── */}
            <aside className={cn(cardBase, 'p-4 sm:p-5 lg:sticky lg:top-4')}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-[hsl(var(--fg-primary))]">
                  {t('warehouse.productDetails', 'جزئیات محصول')}
                </h2>
                {isActive !== null ? (
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold',
                      statusStyle,
                    )}
                  >
                    {isActive ? t('common.active', 'فعال') : t('common.inactive', 'غیرفعال')}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)] lg:block">
                {/* The cover — or the upload control when there is no cover.
                    Loading and failure are their own answers, never «no photo». */}
                <div>
                  {imagesLoading ? (
                    <div
                      className="h-40 animate-pulse rounded-2xl bg-[hsl(var(--surface-muted))] sm:h-44"
                      aria-hidden="true"
                    />
                  ) : imagesError ? (
                    <div
                      role="alert"
                      className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-2xl border border-[hsl(var(--color-destructive)/0.25)] bg-[hsl(var(--color-destructive)/0.05)] p-4 text-center"
                    >
                      <p className="text-xs text-[hsl(var(--color-destructive))]">
                        {t('productImages.loadFailed', 'عکس‌های کالا خوانده نشد.')}
                      </p>
                      {onRetryImages ? (
                        <button type="button" onClick={onRetryImages} className={OUTLINE_BUTTON}>
                          {t('common.retry', 'تلاش دوباره')}
                        </button>
                      ) : null}
                    </div>
                  ) : coverImage ? (
                    <button
                      type="button"
                      onClick={() => setOpenSection('images')}
                      className="group relative block w-full overflow-hidden rounded-2xl border border-[hsl(var(--border-default))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary)/0.5)]"
                    >
                      <Image
                        unoptimized
                        src={coverImage.url}
                        alt={coverImage.altText}
                        width={640}
                        height={480}
                        className="aspect-[4/3] w-full object-cover transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none"
                      />
                      <span className="absolute inset-x-0 bottom-0 bg-[hsl(var(--surface-overlay)/0.94)] px-3 py-2 text-start text-xs font-bold text-[hsl(var(--fg-primary))]">
                        {t('productImages.title', 'عکس‌های کالا')}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpenSection('images')}
                      className="flex min-h-[150px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-muted)/0.45)] p-4 text-center transition-colors hover:border-[hsl(var(--color-primary)/0.55)] hover:bg-[hsl(var(--color-primary)/0.035)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary)/0.5)] motion-reduce:transition-none"
                    >
                      <span className="grid size-11 place-items-center rounded-xl bg-[hsl(var(--color-primary)/0.09)] text-[hsl(var(--color-primary))]">
                        <ImagePlus className="size-5" aria-hidden="true" />
                      </span>
                      <span className="text-sm font-bold text-[hsl(var(--fg-secondary))]">
                        {t('productImages.add', 'افزودن عکس')}
                      </span>
                      <span className="max-w-[220px] text-[11px] leading-relaxed text-[hsl(var(--fg-tertiary))]">
                        {t(
                          'productImages.formats',
                          'JPG، PNG، WebP یا AVIF؛ هر عکس حداکثر ۲ مگابایت.',
                        )}
                      </span>
                    </button>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-base font-bold text-[hsl(var(--fg-primary))]">
                    {product.name}
                  </p>
                  <p className="mt-0.5 text-xs text-[hsl(var(--fg-tertiary))]">
                    {t('warehouse.category', 'دسته‌بندی')}: {category || '—'} ·{' '}
                    {t('warehouse.unit', 'واحد')}: {unitLabel}
                  </p>

                  <dl className="mt-3">
                    <DetailRow
                      label={t('warehouse.currentStock', 'موجودی فعلی')}
                      value={`${fmt(product.quantity)} ${unitLabel}`}
                    />
                    <DetailRow
                      label={t('warehouse.totalBuyValue', 'ارزش کل خرید')}
                      value={`${fmt(purchaseValue)}${currency ? ` ${currency}` : ''}`}
                      ltr
                    />
                    <DetailRow
                      label={t('warehouse.totalSellValue', 'ارزش کل فروش')}
                      value={`${fmt(totalValue)}${currency ? ` ${currency}` : ''}`}
                      ltr
                    />
                    <DetailRow
                      label={t('warehouse.profitPerUnit', 'سود هر واحد')}
                      value={`${fmt(profitPerUnit)}${currency ? ` ${currency}` : ''}`}
                      ltr
                    />
                    <DetailRow
                      label={t('warehouse.totalProfit', 'سود کل موجودی')}
                      value={`${fmt(totalProfit)}${currency ? ` ${currency}` : ''}`}
                      ltr
                    />
                    {product.barcode ? (
                      <DetailRow
                        label={t('warehouse.barcode', 'بارکد')}
                        value={product.barcode}
                        ltr
                      />
                    ) : null}
                    <div
                      data-field="stock-position"
                      className="flex items-start justify-between gap-3 py-2"
                    >
                      <dt className="shrink-0 text-xs text-[hsl(var(--fg-secondary))]">
                        {t('warehouse.stockPosition', 'موقعیت در انبار')}
                      </dt>
                      <dd className="min-w-0 text-end text-xs font-semibold text-[hsl(var(--fg-primary))]">
                        {stockPosition ?? '—'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </aside>

            {/* ── Tabbed workspace ── */}
            <section className="min-w-0">
              <Tabs
                value={currentTab}
                onValueChange={(value) => setActiveTab(value as TabKey)}
                dir={dir}
              >
                <TabsList
                  variant="underline"
                  aria-label={t('warehouse.productSections', 'بخش‌های کالا')}
                >
                  {tabItems.map((tab) => (
                    <TabsTrigger key={tab.id} value={tab.id} variant="underline">
                      <tab.icon className="size-4 shrink-0" aria-hidden="true" />
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {variants ? (
                  <TabsContent forceMount value="variants" className="mt-4 space-y-4">
                    {variants}
                  </TabsContent>
                ) : null}

                {kits ? (
                  <TabsContent forceMount value="kits" className="mt-4">
                    {kits}
                  </TabsContent>
                ) : null}

                <TabsContent forceMount value="notes" className="mt-4 space-y-4">
                  <div className="grid gap-4 xl:grid-cols-2">
                    {notes}
                    {expiry}
                  </div>
                  {waste}
                </TabsContent>

                {units ? (
                  <TabsContent forceMount value="units" className="mt-4">
                    {units}
                  </TabsContent>
                ) : null}

                <TabsContent forceMount value="history" className="mt-4 space-y-4">
                  {stockPanel}
                  {movements}
                </TabsContent>

                <TabsContent forceMount value="more" className="mt-4 space-y-4">
                  {/* The four panels as square buttons that open over the page. */}
                  <div
                    className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"
                    data-product-tiles
                  >
                    {tiles.map((tile) => (
                      <button
                        key={tile.id}
                        type="button"
                        data-section-tile={tile.id}
                        onClick={() => setOpenSection(tile.id)}
                        className={cn(
                          interactiveCard,
                          'flex aspect-square flex-col items-center justify-center gap-2 p-3 text-center',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary)/0.5)]',
                          'motion-reduce:transition-none',
                        )}
                      >
                        <tile.icon
                          className="size-6 text-[hsl(var(--color-primary))]"
                          aria-hidden="true"
                        />
                        <span className="text-sm font-medium text-[hsl(var(--fg-primary))]">
                          {tile.label}
                        </span>
                      </button>
                    ))}
                  </div>
                  {specialties ? <div className="space-y-4">{specialties}</div> : null}
                </TabsContent>
              </Tabs>
            </section>
          </div>
        </>
      )}

      {/* The panel opens OVER the page: the page keeps its place and the panel
          keeps its own header; the dialog title is for screen readers. */}
      <Dialog
        open={openSection !== null}
        onOpenChange={(open) => {
          if (!open) setOpenSection(null)
        }}
      >
        <DialogContent className="max-w-2xl" data-section-modal={openSection ?? ''}>
          <DialogTitle className="sr-only">{openTile?.label ?? ''}</DialogTitle>
          {openSection === 'manufacturing' ? <>{manufacturing}</> : null}
          {openSection === 'customFields' ? <>{customFields}</> : null}
          {openSection === 'images' ? <>{images}</> : null}
          {openSection === 'barcodes' ? <>{barcodes}</> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
