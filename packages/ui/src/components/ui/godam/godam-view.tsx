// packages/ui/src/components/ui/godam/godam-view.tsx
"use client"

import { Button } from "../button"
import { Input } from "../input"
import { EmptyState } from "../empty-state"
import { SaveIndicator } from "../save-indicator"
import { Plus, Search } from "lucide-react"
import { GodamStats } from "./godam-stats"
import { GodamProductList } from "./godam-product-list"
import type { Product, Currency } from "../../../lib/godam/godam-types"

interface GodamViewProps {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  search: string
  onSearchChange: (value: string) => void
  onOpenAddModal: () => void
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
  stockStatus: (qty: number, min: number) => "success" | "warning" | "destructive" | "secondary"
  stockLabel: (qty: number, min: number) => string
}

export function GodamView({
  t,
  fmt,
  search,
  onSearchChange,
  onOpenAddModal,
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
}: GodamViewProps) {
  return (
    <div className="space-y-6">
      <SaveIndicator show={deletingId !== null} message={t("common.saved", "حفظ شد")} />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold sm:text-3xl text-foreground">
            {t("godam.title", "انبار")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("godam.description", "مدیریت محصولات و موجودی انبار")}
          </p>
        </div>
        <Button onClick={onOpenAddModal} className="shimmer-btn gap-2">
          <Plus className="size-4" aria-hidden />
          {t("godam.addProduct", "افزودن محصول")}
        </Button>
      </div>

      {/* Stats */}
      <GodamStats
        t={t}
        fmt={fmt}
        total={total}
        lowStock={lowStock}
        outOfStock={outOfStock}
        totalValue={totalValue}
      />

      {/* Currency chips */}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {currencies.map((c) => (
          <span key={c.code} className="rounded-lg bg-muted px-2 py-1">
            {c.label}: {fmt(totalValue * c.rate)}
          </span>
        ))}
      </div>

      {/* Search */}
      <div className="max-w-sm">
        <Input
          placeholder={`${t("action.search", "جستجو")}...`}
          leftIcon={<Search className="size-4" aria-hidden />}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Product list or empty state */}
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
          description={t("godam.noProductsDesc", "اولین محصول خود را اضافه کنید")}
          action={{ label: t("godam.addProduct", "افزودن محصول"), onClick: onOpenAddModal }}
        />
      ) : (
        <GodamProductList
          t={t}
          fmt={fmt}
          products={products}
          stockStatus={stockStatus}
          stockLabel={stockLabel}
          onNavigate={onNavigate}
          onDelete={onDelete}
          deletingId={deletingId}
        />
      )}
    </div>
  )
}