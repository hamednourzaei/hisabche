// packages/ui/src/components/ui/quick-invoice/quick-invoice-page.tsx
'use client'

import { SelectField } from '../select-field'
import { cn } from '../../../lib/utils'
import {
  ArrowRight,
  Check,
  User,
  DollarSign,
  Package,
  CreditCard,
  Plus,
  Minus,
  Trash2,
  Eye,
  Pencil,
  ShoppingCart,
  Tag,
} from 'lucide-react'
import { ProductPicker } from '../product-picker'
import { CustomerPicker } from '../customer-picker'
import { MoneyInput } from '../money-input'
import { Switch } from '../switch'
import { memo, useMemo, useState, type ReactNode } from 'react'
import {
  InvoiceDocument,
  type InvoiceDocumentData,
  type InvoiceDocumentDisplaySettings,
} from '../invoice-detail/invoice-document'
import { InvoiceSidebar } from '../invoice-detail/invoice-sidebar'
import { useWorkspaces } from '@hisabche/api'

/* ═══════════════════════════════════════════════════════════════════════════
   QuickInvoicePage v4 — Memoized · Performance Optimized
   ✅ memo · useMemo · Row جدا شده
   ═══════════════════════════════════════════════════════════════════════════ */

interface ProductOption {
  id: string
  name: string
  sellPrice: number
  unit: string
}

interface CustomerOption {
  id: string
  name: string
  phone: string
}

/**
 * Mirrors `unitSchema` in @hisabche/validation. Kept as a literal union here
 * because packages/ui does not depend on the validation package; the contract
 * test in that package is the guard against the two drifting apart.
 */
export type InvoiceUnit =
  | 'piece'
  | 'gram'
  | 'kg'
  | 'meter'
  | 'liter'
  | 'box'
  | 'pack'
  | 'carton'
  /** User-defined — the typed label lives in `unitLabel`. */
  | 'custom'

/**
 * A component of a line item — "گردنبند" made of زنجیر / سنگ / اجرت.
 * Never an independent invoice line: it belongs to one parent and dies with it.
 */
export interface InvoiceLineDetail {
  key: string
  title: string
  quantity: string
  amount: string
}

export interface InvoiceLineItem {
  key: string
  product: ProductOption
  quantity: string
  price: string
  unit?: InvoiceUnit
  /** Free text, only when `unit === "custom"`. */
  unitLabel?: string
  /**
   * Weight, deliberately NOT the same field as `quantity`.
   * "1 necklace weighing 12.5 g" is quantity=1, weightGrams=12.5.
   */
  weightGrams?: string
  /** Optional. An empty array is a completely valid, and the default, state. */
  details?: InvoiceLineDetail[]
}

/** Sum of a line's detail components. */
export function detailsSum(details: readonly InvoiceLineDetail[] | undefined): number {
  if (!details?.length) return 0
  return details.reduce(
    (sum, d) => sum + (parseFloat(d.quantity) || 0) * (parseFloat(d.amount) || 0),
    0,
  )
}

/**
 * The one money rule for a line. Mirrors `computeItemTotal` in
 * @hisabche/validation.
 *
 * Components ADD to the line: "قند ۲٬۰۰۰ + سنگ امیتیس ۱٬۰۰۰" totals 3,000.
 * An item with no components is unchanged — base + 0.
 */
export function lineTotalOf(item: InvoiceLineItem): number {
  const base = (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 0)
  return base + detailsSum(item.details)
}

/** The two transaction types. Not two systems — one engine, two semantics. */
export type TransactionType = 'sale' | 'purchase'

type Step = 'product' | 'customer' | 'price' | 'preview' | 'done'
type PaymentType = 'cash' | 'credit'

const STEPS: Step[] = ['product', 'customer', 'price', 'preview', 'done'] as const

export interface QuickInvoicePageProps {
  t: (key: string, fallback?: string) => string
  /**
   * Drawn above the item step — the camera scan button on a phone host; empty
   * elsewhere. A slot, so this view stays unaware of which host it is on.
   */
  scanSlot?: ReactNode | undefined
  elapsedFormatted: string
  showSaved: boolean
  showCelebration: boolean
  step: Step
  items: InvoiceLineItem[]
  selectedCustomer: CustomerOption | null
  paymentType: PaymentType
  paidNow: string
  subtotal: number
  discountValue: string
  discountType: 'fixed' | 'percentage'
  total: number
  productName: string
  paidAmount: number
  isPaid: boolean
  createdInvoiceId: string | null
  isPending: boolean
  /** sale | purchase — drives copy, party terminology and the saved type. */
  transactionType: TransactionType
  onTransactionTypeChange: (t: TransactionType) => void
  onAddItem: (p: ProductOption) => void
  onAddCustomItem: (name: string) => void
  onRemoveItem: (key: string) => void
  onUpdateItemQuantity: (key: string, quantity: string) => void
  onUpdateItemPrice: (key: string, price: string) => void
  onUpdateItemUnit: (key: string, unit: InvoiceUnit) => void
  onUpdateItemUnitLabel: (key: string, label: string) => void
  onUpdateItemWeight: (key: string, grams: string) => void
  onAddDetail: (key: string) => void
  onUpdateDetail: (
    key: string,
    detailKey: string,
    patch: Partial<Omit<InvoiceLineDetail, 'key'>>,
  ) => void
  onRemoveDetail: (key: string, detailKey: string) => void
  onSelectCustomer: (c: CustomerOption | null) => void
  onPaymentTypeChange: (t: PaymentType) => void
  onPaidNowChange: (v: string) => void
  onDiscountValueChange: (v: string) => void
  onDiscountTypeChange: (t: 'fixed' | 'percentage') => void
  onIsPaidChange: (v: boolean) => void
  onSetStep: (s: Step) => void
  onConfirmCreate: () => void
  onDismissCelebration: () => void
  onViewInvoice: () => void
  onViewAllInvoices: () => void
}

