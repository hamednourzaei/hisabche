"use client"

import { useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useProduct, useUpdateProduct, useDeleteProduct } from "@hisabche/api"
import { ProductDetailPage } from "../godam-detail-page"

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const fmt = (v: unknown): string => num(v).toLocaleString("fa-AF")

interface Product {
  name?: string; sell_price?: number | string; sellPrice?: number | string
  buy_price?: number | string; buyPrice?: number | string
  quantity?: number | string; min_stock_level?: number | string; minStockLevel?: number | string
  category?: string; unit?: string
}

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

  const getProduct = useCallback((p: Product) => ({
    name: p.name ?? "", sellPrice: num(p.sell_price ?? p.sellPrice), buyPrice: num(p.buy_price ?? p.buyPrice),
    quantity: num(p.quantity), minStockLevel: num(p.min_stock_level ?? p.minStockLevel ?? 5),
    category: p.category ?? "general", unit: p.unit ?? "piece",
  }), [])

  const startEditing = useCallback(() => {
    if (!product) return
    const p = getProduct(product)
    setName(p.name); setSellPrice(p.sellPrice.toString()); setBuyPrice(p.buyPrice.toString())
    setQuantity(p.quantity.toString()); setMinStock(p.minStockLevel.toString())
    setCategory(p.category); setUnit(p.unit); setEditing(true)
  }, [product, getProduct])

  const handleSave = useCallback(async () => {
    await updateProduct.mutateAsync({
      id: id!, name: editName.trim(), sellPrice: num(editSellPrice), buyPrice: num(editBuyPrice),
      quantity: Math.floor(num(editQuantity)), minStockLevel: Math.floor(num(editMinStock)) || 5,
      category: editCategory as any, unit: editUnit as any,
    })
    setEditing(false)
  }, [id, editName, editSellPrice, editBuyPrice, editQuantity, editMinStock, editCategory, editUnit, updateProduct])

  const handleDelete = useCallback(async () => {
    if (!confirm(t("godam.deleteConfirm", "آیا از حذف این محصول اطمینان دارید؟"))) return
    await deleteProduct.mutateAsync(id!)
    router.push("/godam")
  }, [id, deleteProduct, router, t])

  const safeT = (key: string, fallback?: string) => { const v = t(key); return v && v !== key ? v : (fallback ?? key) }

  const p = product ? getProduct(product) : null
  const stockStatus: "success" | "warning" | "destructive" | "secondary" = !p ? "secondary" : p.quantity === 0 ? "destructive" : p.quantity <= p.minStockLevel ? "warning" : "success"
  const stockLabel = !p ? "" : p.quantity === 0 ? t("godam.outOfStock") : p.quantity <= p.minStockLevel ? t("godam.lowStock") : t("godam.inStock")
  const profitPerUnit = p ? p.sellPrice - p.buyPrice : 0
  const totalProfit = p ? p.quantity * profitPerUnit : 0
  const totalValue = p ? p.quantity * p.sellPrice : 0

  const editValues = {
    name: editName, sellPrice: editSellPrice, buyPrice: editBuyPrice,
    quantity: editQuantity, minStockLevel: editMinStock, category: editCategory, unit: editUnit,
  }

  const handleEditValueChange = (field: string, value: string) => {
    const setters: Record<string, (v: string) => void> = {
      name: setName, sellPrice: setSellPrice, buyPrice: setBuyPrice,
      quantity: setQuantity, minStockLevel: setMinStock, category: setCategory, unit: setUnit,
    }
    setters[field]?.(value)
  }

  return (
    <ProductDetailPage
      t={safeT}
      fmt={fmt}
      isLoading={isLoading}
      product={p}
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