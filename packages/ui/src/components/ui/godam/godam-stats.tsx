// packages/ui/src/components/ui/godam/godam-stats.tsx
"use client"

import { StockStatsCard } from "../stock-stats-card"
import { Package, AlertTriangle, DollarSign } from "lucide-react"

interface GodamStatsProps {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  total: number
  lowStock: number
  outOfStock: number
  totalValue: number
}

export function GodamStats({ t, fmt, total, lowStock, outOfStock, totalValue }: GodamStatsProps) {
  return (
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
  )
}