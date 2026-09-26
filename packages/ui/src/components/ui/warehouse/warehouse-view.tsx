// packages/ui/src/components/ui/warehouse/warehouse-view.tsx
'use client'

import { memo, useMemo, useState, type ReactNode } from 'react'
import type { StockSummary } from '@hisabche/api'
import { cn } from '../../../lib/utils'
import { FOCUS_RING } from '../focus-ring'
import { EmptyState } from '../empty-state'
import { BentoStats, type BentoStat } from '../bento-stats'
import { WarehouseProductList } from './warehouse-product-list'
import { Plus, Check, ChevronRight, DollarSign, Package, Pencil, AlertTriangle } from 'lucide-react'
import type { Product, Currency } from '../../../lib/warehouse/warehouse-types'
import { BASE_CODE, rateFromPair } from '../../../lib/warehouse/rate-from-pair'
import { SelectField } from '../select-field'

/* ═══════════════════════════════════════════════════════════════════════════
   WarehouseView v5 — search moved onto the table toolbar
   ═══════════════════════════════════════════════════════════════════════════ */

interface WarehouseViewProps {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  search: string
  onSearchChange: (value: string) => void
  /** The header's primary action: «افزودن انبار» on the list, «افزودن کالا به انبار» in a warehouse. */
  onOpenAddModal: () => void
  actionLabel?: string | undefined
  /** A second, quieter action beside it — «افزودن کالا به انبار» in a warehouse. */
  secondaryActionLabel?: string | undefined
  onSecondaryAction?: (() => void) | undefined
  /** Header title/subtitle; default «موجودی». A warehouse passes its own name. */
  title?: string | undefined
  description?: string | undefined
  /** Set inside one warehouse: back to the warehouse list. */
  onBack?: (() => void) | undefined
  /** «ویرایش» beside the title — renaming the warehouse you are looking at. */
  onEditCurrent?: (() => void) | undefined
  /**
   * Replaces the product table — the warehouse list uses it for the
   * warehouses table. Omit to show `products`.
   */
  children?: ReactNode
  deletingId: string | null
  products: Product[]
  isLoading: boolean
  /**
   * Stock value and counts over EVERY product, computed by the server.
   * `null` = the server did not provide it; the cards say so instead of
   * reducing the page of `products` (which is at most 100 rows).
   */
  summary: StockSummary | null
  currencies: Currency[]
  /** Save the user's rate (AFN per unit); null clears it. */
  onSetRate: (code: string, afnPerUnit: number | null) => void
  onNavigate: (id: string) => void
  /** H4 — open the movements behind a product's on-hand figure. */
  onOpenHistory?:
    ((product: import('../../../lib/warehouse/warehouse-types').Product) => void) | undefined
  onDelete: (product: Product) => void
  stockStatus: (qty: number, min: number) => 'success' | 'warning' | 'destructive' | 'secondary'
  stockLabel: (qty: number, min: number) => string
}

// ─── SaveIndicator ──────────────────────────────────────────────────────────

const SaveIndicator = memo(function SaveIndicator({
  t,
  deletingId,
}: {
  t: (key: string, fallback?: string) => string
  deletingId: string | null
}) {
  if (deletingId === null) return null

  return (
    <div role="status" aria-live="polite" className="fixed start-1/2 top-4 z-50 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border-strong))] shadow-lg">
        <Check className="size-4 text-[hsl(var(--color-success))]" aria-hidden="true" />
        <span className="text-[hsl(var(--color-success))]">{t('common.saved', 'حفظ شد')}</span>
      </div>
    </div>
  )
})
SaveIndicator.displayName = 'SaveIndicator'

// ─── Header ─────────────────────────────────────────────────────────────────

