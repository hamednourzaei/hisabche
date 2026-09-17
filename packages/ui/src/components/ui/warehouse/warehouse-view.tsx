// packages/ui/src/components/ui/warehouse/warehouse-view.tsx
'use client'

import { memo, useMemo, type ReactNode } from 'react'
import type { StockSummary } from '@hisabche/api'
import { cn } from '../../../lib/utils'
import { FOCUS_RING } from '../focus-ring'
import { EmptyState } from '../empty-state'
import { BentoStats, type BentoStat } from '../bento-stats'
import { WarehouseProductList } from './warehouse-product-list'
import { Plus, Check, ChevronRight, DollarSign, Package, AlertTriangle } from 'lucide-react'
import type { Product, Currency } from '../../../lib/warehouse/warehouse-types'

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
  /** Header title/subtitle; default «موجودی». A warehouse passes its own name. */
  title?: string | undefined
  description?: string | undefined
  /** Set inside one warehouse: back to the warehouse list. */
  onBack?: (() => void) | undefined
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
  title,
  description,
  onBack,
}: {
  t: (key: string, fallback?: string) => string
  onOpenAddModal: () => void
  actionLabel: string
  title: string
  description: string
  onBack?: (() => void) | undefined
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
          <h1 className="truncate text-2xl font-bold sm:text-3xl text-[hsl(var(--fg-primary))]">
            {title}
          </h1>
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{description}</p>
        </div>
      </div>

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
  )
})
WarehouseHeader.displayName = 'WarehouseHeader'

// ─── CurrencyChips ─────────────────────────────────────────────────────────

const CurrencyChips = memo(function CurrencyChips({
  fmt,
  currencies,
  totalValue,
}: {
  fmt: (v: number) => string
  currencies: Currency[]
  totalValue: number | null
}) {
  if (totalValue === null) return null
  return (
    <div className="flex flex-wrap gap-2 text-xs text-[hsl(var(--fg-secondary))]">
      {currencies.map((c) => (
        <span key={c.code} className="rounded-lg bg-[hsl(var(--surface-muted))] px-2 py-1">
          {c.label}: {fmt(totalValue * c.rate)}
        </span>
      ))}
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
  title,
  description,
  onBack,
  children,
  deletingId,
  products,
  isLoading,
  summary,
  currencies,
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
  const stats: BentoStat[] = useMemo(
    () => [
      {
        id: 'value',
        icon: DollarSign,
        label: t('warehouse.totalValue', 'ارزش کل (AFN)'),
        text: figure(summary?.totalValue),
        ...(summary ? { suffix: 'AFN' } : {}),
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
    [t, fmt, summary, isLoading],
  )

  const showEmptyState = !isLoading && products.length === 0

  return (
    <div className="space-y-6">
      <SaveIndicator t={t} deletingId={deletingId} />
      <WarehouseHeader
        t={t}
        onOpenAddModal={onOpenAddModal}
        actionLabel={actionLabel ?? t('warehouse.addWarehouse', 'افزودن انبار')}
        title={title ?? t('nav.stock', 'موجودی')}
        description={description ?? t('nav.stock_description', 'چه چیزی داریم و چه چیزی کم است')}
        onBack={onBack}
      />

      {/* همان کامپوننت و گرید invoices — فقط داده‌ی warehouse */}
      <BentoStats t={t} stats={stats} />

      <CurrencyChips fmt={fmt} currencies={currencies} totalValue={summary?.totalValue ?? null} />

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
