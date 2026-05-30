"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useProducts, useDeleteProduct, useRealtime } from "@hisabche/api"
import { Button, Badge, Card, CardContent, Input, EmptyState, AddProductModal, StockStatsCard, SaveIndicator } from "@hisabche/ui"
import { Plus, Search, Trash2, Package, AlertTriangle, DollarSign, Eye } from "lucide-react"
import { useSyncStore, useBackupStore } from "@hisabche/store"

interface Product {
  id: string; name: string; quantity: number | string
  sell_price?: number | string; sellPrice?: number | string
  buy_price?: number | string; buyPrice?: number | string
  min_stock_level?: number | string; minStockLevel?: number | string
  unit?: string; category?: string
}

interface Currency { code: string; label: string; rate: number }

const CURRENCIES: Currency[] = [
  { code: "AFN", label: "افغانی", rate: 1 },
  { code: "USD", label: "دلار", rate: 0.014 },
  { code: "IRR", label: "تومان", rate: 0.85 },
]
useRealtime({ table: 'products', queryKey: ['products'] })
const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const fmt = (v: unknown): string => num(v).toLocaleString("fa-AF")

export function GodamPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { data, isLoading } = useProducts({ page: 1, limit: 50, sortDirection: "desc", search })
  const deleteProduct = useDeleteProduct()
  const { setSaveStatus } = useSyncStore()
  const { moveToTrash } = useBackupStore()

  const totalValue = (data?.products as Product[] | undefined)?.reduce((sum: number, p: Product) => sum + num(p.quantity) * num(p.sell_price ?? p.sellPrice), 0) || 0
  const lowStock = (data?.products as Product[] | undefined)?.filter((p: Product) => { const q = num(p.quantity); const m = num(p.min_stock_level ?? p.minStockLevel ?? 5); return q > 0 && q <= m }).length || 0
  const outOfStock = (data?.products as Product[] | undefined)?.filter((p: Product) => num(p.quantity) === 0).length || 0

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

  const handleDelete = useCallback(async (e: React.MouseEvent, product: Product) => {
    e.stopPropagation()
    if (!product.id) return
    setDeletingId(product.id)
    
    // ═══ Move to trash before delete ═══
    moveToTrash({
      entity: 'product',
      entityId: product.id,
      data: JSON.stringify(product),
    })
    
    // ═══ Save indicator ═══
    setSaveStatus('saving')
    await deleteProduct.mutateAsync(product.id)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
    setDeletingId(null)
  }, [deleteProduct, moveToTrash, setSaveStatus])

  return (
    <div className="space-y-6">
      <SaveIndicator show={deletingId !== null} message={t("common.saved", "حذف شد")} />
      <AddProductModal open={showAddModal} onClose={() => setShowAddModal(false)} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("godam.title")}</h1>
          <p className="mt-1 text-sm text-[var(--hisab-muted-fg)]">{t("godam.description", "مدیریت محصولات و موجودی انبار")}</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} icon={<Plus className="size-4" />}>{t("godam.addProduct")}</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StockStatsCard value={data?.total || 0} label={t("godam.totalProducts")} icon={Package} color="var(--hisab-primary)" />
        <StockStatsCard value={lowStock} label={t("godam.lowStock")} icon={AlertTriangle} color="var(--hisab-warning)" />
        <StockStatsCard value={outOfStock} label={t("godam.outOfStock")} icon={AlertTriangle} color="var(--hisab-destructive)" />
        <StockStatsCard value={fmt(totalValue)} label={t("godam.totalValue", "ارزش کل (AFN)")} icon={DollarSign} color="var(--hisab-success)" />
      </div>

      <div className="flex gap-2 text-xs text-[var(--hisab-muted-fg)]">
        {CURRENCIES.map((c: Currency) => (
          <span key={c.code} className="bg-[var(--hisab-muted)] px-2 py-1 rounded-lg">{c.label}: {fmt(totalValue * c.rate)}</span>
        ))}
      </div>

      <Input placeholder={`${t("action.search")}...`} leftIcon={<Search className="size-4" />} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton-shimmer h-16" />
          ))}
        </div>
      ) : (data?.products as Product[] | undefined)?.length === 0 ? (
        <EmptyState icon="product" title={t("godam.noProducts", "هیچ محصولی موجود نیست")} description={t("godam.noProductsDesc", "اولین محصول خود را اضافه کنید")} action={{ label: t("godam.addProduct"), onClick: () => setShowAddModal(true) }} />
      ) : (
        <div className="space-y-3">
          {(data?.products as Product[] | undefined)?.map((product: Product) => {
            const qty = num(product.quantity); const min = num(product.min_stock_level ?? product.minStockLevel ?? 5)
            const sellPrice = num(product.sell_price ?? product.sellPrice); const buyPrice = num(product.buy_price ?? product.buyPrice)
            const unit = product.unit ?? t("godam.units.piece"); const category = product.category ?? t("godam.categories.general")

            return (
              <div key={product.id} onClick={() => router.push(`/godam/${product.id}`)} className="cursor-pointer">
                <Card className="interactive-card">
                  <CardContent className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--hisab-muted)]">
                        <Package className="size-5 text-[var(--hisab-muted-fg)]" />
                      </div>
                      <div>
                        <p className="font-semibold">{product.name}</p>
                        <p className="text-xs text-[var(--hisab-muted-fg)]">{category} · {unit} · {t("godam.buyPrice")}: {fmt(buyPrice)} AFN</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-end">
                        <p className="font-bold">{fmt(sellPrice)} AFN</p>
                        <Badge variant={stockStatus(qty, min)} size="sm">{stockLabel(qty, min)} ({qty})</Badge>
                      </div>
                      <button className="ghost-btn" onClick={(e) => { e.stopPropagation(); router.push(`/godam/${product.id}`) }}><Eye className="size-4" /></button>
                      <button className="ghost-btn ghost-danger" onClick={(e) => handleDelete(e, product)} disabled={deletingId === product.id}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}