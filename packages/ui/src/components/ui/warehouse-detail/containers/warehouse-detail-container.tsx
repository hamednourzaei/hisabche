'use client'

import { toValidUnit } from '../../units/unit-select'
import { useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
// Margin and stock-value rules live in the domain layer so mobile derives the
// same numbers rather than re-implementing them.
import { profitPerUnit, stockValue, totalProfit } from '@hisabche/validation'
import { apiErrorMessage, useProduct, useUpdateProduct, useDeleteProduct } from '@hisabche/api'
import { barcodeTakenMessage } from '../../../../lib/barcode/barcode-errors'
import { ProductExpiryPanel } from '../product-expiry-panel'
import { ProductJourneyPanel } from '../product-journey-panel'
import { ProductBarcodesPanel } from '../product-barcodes-panel'
import { ProductDetailPage } from '../warehouse-detail-page'
import { productDeleteRefusal } from '../../../../lib/warehouse/delete-refusal'
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

type StockStatus = 'success' | 'warning' | 'destructive' | 'secondary'

export function ProductDetailContainer() {
  const t = useTranslations()
  const router = useRouter()
  const push = useLocalePush()
  const { id } = useParams<{ id: string }>()

  const { data: product, isLoading } = useProduct(id)
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()
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
      })
      setEditing(false)
    },
    [id, updateProduct],
  )

  const handleDelete = useCallback(async () => {
    if (!confirm(t('warehouse.deleteConfirm'))) return
    try {
      await deleteProduct.mutateAsync(id!)
    } catch (error) {
      // Stay on the product and say why (sales / stock history), instead of an
      // unhandled rejection and a button that seems to do nothing.
      toast.error(productDeleteRefusal(error, t))
      return
    }
    push('/warehouse')
  }, [id, deleteProduct, push, t, toast])

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
        toast.error(barcodeTakenMessage(error, t) ?? apiErrorMessage(error, t('common.error')))
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
      expiry={id ? <ProductExpiryPanel t={safeT} productId={id} /> : null}
      journey={id ? <ProductJourneyPanel t={safeT} productId={id} /> : null}
    />
  )
}
