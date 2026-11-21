// packages/ui/src/components/ui/warehouse/warehouse-view.tsx
'use client'

import { memo, useCallback, useState, type ReactNode } from 'react'
import type { StockSummary } from '@hisabche/api'
import { cn } from '../../../lib/utils'
import { FOCUS_RING } from '../focus-ring'
import { EmptyState } from '../empty-state'
import { KpiCard, formatPercent, fullAmount } from '../kpi-card'
import { WarehouseProductList } from './warehouse-product-list'
import {
  Plus,
  Check,
  ChevronRight,
  DollarSign,
  Package,
  Pencil,
  AlertTriangle,
  Ban,
  LayoutGrid,
  Warehouse,
} from 'lucide-react'
import type { Product, Currency } from '../../../lib/warehouse/warehouse-types'
import { nameOfCurrency } from '../../../lib/currency-name'
import { SelectField } from '../select-field'
import { useIntlLocale } from '../../../hooks/use-intl-locale'

/* ═══════════════════════════════════════════════════════════════════════════
   WarehouseView v5 — search moved onto the table toolbar
   ═══════════════════════════════════════════════════════════════════════════ */

interface WarehouseViewProps {
  t: (key: string, fallback?: string) => string
  /** The books currency — the total is in it, so it is its name. */
  bookCurrency?: string | undefined
  fmt: (v: number) => string
  search: string
  onSearchChange: (value: string) => void
  /** The header's primary action: «افزودن انبار» on the list, «افزودن کالا به انبار» in a warehouse. */
  onOpenAddModal: () => void
  actionLabel?: string | undefined
  /** A second, quieter action beside it — «افزودن کالا به انبار» in a warehouse. */
  secondaryActionLabel?: string | undefined
  onSecondaryAction?: (() => void) | undefined
  /** «انتقال موجودی» — only inside a warehouse, to another one. */
  transferActionLabel?: string | undefined
  onTransferAction?: (() => void) | undefined
  /** «مشاهده نقشه انبار» — where the goods physically are, inside a warehouse. */
  shelvesActionLabel?: string | undefined
  onShelvesAction?: (() => void) | undefined
  /** Beside the header's actions — the costing-method picker on the warehouse list. */
  headerExtra?: ReactNode
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
  /** Products that did not fit their full auto shelf: drawn red. */
  overflowIds?: ReadonlySet<string> | undefined
  isLoading: boolean
  /**
   * Stock value and counts over EVERY product, computed by the server.
   * `null` = the server did not provide it; the cards say so instead of
   * reducing the page of `products` (which is at most 100 rows).
   */
  summary: StockSummary | null
  /** The fifth hub card — the warehouse list shows it; a warehouse does not. */
  showUnassigned?: boolean | undefined
  /** Stock in no warehouse. `undefined` = not read; `null` = there is none. */
  unassigned?: StockSummary | null | undefined
  /** The overview is still loading — the fifth card shows «…», not «نامعلوم». */
  unassignedLoading?: boolean | undefined
  currencies: Currency[]
  /** A value chip was clicked (`code`) or «+» (`null`): open the rate form. */
  onOpenRate: (code: string | null) => void
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
  transferActionLabel,
  onTransferAction,
  shelvesActionLabel,
  onShelvesAction,
  headerExtra,
  eyebrow,
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
  transferActionLabel?: string | undefined
  onTransferAction?: (() => void) | undefined
  shelvesActionLabel?: string | undefined
  onShelvesAction?: (() => void) | undefined
  headerExtra?: ReactNode
  /** «موجودی / انبارها» above the title — the list only, not inside a warehouse. */
  eyebrow?: string | undefined
  title: string
  description: string
  onBack?: (() => void) | undefined
  onEditCurrent?: (() => void) | undefined
}) {
  return (
    // Title and actions share one row while both fit. The actions (costing
    // picker + button) are wider than a phone's spare room, and as a shrink-0
    // column they squeezed the description to one word per line — so the row
    // wraps and the title keeps a readable minimum width.
    <div className="flex flex-row flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-[12rem] flex-1 items-start gap-2">
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
          {eyebrow ? (
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[hsl(var(--fg-tertiary))]">
              <Warehouse className="size-3.5 shrink-0" aria-hidden="true" />
              {eyebrow}
            </div>
          ) : null}
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

      {/* On a phone the actions take their own full row and wrap: as a
          shrink-0 column they ran off the screen and over the title. */}
      <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
        {headerExtra}
        {shelvesActionLabel && onShelvesAction ? (
          <button
            type="button"
            onClick={onShelvesAction}
            data-warehouse-shelves-open=""
            className={cn(
              'inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-full border border-[hsl(var(--border-default))] px-4 text-sm font-medium sm:min-h-[40px]',
              'text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]',
              FOCUS_RING,
            )}
          >
            <LayoutGrid className="size-4" aria-hidden="true" />
            {shelvesActionLabel}
          </button>
        ) : null}
        {transferActionLabel && onTransferAction ? (
          <button
            type="button"
            onClick={onTransferAction}
            data-transfer-stock-open=""
            className={cn(
              'inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-full border border-[hsl(var(--border-default))] px-4 text-sm font-medium sm:min-h-[40px]',
              'text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]',
              FOCUS_RING,
            )}
          >
            {transferActionLabel}
          </button>
        ) : null}
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
//
// The stock's value in up to MAX_CHIPS other currencies or named units
// (owner, 18 Oct 2026). A chip opens the dashboard's rate form on it; «+» opens
// the same form empty, to add one. The form is the shared ExchangeRateDialog,
// mounted by the container — this view only says which code was clicked.

/** How many currencies / units the warehouse shows its value in. */
export const MAX_CHIPS = 5

const CurrencyChips = memo(function CurrencyChips({
  t,
  fmt,
  currencies,
  totalValue,
  bookCurrency,
  onOpenRate,
}: {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  currencies: Currency[]
  totalValue: number | null
  /** The books currency the total is already in — the chip's name, never «AFN». */
  bookCurrency?: string | undefined
  /** `null` = «+», a new one. */
  onOpenRate: (code: string | null) => void
}) {
  if (totalValue === null) return null

  const chip = 'rounded-lg bg-[hsl(var(--surface-muted))] px-2 py-1'

  return (
    <div
      className="flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--fg-secondary))]"
      data-currency-chips=""
    >
      {/* ⚠️ THIS SAID «افغانی» IN EVERY WORKSPACE. A gold business read its own
          stock value under another currency's name — the same defect as the
          «(AFN)» in the card, one line lower. */}
      {bookCurrency ? (
        <span className={chip}>
          {nameOfCurrency(t, bookCurrency, bookCurrency)}: {fmt(totalValue)}
        </span>
      ) : null}
      {currencies.slice(0, MAX_CHIPS).map((c) => (
        <button
          key={c.code}
          type="button"
          onClick={() => onOpenRate(c.code)}
          aria-label={`${t('warehouse.rateForm', 'ثبت نرخ')} — ${c.label}`}
          className={cn(
            chip,
            'inline-flex items-center gap-1.5 transition-colors hover:bg-[hsl(var(--surface-elevated))] hover:text-[hsl(var(--fg-primary))]',
            FOCUS_RING,
          )}
        >
          <span>
            {c.label}:{' '}
            {c.rate === null ? (
              <span className="text-[hsl(var(--color-warning))]">
                {t('warehouse.enterRate', 'نرخ را وارد کنید')}
              </span>
            ) : (
              fmt(totalValue * c.rate)
            )}
          </span>
          <Pencil className="size-3 shrink-0 opacity-60" aria-hidden="true" />
        </button>
      ))}
      {currencies.length < MAX_CHIPS ? (
        <button
          type="button"
          data-add-rate=""
          onClick={() => onOpenRate(null)}
          aria-label={t('warehouse.addRate', 'افزودن ارز یا واحد')}
          title={t('warehouse.addRate', 'افزودن ارز یا واحد')}
          className={cn(
            'inline-flex size-7 items-center justify-center rounded-lg border border-dashed border-[hsl(var(--border-default))] text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--surface-muted))]',
            FOCUS_RING,
          )}
        >
          <Plus className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
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
  transferActionLabel,
  onTransferAction,
  shelvesActionLabel,
  onShelvesAction,
  headerExtra,
  title,
  description,
  onBack,
  onEditCurrent,
  children,
  deletingId,
  products,
  overflowIds,
  isLoading,
  summary,
  showUnassigned,
  unassigned,
  unassignedLoading,
  currencies,
  onOpenRate,
  onNavigate,
  onOpenHistory,
  onDelete,
  stockStatus,
  stockLabel,
  bookCurrency,
}: WarehouseViewProps) {
  // Loading shows the placeholder; a loaded response without a summary says
  // the figure is unavailable. Neither shows a number that is not there.
  const figure = useCallback(
    (value: number | undefined) =>
      isLoading
        ? '…'
        : value === undefined
          ? t('warehouse.summaryUnavailable', 'نامعلوم')
          : fmt(value),
    [isLoading, t, fmt],
  )

  // ✅ دقیقاً همان BentoStats که /invoices استفاده میکند — در همه‌ی ابعاد.
  // ⚠️ عمداً از `text` استفاده شده (نه `amount`) چون BentoStats مقدار متنی
  // را هرگز compact نمی‌کند — عدد کامل در موبایل/تبلت/دسکتاپ ثابت می‌ماند
  // (مثلاً 27,820,000 AFN) و فقط اندازه‌ی فونت تغییر می‌کند.
  // The unit «ارزش کل» is shown in — the books currency, or any currency with a
  // rate the person picked from the switcher.
  //
  // ⚠️ THE DEFAULT WAS THE LITERAL `BASE_CODE` ('AFN'). The card therefore
  // offered an option whose value was 'AFN' and whose label was the books
  // currency: a gold business saw one currency's name beside a number computed
  // in another. «Not chosen yet» is now `null` and resolves to the books
  // currency on every render, so it cannot survive a late `useBookCurrency()`
  // either.
  const [displayOverride, setDisplayOverride] = useState<string | null>(null)
  const bookCode = bookCurrency ?? null
  const displayCode = displayOverride ?? bookCode
  // ⚠️ The total is in the BOOKS' currency, so that is its name — a business
  // keeping its books in gold saw «AFN» on its own stock value (owner report).
  const baseLabel = bookCurrency ? nameOfCurrency(t, bookCurrency, bookCurrency) : '—'
  const displayed = displayCode ? currencies.find((c) => c.code === displayCode) : undefined
  const valueText =
    displayCode === null || displayCode === bookCode || !displayed
      ? figure(summary?.totalValue)
      : isLoading || summary?.totalValue === undefined
        ? figure(summary?.totalValue)
        : displayed.rate === null
          ? t('warehouse.enterRate', 'نرخ را وارد کنید')
          : fmt(summary.totalValue * displayed.rate)

  const locale = useIntlLocale()

  // Counts are not money: `fullAmount` groups the digits without a currency's
  // decimals. Money still goes through `fmt`.
  const countText = useCallback(
    (value: number | undefined) =>
      isLoading
        ? '…'
        : value === undefined
          ? t('warehouse.summaryUnavailable', 'نامعلوم')
          : fullAmount(value, locale),
    [isLoading, t, locale],
  )

  // «۳٫۷٪ از کالاها» — a share of the SAME server summary's product count,
  // never of a page of rows. No count (or no total) = no percentage, rather
  // than a 0 that claims to have been measured.
  const shareOf = useCallback(
    (count: number | undefined) =>
      count === undefined || summary?.productCount === undefined || summary.productCount <= 0
        ? null
        : formatPercent((count / summary.productCount) * 100, locale),
    [summary, locale],
  )

  const lowShare = shareOf(summary?.lowStockCount)
  const outShare = shareOf(summary?.outOfStockCount)
  const hubTitle = title ?? t('warehouse.hubTitle', 'انبارها')

  const valueAddon =
    currencies.length > 0 || bookCode ? (
      <SelectField
        aria-label={t('warehouse.showIn', 'نمایش به')}
        value={displayCode ?? ''}
        onChange={setDisplayOverride}
        options={[
          ...(bookCode ? [{ value: bookCode, label: baseLabel }] : []),
          ...currencies.map((c) => ({ value: c.code, label: c.label })),
        ]}
        // Currency-code sized (owner's request, 27 Sep 2026): SelectField is
        // full-width by default and pushed the label «ارزش کل» to «ارز…».
        className="h-6 w-auto shrink-0 gap-0.5 rounded-md border-transparent bg-transparent px-1 text-[11px] font-semibold hover:bg-[hsl(var(--surface-muted))] [&>svg]:size-3"
      />
    ) : (
      <span className="text-[11px] text-[hsl(var(--fg-tertiary))]">({baseLabel})</span>
    )

  // The fifth card is only on the hub: inside a warehouse the four cards
  // describe that warehouse, and a business-wide «unassigned» figure in the
  // same row would be a second scope under one heading.
  const unassignedValue =
    unassignedLoading || isLoading
      ? '…'
      : unassigned === undefined
        ? t('warehouse.summaryUnavailable', 'نامعلوم')
        : fmt(unassigned === null ? 0 : unassigned.totalValue)

  const unassignedHint =
    unassignedLoading || isLoading || unassigned === undefined
      ? undefined
      : unassigned === null
        ? t('warehouse.nothingUnassigned', 'موجودی بدون انبار وجود ندارد.')
        : `${fullAmount(unassigned.productCount, locale)} ${t('warehouse.unassignedCountHint', 'کالا هنوز جای داده نشده')}`

  const showEmptyState = !isLoading && products.length === 0
  const showHint = (share: string | null) =>
    share ? `${share} ${t('warehouse.ofProducts', 'از کالاها')}` : undefined

  return (
    <div className="space-y-5">
      <SaveIndicator t={t} deletingId={deletingId} />
      <WarehouseHeader
        t={t}
        onOpenAddModal={onOpenAddModal}
        actionLabel={actionLabel ?? t('warehouse.addWarehouse', 'افزودن انبار')}
        secondaryActionLabel={secondaryActionLabel}
        onSecondaryAction={onSecondaryAction}
        transferActionLabel={transferActionLabel}
        onTransferAction={onTransferAction}
        shelvesActionLabel={shelvesActionLabel}
        onShelvesAction={onShelvesAction}
        headerExtra={headerExtra}
        eyebrow={showUnassigned ? t('warehouse.eyebrow', 'موجودی') : undefined}
        title={hubTitle}
        description={
          description ??
          (showUnassigned
            ? t('warehouse.hubDescription', 'موجودی هر انبار، ارزش آن و پیشنهاد سفارش')
            : t('nav.stock_description', 'چه چیزی داریم و چه چیزی کم است'))
        }
        onBack={onBack}
        onEditCurrent={onEditCurrent}
      />

      {/* Five figures, five real server numbers. Layout: a phone shows 2+2+1,
          a tablet 2+1+1+1 (the value card is wider), a desktop the five-column
          row the mockup was approved on. A warehouse shows four — a
          business-wide «بدون انبار» inside one warehouse would be a second
          scope under one heading. */}
      <div
        className={cn(
          'grid gap-2.5',
          showUnassigned
            ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-[1.32fr_1fr_.96fr_.96fr_1.18fr]'
            : 'grid-cols-2 md:grid-cols-4',
        )}
      >
        <KpiCard
          label={t('warehouse.totalValueShort', 'ارزش کل')}
          labelAddon={valueAddon}
          icon={DollarSign}
          value={valueText}
          hint={
            displayed && displayed.rate !== null && displayCode !== bookCode
              ? t('warehouse.atPurchasePriceWithRate', 'به بهای خرید، با نرخ ثبت‌شده')
              : t('warehouse.atPurchasePrice', 'به بهای خرید')
          }
          {...(showUnassigned ? { className: 'sm:col-span-2 lg:col-span-1' } : {})}
        />
        <KpiCard
          label={t('warehouse.totalProducts', 'تعداد محصولات')}
          icon={Package}
          value={countText(summary?.productCount)}
          hint={t('warehouse.activeProductsOnly', 'فقط کالاهای فعال')}
        />
        <KpiCard
          label={t('warehouse.lowStock', 'موجودی کم')}
          icon={AlertTriangle}
          tone="warning"
          value={countText(summary?.lowStockCount)}
          hint={showHint(lowShare)}
        />
        <KpiCard
          label={t('warehouse.outOfStock', 'ناموجود')}
          icon={Ban}
          tone="destructive"
          value={countText(summary?.outOfStockCount)}
          hint={showHint(outShare)}
        />
        {showUnassigned ? (
          <KpiCard
            label={t('warehouse.unassigned', 'بدون انبار')}
            icon={Warehouse}
            tone="info"
            value={unassignedValue}
            hint={unassignedHint}
            className="col-span-2 sm:col-span-1"
          />
        ) : null}
      </div>

      <CurrencyChips
        t={t}
        fmt={fmt}
        currencies={currencies}
        totalValue={summary?.totalValue ?? null}
        bookCurrency={bookCurrency}
        onOpenRate={onOpenRate}
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
          overflowIds={overflowIds}
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