const WarehouseHeader = memo(function WarehouseHeader({
  t,
  onOpenAddModal,
  actionLabel,
  secondaryActionLabel,
  onSecondaryAction,
  title,
  description,
  onBack,
  onEditCurrent,
}: {
  t: (key: string, fallback?: string) => string
  onOpenAddModal: () => void
  actionLabel: string
  secondaryActionLabel?: string | undefined
  onSecondaryAction?: (() => void) | undefined
  title: string
  description: string
  onBack?: (() => void) | undefined
  onEditCurrent?: (() => void) | undefined
}) {
  return (
    // Title and action share one row at every width, mobile included.
    <div className="flex flex-row items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label={t('warehouse.backToList', 'بازگشت به فهرست انبارها')}
            className={cn(
              'mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]',
              FOCUS_RING,
            )}
          >
            <ChevronRight className="size-5 ltr:rotate-180" aria-hidden="true" />
          </button>
        ) : null}
        <div className="min-w-0 space-y-1.5">
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl text-[hsl(var(--fg-primary))]">
            <span className="truncate">{title}</span>
            {onEditCurrent ? (
              <button
                type="button"
                onClick={onEditCurrent}
                aria-label={t('warehouse.editWarehouse', 'ویرایش انبار')}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--surface-muted))]',
                  FOCUS_RING,
                )}
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                {t('common.edit', 'ویرایش')}
              </button>
            ) : null}
          </h1>
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{description}</p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {secondaryActionLabel && onSecondaryAction ? (
          <button
            type="button"
            onClick={onSecondaryAction}
            className={cn(
              'inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[hsl(var(--border-default))] px-4 text-sm font-medium sm:min-h-[40px]',
              'text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]',
              FOCUS_RING,
            )}
          >
            {secondaryActionLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onOpenAddModal}
          className={cn(
            'inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 sm:px-5',
            'min-h-[44px] sm:min-h-[40px]',
            'text-sm font-bold text-white',
            'bg-[image:var(--gradient-brand)]',
            'shadow-sm shadow-[hsl(var(--color-primary)/0.15)]',
            'transition-all duration-200 hover:brightness-110 active:scale-[0.98]',
            FOCUS_RING,
            'motion-reduce:transition-none',
          )}
        >
          <Plus className="size-4" aria-hidden="true" />
          <span className="whitespace-nowrap">{actionLabel}</span>
        </button>
      </div>
    </div>
  )
})
WarehouseHeader.displayName = 'WarehouseHeader'

// ─── CurrencyChips ─────────────────────────────────────────────────────────

