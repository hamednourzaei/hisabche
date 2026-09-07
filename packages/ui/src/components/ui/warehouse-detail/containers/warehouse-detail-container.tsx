'use client'

import { toValidUnit } from '../../units/unit-select'
import { useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
// Margin and stock-value rules live in the domain layer so mobile derives the
// same numbers rather than re-implementing them.
import { profitPerUnit, stockValue, totalProfit } from '@hisabche/validation'
import { useProduct, useUpdateProduct, useDeleteProduct } from '@hisabche/api'
import { ProductDetailPage } from '../warehouse-detail-page'

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
  const { id } = useParams<{ id: string }>()

  const { data: product, isLoading } = useProduct(id)
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()

  const [editing, setEditing] = useState(false)
  const [editName, setName] = useState('')
  const [editSellPrice, setSellPrice] = useState('')
  const [editBuyPrice, setBuyPrice] = useState('')
  const [editQuantity, setQuantity] = useState('')
  const [editMinStock, setMinStock] = useState('')
  const [editCategory, setCategory] = useState('general')
  const [editUnit, setUnit] = useState<UnitType>('piece')

  const getProduct = useCallback(
    (p: RawProduct) => ({
      name: p.name ?? '',
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
    if (!product) return
    const p = getProduct(product)
    setName(p.name)
    setSellPrice(p.sellPrice.toString())
    setBuyPrice(p.buyPrice.toString())
    setQuantity(p.quantity.toString())
    setMinStock(p.minStockLevel.toString())
    setCategory(p.category)
    setUnit(p.unit)
    setEditing(true)
  }, [product, getProduct])

  const handleSave = useCallback(async () => {
    await updateProduct.mutateAsync({
      id: id!,
      name: editName.trim(),
      sellPrice: num(editSellPrice),
      buyPrice: num(editBuyPrice),
      quantity: Math.floor(num(editQuantity)),
      minStockLevel: Math.floor(num(editMinStock)) || 5,
      category: editCategory as
        'general' | 'food' | 'electronics' | 'clothing' | 'construction' | 'medicine',
      // Refused rather than defaulted — see toValidUnit (T2).
      unit: toValidUnit(editUnit) ?? undefined,
    })
    setEditing(false)
  }, [
    id,
    editName,
    editSellPrice,
    editBuyPrice,
    editQuantity,
    editMinStock,
    editCategory,
    editUnit,
    updateProduct,
  ])

  const handleDelete = useCallback(async () => {
    if (!confirm(t('warehouse.deleteConfirm'))) return
    await deleteProduct.mutateAsync(id!)
    router.push('/warehouse')
  }, [id, deleteProduct, router, t])

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
    if (productData.quantity === 0) return 'destructive'
    if (productData.quantity <= productData.minStockLevel) return 'warning'
    return 'success'
  }, [productData])

  const stockLabel = useMemo(() => {
    if (!productData) return ''
    if (productData.quantity === 0) return t('warehouse.outOfStock')
    if (productData.quantity <= productData.minStockLevel) return t('warehouse.lowStock')
    return t('warehouse.inStock')
  }, [productData, t])

  const profit = productData ? profitPerUnit(productData) : 0

  const profitTotal = productData ? totalProfit(productData) : 0

  const totalValue = productData ? stockValue(productData) : 0

  const onSave = useCallback(
    (data: ProductEditValues) => {
      // This will be called from ProductDetailPage with the edit values
      setName(data.name)
      setSellPrice(data.sellPrice.toString())
      setBuyPrice(data.buyPrice.toString())
      setQuantity(data.quantity.toString())
      setMinStock(data.minStockLevel.toString())
      setCategory(data.category)
      setUnit(data.unit)
      handleSave()
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
    />
  )
}
