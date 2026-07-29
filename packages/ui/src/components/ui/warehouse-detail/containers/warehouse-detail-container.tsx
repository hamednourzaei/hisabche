"use client"

import { useState, useCallback, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useTranslations } from "next-intl";
import {
  useProduct,
  useUpdateProduct,
  useDeleteProduct,
} from "@hisabche/api"
import { ProductDetailPage } from "../warehouse-detail-page"

type UnitType = "piece" | "kg" | "liter" | "meter" | "box"

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

const fmt = (v: unknown): string => num(v).toLocaleString("fa-AF")

// Helper to convert string to valid UnitType
const toUnitType = (unit: string): UnitType => {
  const validUnits: UnitType[] = ["piece", "kg", "liter", "meter", "box"]
  return validUnits.includes(unit as UnitType) ? (unit as UnitType) : "piece"
}

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

type StockStatus =
  | "success"
  | "warning"
  | "destructive"
  | "secondary"

export function ProductDetailContainer() {
  const t = useTranslations();const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const { data: product, isLoading } = useProduct(id)
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()

  const [editing, setEditing] = useState(false)
  const [editName, setName] = useState("")
  const [editSellPrice, setSellPrice] = useState("")
  const [editBuyPrice, setBuyPrice] = useState("")
  const [editQuantity, setQuantity] = useState("")
  const [editMinStock, setMinStock] = useState("")
  const [editCategory, setCategory] = useState("general")
  const [editUnit, setUnit] = useState<UnitType>("piece")

  const getProduct = useCallback(
    (p: RawProduct) => ({
      name: p.name ?? "",
      sellPrice: num(p.sell_price ?? p.sellPrice),
      buyPrice: num(p.buy_price ?? p.buyPrice),
      quantity: num(p.quantity),
      minStockLevel: num(
        p.min_stock_level ?? p.minStockLevel ?? 5
      ),
      category: p.category ?? "general",
      unit: toUnitType(p.unit ?? "piece"),
    }),
    []
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
      category: editCategory as "general" | "food" | "electronics" | "clothing" | "construction" | "medicine",
      unit: editUnit,
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
    if (
      !confirm(
        t("warehouse.deleteConfirm")
      )
    )
      return
    await deleteProduct.mutateAsync(id!)
    router.push("/warehouse")
  }, [id, deleteProduct, router, t])

  const safeT = useCallback(
    (key: string, fallback?: string) => {
      const v = t(key)
      return v && v !== key ? v : (fallback ?? key)
    },
    [t]
  )

  const productData = useMemo(
    () => (product ? getProduct(product) : null),
    [product, getProduct]
  )

  const stockStatus: StockStatus = useMemo(() => {
    if (!productData) return "secondary"
    if (productData.quantity === 0) return "destructive"
    if (productData.quantity <= productData.minStockLevel)
      return "warning"
    return "success"
  }, [productData])

  const stockLabel = useMemo(() => {
    if (!productData) return ""
    if (productData.quantity === 0)
      return t("warehouse.outOfStock")
    if (productData.quantity <= productData.minStockLevel)
      return t("warehouse.lowStock")
    return t("warehouse.inStock")
  }, [productData, t])

  const profitPerUnit = productData
    ? productData.sellPrice - productData.buyPrice
    : 0

  const totalProfit = productData
    ? productData.quantity * profitPerUnit
    : 0

  const totalValue = productData
    ? productData.quantity * productData.sellPrice
    : 0

  const onSave = useCallback((data: ProductEditValues) => {
    // This will be called from ProductDetailPage with the edit values
    setName(data.name)
    setSellPrice(data.sellPrice.toString())
    setBuyPrice(data.buyPrice.toString())
    setQuantity(data.quantity.toString())
    setMinStock(data.minStockLevel.toString())
    setCategory(data.category)
    setUnit(data.unit)
    handleSave()
  }, [handleSave])

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
      profitPerUnit={profitPerUnit}
      totalProfit={totalProfit}
      totalValue={totalValue}
      onBack={() => router.back()}
      onStartEditing={startEditing}
      onCancelEditing={() => setEditing(false)}
      onSave={onSave}
      onDelete={handleDelete}
    />
  )
}