const CurrencyChips = memo(function CurrencyChips({
  t,
  fmt,
  currencies,
  totalValue,
  onSetRate,
}: {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  currencies: Currency[]
  totalValue: number | null
  onSetRate: (code: string, afnPerUnit: number | null) => void
}) {
  // «[amount] [unit] = [amount] [unit]» — the way a rate is said aloud
  // (owner's request, 26 Sep 2026). The old form was fixed to «۱ X = … افغانی»
  // and had no room for «۳٬۰۰۰ افغانی = ۱٬۰۰۰٬۰۰۰ تومان».
  const units = [{ code: BASE_CODE, label: t('warehouse.currencyAFN', 'افغانی') }, ...currencies]
  const [leftAmount, setLeftAmount] = useState('1')
  const [leftCode, setLeftCode] = useState(currencies[0]?.code ?? BASE_CODE)
  const [rightAmount, setRightAmount] = useState('')
  const [rightCode, setRightCode] = useState(BASE_CODE)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  if (totalValue === null) return null

  const submit = () => {
    const result = rateFromPair(
      { amount: Number(leftAmount), code: leftCode },
      { amount: Number(rightAmount), code: rightCode },
      (code) => currencies.find((c) => c.code === code)?.afnPerUnit ?? null,
    )
    if (!result.ok) {
      setMessage({
        ok: false,
        text:
          result.reason === 'same'
            ? t('warehouse.rateSame', 'دو واحد باید متفاوت باشند.')
            : result.reason === 'amount'
              ? t('warehouse.rateAmount', 'هر دو مقدار باید بزرگ‌تر از صفر باشند.')
              : t(
                  'warehouse.rateBridge',
                  'یکی از دو واحد باید افغانی باشد یا نرخش از قبل ثبت شده باشد.',
                ),
      })
      return
    }
    onSetRate(result.code, result.afnPerUnit)
    setMessage({ ok: true, text: t('warehouse.rateSaved', 'نرخ ذخیره شد.') })
  }

  const amountInput =
    'h-9 w-28 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-2 text-sm tabular-nums'
  const unitSelect =
    'h-9 min-w-[96px] rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-2 text-sm'
  const unitOptions = units.map((u) => ({ value: u.code, label: u.label }))

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--fg-secondary))]">
        <span className="rounded-lg bg-[hsl(var(--surface-muted))] px-2 py-1">
          {t('warehouse.currencyAFN', 'افغانی')}: {fmt(totalValue)}
        </span>
        {currencies.map((c) => (
          <span key={c.code} className="rounded-lg bg-[hsl(var(--surface-muted))] px-2 py-1">
            {c.label}:{' '}
            {c.rate === null ? (
              <span className="text-[hsl(var(--color-warning))]">
                {t('warehouse.enterRate', 'نرخ را وارد کنید')}
              </span>
            ) : (
              fmt(totalValue * c.rate)
            )}
          </span>
        ))}
      </div>

      <form
        data-rate-form=""
        className="flex flex-wrap items-center gap-2 text-sm"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <span className="text-xs font-medium text-[hsl(var(--fg-secondary))]">
          {t('warehouse.rateForm', 'ثبت نرخ')}:
        </span>
        <input
          aria-label={t('warehouse.rateForm', 'ثبت نرخ')}
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          dir="ltr"
          value={leftAmount}
          onChange={(e) => setLeftAmount(e.target.value)}
          className={amountInput}
        />
        <SelectField
          value={leftCode}
          onChange={setLeftCode}
          options={unitOptions}
          className={unitSelect}
        />
        <span aria-hidden="true">=</span>
        <input
          aria-label={t('warehouse.rateForm', 'ثبت نرخ')}
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          dir="ltr"
          value={rightAmount}
          onChange={(e) => setRightAmount(e.target.value)}
          className={amountInput}
        />
        <SelectField
          value={rightCode}
          onChange={setRightCode}
          options={unitOptions}
          className={unitSelect}
        />
        <button
          type="submit"
          className="h-9 rounded-lg bg-[hsl(var(--color-primary))] px-3 text-sm font-medium text-[hsl(var(--color-primary-fg))]"
        >
          {t('common.save', 'ذخیره')}
        </button>
        {message ? (
          <span
            role={message.ok ? 'status' : 'alert'}
            className={
              message.ok
                ? 'text-xs text-[hsl(var(--color-success))]'
                : 'text-xs text-[hsl(var(--color-destructive))]'
            }
          >
            {message.text}
          </span>
        ) : null}
      </form>
    </div>
  )
})
CurrencyChips.displayName = 'CurrencyChips'

// ─── LoadingSkeleton ────────────────────────────────────────────────────────

const LoadingSkeleton = memo(function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-16 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
      ))}
    </div>
  )
})
LoadingSkeleton.displayName = 'LoadingSkeleton'

// ─── Main Component ────────────────────────────────────────────────────────

