// packages/ui/src/components/ui/godam/godam-product-list.tsx
"use client"

import { Card, CardContent } from "../card"
import { Button } from "../button"
import { Badge } from "../badge"
import { Package, Eye, Trash2 } from "lucide-react"
import type { Product } from "../../../lib/godam/godam-types"

interface GodamProductListProps {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  products: Product[]
  stockStatus: (qty: number, min: number) => "success" | "warning" | "destructive" | "secondary"
  stockLabel: (qty: number, min: number) => string
  onNavigate: (id: string) => void
  onDelete: (product: Product) => void
  deletingId: string | null
}

export function GodamProductList({
  t,
  fmt,
  products,
  stockStatus,
  stockLabel,
  onNavigate,
  onDelete,
  deletingId,
}: GodamProductListProps) {
  return (
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
                    <Package className="size-5 text-muted-foreground" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{product.name}</p>
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
  )
}