// ─── Row ────────────────────────────────────────────────────────────────────

const Row = memo(function Row({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="mb-2 last:mb-0 flex justify-between">
      <span className="text-sm text-[hsl(var(--fg-secondary))]">{label}</span>
      <span className={cn('font-medium text-[hsl(var(--fg-primary))]', valueClass)}>{value}</span>
    </div>
  )
})
Row.displayName = 'Row'

// ─── Step: Items (multi-product) ───────────────────────────────────────────

const UNIT_OPTIONS: readonly InvoiceUnit[] = [
  'piece',
  'gram',
  'kg',
  'carton',
  'box',
  'pack',
  'meter',
  'liter',
  // Last on purpose: the escape hatch belongs after the known units.
  'custom',
]

/** Persian fallbacks used when a locale file has no `unit.*` key yet. */
const UNIT_FALLBACK: Record<InvoiceUnit, string> = {
  piece: 'عدد',
  gram: 'گرم',
  kg: 'کیلوگرم',
  carton: 'کارتن',
  box: 'جعبه',
  pack: 'بسته',
  meter: 'متر',
  liter: 'لیتر',
  custom: 'دلخواه',
}

/** One component row inside an item card. Stacks on small screens. */
const DetailRow = memo(function DetailRow({
  itemKey,
  detail,
  onUpdate,
  onRemove,
  t,
}: {
  itemKey: string
  detail: InvoiceLineDetail
  onUpdate: (key: string, detailKey: string, patch: Partial<Omit<InvoiceLineDetail, 'key'>>) => void
  onRemove: (key: string, detailKey: string) => void
  t: (key: string, fallback?: string) => string
}) {
  const inputClass =
    'rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-2 py-1.5 text-sm text-[hsl(var(--fg-primary))] focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]'

  return (
    <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
      <input
        type="text"
        value={detail.title}
        onChange={(e) => onUpdate(itemKey, detail.key, { title: e.target.value })}
        placeholder={t('quickInvoice.detailTitle', 'عنوان')}
        aria-label={t('quickInvoice.detailTitle', 'عنوان')}
        className={cn(inputClass, 'min-w-0 flex-1 basis-full sm:basis-auto')}
      />
      <input
        type="number"
        min={0}
        step="any"
        value={detail.quantity}
        onChange={(e) => onUpdate(itemKey, detail.key, { quantity: e.target.value })}
        aria-label={t('quickInvoice.quantity', 'تعداد')}
        className={cn(inputClass, 'w-16 text-center')}
      />
      <MoneyInput
        value={detail.amount}
        onChange={(raw) => onUpdate(itemKey, detail.key, { amount: raw })}
        placeholder={t('quickInvoice.amount', 'مبلغ')}
        aria-label={t('quickInvoice.amount', 'مبلغ')}
        className={cn(inputClass, 'h-auto min-w-0 flex-1')}
      />
      <button
        type="button"
        onClick={() => onRemove(itemKey, detail.key)}
        className="shrink-0 rounded-full p-1.5 text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--color-destructive)/0.1)] hover:text-[hsl(var(--color-destructive))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]"
        aria-label={`${t('quickInvoice.removeDetail', 'حذف جزئیات')}: ${detail.title || ''}`}
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  )
})
DetailRow.displayName = 'DetailRow'

