"use client"

import { useState, useCallback, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import {
  useProduct,
  useUpdateProduct,
  useDeleteProduct,
} from "@hisabche/api"
import { ProductDetailPage } from "../godam-detail-page"

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const fmt = (v: unknown): string => num(v).toLocaleString("fa-AF")

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
  const { t } = useTranslation()
  const router = useRouter()
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
  const [editUnit, setUnit] = useState("piece")

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
      unit: p.unit ?? "piece",
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
    unit: editUnit as "piece" | "kg" | "meter" | "liter" | "box" | "pack",
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
        t(
          "godam.deleteConfirm",
          "آیا از حذف این محصول اطمینان دارید؟"
        )
      )
    )
      return
    await deleteProduct.mutateAsync(id!)
    router.push("/godam")
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
      return t("godam.outOfStock")
    if (productData.quantity <= productData.minStockLevel)
      return t("godam.lowStock")
    return t("godam.inStock")
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

  const editValues = useMemo(
    () => ({
      name: editName,
      sellPrice: editSellPrice,
      buyPrice: editBuyPrice,
      quantity: editQuantity,
      minStockLevel: editMinStock,
      category: editCategory,
      unit: editUnit,
    }),
    [
      editName,
      editSellPrice,
      editBuyPrice,
      editQuantity,
      editMinStock,
      editCategory,
      editUnit,
    ]
  )

  const handleEditValueChange = useCallback(
    (field: string, value: string) => {
      const setters: Record<string, (v: string) => void> = {
        name: setName,
        sellPrice: setSellPrice,
        buyPrice: setBuyPrice,
        quantity: setQuantity,
        minStockLevel: setMinStock,
        category: setCategory,
        unit: setUnit,
      }
      setters[field]?.(value)
    },
    []
  )

  return (
    <ProductDetailPage
      t={safeT}
      fmt={fmt}
      isLoading={isLoading}
      product={productData}
      editing={editing}
      editValues={editValues}
      updatePending={updateProduct.isPending}
      stockStatus={stockStatus}
      stockLabel={stockLabel}
      profitPerUnit={profitPerUnit}
      totalProfit={totalProfit}
      totalValue={totalValue}
      onBack={() => router.back()}
      onStartEditing={startEditing}
      onCancelEditing={() => setEditing(false)}
      onSave={handleSave}
      onDelete={handleDelete}
      onEditValueChange={handleEditValueChange}
    />
  )
}