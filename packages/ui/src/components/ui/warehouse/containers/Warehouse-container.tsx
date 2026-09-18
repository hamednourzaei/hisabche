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
import { useCurrencyStore } from '@hisabche/store'
import {
  productKeys,
  useAssignWarehouseStock,
  useCreateWarehouse,
  warehouseKeys,
  useUpdateWarehouse,
  useStockHistory,
  useWarehouseDetail,
  useWarehouseOverview,
} from '@hisabche/api'
import { WarehouseListTable, UNASSIGNED_WAREHOUSE_ID } from '../warehouse-list-table'
import { AddWarehouseDialog, AssignStockDialog } from '../warehouse-dialogs'
import { AddToWarehouseModal } from '../add-to-warehouse-modal'

/**
 * H4 — the server's own cap on `GET /products/:id/stock-history`.
 *
 * Stated here as well so the drawer can tell «this is the whole history» from
 * «this is the last 200 movements». It matters: a truncated history never sums
 * to the stored quantity, and without knowing which case it is the drawer would
 * warn about projection drift on every busy product.
 */
const HISTORY_LIMIT = 200

// Request #92: the chips convert with rates the USER entered, never with a
// constant. Without a rate the chip asks for one instead of showing a number.
const CHIP_CURRENCIES = [
  { code: 'USD', labelKey: 'warehouse.currencyUSD', fallback: 'دالر' },
  { code: 'IRR', labelKey: 'warehouse.currencyIRR', fallback: 'تومان' },
] as const

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
  const [editingWarehouse, setEditingWarehouse] = useState<{
    id: string
    name: string
    location: string
  } | null>(null)
  const updateWarehouse = useUpdateWarehouse()
  const [showAssign, setShowAssign] = useState(false)
  const [showAddToWarehouse, setShowAddToWarehouse] = useState(false)

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

  const rates = useCurrencyStore((state) => state.rates)
  const setManualRate = useCurrencyStore((state) => state.setManualRate)
  const currencies = useMemo(
    () =>
      CHIP_CURRENCIES.map((currency) => {
        const rate = rates[currency.code]
        return {
          code: currency.code,
          label: safeT(currency.labelKey, currency.fallback),
          // Only a rate the user typed converts; null = ask for it.
          rate: rate?.manual ? rate.rate : null,
          afnPerUnit: rate?.manual && rate.rate > 0 ? 1 / rate.rate : null,
        }
      }),
    [rates, safeT],
  )

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
  // A new product's opening stock is in no warehouse yet, so the warehouse
  // list and «بدون انبار» change with it — not only the product list.
  const refreshStock = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    queryClient.invalidateQueries({ queryKey: warehouseKeys.all })
    refetch()
  }, [queryClient, refetch])

  const handleCloseAddModal = useCallback(() => {
    setShowAddModal(false)
    refreshStock()
  }, [refreshStock])

  const handleProductCreated = useCallback(refreshStock, [refreshStock])

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
    currencies,
    onSetRate: (code: string, afnPerUnit: number | null) =>
      setManualRate(code as Parameters<typeof setManualRate>[0], afnPerUnit),
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
          // Back is the arrow beside the title; the action button ADDS.
          onBack: () => openWarehouse(null),
          // Renaming from inside the warehouse too: on a narrow screen the
          // table's own edit button sits past the horizontal scroll.
          ...(isUnassigned || !detail.data?.warehouse
            ? {}
            : {
                onEditCurrent: () =>
                  setEditingWarehouse({
                    id: detail.data!.warehouse!.id,
                    name: detail.data!.warehouse!.name,
                    location: detail.data!.warehouse!.location,
                  }),
              }),
          // «بدون انبار» holds stock that is in no warehouse, and that is
          // exactly where a brand-new product's opening stock lands — so its
          // action is the product modal (name, unit, quantity, buy/sell price).
          // A real warehouse instead takes stock that already exists.
          onOpenAddModal: isUnassigned
            ? () => setShowAddModal(true)
            : () => setShowAddToWarehouse(true),
          actionLabel: isUnassigned
            ? safeT('warehouse.addProduct', 'افزودن محصول')
            : safeT('warehouse.addToWarehouse', 'افزودن به انبار'),
          // Moving stock that is already in the business but in no warehouse.
          ...(isUnassigned
            ? {}
            : {
                secondaryActionLabel: safeT('warehouse.assignTitle', 'افزودن کالا به انبار'),
                onSecondaryAction: () => setShowAssign(true),
              }),
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
              onEdit={setEditingWarehouse}
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

      <AddWarehouseDialog
        t={safeT}
        open={editingWarehouse !== null}
        initial={editingWarehouse}
        onClose={() => setEditingWarehouse(null)}
        isPending={updateWarehouse.isPending}
        onCreate={(input) =>
          editingWarehouse
            ? updateWarehouse.mutateAsync({ id: editingWarehouse.id, ...input })
            : Promise.resolve()
        }
      />

      {inWarehouse && !isUnassigned && detail.data?.warehouse ? (
        <AddToWarehouseModal
          t={safeT}
          open={showAddToWarehouse}
          onClose={() => setShowAddToWarehouse(false)}
          warehouseId={detail.data.warehouse.id}
          warehouseName={detail.data.warehouse.name}
          onCreated={refreshStock}
        />
      ) : null}

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