const ItemRow = memo(function ItemRow({
  item,
  onRemove,
  onUpdateQuantity,
  onUpdatePrice,
  onUpdateUnit,
  onUpdateUnitLabel,
  onUpdateWeight,
  onAddDetail,
  onUpdateDetail,
  onRemoveDetail,
  t,
}: {
  item: InvoiceLineItem
  onRemove: (key: string) => void
  onUpdateQuantity: (key: string, quantity: string) => void
  onUpdatePrice: (key: string, price: string) => void
  onUpdateUnit: (key: string, unit: InvoiceUnit) => void
  onUpdateUnitLabel: (key: string, label: string) => void
  onUpdateWeight: (key: string, grams: string) => void
  onAddDetail: (key: string) => void
  onUpdateDetail: (
    key: string,
    detailKey: string,
    patch: Partial<Omit<InvoiceLineDetail, 'key'>>,
  ) => void
  onRemoveDetail: (key: string, detailKey: string) => void
  t: (key: string, fallback?: string) => string
}) {
  const details = item.details ?? []
  const [expanded, setExpanded] = useState(details.length > 0)
  const lineTotal = lineTotalOf(item)
  const componentsSum = detailsSum(details)

  const handleToggle = () => {
    // Opening an empty item seeds the first row, so `+` is one tap not two.
    if (!expanded && details.length === 0) onAddDetail(item.key)
    setExpanded((prev) => !prev)
  }

  return (
    <div className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium text-sm text-[hsl(var(--fg-primary))]">
          {item.product.name}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleToggle}
            aria-expanded={expanded}
            aria-label={
              expanded
                ? `${t('quickInvoice.hideDetails', 'بستن جزئیات')}: ${item.product.name}`
                : `${t('quickInvoice.addDetails', 'افزودن جزئیات')}: ${item.product.name}`
            }
            className="rounded-full p-1.5 text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--color-primary)/0.1)] hover:text-[hsl(var(--color-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]"
          >
            {expanded ? (
              <Minus className="size-4" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onRemove(item.key)}
            className="rounded-full p-1.5 text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--color-destructive)/0.1)] hover:text-[hsl(var(--color-destructive))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]"
            aria-label={t('action.delete', 'حذف')}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      {/* ✅ قبلاً هیچ برچسب یا placeholder ای روی این ردیف نبود؛ کاربر
          نمی‌فهمید کدام فیلد «مبلغ» است و فکر می‌کرد جنس دلخواه قیمت ندارد. */}
      <div className="flex items-center gap-2 px-0.5 text-[10px] text-[hsl(var(--fg-tertiary))]">
        <span className="w-16 text-center">{t('quickInvoice.quantity', 'تعداد')}</span>
        <span className="w-3" aria-hidden="true" />
        <span className="flex-1">{t('quickInvoice.unitPrice', 'مبلغ واحد')}</span>
        <span className="shrink-0">{t('quickInvoice.lineTotal', 'جمع')}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          aria-label={t('quickInvoice.quantity', 'تعداد')}
          value={item.quantity}
          onChange={(e) => onUpdateQuantity(item.key, e.target.value)}
          className="w-16 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-2 py-1.5 text-sm text-center text-[hsl(var(--fg-primary))] focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]"
        />
        <span className="text-xs text-[hsl(var(--fg-tertiary))]">×</span>
        <MoneyInput
          value={item.price}
          onChange={(raw) => onUpdatePrice(item.key, raw)}
          placeholder={t('quickInvoice.unitPricePlaceholder', 'مبلغ را وارد کنید')}
          aria-label={t('quickInvoice.unitPrice', 'مبلغ واحد')}
          className="flex-1 h-auto rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-2 py-1.5 text-sm text-[hsl(var(--fg-primary))] focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]"
        />
        <span className="shrink-0 text-sm font-bold tabular-nums text-[hsl(var(--color-primary))]">
          {lineTotal.toLocaleString()}
        </span>
      </div>

      {/* واحد — از رجیستری مشترک، نه لیست محلی */}
      <div className="flex items-center gap-2">
        <label htmlFor={`unit-${item.key}`} className="text-[10px] text-[hsl(var(--fg-tertiary))]">
          {t('quickInvoice.unit', 'واحد')}
        </label>
        <SelectField
          value={item.unit ?? 'piece'}
          onChange={(value) => onUpdateUnit(item.key, value as InvoiceUnit)}
          options={[
            ...UNIT_OPTIONS.map((unit) => ({
              value: unit,
              label: t(`unit.${unit}`, UNIT_FALLBACK[unit]),
            })),
          ]}
          className={
            'rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-2 py-1 text-xs text-[hsl(var(--fg-primary))] focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]'
          }
          id={`unit-${item.key}`}
        />

        {/* وزن — مستقل از تعداد. «۱ گردنبند ۱۲٫۵ گرمی» یعنی تعداد=۱، وزن=۱۲٫۵ */}
        <label
          htmlFor={`weight-${item.key}`}
          className="text-[10px] text-[hsl(var(--fg-tertiary))]"
        >
          {t('quickInvoice.weightGrams', 'وزن (گرم)')}
        </label>
        <input
          id={`weight-${item.key}`}
          type="number"
          min={0}
          step="any"
          value={item.weightGrams ?? ''}
          onChange={(e) => onUpdateWeight(item.key, e.target.value)}
          placeholder="—"
          className="w-20 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-2 py-1 text-xs text-[hsl(var(--fg-primary))] focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]"
        />

        {/* واحد دلخواه — کاربر هر چیزی می‌تواند بنویسد: مثقال، دانه، بسته... */}
        {item.unit === 'custom' && (
          <input
            type="text"
            value={item.unitLabel ?? ''}
            onChange={(e) => onUpdateUnitLabel(item.key, e.target.value)}
            placeholder={t('quickInvoice.customUnitPlaceholder', 'مثلاً: مثقال')}
            aria-label={t('quickInvoice.customUnit', 'واحد دلخواه')}
            maxLength={24}
            className="w-28 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-2 py-1 text-xs text-[hsl(var(--fg-primary))] focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]"
          />
        )}
      </div>

      {expanded && (
        <div className="space-y-2 rounded-lg border border-dashed border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-[hsl(var(--fg-secondary))]">
              {t('quickInvoice.details', 'جزئیات')}
            </span>
            <span className="text-[11px] tabular-nums text-[hsl(var(--fg-tertiary))]">
              {t('quickInvoice.componentsSum', 'جمع اجزا')}: {componentsSum.toLocaleString()}
            </span>
          </div>

          {details.map((detail) => (
            <DetailRow
              key={detail.key}
              itemKey={item.key}
              detail={detail}
              onUpdate={onUpdateDetail}
              onRemove={onRemoveDetail}
              t={t}
            />
          ))}

          {/* بدون هیچ سقفی — کاربر هرچقدر بخواهد جزء اضافه می‌کند */}
          <button
            type="button"
            onClick={() => onAddDetail(item.key)}
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-[hsl(var(--border-default))] py-1.5 text-xs text-[hsl(var(--fg-secondary))] hover:border-[hsl(var(--color-primary)/0.5)] hover:text-[hsl(var(--color-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {t('quickInvoice.addDetail', 'افزودن جزئیات')}
          </button>
        </div>
      )}
    </div>
  )
})
ItemRow.displayName = 'ItemRow'

/**
 * Sale / Purchase switch. It is the ONLY thing that differs between the two
 * flows — same form, same item editor, same engine, different semantics.
 */
const TransactionTypeSwitch = memo(function TransactionTypeSwitch({
  value,
  onChange,
  t,
}: {
  value: TransactionType
  onChange: (t: TransactionType) => void
  t: (key: string, fallback?: string) => string
}) {
  const options: { type: TransactionType; label: string; Icon: typeof Tag }[] = [
    { type: 'sale', label: t('quickInvoice.sale', 'فروش'), Icon: Tag },
    { type: 'purchase', label: t('quickInvoice.purchase', 'خرید'), Icon: ShoppingCart },
  ]

  return (
    <div
      role="radiogroup"
      aria-label={t('quickInvoice.transactionType', 'نوع تراکنش')}
      className="flex gap-1 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] p-1"
    >
      {options.map(({ type, label, Icon }) => {
        const active = value === type
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(type)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]',
              active
                ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))]'
                : 'text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))]',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </button>
        )
      })}
    </div>
  )
})
TransactionTypeSwitch.displayName = 'TransactionTypeSwitch'

