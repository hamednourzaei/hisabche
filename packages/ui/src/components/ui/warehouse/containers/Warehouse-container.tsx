// packages/ui/src/components/ui/warehouse/containers/Warehouse-container.tsx
'use client'

// Multi-warehouse (request #90). The stock tab has two states, chosen by
// `?warehouse=` so a warehouse can be linked to and survives a reload:
//   no param   → business-wide stat cards + the warehouse list («افزودن انبار»)
//   ?warehouse → that warehouse's stat cards + its products («افزودن کالا به انبار»)
// `?warehouse=unassigned` is the stock that is in no warehouse yet.

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useWarehouse } from '../../../../hooks/warehouse/use-warehouse'
import { WarehouseView } from '../warehouse-view'
import { AddProductModal } from '../../add-product-modal'
import { StockHistoryDrawer } from '../stock-history-drawer'
import { fmt } from '../../../../lib/warehouse/warehouse-format'
import type { Product } from '../../../../lib/warehouse/warehouse-types'
import { useQueryClient } from '@tanstack/react-query'
import {
  productKeys,
  useAssignWarehouseStock,
  useCreateWarehouse,
  useStockHistory,
  useWarehouseDetail,
  useWarehouseOverview,
} from '@hisabche/api'
import { WarehouseListTable, UNASSIGNED_WAREHOUSE_ID } from '../warehouse-list-table'
import { AddWarehouseDialog, AssignStockDialog } from '../warehouse-dialogs'

/**
 * H4 — the server's own cap on `GET /products/:id/stock-history`.
 *
 * Stated here as well so the drawer can tell «this is the whole history» from
 * «this is the last 200 movements». It matters: a truncated history never sums
 * to the stored quantity, and without knowing which case it is the drawer would
 * warn about projection drift on every busy product.
 */
const HISTORY_LIMIT = 200

const CURRENCIES = [
  { code: 'AFN', label: 'افغانی', rate: 1 },
  { code: 'USD', label: 'دالر', rate: 0.014 },
  { code: 'IRR', label: 'پومان', rate: 0.85 },
]

