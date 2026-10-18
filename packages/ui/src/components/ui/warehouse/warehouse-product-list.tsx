// packages/ui/src/components/ui/warehouse/warehouse-product-list.tsx
'use client'

import { categoryLabel } from './category-field'
import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { cn } from '../../../lib/utils'
import { History, Pencil, Trash2 } from 'lucide-react'
import {
  BulkActionBar,
  DataTable,
  TableFilterSelect,
  useBulkAction,
  useRowSelection,
  type TableColumn,
} from '../data-table'
import type { Product } from '../../../lib/warehouse/warehouse-types'

/* ═══════════════════════════════════════════════════════════════════════════
   WarehouseProductList v7 — shared DataTable
   collapsible search · column settings · sortable headers · responsive columns
   ═══════════════════════════════════════════════════════════════════════════ */

type StockStatus = 'success' | 'warning' | 'destructive' | 'secondary'

/** The filter's value for «every category». Never a category itself. */
const ALL_CATEGORIES = '__all__'

interface WarehouseProductListProps {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  products: Product[]
  stockStatus: (qty: number, min: number) => StockStatus
  stockLabel: (qty: number, min: number) => string
  onNavigate: (id: string) => void
  /** Products whose full auto shelf could not take what arrived (shelf-overflow.tsx). */
  overflowIds?: ReadonlySet<string> | undefined
  /** H4 — open the movements behind this product's on-hand figure. */
  onOpenHistory?: ((product: Product) => void) | undefined
  // ⚠️ H4 — there is deliberately NO `onReorder` here.
  //
  // The spec asks for a «سفارش خرید» button on a low-stock row. `/purchasing`
  // has no create form at all — it lists orders and receives goods — so the
  // button would lead somewhere that cannot act on it. A declared-but-unwired
  // prop is the same theater one indirection further back. See
  // Warehouse-container.tsx for the full reasoning.

  /** Awaited by bulk delete so partial failures are reported accurately. */
  onDelete: (product: Product) => void | Promise<void>
  deletingId: string | null
  search: string
  onSearchChange: (value: string) => void
  /** Export controls, rendered beside the search and column icons. */
  actions?: ReactNode
  emptyState?: ReactNode
}

const statusBadgeStyles: Record<string, string> = {
  success:
    'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))] border-[hsl(var(--color-success)/0.2)]',
  warning:
    'bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))] border-[hsl(var(--color-warning)/0.2)]',
  destructive:
    'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))] border-[hsl(var(--color-destructive)/0.2)]',
  secondary:
    'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))] border-[hsl(var(--border-default))]',
}