const ItemsStep = memo(function ItemsStep({
  items,
  transactionType,
  onTransactionTypeChange,
  onAddItem,
  onAddCustomItem,
  onRemoveItem,
  onUpdateItemQuantity,
  onUpdateItemPrice,
  onUpdateItemUnit,
  onUpdateItemUnitLabel,
  onUpdateItemWeight,
  onAddDetail,
  onUpdateDetail,
  onRemoveDetail,
  onNext,
  t,
}: {
  items: InvoiceLineItem[]
  transactionType: TransactionType
  onTransactionTypeChange: (t: TransactionType) => void
  onAddItem: (p: ProductOption) => void
  onAddCustomItem: (name: string) => void
  onRemoveItem: (key: string) => void
  onUpdateItemQuantity: (key: string, quantity: string) => void
  onUpdateItemPrice: (key: string, price: string) => void
  onUpdateItemUnit: (key: string, unit: InvoiceUnit) => void
  onUpdateItemUnitLabel: (key: string, label: string) => void
  onUpdateItemWeight: (key: string, grams: string) => void
  onAddDetail: (key: string) => void
  onUpdateDetail: (
    key: string,
    detailKey: string,
    patch: Partial<Omit<InvoiceLineDetail, 'key'>>,
  ) => void
  onRemoveDetail: (key: string, detailKey: string) => void
  onNext: () => void
  t: (key: string, fallback?: string) => string
}) {
  const [showCustom, setShowCustom] = useState(false)
  const [customName, setCustomName] = useState('')

  const handleAddCustom = () => {
    if (!customName.trim()) return
    onAddCustomItem(customName)
    setCustomName('')
    setShowCustom(false)
  }

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-elevated))]">
      <div className="p-6 space-y-6">
        <TransactionTypeSwitch value={transactionType} onChange={onTransactionTypeChange} t={t} />

        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--color-primary)/0.1)]">
            <Package className="size-8 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
            {transactionType === 'purchase'
              ? t('quickInvoice.whatBought', 'چه چیزی خریدید؟')
              : t('quickInvoice.whatSold', 'چه چیزی فروختید؟')}
          </h1>
          <p className="mt-2 text-sm text-[hsl(var(--fg-secondary))]">
            {t('quickInvoice.whatSoldDesc', 'یک یا چند جنس را انتخاب کنید')}
          </p>
        </div>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((item) => (
              <ItemRow
                key={item.key}
                item={item}
                onRemove={onRemoveItem}
                onUpdateQuantity={onUpdateItemQuantity}
                onUpdatePrice={onUpdateItemPrice}
                onUpdateUnit={onUpdateItemUnit}
                onUpdateUnitLabel={onUpdateItemUnitLabel}
                onUpdateWeight={onUpdateItemWeight}
                onAddDetail={onAddDetail}
                onUpdateDetail={onUpdateDetail}
                onRemoveDetail={onRemoveDetail}
                t={t}
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Plus className="size-4 shrink-0 text-[hsl(var(--fg-tertiary))]" aria-hidden="true" />
          <ProductPicker
            value={null}
            onChange={(p) => p && onAddItem(p)}
            placeholder={t('warehouse.pickProduct', 'افزودن جنس از گدام...')}
          />
        </div>

        {/* ✅ آیتم با نام دلخواه — برای خدماتی که در انبار محصول ندارند (مثلاً ترجمه، کرایه) */}
        {showCustom ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
              placeholder={t('quickInvoice.customItemName', 'نام دلخواه (مثلاً: کرایه تاکسی)')}
              className="flex-1 rounded-lg px-3 py-2 text-sm border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))] focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]"
            />
            <button
              type="button"
              onClick={handleAddCustom}
              disabled={!customName.trim()}
              className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-white bg-[image:var(--gradient-brand)] disabled:opacity-40"
            >
              {t('action.add', 'افزودن')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowCustom(true)}
            className="text-sm text-[hsl(var(--color-primary))] hover:underline"
          >
            + {t('quickInvoice.addCustomItem', 'با نام دلخواه پر کن')}
          </button>
        )}

        <button
          type="button"
          disabled={items.length === 0}
          onClick={onNext}
          className={cn(
            'w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3',
            'text-sm font-bold text-white',
            'bg-[hsl(var(--color-primary))]',
            'shadow-sm shadow-[hsl(var(--color-primary)/0.15)]',
            'transition-all duration-200 hover:brightness-110 active:scale-[0.98]',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'motion-reduce:transition-none',
          )}
        >
          <ArrowRight className="size-4" aria-hidden="true" />
          {t('action.next', 'ادامه')}
        </button>
      </div>
    </div>
  )
})
ItemsStep.displayName = 'ItemsStep'

// ─── Step: Customer ────────────────────────────────────────────────────────

