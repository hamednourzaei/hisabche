"use client"

import { Package, AlertTriangle, DollarSign, type LucideIcon } from "lucide-react"
import { Skeleton } from "../skeleton"

type Tone = "emerald" | "amber" | "rose" | "purple" | "blue" | "teal"

const TONE_BG: Record<Tone, string> = {
  emerald: "from-emerald-500/10 to-emerald-500/[0.02]",
  amber: "from-amber-500/10 to-amber-500/[0.02]",
  rose: "from-rose-500/10 to-rose-500/[0.02]",
  purple: "from-purple-500/10 to-purple-500/[0.02]",
  blue: "from-blue-500/10 to-blue-500/[0.02]",
  teal: "from-teal-500/10 to-teal-500/[0.02]",
}

const TONE_ICON: Record<Tone, string> = {
  emerald: "bg-emerald-500/15 text-emerald-500",
  amber: "bg-amber-500/15 text-amber-500",
  rose: "bg-rose-500/15 text-rose-500",
  purple: "bg-purple-500/15 text-purple-500",
  blue: "bg-blue-500/15 text-blue-500",
  teal: "bg-teal-500/15 text-teal-500",
}

interface GodamStatCardProps {
  label: string
  value: string | number
  hint?: string | undefined  // ✅ اضافه کردن | undefined
  Icon: LucideIcon
  tone: Tone
  onClick?: () => void
  isLoading?: boolean
}

function GodamStatCard({
  label,
  value,
  hint,
  Icon,
  tone,
  onClick,
  isLoading = false,
}: GodamStatCardProps) {
  const Wrap = onClick ? "button" : "div"
  return (
    <Wrap
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={`group relative overflow-hidden rounded-xl p-5 text-start motion-safe:transition-all motion-safe:hover:-translate-y-0.5 ${
        onClick ? "cursor-pointer" : "cursor-default"
      } bg-gradient-to-br ${TONE_BG[tone]} border border-white/10`}
    >
      <div className="mb-4 flex items-center justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${TONE_ICON[tone]}`}
        >
          <Icon className="size-5" aria-hidden />
        </div>
      </div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      {isLoading ? (
        <Skeleton className="h-8 w-32 rounded-lg" />
      ) : (
        <p className="text-2xl font-bold tabular-nums sm:text-3xl text-foreground">
          {value}
        </p>
      )}
      {hint && <p className="mt-1.5 text-[10px] text-muted-foreground">{hint}</p>}
    </Wrap>
  )
}

interface GodamStatsProps {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  total: number
  lowStock: number
  outOfStock: number
  totalValue: number
  isLoading?: boolean
}

export function GodamStats({ 
  t, 
  fmt, 
  total, 
  lowStock, 
  outOfStock, 
  totalValue, 
  isLoading = false
}: GodamStatsProps) {
  // تعیین رنگ بر اساس مقدار موجودی کم
  const getLowStockTone = (value: number): Tone => {
    if (value === 0) return "emerald"
    if (value < 5) return "rose"
    if (value < 15) return "amber"
    return "blue"
  }

  // تعیین رنگ بر اساس مقدار ناموجود
  const getOutOfStockTone = (value: number): Tone => {
    if (value === 0) return "emerald"
    if (value > 20) return "rose"
    if (value > 10) return "amber"
    return "teal"
  }

  // تعیین رنگ بر اساس ارزش کل
  const getTotalValueTone = (value: number): Tone => {
    if (value > 1000000) return "emerald"
    if (value > 500000) return "blue"
    if (value > 100000) return "teal"
    return "purple"
  }

  return (
    <div className="godam-stats-grid">
      {/* کل محصولات - همیشه بنفش */}
      <GodamStatCard
        label={t("godam.totalProducts", "کل محصولات")}
        value={total}
        Icon={Package}
        tone="purple"
        isLoading={isLoading}
      />

      {/* موجودی کم - رنگ بر اساس مقدار */}
      <GodamStatCard
        label={t("godam.lowStock", "موجودی کم")}
        value={lowStock}
        Icon={AlertTriangle}
        tone={getLowStockTone(lowStock)}
        hint={lowStock === 0 ? t("godam.noLowStock", "هیچ محصولی با موجودی کم نیست") : undefined}
        isLoading={isLoading}
      />

      {/* ناموجود - رنگ بر اساس مقدار */}
      <GodamStatCard
        label={t("godam.outOfStock", "ناموجود")}
        value={outOfStock}
        Icon={AlertTriangle}
        tone={getOutOfStockTone(outOfStock)}
        hint={outOfStock === 0 ? t("godam.noOutOfStock", "هیچ محصول ناموجودی نیست") : undefined}
        isLoading={isLoading}
      />

      {/* ارزش کل - رنگ بر اساس مقدار */}
      <GodamStatCard
        label={t("godam.totalValue", "ارزش کل (AFN)")}
        value={fmt(totalValue)}
        Icon={DollarSign}
        tone={getTotalValueTone(totalValue)}
        isLoading={isLoading}
      />
    </div>
  )
}