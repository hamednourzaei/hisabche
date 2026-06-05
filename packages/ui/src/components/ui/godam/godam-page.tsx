"use client"

import { Button } from "../button"
import { Badge } from "../badge"
import { Card, CardContent } from "../card"
import { Input } from "../input"
import { EmptyState } from "../empty-state"
import { StockStatsCard } from "../stock-stats-card"
import { SaveIndicator } from "../save-indicator"
import {
  Plus,
  Search,
  Trash2,
  Package,
  AlertTriangle,
  DollarSign,
  Eye,
} from "lucide-react"

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
  t: (key: string, fallback?: string) => string
  search: string
  onSearchChange: (value: string) => void
  showAddModal: boolean
  onOpenAddModal: () => void
  onCloseAddModal: () => void
  deletingId: string | null
  products: Product[]
  total: number
  isLoading: boolean
  totalValue: number
  lowStock: number
  outOfStock: number
  currencies: Currency[]
  onNavigate: (id: string) => void
  onDelete: (product: Product) => void
  stockStatus: (
    qty: number,
    min: number
  ) => "success" | "warning" | "destructive" | "secondary"
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
      <SaveIndicator
        show={deletingId !== null}
        message={t("common.saved", "حفظ شد")}
      />

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold sm:text-3xl text-foreground">
            {t("godam.title", "انبار")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("godam.description", "مدیریت محصولات و موجودی انبار")}
          </p>
        </div>
        <Button
          onClick={onOpenAddModal}
          className="shimmer-btn gap-2"
        >
          <Plus className="size-4" aria-hidden />
          {t("godam.addProduct", "افزودن محصول")}
        </Button>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StockStatsCard
          value={total}
          label={t("godam.totalProducts", "کل محصولات")}
          icon={Package}
          color="hsl(var(--primary))"
        />
        <StockStatsCard
          value={lowStock}
          label={t("godam.lowStock", "موجودی کم")}
          icon={AlertTriangle}
          color="hsl(var(--warning))"
        />
        <StockStatsCard
          value={outOfStock}
          label={t("godam.outOfStock", "ناموجود")}
          icon={AlertTriangle}
          color="hsl(var(--destructive))"
        />
        <StockStatsCard
          value={fmt(totalValue)}
          label={t("godam.totalValue", "ارزش کل (AFN)")}
          icon={DollarSign}
          color="hsl(var(--success))"
        />
      </div>

      {/* ── Currency chips ── */}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {currencies.map((c) => (
          <span
            key={c.code}
            className="rounded-lg bg-muted px-2 py-1"
          >
            {c.label}: {fmt(totalValue * c.rate)}
          </span>
        ))}
      </div>

      {/* ── Search ── */}
      <div className="max-w-sm">
        <Input
          placeholder={`${t("action.search", "جستجو")}...`}
          leftIcon={<Search className="size-4" aria-hidden />}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* ── Product list ── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton-shimmer h-16 rounded-2xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon="product"
          title={t("godam.noProducts", "هیچ محصولی موجود نیست")}
          description={t(
            "godam.noProductsDesc",
            "اولین محصول خود را اضافه کنید"
          )}
          action={{
            label: t("godam.addProduct", "افزودن محصول"),
            onClick: onOpenAddModal,
          }}
        />
      ) : (
        <div className="space-y-3">
          {products.map((product) => {
            const qty = product.quantity
            const min = product.minStockLevel

            return (
              <div
                key={product.id}
                onClick={() => onNavigate(product.id)}
                className="cursor-pointer"
              >
                <Card className="interactive-card border-border transition-all hover:border-primary/30">
                  <CardContent className="flex items-center justify-between p-5">
                    <div className="flex min-w-0 flex-1 items-center gap-4 text-start">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <Package
                          className="size-5 text-muted-foreground"
                          aria-hidden
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">
                          {product.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {product.category} · {product.unit} ·{" "}
                          {t("godam.buyPrice", "قیمت خرید")}: {fmt(product.buyPrice)} AFN
                        </p>
                      </div>
                    </div>
                    <div className="ms-3 flex shrink-0 items-center gap-4">
                      <div className="text-end">
                        <p className="font-bold tabular-nums text-foreground">
                          {fmt(product.sellPrice)} AFN
                        </p>
                        <Badge variant={stockStatus(qty, min)}>
                          {stockLabel(qty, min)} ({qty})
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          onNavigate(product.id)
                        }}
                        aria-label={t("action.view", "مشاهده")}
                      >
                        <Eye className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(product)
                        }}
                        disabled={deletingId === product.id}
                        aria-label={t("action.delete", "حذف")}
                        className="hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
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