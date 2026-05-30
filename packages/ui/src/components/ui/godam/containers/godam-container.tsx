"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useProducts, useDeleteProduct, useRealtime } from "@hisabche/api"
import { useSyncStore, useBackupStore } from "@hisabche/store"
import { GodamPage, AddProductModal } from "@hisabche/ui"

const CURRENCIES = [
  { code: "AFN", label: "افغانی", rate: 1 },
  { code: "USD", label: "دالر", rate: 0.014 },
  { code: "IRR", label: "پومان", rate: 0.85 },
]

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const fmt = (v: unknown): string => num(v).toLocaleString("fa-AF")

export function GodamContainer() {
  const { t } = useTranslation()
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { data, isLoading } = useProducts({ page: 1, limit: 50, sortDirection: "desc", search })
  const deleteProduct = useDeleteProduct()
  const { setSaveStatus } = useSyncStore()
  const { moveToTrash } = useBackupStore()

  useRealtime({ table: 'products', queryKey: ['products'] })

  const products = (data?.products ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    quantity: num(p.quantity),
    sellPrice: num(p.sell_price ?? p.sellPrice),
    buyPrice: num(p.buy_price ?? p.buyPrice),
    minStockLevel: num(p.min_stock_level ?? p.minStockLevel ?? 5),
    unit: p.unit ?? t("godam.units.piece"),
    category: p.category ?? t("godam.categories.general"),
  }))

  const totalValue = products.reduce((sum: number, p: any) => sum + p.quantity * p.sellPrice, 0)
  const lowStock = products.filter((p: any) => p.quantity > 0 && p.quantity <= p.minStockLevel).length
  const outOfStock = products.filter((p: any) => p.quantity === 0).length

  const stockStatus = (qty: number, min: number): "success" | "warning" | "destructive" | "secondary" => {
    if (qty === 0) return "destructive"
    if (qty <= min) return "warning"
    return "success"
  }

  const stockLabel = (qty: number, min: number) => {
    if (qty === 0) return t("godam.outOfStock")
    if (qty <= min) return t("godam.lowStock")
    return t("godam.inStock")
  }

  const handleDelete = useCallback(async (product: any) => {
    if (!product.id) return
    setDeletingId(product.id)
    moveToTrash({ entity: 'product', entityId: product.id, data: JSON.stringify(product) })
    setSaveStatus('saving')
    await deleteProduct.mutateAsync(product.id)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
    setDeletingId(null)
  }, [deleteProduct, moveToTrash, setSaveStatus])

  const safeT = (key: string, fallback?: string) => {
    const v = t(key)
    return v && v !== key ? v : (fallback ?? key)
  }

  return (
    <>
      {showAddModal && <AddProductModal open={showAddModal} onClose={() => setShowAddModal(false)} />}
      <GodamPage
        t={safeT}
        search={search}
        onSearchChange={setSearch}
        showAddModal={showAddModal}
        onOpenAddModal={() => setShowAddModal(true)}
        onCloseAddModal={() => setShowAddModal(false)}
        deletingId={deletingId}
        products={products}
        total={data?.total || 0}
        isLoading={isLoading}
        totalValue={totalValue}
        lowStock={lowStock}
        outOfStock={outOfStock}
        currencies={CURRENCIES}
        onNavigate={(id) => router.push(`/godam/${id}`)}
        onDelete={handleDelete}
        stockStatus={stockStatus}
        stockLabel={stockLabel}
        fmt={fmt}
      />
    </>
  )
}