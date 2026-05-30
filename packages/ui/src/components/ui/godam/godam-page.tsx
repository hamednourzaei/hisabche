"use client"

import { Button, Badge, Card, CardContent, Input, EmptyState, StockStatsCard, SaveIndicator } from "@hisabche/ui"
import { Plus, Search, Trash2, Package, AlertTriangle, DollarSign, Eye } from "lucide-react"

interface Product {
  id: string
  name: string
  quantity: number
  sellPrice: number
  buyPrice: number
  minStockLevel: number
  unit: string
  category: string
}

interface Currency {
  code: string
  label: string
  rate: number
}

export interface GodamPageProps {
  // i18n
  t: (key: string, fallback?: string) => string
  // state
  search: string
  onSearchChange: (value: string) => void
  showAddModal: boolean
  onOpenAddModal: () => void
  onCloseAddModal: () => void
  deletingId: string | null
  // data
  products: Product[]
  total: number
  isLoading: boolean
  totalValue: number
  lowStock: number
  outOfStock: number
  currencies: Currency[]
  // actions
  onNavigate: (id: string) => void
  onDelete: (product: Product) => void
  stockStatus: (qty: number, min: number) => "success" | "warning" | "destructive" | "secondary"
  stockLabel: (qty: number, min: number) => string
  fmt: (v: number) => string
}

export function GodamPage({
  t,
  search,
  onSearchChange,
  showAddModal,
  onOpenAddModal,
  onCloseAddModal,
  deletingId,
  products,
  total,
  isLoading,
  totalValue,
  lowStock,
  outOfStock,
  currencies,
  onNavigate,
  onDelete,
  stockStatus,
  stockLabel,
  fmt,
}: GodamPageProps) {
  return (
    <div className="space-y-6">
      <SaveIndicator show={deletingId !== null} message={t("common.saved", "حفظ شد")} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("godam.title")}</h1>
          <p className="mt-1 text-sm text-[var(--hisab-muted-fg)]">{t("godam.description", "مدیریت محصولات و موجودی انبار")}</p>
        </div>
        <Button onClick={onOpenAddModal} icon={<Plus className="size-4" />}>{t("godam.addProduct")}</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StockStatsCard value={total} label={t("godam.totalProducts")} icon={Package} color="var(--hisab-primary)" />
        <StockStatsCard value={lowStock} label={t("godam.lowStock")} icon={AlertTriangle} color="var(--hisab-warning)" />
        <StockStatsCard value={outOfStock} label={t("godam.outOfStock")} icon={AlertTriangle} color="var(--hisab-destructive)" />
        <StockStatsCard value={fmt(totalValue)} label={t("godam.totalValue", "ارزش کل (AFN)")} icon={DollarSign} color="var(--hisab-success)" />
      </div>

      <div className="flex gap-2 text-xs text-[var(--hisab-muted-fg)]">
        {currencies.map((c) => (
          <span key={c.code} className="bg-[var(--hisab-muted)] px-2 py-1 rounded-lg">{c.label}: {fmt(totalValue * c.rate)}</span>
        ))}
      </div>

      <Input placeholder={`${t("action.search")}...`} leftIcon={<Search className="size-4" />} value={search} onChange={(e) => onSearchChange(e.target.value)} className="max-w-sm" />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton-shimmer h-16 rounded-2xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState icon="product" title={t("godam.noProducts", "هیچ محصولی موجود نیست")} description={t("godam.noProductsDesc", "اولین محصول خود را اضافه کنید")} action={{ label: t("godam.addProduct"), onClick: onOpenAddModal }} />
      ) : (
        <div className="space-y-3">
          {products.map((product) => {
            const qty = product.quantity
            const min = product.minStockLevel

            return (
              <div key={product.id} onClick={() => onNavigate(product.id)} className="cursor-pointer">
                <Card className="interactive-card">
                  <CardContent className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--hisab-muted)]">
                        <Package className="size-5 text-[var(--hisab-muted-fg)]" />
                      </div>
                      <div>
                        <p className="font-semibold">{product.name}</p>
                        <p className="text-xs text-[var(--hisab-muted-fg)]">{product.category} · {product.unit} · {t("godam.buyPrice")}: {fmt(product.buyPrice)} AFN</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-end">
                        <p className="font-bold">{fmt(product.sellPrice)} AFN</p>
                        <Badge variant={stockStatus(qty, min)} size="sm">{stockLabel(qty, min)} ({qty})</Badge>
                      </div>
                      <button className="ghost-btn" onClick={(e) => { e.stopPropagation(); onNavigate(product.id) }}><Eye className="size-4" /></button>
                      <button className="ghost-btn ghost-danger" onClick={(e) => { e.stopPropagation(); onDelete(product) }} disabled={deletingId === product.id}>
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