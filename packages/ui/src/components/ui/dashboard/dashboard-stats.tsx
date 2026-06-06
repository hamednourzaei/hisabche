// packages/ui/src/components/ui/dashboard/dashboard-stats.tsx
"use client"

import { Skeleton } from "../skeleton"
import { ArrowUpRight, type LucideIcon } from "lucide-react"

type Tone = "emerald" | "amber" | "rose"

const TONE_BG: Record<Tone, string> = {
  emerald: "from-emerald-500/10 to-emerald-500/[0.02]",
  amber: "from-amber-500/10 to-amber-500/[0.02]",
  rose: "from-rose-500/10 to-rose-500/[0.02]",
}

const TONE_ICON: Record<Tone, string> = {
  emerald: "bg-emerald-500/15 text-emerald-500",
  amber: "bg-amber-500/15 text-amber-500",
  rose: "bg-rose-500/15 text-rose-500",
}

interface StatCardProps {
  label: string
  value: string
  hint?: string
  Icon: LucideIcon
  tone: Tone
  onClick?: () => void
  isLoading?: boolean
}

export function StatCard({
  label,
  value,
  hint,
  Icon,
  tone,
  onClick,
  isLoading,
}: StatCardProps) {
  const Wrap = onClick ? "button" : "div"
  return (
    <Wrap
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={`glass-card group relative overflow-hidden rounded-xl p-5 text-start motion-safe:transition-all motion-safe:hover:-translate-y-0.5 ${
        onClick ? "cursor-pointer" : "cursor-default"
      } bg-gradient-to-br ${TONE_BG[tone]} border border-white/10`}
    >
      <div className="mb-4 flex items-center justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${TONE_ICON[tone]}`}
        >
          <Icon className="size-5" aria-hidden />
        </div>
        {onClick && (
          <ArrowUpRight
            className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden
          />
        )}
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