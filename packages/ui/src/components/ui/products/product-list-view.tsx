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

import { memo } from 'react'
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
  Panel,
  SelectField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../capability/capability-kit'
import { WorkStateBadge } from '../state/work-state'
import { Input } from '../input'

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
}

/** Only fields the server can order by. */
const COLUMNS: ReadonlyArray<{ field: string; labelKey: string; fallback: string }> = [
  { field: 'name', labelKey: 'products.name', fallback: 'نام کالا' },
  { field: 'sku', labelKey: 'products.sku', fallback: 'کد' },
  { field: 'quantity', labelKey: 'products.quantity', fallback: 'موجودی' },
]

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
}: ProductListViewProps) {
  const { state } = engine

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

      <Panel title={t('common.search', 'جست‌وجو')}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Input
              label={t('products.search_label', 'نام یا کد کالا')}
              value={state.search}
              onChange={(event) => engine.setSearch(event.target.value)}
            />
          </div>

          <div className="w-32">
            <SelectField
              label={t('common.page_size', 'تعداد در صفحه')}
              value={String(state.pageSize)}
              onChange={(value) => engine.setPageSize(Number(value))}
              options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))}
            />
          </div>

          {engine.isFiltered ? (
            <ActionButton variant="quiet" onClick={engine.reset}>
              {t('common.clear', 'پاک کردن')}
            </ActionButton>
          ) : null}
        </div>
      </Panel>

      {isLoading ? <Loading label={t('common.loading', 'در حال بارگذاری…')} /> : null}

      {!isLoading && rows.length === 0 ? (
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
      ) : null}

      {rows.length > 0 ? (
        <Panel title={t('products.list', 'فهرست')}>
          <Table>
            <TableHeader>
              <TableRow>
                {COLUMNS.map((column) => {
                  const direction = engine.sortIndicator(column.field)
                  return (
                    <TableHead key={column.field}>
                      <button
                        type="button"
                        onClick={() => engine.toggleSort(column.field)}
                        aria-sort={
                          direction === 'asc'
                            ? 'ascending'
                            : direction === 'desc'
                              ? 'descending'
                              : 'none'
                        }
                        className="flex items-center gap-1 text-start"
                      >
                        {t(column.labelKey, column.fallback)}
                        <span aria-hidden="true">
                          {direction === 'asc' ? '↑' : direction === 'desc' ? '↓' : ''}
                        </span>
                      </button>
                    </TableHead>
                  )
                })}
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.map((product) => {
                const low = (product.quantity ?? 0) <= (product.minStockLevel ?? 0)
                return (
                  <TableRow key={product.id}>
                    <TableCell>{product.name}</TableCell>
                    <TableCell dir="ltr">{product.sku || '—'}</TableCell>
                    <TableCell>
                      {/* The count is stated as text as well as a colour —
                          §1.7, never colour alone. */}
                      <Badge tone={low ? 'warn' : 'neutral'}>
                        <span dir="ltr" className="tabular-nums">
                          {product.quantity ?? 0}
                        </span>
                      </Badge>
                      {low ? (
                        <span className="ms-2 text-xs text-[hsl(var(--fg-tertiary))]">
                          {t('products.low_stock', 'رو به اتمام')}
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Panel>
      ) : null}

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

      <p className="text-xs text-[hsl(var(--fg-tertiary))]">
        {t('common.total', 'مجموع')}:{' '}
        <span dir="ltr" className="tabular-nums">
          {total}
        </span>
      </p>
    </CapabilityPage>
  )
})

ProductListView.displayName = 'ProductListView'
