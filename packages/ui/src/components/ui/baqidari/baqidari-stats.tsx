// packages/ui/src/components/ui/baqidari/baqidari-stats.tsx
"use client"

import { Card, CardContent } from "../card"
import { TrendingUp, DollarSign, TrendingDown } from "lucide-react"

interface BaqidariStatsProps {
  t: (key: string, fallback?: string) => string
  debtorCount: number
  totalDebt: number
  openDealsCount: number
  fmt: (v: number) => string
}

export function BaqidariStats({ t, debtorCount, totalDebt, openDealsCount, fmt }: BaqidariStatsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card className="glass-card bg-gradient-to-br from-rose-500/10 to-rose-500/[0.02] border-border">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10">
            <TrendingUp className="size-5 text-rose-500" aria-hidden />
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums text-foreground">
              {debtorCount}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("baqidari.debtorCount", "تعداد بدهکاران")}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card bg-gradient-to-br from-rose-500/10 to-rose-500/[0.02] border-border">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10">
            <DollarSign className="size-5 text-rose-500" aria-hidden />
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums text-foreground">
              {fmt(totalDebt)}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("baqidari.totalDebt", "مجموع بدهی")} (AFN)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card bg-gradient-to-br from-amber-500/10 to-amber-500/[0.02] border-border">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
            <TrendingDown className="size-5 text-amber-500" aria-hidden />
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums text-foreground">
              {openDealsCount}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("baqidari.openDeals", "معاملات باز")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}