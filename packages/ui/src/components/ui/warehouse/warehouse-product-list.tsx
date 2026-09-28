// packages/ui/src/components/ui/warehouse/warehouse-product-list.tsx
'use client'

import { memo, useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { cn } from '../../../lib/utils'
import { History, Pencil, Trash2 } from 'lucide-react'
import {
  BulkActionBar,
  DataTable,
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

interface WarehouseProductListProps {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  products: Product[]
  stockStatus: (qty: number, min: number) => StockStatus
  stockLabel: (qty: number, min: number) => string
  onNavigate: (id: string) => void
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
            <span className="font-medium text-[hsl(var(--fg-primary))]">{product.name}</span>
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
          <span className="text-[hsl(var(--fg-secondary))]">{product.unit}</span>
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
          <span className="text-[hsl(var(--fg-secondary))]">{product.category || '—'}</span>
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
    [fmt, onNavigate, onOpenHistory, stockStatus, stockLabel, t],
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
  onDelete,
  search,
  onSearchChange,
  actions,
  emptyState,
}: WarehouseProductListProps) {
  const columns = useProductColumns(t, fmt, stockStatus, stockLabel, onNavigate, onOpenHistory)

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
      rows={products}
      columns={columns}
      rowKey={(product) => product.id}
      onRowClick={(product) => onNavigate(product.id)}
      searchValue={search}
      onSearchChange={onSearchChange}
      minWidthClass="min-w-[420px] sm:min-w-[680px]"
      actions={actions}
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