export const WarehouseView = memo(function WarehouseView({
  t,
  fmt,
  search,
  onSearchChange,
  onOpenAddModal,
  actionLabel,
  secondaryActionLabel,
  onSecondaryAction,
  title,
  description,
  onBack,
  onEditCurrent,
  children,
  deletingId,
  products,
  isLoading,
  summary,
  currencies,
  onSetRate,
  onNavigate,
  onOpenHistory,
  onDelete,
  stockStatus,
  stockLabel,
}: WarehouseViewProps) {
  // Loading shows the placeholder; a loaded response without a summary says
  // the figure is unavailable. Neither shows a number that is not there.
  const figure = (value: number | undefined) =>
    isLoading
      ? '…'
      : value === undefined
        ? t('warehouse.summaryUnavailable', 'نامعلوم')
        : fmt(value)

  // ✅ دقیقاً همان BentoStats که /invoices استفاده میکند — در همه‌ی ابعاد.
  // ⚠️ عمداً از `text` استفاده شده (نه `amount`) چون BentoStats مقدار متنی
  // را هرگز compact نمی‌کند — عدد کامل در موبایل/تبلت/دسکتاپ ثابت می‌ماند
  // (مثلاً 27,820,000 AFN) و فقط اندازه‌ی فونت تغییر می‌کند.
  // The unit «ارزش کل» is shown in — afghani, or any currency with a rate
  // (owner's request: the «(AFN)» of the card should be selectable).
  const [displayCode, setDisplayCode] = useState(BASE_CODE)
  const displayed = currencies.find((c) => c.code === displayCode)
  const valueText =
    displayCode === BASE_CODE || !displayed
      ? figure(summary?.totalValue)
      : isLoading || summary?.totalValue === undefined
        ? figure(summary?.totalValue)
        : displayed.rate === null
          ? t('warehouse.enterRate', 'نرخ را وارد کنید')
          : fmt(summary.totalValue * displayed.rate)

  const stats: BentoStat[] = useMemo(
    () => [
      {
        id: 'value',
        icon: DollarSign,
        label: t('warehouse.totalValueShort', 'ارزش کل'),
        labelAddon:
          currencies.length > 0 ? (
            <SelectField
              aria-label={t('warehouse.showIn', 'نمایش به')}
              value={displayCode}
              onChange={setDisplayCode}
              options={[
                { value: BASE_CODE, label: 'AFN' },
                ...currencies.map((c) => ({ value: c.code, label: c.code })),
              ]}
              className="h-6 rounded-md border border-[hsl(var(--border-default))] bg-transparent px-1 text-[11px]"
            />
          ) : (
            <span className="text-[11px] text-[hsl(var(--fg-tertiary))]">(AFN)</span>
          ),
        text: valueText,
      },
      {
        id: 'count',
        icon: Package,
        label: t('warehouse.totalProducts', 'تعداد محصولات'),
        text: figure(summary?.productCount),
      },
      {
        id: 'low',
        icon: AlertTriangle,
        label: t('warehouse.lowStock', 'موجودی کم'),
        text: figure(summary?.lowStockCount),
      },
      {
        id: 'out',
        icon: AlertTriangle,
        label: t('warehouse.outOfStock', 'ناموجود'),
        text: figure(summary?.outOfStockCount),
      },
    ],
    [t, fmt, summary, isLoading, currencies, displayCode, valueText],
  )

  const showEmptyState = !isLoading && products.length === 0

  return (
    <div className="space-y-6">
      <SaveIndicator t={t} deletingId={deletingId} />
      <WarehouseHeader
        t={t}
        onOpenAddModal={onOpenAddModal}
        actionLabel={actionLabel ?? t('warehouse.addWarehouse', 'افزودن انبار')}
        secondaryActionLabel={secondaryActionLabel}
        onSecondaryAction={onSecondaryAction}
        title={title ?? t('nav.stock', 'موجودی')}
        description={description ?? t('nav.stock_description', 'چه چیزی داریم و چه چیزی کم است')}
        onBack={onBack}
        onEditCurrent={onEditCurrent}
      />

      {/* همان کامپوننت و گرید invoices — فقط داده‌ی warehouse */}
      <BentoStats t={t} stats={stats} />

      <CurrencyChips
        t={t}
        fmt={fmt}
        currencies={currencies}
        totalValue={summary?.totalValue ?? null}
        onSetRate={onSetRate}
      />

      {isLoading ? (
        <LoadingSkeleton />
      ) : children !== undefined ? (
        children
      ) : (
        <WarehouseProductList
          t={t}
          fmt={fmt}
          products={products}
          stockStatus={stockStatus}
          stockLabel={stockLabel}
          onNavigate={onNavigate}
          onOpenHistory={onOpenHistory}
          onDelete={onDelete}
          deletingId={deletingId}
          search={search}
          onSearchChange={onSearchChange}
          emptyState={
            showEmptyState ? (
              <EmptyState
                icon="product"
                title={t('warehouse.noProducts', 'هیچ محصولی موجود نیست')}
                description={t(
                  'warehouse.noProductsInWarehouse',
                  'کالایی در این انبار نیست؛ موجودی بدون انبار را اضافه کنید یا فاکتور خرید با این انبار ثبت کنید',
                )}
                action={{
                  label: actionLabel ?? t('warehouse.addProduct', 'افزودن محصول'),
                  onClick: onOpenAddModal,
                }}
              />
            ) : undefined
          }
        />
      )}
    </div>
  )
})

WarehouseView.displayName = 'WarehouseView'