function useProductColumns(
  t: (key: string, fallback?: string) => string,
  fmt: (v: number) => string,
  stockStatus: (qty: number, min: number) => StockStatus,
  stockLabel: (qty: number, min: number) => string,
  onNavigate: (id: string) => void,
  onOpenHistory: WarehouseProductListProps['onOpenHistory'],
  overflowIds?: ReadonlySet<string> | undefined,
): TableColumn<Product>[] {
  return useMemo(
    () => [
      {
        id: 'name',
        labelKey: 'warehouse.name',
        labelFallback: 'نام',
        locked: true,
        sortValue: (product) => product.name,
        render: (product) => (
          <span className="flex items-center gap-2">
            {/* The cover (first gallery image). Fixed size so the row never
                jumps when it loads; empty alt — the name beside it says it. */}
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt=""
                width={32}
                height={32}
                loading="lazy"
                decoding="async"
                className="size-8 shrink-0 rounded-md object-cover"
              />
            ) : null}
            <span
              className={
                overflowIds?.has(product.id)
                  ? 'font-medium text-[hsl(var(--color-destructive))]'
                  : 'font-medium text-[hsl(var(--fg-primary))]'
              }
            >
              {product.name}
            </span>
            {overflowIds?.has(product.id) ? (
              <span
                data-overflow-badge=""
                className="shrink-0 rounded bg-[hsl(var(--color-destructive)/0.12)] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--color-destructive))]"
              >
                {t('warehouseShelves.overflow.badge', 'جا نشد')}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'unit',
        labelKey: 'warehouse.unit',
        labelFallback: 'واحد',
        showFrom: 'md',
        sortValue: (product) => product.unit,
        render: (product) => (
          <span className="text-[hsl(var(--fg-secondary))]">
            {t(`unit.${product.unit}`, product.unit)}
          </span>
        ),
      },
      {
        id: 'buyPrice',
        labelKey: 'warehouse.buyPrice',
        labelFallback: 'قیمت خرید',
        showFrom: 'sm',
        align: 'end',
        sortValue: (product) => product.buyPrice,
        render: (product) => (
          <span className="tabular-nums text-[hsl(var(--fg-secondary))]">
            {fmt(product.buyPrice)}
          </span>
        ),
      },
      {
        id: 'sellPrice',
        labelKey: 'warehouse.sellPrice',
        labelFallback: 'قیمت فروش',
        align: 'end',
        sortValue: (product) => product.sellPrice,
        render: (product) => (
          <span className="tabular-nums text-[hsl(var(--fg-primary))]">
            {fmt(product.sellPrice)}
          </span>
        ),
      },
      {
        id: 'quantity',
        labelKey: 'warehouse.quantity',
        labelFallback: 'تعداد',
        align: 'end',
        sortValue: (product) => product.quantity,
        render: (product) => (
          <span
            className={cn(
              'inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums',
              statusBadgeStyles[stockStatus(product.quantity, product.minStockLevel)] ??
                statusBadgeStyles.secondary,
            )}
          >
            {product.quantity}
          </span>
        ),
      },
      // ⚠️ THE STATUS IS SPELLED OUT, NOT ONLY COLOURED. `stockLabel` was passed
      // all the way down to this table and no column rendered it, so an
      // oversold product (-98) was a red number with no word saying it was out.
      {
        id: 'stockStatus',
        labelKey: 'warehouse.stockStatus',
        labelFallback: 'وضعیت موجودی',
        sortValue: (product) => product.quantity - product.minStockLevel,
        render: (product) => (
          <span
            className={cn(
              'inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium',
              statusBadgeStyles[stockStatus(product.quantity, product.minStockLevel)] ??
                statusBadgeStyles.secondary,
            )}
          >
            {stockLabel(product.quantity, product.minStockLevel)}
          </span>
        ),
      },
      {
        id: 'category',
        labelKey: 'warehouse.category',
        labelFallback: 'دسته‌بندی',
        showFrom: 'md',
        sortValue: (product) => product.category ?? '',
        render: (product) => (
          <span className="text-[hsl(var(--fg-secondary))]">
            {categoryLabel(t, product.category) || '—'}
          </span>
        ),
      },
      {
        id: 'itemValue',
        labelKey: 'warehouse.itemValue',
        labelFallback: 'ارزش',
        showFrom: 'sm',
        align: 'end',
        sortValue: (product) => product.quantity * product.buyPrice,
        render: (product) => (
          <span className="font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
            {fmt(product.quantity * product.buyPrice)}
          </span>
        ),
      },
      {
        id: 'actions',
        labelKey: 'invoices.actions',
        labelFallback: 'عملیات',
        locked: true,
        align: 'end',
        render: (product) => (
          <div className="inline-flex items-center gap-1">
            {/* H4 — the movements behind this product's on-hand figure.
                A separate control, not the row click: the row already opens
                the editor, and «why is this number wrong» is a different
                question from «change this number». */}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenHistory?.(product)
              }}
              aria-label={t('warehouse.stockHistory', 'تاریخچه‌ی موجودی')}
              title={t('warehouse.stockHistory', 'تاریخچه‌ی موجودی')}
              className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full text-[hsl(var(--fg-secondary))] transition-colors duration-150 hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]"
            >
              <History className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onNavigate(product.id)
              }}
              aria-label={t('action.edit', 'ویرایش')}
              className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full text-[hsl(var(--fg-secondary))] transition-colors duration-150 hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]"
            >
              <Pencil className="size-4" aria-hidden="true" />
            </button>
          </div>
        ),
      },
    ],
    [fmt, onNavigate, onOpenHistory, stockStatus, stockLabel, t, overflowIds],
  )
}

