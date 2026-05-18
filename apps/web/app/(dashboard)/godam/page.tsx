"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useProducts, useDeleteProduct } from "@hisabche/api"
import { Button, Badge, Card, CardContent, Input, EmptyState, AddProductModal, StockStatsCard } from "@hisabche/ui"
import { Plus, Search, Trash2, Package, AlertTriangle, DollarSign, Eye } from "lucide-react"

const CURRENCIES = [
  { code: "AFN", label: "افغانی", rate: 1 },
  { code: "USD", label: "دلار", rate: 0.014 },
  { code: "IRR", label: "تومان", rate: 0.85 },
]

const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const fmt = (v: any) => num(v).toLocaleString("fa-AF")

export default function GodamPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const { data, isLoading } = useProducts({ page: 1, limit: 50, sortDirection: "desc", search })
  const deleteProduct = useDeleteProduct()

  const totalValue = data?.products?.reduce((sum: number, p: any) => {
    const qty = num(p.quantity)
    const price = num(p.sell_price ?? p.sellPrice)
    return sum + qty * price
  }, 0) || 0

  const lowStock = data?.products?.filter((p: any) => {
    const qty = num(p.quantity)
    const min = num(p.min_stock_level ?? p.minStockLevel ?? 5)
    return qty > 0 && qty <= min
  }).length || 0

  const outOfStock = data?.products?.filter((p: any) => num(p.quantity) === 0).length || 0

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

  return (
    <div className="space-y-6">
      <AddProductModal open={showAddModal} onClose={() => setShowAddModal(false)} />

      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--hisab-foreground)]">{t("godam.title")}</h1>
          <p className="mt-1 text-sm text-[var(--hisab-muted-fg)]">مدیریت محصولات و موجودی انبار</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} icon={<Plus className="size-4" />}>
          {t("godam.addProduct")}
        </Button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StockStatsCard value={data?.total || 0} label={t("godam.totalProducts")} icon={Package} color="var(--hisab-primary)" />
        <StockStatsCard value={lowStock} label={t("godam.lowStock")} icon={AlertTriangle} color="var(--hisab-warning)" />
        <StockStatsCard value={outOfStock} label={t("godam.outOfStock")} icon={AlertTriangle} color="var(--hisab-destructive)" />
        <StockStatsCard value={fmt(totalValue)} label="ارزش کل (AFN)" icon={DollarSign} color="var(--hisab-success)" />
      </div>

      {/* Multi-currency */}
      <div className="flex gap-2 text-xs text-[var(--hisab-muted-fg)]">
        {CURRENCIES.map((c) => (
          <span key={c.code} className="bg-[var(--hisab-muted)] px-2 py-1 rounded-lg">
            {c.label}: {fmt(totalValue * c.rate)}
          </span>
        ))}
      </div>

      {/* SEARCH */}
      <Input
        placeholder={`${t("action.search")}...`}
        leftIcon={<Search className="size-4" />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* LIST */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--hisab-muted)]" />
          ))}
        </div>
      ) : data?.products?.length === 0 ? (
        <EmptyState
          icon="product"
          title={t("godam.noProducts", { defaultValue: "هیچ محصولی موجود نیست" })}
          description="اولین محصول خود را اضافه کنید تا موجودی انبار را مدیریت کنید."
          action={{ label: t("godam.addProduct"), onClick: () => setShowAddModal(true) }}
        />
      ) : (
        <div className="space-y-3">
          {data?.products?.map((product: any) => {
            const qty = num(product.quantity)
            const min = num(product.min_stock_level ?? product.minStockLevel ?? 5)
            const sellPrice = num(product.sell_price ?? product.sellPrice)
            const buyPrice = num(product.buy_price ?? product.buyPrice)
            const unit = product.unit ?? "عدد"
            const category = product.category ?? "عمومی"

            return (
              <div
                key={product.id}
                onClick={() => router.push(`/godam/${product.id}`)}
                className="cursor-pointer"
              >
                <Card className="transition-shadow hover:shadow-[var(--hisab-shadow-sm)]">
                  <CardContent className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--hisab-muted)]">
                        <Package className="size-5 text-[var(--hisab-muted-fg)]" />
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--hisab-foreground)]">{product.name}</p>
                        <p className="text-xs text-[var(--hisab-muted-fg)]">
                          {category} · {unit} · خرید: {fmt(buyPrice)} AFN
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-end">
                        <p className="font-bold text-[var(--hisab-foreground)]">
                          {fmt(sellPrice)} AFN
                        </p>
                        <Badge variant={stockStatus(qty, min)} size="sm">
                          {stockLabel(qty, min)} ({qty})
                        </Badge>
                      </div>
                      <button
                        className="inline-flex items-center justify-center size-9 rounded-lg hover:bg-[var(--hisab-muted)] transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/godam/${product.id}`)
                        }}
                      >
                        <Eye className="size-4" />
                      </button>
                      <button
                        className="inline-flex items-center justify-center size-9 rounded-lg hover:bg-[var(--hisab-muted)] transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteProduct.mutate(product.id)
                        }}
                      >
                        <Trash2 className="size-4 text-[var(--hisab-destructive)]" />
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