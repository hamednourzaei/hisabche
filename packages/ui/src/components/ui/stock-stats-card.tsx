import { Card, CardContent } from "./card"
import { type LucideIcon } from "lucide-react"

interface StockStatsCardProps {
  value: number | string
  label: string
  icon: LucideIcon
  color: string
}

export function StockStatsCard({ value, label, icon: Icon, color }: StockStatsCardProps) {
  return (
    <div className="card-elevated">
      <div className="flex items-center gap-3 p-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}
        >
          <Icon className="size-5" style={{ color }} aria-hidden />
        </div>
        <div>
          <p className="text-xl font-bold tabular-nums text-[var(--hisab-foreground)]">
            {value}
          </p>
          <p className="text-xs text-[var(--hisab-muted-fg)]">
            {label}
          </p>
        </div>
      </div>
    </div>
  )
}