const CustomerStep = memo(function CustomerStep({
  selectedCustomer,
  transactionType,
  onSelectCustomer,
  onBack,
  onNext,
  t,
}: {
  selectedCustomer: CustomerOption | null
  transactionType: TransactionType
  onSelectCustomer: (c: CustomerOption | null) => void
  onBack: () => void
  onNext: () => void
  t: (key: string, fallback?: string) => string
}) {
  // یک مدل طرف‌حساب، دو برچسب. در خرید طرف مقابل فروشنده است نه مشتری.
  const isPurchase = transactionType === 'purchase'
  return (
    <div className="rounded-2xl border border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-elevated))]">
      <div className="p-6 space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--surface-muted))]">
            <User className="size-8 text-[hsl(var(--fg-secondary))]" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
            {isPurchase ? t('quickInvoice.supplier', 'فروشنده') : t('invoices.customer', 'مشتری')}
          </h1>
          <p className="mt-2 text-sm text-[hsl(var(--fg-secondary))]">
            {isPurchase
              ? t('quickInvoice.toWhomBought', 'از چه کسی خریدید؟ (اختیاری)')
              : t('quickInvoice.toWhom', 'نام مشتری را انتخاب کنید (اختیاری)')}
          </p>
        </div>

        <CustomerPicker
          value={selectedCustomer}
          onChange={onSelectCustomer}
          placeholder={
            isPurchase
              ? t('customer.pickSupplierPlaceholder', 'انتخاب فروشنده...')
              : t('customer.pickPlaceholder', 'انتخاب مشتری...')
          }
        />

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className={cn(
              'w-full rounded-full px-4 py-2.5 text-sm font-medium',
              'border border-[hsl(var(--border-default))]',
              'text-[hsl(var(--fg-secondary))]',
              'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
              'transition-colors duration-150',
              'motion-reduce:transition-none',
            )}
          >
            {t('action.back', 'برگشت')}
          </button>
          <button
            type="button"
            onClick={onNext}
            className={cn(
              'w-full rounded-full px-4 py-2.5 text-sm font-bold text-white',
              'bg-[hsl(var(--color-primary))]',
              'transition-all duration-200 hover:brightness-110 active:scale-[0.98]',
              'motion-reduce:transition-none',
            )}
          >
            {t('action.next', 'ادامه')}
          </button>
        </div>
      </div>
    </div>
  )
})
CustomerStep.displayName = 'CustomerStep'

// ─── Step: Payment ──────────────────────────────────────────────────────────

const PriceStep = memo(function PriceStep({
  t,
  items,
  selectedCustomer,
  paymentType,
  paidNow,
  subtotal,
  discountValue,
  discountType,
  total,
  isPaid,
  isPending,
  onPaymentTypeChange,
  onPaidNowChange,
  onDiscountValueChange,
  onDiscountTypeChange,
  onIsPaidChange,
  onBack,
  onNext,
}: {
  t: (key: string, fallback?: string) => string
  items: InvoiceLineItem[]
  selectedCustomer: CustomerOption | null
  paymentType: PaymentType
  paidNow: string
  subtotal: number
  discountValue: string
  discountType: 'fixed' | 'percentage'
  total: number
  isPaid: boolean
  isPending: boolean
  onPaymentTypeChange: (t: PaymentType) => void
  onPaidNowChange: (v: string) => void
  onDiscountValueChange: (v: string) => void
  onDiscountTypeChange: (t: 'fixed' | 'percentage') => void
  onIsPaidChange: (v: boolean) => void
  onBack: () => void
  onNext: () => void
}) {
  const hasItems = items.length > 0

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-elevated))]">
      <div className="p-6 space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--color-success)/0.1)]">
            <DollarSign className="size-8 text-[hsl(var(--color-success))]" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
            {t('invoices.total', 'مبلغ فاکتور')}
          </h1>
          <p className="mt-2 text-sm text-[hsl(var(--fg-secondary))]">
            {t('quickInvoice.howToPay', 'نوع پرداخت را انتخاب کنید')}
          </p>
        </div>

        <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-4 text-start space-y-2">
          {items.map((item) => (
            <div key={item.key} className="flex items-center justify-between text-sm">
              <span className="text-[hsl(var(--fg-secondary))]">
                {item.product.name} × {item.quantity}
              </span>
              <span className="font-medium text-[hsl(var(--fg-primary))]">
                {((parseFloat(item.price) || 0) * (parseInt(item.quantity) || 0)).toLocaleString()}
              </span>
            </div>
          ))}
          {selectedCustomer && (
            <div className="flex items-center justify-between border-t border-[hsl(var(--border-default))] pt-2">
              <span className="text-sm text-[hsl(var(--fg-secondary))]">
                {t('invoices.customer', 'مشتری')}
              </span>
              <span className="font-medium text-[hsl(var(--fg-primary))]">
                {selectedCustomer.name}
              </span>
            </div>
          )}
        </div>

        {/* ✅ تخفیف (عدد ثابت یا درصد) — قبل از پیش‌نمایش اعمال می‌شود */}
        <div className="flex items-center gap-2">
          <MoneyInput
            value={discountValue}
            onChange={onDiscountValueChange}
            placeholder={t('quickInvoice.discount', 'تخفیف (اختیاری)')}
            className="flex-1 h-auto rounded-xl px-3 py-2.5 text-sm border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))] focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]"
          />
          <div className="flex shrink-0 rounded-xl border border-[hsl(var(--border-default))] overflow-hidden">
            {(['fixed', 'percentage'] as const).map((dt) => (
              <button
                key={dt}
                type="button"
                onClick={() => onDiscountTypeChange(dt)}
                className={cn(
                  'px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                  discountType === dt
                    ? 'bg-[hsl(var(--color-primary))] text-white'
                    : 'text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]',
                )}
              >
                {dt === 'fixed' ? 'AFN' : '%'}
              </button>
            ))}
          </div>
        </div>
        {parseFloat(discountValue) > 0 && (
          <div className="flex items-center justify-between text-xs text-[hsl(var(--fg-tertiary))] -mt-3">
            <span>{t('quickInvoice.subtotal', 'جمع قبل از تخفیف')}</span>
            <span className="tabular-nums">{subtotal.toLocaleString()} AFN</span>
          </div>
        )}

        <div className="flex gap-2">
          {(['cash', 'credit'] as PaymentType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onPaymentTypeChange(type)}
              className={cn(
                'flex-1 rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-200 motion-reduce:transition-none',
                paymentType === type
                  ? 'bg-[hsl(var(--color-primary))] text-white shadow-sm'
                  : 'border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]',
              )}
            >
              {type === 'cash' ? '💵 ' : '📝 '}
              {type === 'cash' ? t('invoices.cash', 'نقد') : t('invoices.credit', 'نسیه')}
            </button>
          ))}
        </div>

        {/* ✅ سویچ صریح «تسویه شده / تسویه‌نشده» — مستقل از نوع پرداخت */}
        <label className="flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-3 cursor-pointer">
          <span className="text-sm font-medium text-[hsl(var(--fg-primary))]">
            {t('quickInvoice.isPaid', 'این فاکتور تسویه شده است')}
          </span>
          <Switch checked={isPaid} onCheckedChange={onIsPaidChange} />
        </label>

        {paymentType === 'credit' && !isPaid && (
          <div className="relative">
            <CreditCard
              className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))] pointer-events-none"
              aria-hidden="true"
            />
            <MoneyInput
              value={paidNow}
              onChange={(raw) => onPaidNowChange(raw)}
              placeholder={`${t('payment.record', 'پیش‌پرداخت')} (کل: ${total.toLocaleString()} AFN)`}
              className={cn(
                'w-full h-auto rounded-xl ps-9 pe-3 py-3 text-sm',
                'border border-[hsl(var(--border-default))]',
                'bg-[hsl(var(--surface-base))]',
                'text-[hsl(var(--fg-primary))]',
                'placeholder:text-[hsl(var(--fg-tertiary))]',
                'focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)]',
              )}
            />
          </div>
        )}

        {hasItems && (
          <div className="rounded-2xl bg-[hsl(var(--color-primary)/0.05)] p-5 text-center border border-[hsl(var(--border-default))]">
            <p className="mb-2 text-sm text-[hsl(var(--fg-secondary))]">
              {t('common.total', 'مبلغ کل')}
            </p>
            <p className="text-4xl font-bold tabular-nums text-[hsl(var(--color-primary))]">
              {total.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-[hsl(var(--fg-secondary))]">
              {isPaid
                ? t('invoices.paid', 'پرداخت کامل')
                : paidNow
                  ? `${t('payment.record', 'پیش‌پرداخت')}: ${parseFloat(paidNow).toLocaleString()} AFN — ${t('invoices.remaining', 'باقی‌مانده')}: ${(total - parseFloat(paidNow || '0')).toLocaleString()} AFN`
                  : t('invoices.credit', 'نسیه کامل')}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className={cn(
              'w-full rounded-full px-4 py-2.5 text-sm font-medium',
              'border border-[hsl(var(--border-default))]',
              'text-[hsl(var(--fg-secondary))]',
              'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
              'transition-colors duration-150',
              'motion-reduce:transition-none',
            )}
          >
            {t('action.back', 'برگشت')}
          </button>
          <button
            type="button"
            disabled={!hasItems || isPending}
            onClick={onNext}
            className={cn(
              'w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3',
              'text-sm font-bold text-white',
              'bg-[hsl(var(--color-primary))]',
              'shadow-sm shadow-[hsl(var(--color-primary)/0.15)]',
              'transition-all duration-200 hover:brightness-110 active:scale-[0.98]',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              'motion-reduce:transition-none',
            )}
          >
            <Eye className="size-4" aria-hidden="true" />
            {t('action.previewInvoice', 'پیش‌نمایش فاکتور')}
          </button>
        </div>
      </div>
    </div>
  )
})
PriceStep.displayName = 'PriceStep'

