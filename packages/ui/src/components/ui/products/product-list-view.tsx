'use client'

// ============================================
// packages/ui/src/components/ui/products/product-list-view.tsx
//
// Same engine, different columns — which is what "shared" is supposed to mean.
//
// ⚠️ Low stock is NOT rendered with `WorkStateBadge`.
//
// The first draft did that, mapping the low-stock count onto `conflictCount`
// so the badge would go amber. It would have read "needs review" — the
// conflict label — on a product that is merely running out. The work-STATE
// vocabulary is about the data (loading, offline, syncing, conflicted); a
// business alert belongs to the work QUEUE, which already has `low_stock`.
//
// `WorkStateBadge` appears here with what it actually means: whether this
// list's data is in step with the server.
// ============================================

import { memo, useMemo } from 'react'
import { PAGE_SIZES } from '@hisabche/ui-contract'

import type { ListEngine } from '../../../hooks/use-list-engine'
import type { ProductRow } from './containers/product-list-container'
import {
  ActionButton,
  Badge,
  CapabilityHeader,
  CapabilityPage,
  EmptyState,
  ErrorNote,
  Loading,
  SelectField,
} from '../capability/capability-kit'
import { DataTable, type TableColumn } from '../data-table'
import { WorkStateBadge } from '../state/work-state'

export interface ProductListViewProps {
  t: (key: string, fallback?: string) => string
  engine: ListEngine
  /** Connectivity, so the header can say whether this list is in step. */
  isOnline: boolean
  pendingCount: number
  rows: ProductRow[]
  total: number
  isLoading: boolean
  error: string | null
  onRefresh: () => void
  /** The product's own page — a row opens it. */
  onOpen?: ((productId: string) => void) | undefined
}

const isLow = (product: ProductRow) => (product.quantity ?? 0) <= (product.minStockLevel ?? 0)

export const ProductListView = memo(function ProductListView({
  t,
  engine,
  isOnline,
  pendingCount,
  rows,
  total,
  isLoading,
  error,
  onRefresh,
  onOpen,
}: ProductListViewProps) {
  const { state } = engine

  const columns = useMemo<TableColumn<ProductRow>[]>(
    () => [
      {
        id: 'name',
        labelKey: 'products.name',
        labelFallback: 'نام کالا',
        locked: true,
        sortValue: (product) => product.name,
        render: (product) => <span className="font-medium">{product.name}</span>,
      },
      {
        id: 'sku',
        labelKey: 'products.sku',
        labelFallback: 'کد',
        sortValue: (product) => product.sku ?? null,
        render: (product) => <span dir="ltr">{product.sku || '—'}</span>,
      },
      {
        id: 'quantity',
        labelKey: 'products.quantity',
        labelFallback: 'موجودی',
        sortValue: (product) => product.quantity ?? 0,
        render: (product) => (
          <>
            {/* The count is stated as text as well as a colour —
                §1.7, never colour alone. */}
            <Badge tone={isLow(product) ? 'warn' : 'neutral'}>
              <span dir="ltr" className="tabular-nums">
                {product.quantity ?? 0}
              </span>
            </Badge>
            {isLow(product) ? (
              <span className="ms-2 text-xs text-[hsl(var(--fg-tertiary))]">
                {t('products.low_stock', 'رو به اتمام')}
              </span>
            ) : null}
          </>
        ),
      },
    ],
    [t],
  )

  return (
    <CapabilityPage>
      <CapabilityHeader
        title={t('products.title', 'کالاها')}
        description={t('products.subtitle', 'فهرست کالاها با جست‌وجو و مرتب‌سازی')}
        action={
          <span className="flex items-center gap-2">
            {/* Data state, in the product's one vocabulary. Renders nothing
                when everything is in step — a permanent "fine" badge is a
                badge nobody reads. */}
            <WorkStateBadge t={t} isOffline={!isOnline} pendingCount={pendingCount} />
            <ActionButton variant="quiet" onClick={onRefresh} disabled={isLoading}>
              {t('common.refresh', 'تازه‌سازی')}
            </ActionButton>
          </span>
        }
      />

      {error ? (
        <ErrorNote
          message={error}
          onRetry={onRefresh}
          retryLabel={t('common.retry', 'تلاش دوباره')}
        />
      ) : null}

      {/* The shared table — the same search, saved views and column settings as
          every other list. Search is sent to the server: the table holds one
          page. It stays mounted while a page loads, so typing keeps its focus. */}
      <DataTable
        tableId="products"
        t={t}
        rows={rows}
        columns={columns}
        rowKey={(product) => product.id}
        onRowClick={onOpen ? (product) => onOpen(product.id) : undefined}
        searchValue={state.search}
        onSearchChange={engine.setSearch}
        minWidthClass="min-w-[420px]"
        emptyState={
          isLoading ? (
            <Loading label={t('common.loading', 'در حال بارگذاری…')} />
          ) : (
            <EmptyState
              title={
                engine.isFiltered
                  ? t('products.no_match', 'کالایی با این جست‌وجو پیدا نشد')
                  : t('products.empty', 'هنوز کالایی ثبت نشده')
              }
              description={
                engine.isFiltered
                  ? t('products.no_match_hint', 'جست‌وجو را تغییر دهید یا پاکش کنید.')
                  : t('products.empty_hint', 'اولین کالا را از صفحه‌ی موجودی اضافه کنید.')
              }
            />
          )
        }
      />

      {engine.pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <ActionButton
            variant="quiet"
            disabled={state.page <= 1}
            onClick={() => engine.goToPage(state.page - 1)}
          >
            {t('common.previous', 'قبلی')}
          </ActionButton>

          <Badge>
            <span dir="ltr" className="tabular-nums">
              {state.page} / {engine.pageCount}
            </span>
          </Badge>

          <ActionButton
            variant="quiet"
            disabled={state.page >= engine.pageCount}
            onClick={() => engine.goToPage(state.page + 1)}
          >
            {t('common.next', 'بعدی')}
          </ActionButton>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">
          {t('common.total', 'مجموع')}:{' '}
          <span dir="ltr" className="tabular-nums">
            {total}
          </span>
        </p>
        <div className="w-32">
          <SelectField
            label={t('common.page_size', 'تعداد در صفحه')}
            value={String(state.pageSize)}
            onChange={(value) => engine.setPageSize(Number(value))}
            options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))}
          />
        </div>
      </div>
    </CapabilityPage>
  )
})

ProductListView.displayName = 'ProductListView'