export const WarehouseProductList = memo(function WarehouseProductList({
  t,
  fmt,
  products,
  stockStatus,
  stockLabel,
  onNavigate,
  onOpenHistory,
  overflowIds,
  onDelete,
  search,
  onSearchChange,
  actions,
  emptyState,
}: WarehouseProductListProps) {
  const columns = useProductColumns(
    t,
    fmt,
    stockStatus,
    stockLabel,
    onNavigate,
    onOpenHistory,
    overflowIds,
  )

  // «شال‌ها»، «شلوارها»، «دستبندها»: one category of this warehouse at a time.
  // The choices are the categories the products on screen actually carry.
  const [category, setCategory] = useState(ALL_CATEGORIES)
  const categories = useMemo(
    () =>
      [...new Set(products.map((product) => (product.category ?? '').trim()))]
        .filter((value) => value !== '')
        .sort((a, b) => a.localeCompare(b)),
    [products],
  )
  // A category that is no longer on the page (another warehouse was opened) is
  // not a filter that silently hides everything.
  const activeCategory = categories.includes(category) ? category : ALL_CATEGORIES
  const shown = useMemo(
    () =>
      activeCategory === ALL_CATEGORIES
        ? products
        : products.filter((product) => (product.category ?? '').trim() === activeCategory),
    [products, activeCategory],
  )

  // Bulk delete reuses the same per-product delete the row menu calls, so the
  // stock and authorization side effects are identical to deleting one by one.
  const selection = useRowSelection()
  const byId = useMemo(() => new Map(products.map((product) => [product.id, product])), [products])

  const bulkDelete = useBulkAction(
    useCallback(
      async (id: string) => {
        const product = byId.get(id)
        // The row disappeared between selection and confirmation — treat it as
        // a failure rather than silently counting it as deleted.
        if (!product) throw new Error(`product ${id} is no longer listed`)
        await onDelete(product)
      },
      [byId, onDelete],
    ),
  )

  const productIds = useMemo(() => products.map((p) => p.id), [products])

  useEffect(() => {
    selection.prune(productIds)
  }, [productIds, selection])

  const handleBulkDelete = useCallback(async () => {
    await bulkDelete.run([...selection.selectedIds])
    selection.clear()
  }, [bulkDelete, selection])

  return (
    <DataTable
      tableId="warehouse-products"
      t={t}
      rows={shown}
      columns={columns}
      rowKey={(product) => product.id}
      onRowClick={(product) => onNavigate(product.id)}
      // The phone card's edge (owner's mock-up, 18 Oct 2026): a shelf that
      // could not take the goods is red; otherwise the stock badge's own state.
      cardTone={(product) => {
        if (overflowIds?.has(product.id)) return 'destructive'
        const state = stockStatus(product.quantity, product.minStockLevel)
        return state === 'secondary' ? undefined : state
      }}
      // The mock-up's grid: purchase, sale, on hand, value — category behind «بیشتر».
      cardOrder={['buyPrice', 'sellPrice', 'quantity', 'itemValue']}
      searchValue={search}
      onSearchChange={onSearchChange}
      minWidthClass="min-w-[420px] sm:min-w-[680px]"
      actions={
        <>
          {categories.length > 1 ? (
            <TableFilterSelect
              label={t('warehouse.categoryFilter', 'دسته‌بندی')}
              value={activeCategory}
              onChange={setCategory}
              allValue={ALL_CATEGORIES}
              options={[
                { value: ALL_CATEGORIES, label: t('common.all', 'همه') },
                ...categories.map((value) => ({ value, label: categoryLabel(t, value) })),
              ]}
            />
          ) : null}
          {actions}
        </>
      }
      emptyState={emptyState}
      selectedIds={selection.selectedIds}
      onToggleRow={selection.toggleRow}
      onToggleAll={selection.toggleAll}
      bulkBar={
        <BulkActionBar
          t={t}
          selectedCount={selection.selectedCount}
          busy={bulkDelete.busy}
          result={bulkDelete.result}
          onClear={selection.clear}
          actions={[
            {
              id: 'delete',
              label: t('common.delete', 'حذف'),
              icon: <Trash2 className="size-3.5" aria-hidden="true" />,
              destructive: true,
              confirmLabel: t('warehouse.bulkDeleteConfirm', 'کالاهای انتخاب‌شده حذف شوند؟'),
              onRun: handleBulkDelete,
            },
          ]}
        />
      }
    />
  )
})

WarehouseProductList.displayName = 'WarehouseProductList'