// ─── Step: Preview / Confirm ────────────────────────────────────────────────

const DEFAULT_PREVIEW_DISPLAY: InvoiceDocumentDisplaySettings = {
  showSignature: true,
  showNotes: true,
  showBarcode: true,
}

const PreviewStep = memo(function PreviewStep({
  t,
  items,
  selectedCustomer,
  transactionType,
  total,
  paidAmount,
  isPending,
  onBack,
  onConfirm,
}: {
  t: (key: string, fallback?: string) => string
  items: InvoiceLineItem[]
  selectedCustomer: CustomerOption | null
  transactionType: TransactionType
  total: number
  paidAmount: number
  isPending: boolean
  onBack: () => void
  onConfirm: () => void
}) {
  const [display, setDisplay] = useState<InvoiceDocumentDisplaySettings>(DEFAULT_PREVIEW_DISPLAY)

  // ✅ فرض تک-workspace: اولین workspace کاربر — برای نمایش لوگو/مهر کسب‌وکار روی پیش‌نمایش فاکتور
  const { data: workspaces } = useWorkspaces()
  const currentWorkspace = Array.isArray(workspaces)
    ? (workspaces[0] as
        { name?: string; logo_url?: string | null; stamp_url?: string | null } | undefined)
    : undefined

  const documentData: InvoiceDocumentData = useMemo(
    () => ({
      // ⚠️ فاکتور هنوز ثبت نشده — شماره فاکتور و تاریخ ثبت وجود ندارند
      // و عمداً fabricate نمی‌شوند؛ کامپوننت سند به‌جای آن «—» نشان می‌دهد.
      invoiceNumber: undefined,
      // پیش‌نمایش باید همان سندی را نشان دهد که ذخیره می‌شود — از جمله
      // اینکه فاکتور فروش است یا خرید.
      type: transactionType,
      date: new Date().toISOString(),
      business: {
        name: currentWorkspace?.name || t('app.name', 'Hisabche'),
        logoUrl: currentWorkspace?.logo_url ?? null,
        stampUrl: currentWorkspace?.stamp_url ?? null,
      },
      customer: selectedCustomer
        ? { name: selectedCustomer.name, phone: selectedCustomer.phone }
        : null,
      items: items.map((item) => ({
        id: item.key,
        productName: item.product.name,
        // parseFloat: یک خط گرمی می‌تواند ۱۲٫۵ باشد.
        quantity: parseFloat(item.quantity) || 0,
        unit: item.unit ?? item.product.unit,
        unitLabel: item.unitLabel ?? null,
        unitPrice: parseFloat(item.price) || 0,
        // همان قانون واحد پولی که هنگام ذخیره استفاده می‌شود، تا پیش‌نمایش
        // هرگز با مبلغ نهایی اختلاف نداشته باشد.
        totalPrice: lineTotalOf(item),
        details: (item.details ?? [])
          .filter((d) => d.title.trim())
          .map((d) => ({
            id: d.key,
            title: d.title,
            quantity: parseFloat(d.quantity) || 1,
            amount: parseFloat(d.amount) || 0,
          })),
      })),
      currency: 'AFN',
      subtotal: total,
      total,
      paidAmount,
    }),
    [items, selectedCustomer, total, paidAmount, t, currentWorkspace, transactionType],
  )

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <div className="text-center lg:text-start">
          <h1 className="text-xl font-bold text-[hsl(var(--fg-primary))]">
            {t('quickInvoice.previewTitle', 'پیش‌نمایش فاکتور')}
          </h1>
          <p className="mt-1 text-sm text-[hsl(var(--fg-secondary))]">
            {t('quickInvoice.previewDesc', 'قبل از ثبت نهایی، فاکتور را بررسی کنید')}
          </p>
        </div>
        <InvoiceDocument t={t} data={documentData} display={display} />
      </div>

      <div className="space-y-4">
        <InvoiceSidebar
          t={t}
          summary={{ total, paidAmount, currency: 'AFN' }}
          display={display}
          onDisplayChange={(key, value) => setDisplay((prev) => ({ ...prev, [key]: value }))}
        />

        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className={cn(
              'w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3',
              'text-sm font-bold text-white',
              'bg-[hsl(var(--color-primary))]',
              'shadow-sm shadow-[hsl(var(--color-primary)/0.15)]',
              'transition-all duration-200 hover:brightness-110 active:scale-[0.98]',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              'motion-reduce:transition-none',
            )}
          >
            <Check className="size-4" aria-hidden="true" />
            {t('action.confirmCreate', 'تأیید و ساخت فاکتور')}
          </button>
          <button
            type="button"
            onClick={onBack}
            disabled={isPending}
            className={cn(
              'w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium',
              'border border-[hsl(var(--border-default))]',
              'text-[hsl(var(--fg-secondary))]',
              'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
              'transition-colors duration-150',
              'motion-reduce:transition-none',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            <Pencil className="size-4" aria-hidden="true" />
            {t('action.backToEdit', 'بازگشت و ویرایش')}
          </button>
        </div>
      </div>
    </div>
  )
})
PreviewStep.displayName = 'PreviewStep'

// ─── Step: Done ────────────────────────────────────────────────────────────

const DoneStep = memo(function DoneStep({
  t,
  productName,
  paymentType,
  total,
  paidAmount,
  elapsedFormatted,
  createdInvoiceId,
  onViewInvoice,
  onViewAllInvoices,
}: {
  t: (key: string, fallback?: string) => string
  productName: string
  paymentType: PaymentType
  total: number
  paidAmount: number
  elapsedFormatted: string
  createdInvoiceId: string | null
  onViewInvoice: () => void
  onViewAllInvoices: () => void
}) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-elevated))]">
      <div className="p-8 space-y-8 text-center">
        <div>
          <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-[hsl(var(--color-success)/0.1)]">
            <Check className="size-12 text-[hsl(var(--color-success))]" aria-hidden="true" />
          </div>
          <h1 className="mb-3 text-3xl font-bold text-[hsl(var(--fg-primary))]">
            {t('invoices.created', 'فاکتور ثبت شد')} 🎉
          </h1>
          <p className="text-[hsl(var(--fg-secondary))]">
            {t('dashboard.ready', 'فاکتور شما در')} <strong>{elapsedFormatted}</strong>{' '}
            {t('dashboard.ready', 'ثبت شد.')}
          </p>
        </div>

        <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-5 text-start">
          <Row label={t('invoices.items', 'اجناس')} value={productName} />
          <Row
            label={t('common.status', 'نوع')}
            value={
              paymentType === 'cash'
                ? `💵 ${t('invoices.cash', 'نقد')}`
                : `📝 ${t('invoices.credit', 'نسیه')}`
            }
          />
          <Row
            label={t('common.total', 'مبلغ کل')}
            value={`${total.toLocaleString()} AFN`}
            valueClass="font-bold tabular-nums text-[hsl(var(--color-primary))]"
          />
          {paymentType === 'credit' && (
            <>
              <Row
                label={t('invoices.paid', 'پرداخت شده')}
                value={`${paidAmount.toLocaleString()} AFN`}
                valueClass="font-bold tabular-nums text-[hsl(var(--color-success))]"
              />
              <Row
                label={t('invoices.remaining', 'باقی‌مانده')}
                value={`${(total - paidAmount).toLocaleString()} AFN`}
                valueClass="font-bold tabular-nums text-[hsl(var(--color-destructive))]"
              />
            </>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {createdInvoiceId && (
            <button
              type="button"
              onClick={onViewInvoice}
              className={cn(
                'w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3',
                'text-sm font-bold text-white',
                'bg-[hsl(var(--color-primary))]',
                'transition-all duration-200 hover:brightness-110 active:scale-[0.98]',
                'motion-reduce:transition-none',
              )}
            >
              <ArrowRight className="size-5" aria-hidden="true" />
              {t('action.view', 'مشاهده فاکتور')}
            </button>
          )}
          <button
            type="button"
            onClick={onViewAllInvoices}
            className={cn(
              'w-full rounded-full px-4 py-2.5 text-sm font-medium',
              'border border-[hsl(var(--border-default))]',
              'text-[hsl(var(--fg-secondary))]',
              'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
              'transition-colors duration-150',
              'motion-reduce:transition-none',
            )}
          >
            {t('action.back', 'بازگشت به فاکتورها')}
          </button>
        </div>
      </div>
    </div>
  )
})
DoneStep.displayName = 'DoneStep'