export function warehouseContainer() {
  const t = useTranslations()
  const router = useRouter()
  const queryClient = useQueryClient()

  // ورودی از command palette — همان قرارداد صفحه‌ی مشتریان: `?add=true` مودال
  // افزودن کالا را باز می‌کند و `?q=` جستجو را از قبل پر می‌کند.
  const searchParams = useSearchParams()
  const addParam = searchParams?.get('add')
  const queryParam = searchParams?.get('q')
  const warehouseParam = searchParams?.get('warehouse') ?? null

  const [search, setSearch] = useState(queryParam ?? '')
  const [showAddModal, setShowAddModal] = useState(addParam === 'true')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showAddWarehouse, setShowAddWarehouse] = useState(false)
  const [showAssign, setShowAssign] = useState(false)

  const overview = useWarehouseOverview()
  const detail = useWarehouseDetail(warehouseParam)
  // The unassigned list feeds «افزودن کالا به انبار»; only read when the dialog is open.
  const unassignedDetail = useWarehouseDetail(showAssign ? UNASSIGNED_WAREHOUSE_ID : null)
  const createWarehouse = useCreateWarehouse()
  const assignStock = useAssignWarehouseStock(warehouseParam ?? '')

  const openWarehouse = useCallback(
    (id: string | null) => {
      setSearch('')
      router.replace(id ? `/warehouse?warehouse=${encodeURIComponent(id)}` : '/warehouse')
    },
    [router],
  )

  // ─── H4 — stock history and reorder ──────────────────────────────────────
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null)
  const { data: history, isLoading: historyLoading } = useStockHistory(historyProduct?.id)

  const handleOpenHistory = useCallback((product: Product) => setHistoryProduct(product), [])

  // ⚠️ H4 — «سفارش خرید» FOR A LOW-STOCK PRODUCT IS NOT WIRED, DELIBERATELY.
  //
  // The spec asks for a button that opens purchasing with the product filled
  // in. `POST /api/purchase-orders` exists, `useCreatePurchaseOrder` exists —
  // and `/purchasing` has NO create UI at all. It lists orders and receives
  // goods; there is no form to prefill.
  //
  // So the button would navigate to a screen that cannot act on what it was
  // sent: a control that looks like it starts an order and does nothing. That
  // is the theater G1 forbids, and it is worse than the absence, because a
  // shopkeeper would believe the order had been started.
  //
  // Building the form is a FEATURE, not an interconnection — it needs a
  // supplier, lines, dates and a decision about approval. Recorded as a gap in
  // .claude/HANDOFF-PHASES-G-TO-O.md instead of half-built here.

  useEffect(() => {
    if (addParam === 'true') setShowAddModal(true)
  }, [addParam])

  useEffect(() => {
    if (queryParam !== null && queryParam !== undefined) setSearch(queryParam)
  }, [queryParam])

  const { products, summary, isLoading, stockStatus, stockLabel, handleDelete, refetch } =
    useWarehouse(search)

  const onDelete = useCallback(
    async (product: { id: string; name?: string }) => {
      setDeletingId(product.id)
      await handleDelete(product)
      setDeletingId(null)
    },
    [handleDelete],
  )

  const safeT = useMemo(
    () => (key: string, fallback?: string) => {
      const v = t(key)
      return v !== key ? v : (fallback ?? key)
    },
    [t],
  )

  const handleNavigate = useCallback((id: string) => router.push(`/warehouse/${id}`), [router])

  // One warehouse's products in the shape the product table already renders.
  // `quantity` is the quantity IN THIS WAREHOUSE.
  const warehouseProducts: Product[] = useMemo(
    () =>
      (detail.data?.products ?? [])
        .filter((product) => !search || product.name.toLowerCase().includes(search.toLowerCase()))
        .map((product) => ({
          id: product.id,
          name: product.name,
          quantity: product.quantity,
          sellPrice: product.sellPrice,
          buyPrice: product.buyPrice,
          minStockLevel: product.minStockLevel ?? 5,
          unit: product.unit,
          category: '',
        })),
    [detail.data, search],
  )

  const handleOpenAddModal = useCallback(() => setShowAddModal(true), [])

  // ✅ FIX: بعد از بستن مودال و ایجاد محصول، کش را پاک کن
  const handleCloseAddModal = useCallback(() => {
    setShowAddModal(false)
    // ✅ پاک کردن کش محصولات
    queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    // ✅ رفرش کردن داده‌ها
    refetch()
  }, [queryClient, refetch])

  // ✅ FIX: وقتی محصول جدید ایجاد شد، کش را پاک کن
  const handleProductCreated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    refetch()
  }, [queryClient, refetch])

  const inWarehouse = warehouseParam !== null
  const isUnassigned = warehouseParam === UNASSIGNED_WAREHOUSE_ID
  const warehouseName = isUnassigned
    ? safeT('warehouse.unassigned', 'بدون انبار')
    : (detail.data?.warehouse?.name ?? '')

  const viewProps = {
    t: safeT,
    fmt,
    search,
    onSearchChange: setSearch,
    deletingId,
    currencies: CURRENCIES,
    onNavigate: handleNavigate,
    onOpenHistory: handleOpenHistory,
    onDelete,
    stockStatus,
    stockLabel,
    ...(inWarehouse
      ? {
          title: warehouseName || safeT('nav.stock', 'موجودی'),
          description: isUnassigned
            ? safeT('warehouse.unassignedHint', 'موجودی‌ای که هنوز در هیچ انباری ثبت نشده')
            : detail.data?.warehouse?.location ||
              safeT('warehouse.warehouseStock', 'کالاهای این انبار'),
          onBack: () => openWarehouse(null),
          // No «add» inside the unassigned pseudo-warehouse: its stock is added
          // to a real warehouse from that warehouse.
          onOpenAddModal: isUnassigned ? () => openWarehouse(null) : () => setShowAssign(true),
          actionLabel: isUnassigned
            ? safeT('warehouse.backToList', 'بازگشت به فهرست انبارها')
            : safeT('warehouse.assignTitle', 'افزودن کالا به انبار'),
          products: warehouseProducts,
          isLoading: detail.isLoading,
          summary: detail.isError ? null : (detail.data?.summary ?? null),
        }
      : {
          onOpenAddModal: () => setShowAddWarehouse(true),
          actionLabel: safeT('warehouse.addWarehouse', 'افزودن انبار'),
          products,
          isLoading,
          summary,
          children: overview.isError ? (
            <p
              role="alert"
              className="py-8 text-center text-sm text-[hsl(var(--color-destructive))]"
            >
              {safeT('warehouse.loadError', 'فهرست انبارها خوانده نشد.')}{' '}
              <button type="button" className="underline" onClick={() => void overview.refetch()}>
                {safeT('common.retry', 'تلاش دوباره')}
              </button>
            </p>
          ) : overview.isLoading ? (
            <p className="py-8 text-center text-sm text-[hsl(var(--fg-secondary))]">
              {safeT('common.loading', 'در حال بارگذاری…')}
            </p>
          ) : (
            <WarehouseListTable
              t={safeT}
              fmt={fmt}
              warehouses={overview.data?.warehouses ?? []}
              unassigned={overview.data?.unassigned ?? null}
              onOpen={(id) => openWarehouse(id)}
              onAdd={() => setShowAddWarehouse(true)}
            />
          ),
        }),
  }

  return (
    <>
      <AddProductModal
        open={showAddModal}
        onClose={handleCloseAddModal}
        onCreated={handleProductCreated}
      />
      <WarehouseView {...viewProps} />

      <AddWarehouseDialog
        t={safeT}
        open={showAddWarehouse}
        onClose={() => setShowAddWarehouse(false)}
        isPending={createWarehouse.isPending}
        onCreate={(input) => createWarehouse.mutateAsync(input)}
      />

      {inWarehouse && !isUnassigned ? (
        <AssignStockDialog
          t={safeT}
          fmt={fmt}
          open={showAssign}
          onClose={() => setShowAssign(false)}
          warehouseName={warehouseName}
          unassigned={unassignedDetail.data?.products ?? []}
          isLoadingUnassigned={unassignedDetail.isLoading}
          isPending={assignStock.isPending}
          onAssign={(input) => assignStock.mutateAsync(input)}
        />
      ) : null}

      {/* H4 — the movements behind an on-hand figure. */}
      <StockHistoryDrawer
        t={safeT}
        product={historyProduct}
        isLoading={historyLoading}
        movements={history?.movements ?? []}
        movementTotal={history?.movementTotal ?? 0}
        storedQuantity={history?.storedQuantity ?? historyProduct?.quantity ?? 0}
        // The server caps at 200. A full page means there is more history than
        // was returned, so the totals below it are partial — and the drift
        // warning has to stay quiet rather than fire on every busy product.
        truncated={(history?.movements.length ?? 0) >= HISTORY_LIMIT}
        onClose={() => setHistoryProduct(null)}
        onNavigate={(route) => {
          setHistoryProduct(null)
          router.push(route)
        }}
      />
    </>
  )
}
