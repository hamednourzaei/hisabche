'use client'

import { toValidUnit } from '../../units/unit-select'
import { useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
// Margin and stock-value rules live in the domain layer so mobile derives the
// same numbers rather than re-implementing them.
import { profitPerUnit, stockValue, totalProfit } from '@hisabche/validation'
import {
  apiErrorMessage,
  useProduct,
  useProductWarehouseBreakdown,
  useUpdateProduct,
  useDeleteProduct,
  warehouseKeys,
} from '@hisabche/api'
import { useQueryClient } from '@tanstack/react-query'
import { barcodeTakenMessage } from '../../../../lib/barcode/barcode-errors'
import { ProductExpiryPanel } from '../product-expiry-panel'
import { ProductJourneyPanel } from '../product-journey-panel'
import { ProductBarcodesPanel } from '../product-barcodes-panel'
import { ProductImagesPanel } from '../product-images-panel'
import { ProductWarehouseStockPanel } from '../product-warehouse-stock-panel'
import { ProductManufacturingPanel } from '../../manufacturing/product-manufacturing-panel'
import { EntityNotes } from '../../entity-notes'
import { CustomFieldsPanel } from '../../custom-fields-panel'
import { useIntlLocale } from '../../../../hooks/use-intl-locale'
import { ProductDetailPage } from '../warehouse-detail-page'
import { isProductInUse, productDeleteRefusal } from '../../../../lib/warehouse/delete-refusal'
import { STOCK_LABEL_KEY, STOCK_TONE, stockStateOf } from '../../../../lib/warehouse/stock-state'
import { useToast } from '../../toast-provider'
import { useLocalePush } from '../../../../hooks/use-locale-push'

/**
 * ⚠️ WAS `'piece' | 'kg' | 'liter' | 'meter' | 'box'` — FIVE OF FIFTEEN.
 *
 * `units` (phase-l-01) seeds fifteen codes and `unitSchema` accepts all of
 * them. Narrowing to five here did not merely hide options: `toUnitType`
 * coerced everything else to 'piece', so a product measured in grams opened
 * as «عدد» and SAVING the form wrote 'piece' over the real unit — a silent
 * data change, structurally the T1 currency-to-AFN defect. See T2.
 */
type UnitType = string

interface ProductEditValues {
  name: string
  barcode: string
  sellPrice: number
  buyPrice: number
  quantity: number
  minStockLevel: number
  category: string
  unit: UnitType
  warehouseId: string
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const fmt = (v: unknown): string => num(v).toLocaleString('fa-AF')

/**
 * ⚠️ THIS USED TO REWRITE THE PRODUCT'S UNIT.
 *
 * It checked the value against five hardcoded codes and returned 'piece' for
 * everything else — so a gram, tonne or dozen product was loaded into the edit
 * form as «عدد», and the next save persisted that. Identity now: the stored
 * unit is carried through untouched and `<UnitSelect>` renders an unknown code
 * as itself. See T2.
 */
const toUnitType = (unit: string): UnitType => unit

interface RawProduct {
  name?: string
  barcode?: string | null | undefined
  sell_price?: number | string
  sellPrice?: number | string
  buy_price?: number | string
  buyPrice?: number | string
  quantity?: number | string
  min_stock_level?: number | string
  minStockLevel?: number | string
  category?: string
  unit?: string
}

/** The server's refusals of a stock edit — a CLOSED list, each worded in fa/af/en. */
const STOCK_REFUSALS = [
  'PRODUCT_WAREHOUSE_REQUIRED',
  'PRODUCT_WAREHOUSE_NOT_FOUND',
  'PRODUCT_QUANTITY_INVALID',
] as const

function stockRefusal(error: unknown, t: (key: string) => string): string | null {
  const code = (error as { response?: { data?: { code?: unknown } } } | null)?.response?.data?.code
  return typeof code === 'string' && (STOCK_REFUSALS as readonly string[]).includes(code)
    ? t(`warehouse.byWarehouse.error.${code}`)
    : null
}

type StockStatus = 'success' | 'warning' | 'destructive' | 'secondary'

export function ProductDetailContainer() {
  const t = useTranslations()
  const router = useRouter()
  const push = useLocalePush()
  const { id } = useParams<{ id: string }>()

  const { data: product, isLoading } = useProduct(id)
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()
  const breakdown = useProductWarehouseBreakdown(id ?? null)
  const queryClient = useQueryClient()
  const toast = useToast()

  const [editing, setEditing] = useState(false)

  const getProduct = useCallback(
    (p: RawProduct) => ({
      name: p.name ?? '',
      barcode: p.barcode ?? '',
      sellPrice: num(p.sell_price ?? p.sellPrice),
      buyPrice: num(p.buy_price ?? p.buyPrice),
      quantity: num(p.quantity),
      minStockLevel: num(p.min_stock_level ?? p.minStockLevel ?? 5),
      category: p.category ?? 'general',
      unit: toUnitType(p.unit ?? 'piece'),
    }),
    [],
  )

  const startEditing = useCallback(() => {
    if (product) setEditing(true)
  }, [product])

  /**
   * ⚠️ THE VALUES ARE PASSED IN, NOT READ FROM STATE.
   *
   * `onSave` used to copy the form into seven `useState`s and call the save in
   * the same tick. React had not re-rendered yet, so the save closure still
   * held the values from when editing STARTED: changing the stock from −98 to
   * 99 sent −98 back, the request succeeded, and nothing changed. Every other
   * edited field was lost the same way.
   */
  const handleSave = useCallback(
    async (values: ProductEditValues) => {
      await updateProduct.mutateAsync({
        id: id!,
        name: values.name.trim(),
        barcode: values.barcode,
        sellPrice: num(values.sellPrice),
        buyPrice: num(values.buyPrice),
        quantity: Math.floor(num(values.quantity)),
        minStockLevel: Math.floor(num(values.minStockLevel)) || 5,
        category: values.category as
          'general' | 'food' | 'electronics' | 'clothing' | 'construction' | 'medicine',
        // Refused rather than defaulted — see toValidUnit (T2).
        unit: toValidUnit(values.unit) ?? undefined,
        // Where a quantity change lands (BUG-080); the server picks the only
        // warehouse itself and refuses a missing one when there are several.
        ...(values.warehouseId ? { warehouseId: values.warehouseId } : {}),
      })
      // The stock moved: the per-warehouse figures are stale too.
      void queryClient.invalidateQueries({ queryKey: warehouseKeys.all })
      setEditing(false)
    },
    [id, updateProduct, queryClient],
  )

  const handleDelete = useCallback(async () => {
    if (!confirm(t('warehouse.deleteConfirm'))) return
    try {
      await deleteProduct.mutateAsync(id!)
    } catch (error) {
      // Sales or stock history: deleting would orphan it. The message used to
      // say «deactivate instead» with no way to do so on this page — so the
      // product could not be removed at all (reported 28 Sep 2026). Now the
      // same step offers it; a deactivated product leaves the warehouse lists.
      if (
        isProductInUse(error) &&
        confirm(`${productDeleteRefusal(error, t)}

${t('warehouse.deactivateInstead')}`)
      ) {
        try {
          await updateProduct.mutateAsync({ id: id!, isActive: false })
        } catch {
          toast.error(t('warehouse.deactivateFailed'))
          return
        }
        void queryClient.invalidateQueries({ queryKey: warehouseKeys.all })
        toast.success(t('warehouse.deactivated'))
        push('/warehouse')
        return
      }
      // Stay on the product and say why, instead of an unhandled rejection
      // and a button that seems to do nothing.
      if (!isProductInUse(error)) toast.error(productDeleteRefusal(error, t))
      return
    }
    push('/warehouse')
  }, [id, deleteProduct, updateProduct, queryClient, push, t, toast])

  const locale = useIntlLocale()
  const safeT = useCallback(
    (key: string, fallback?: string) => {
      const v = t(key)
      return v && v !== key ? v : (fallback ?? key)
    },
    [t],
  )

  const productData = useMemo(() => (product ? getProduct(product) : null), [product, getProduct])

  const stockStatus: StockStatus = useMemo(() => {
    if (!productData) return 'secondary'
    return STOCK_TONE[stockStateOf(productData.quantity, productData.minStockLevel)]
  }, [productData])

  const stockLabel = useMemo(() => {
    if (!productData) return ''
    return t(STOCK_LABEL_KEY[stockStateOf(productData.quantity, productData.minStockLevel)])
  }, [productData, t])

  const profit = productData ? profitPerUnit(productData) : 0

  const profitTotal = productData ? totalProfit(productData) : 0

  const totalValue = productData ? stockValue(productData) : 0

  const onSave = useCallback(
    (data: ProductEditValues) => {
      // A refused save keeps the form open with what was typed.
      // ⚠️ WAS `.catch(() => undefined)`: every failed save was swallowed, the
      // form stayed open and nothing said why. Now the reason is shown.
      void handleSave(data).catch((error: unknown) => {
        toast.error(
          barcodeTakenMessage(error, t) ??
            stockRefusal(error, t) ??
            apiErrorMessage(error, t('common.error')),
        )
      })
    },
    [handleSave],
  )

  return (
    <ProductDetailPage
      t={safeT}
      fmt={fmt}
      isLoading={isLoading}
      product={productData}
      editing={editing}
      updatePending={updateProduct.isPending}
      stockStatus={stockStatus}
      stockLabel={stockLabel}
      profitPerUnit={profit}
      totalProfit={profitTotal}
      totalValue={totalValue}
      onBack={() => router.back()}
      onStartEditing={startEditing}
      onCancelEditing={() => setEditing(false)}
      onSave={onSave}
      onDelete={handleDelete}
      barcodes={id ? <ProductBarcodesPanel t={safeT} productId={id} /> : null}
      images={
        id ? (
          <ProductImagesPanel t={safeT} productId={id} productName={product?.name ?? ''} />
        ) : null
      }
      stockPlaces={id ? <ProductWarehouseStockPanel t={safeT} productId={id} fmt={fmt} /> : null}
      manufacturing={
        id ? (
          <div className="space-y-4">
            <ProductManufacturingPanel
              t={safeT}
              locale={locale}
              productId={id}
              productName={product?.name ?? ''}
            />
            {/* What colleagues wrote about this product (#103). */}
            <EntityNotes entityType="product" entityId={id} />
            {/* The business's own fields on a product (#141–#143). */}
            <CustomFieldsPanel entity="product" entityId={id} />
          </div>
        ) : null
      }
      stockWarehouses={(breakdown.data?.warehouses ?? []).map((w) => ({ id: w.id, name: w.name }))}
      expiry={id ? <ProductExpiryPanel t={safeT} productId={id} /> : null}
      journey={id ? <ProductJourneyPanel t={safeT} productId={id} /> : null}
    />
  )
}