// ─── Celebration ───────────────────────────────────────────────────────────

const Celebration = memo(function Celebration({
  onDismiss,
  t,
}: {
  onDismiss: () => void
  t: (key: string, fallback?: string) => string
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-[hsl(var(--surface-base)/0.6)] backdrop-blur-md"
      onClick={onDismiss}
    >
      <div className="text-center">
        <div className="mb-4 animate-bounce text-6xl motion-reduce:animate-none">🧾</div>
        <div className="rounded-2xl px-8 py-6 border border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-elevated))] shadow-xl">
          <p className="text-xl font-bold text-[hsl(var(--fg-primary))]">
            🎉 {t('invoices.created', 'فاکتور با موفقیت ثبت شد')}
          </p>
          <p className="mt-2 text-sm text-[hsl(var(--fg-secondary))]">
            {t('invoices.clickToView', 'کلیک کنید تا فاکتور را ببینید')}
          </p>
        </div>
      </div>
    </div>
  )
})
Celebration.displayName = 'Celebration'

// ─── Main Component ─────────────────────────────────────────────────────────

export const QuickInvoicePage = memo(function QuickInvoicePage({
  t,
  scanSlot,
  elapsedFormatted,
  showSaved,
  showCelebration,
  step,
  items,
  selectedCustomer,
  paymentType,
  paidNow,
  subtotal,
  discountValue,
  discountType,
  total,
  productName,
  paidAmount,
  isPaid,
  createdInvoiceId,
  isPending,
  transactionType,
  onTransactionTypeChange,
  onAddItem,
  onAddCustomItem,
  onRemoveItem,
  onUpdateItemQuantity,
  onUpdateItemPrice,
  onUpdateItemUnit,
  onUpdateItemUnitLabel,
  onUpdateItemWeight,
  onAddDetail,
  onUpdateDetail,
  onRemoveDetail,
  onSelectCustomer,
  onPaymentTypeChange,
  onPaidNowChange,
  onDiscountValueChange,
  onDiscountTypeChange,
  onIsPaidChange,
  onSetStep,
  onConfirmCreate,
  onDismissCelebration,
  onViewInvoice,
  onViewAllInvoices,
}: QuickInvoicePageProps) {
  return (
    <div className="px-4 py-10">
      {/* Celebration Pop-up */}
      {showCelebration && <Celebration onDismiss={onDismissCelebration} t={t} />}

      <div className={cn('mx-auto', step === 'preview' ? 'max-w-5xl' : 'max-w-xl')}>
        {/* Timer + Step Indicators */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 animate-pulse rounded-full bg-[hsl(var(--color-success))]" />
            <span className="text-sm text-[hsl(var(--fg-secondary))]">{elapsedFormatted}</span>
          </div>
          <div className="flex gap-2">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={cn(
                  'h-2 w-14 rounded-full transition-all duration-300',
                  STEPS.indexOf(step) >= i
                    ? 'bg-[hsl(var(--color-primary))]'
                    : 'bg-[hsl(var(--surface-muted))]',
                )}
              />
            ))}
          </div>
        </div>

        {/* Step 1: Items */}
        {step === 'product' && scanSlot ? <div className="mb-3">{scanSlot}</div> : null}
        {step === 'product' && (
          <ItemsStep
            items={items}
            transactionType={transactionType}
            onTransactionTypeChange={onTransactionTypeChange}
            onUpdateItemUnit={onUpdateItemUnit}
            onUpdateItemUnitLabel={onUpdateItemUnitLabel}
            onUpdateItemWeight={onUpdateItemWeight}
            onAddDetail={onAddDetail}
            onUpdateDetail={onUpdateDetail}
            onRemoveDetail={onRemoveDetail}
            onAddItem={onAddItem}
            onAddCustomItem={onAddCustomItem}
            onRemoveItem={onRemoveItem}
            onUpdateItemQuantity={onUpdateItemQuantity}
            onUpdateItemPrice={onUpdateItemPrice}
            onNext={() => onSetStep('customer')}
            t={t}
          />
        )}

        {/* Step 2: Customer */}
        {step === 'customer' && (
          <CustomerStep
            selectedCustomer={selectedCustomer}
            transactionType={transactionType}
            onSelectCustomer={onSelectCustomer}
            onBack={() => onSetStep('product')}
            onNext={() => onSetStep('price')}
            t={t}
          />
        )}

        {/* Step 3: Price */}
        {step === 'price' && (
          <PriceStep
            t={t}
            items={items}
            selectedCustomer={selectedCustomer}
            paymentType={paymentType}
            paidNow={paidNow}
            subtotal={subtotal}
            discountValue={discountValue}
            discountType={discountType}
            total={total}
            isPaid={isPaid}
            isPending={isPending}
            onPaymentTypeChange={onPaymentTypeChange}
            onPaidNowChange={onPaidNowChange}
            onDiscountValueChange={onDiscountValueChange}
            onDiscountTypeChange={onDiscountTypeChange}
            onIsPaidChange={onIsPaidChange}
            onBack={() => onSetStep('customer')}
            onNext={() => onSetStep('preview')}
          />
        )}

        {/* Step 4: Preview & confirm */}
        {step === 'preview' && (
          <PreviewStep
            t={t}
            transactionType={transactionType}
            items={items}
            selectedCustomer={selectedCustomer}
            paidAmount={paidAmount}
            total={total}
            isPending={isPending}
            onBack={() => onSetStep('price')}
            onConfirm={onConfirmCreate}
          />
        )}

        {/* Step 5: Done */}
        {step === 'done' && (
          <DoneStep
            t={t}
            productName={productName}
            paymentType={paymentType}
            total={total}
            paidAmount={paidAmount}
            elapsedFormatted={elapsedFormatted}
            createdInvoiceId={createdInvoiceId}
            onViewInvoice={onViewInvoice}
            onViewAllInvoices={onViewAllInvoices}
          />
        )}
      </div>
    </div>
  )
})

QuickInvoicePage.displayName = 'QuickInvoicePage'
