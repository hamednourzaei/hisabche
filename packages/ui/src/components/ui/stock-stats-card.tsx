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
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: color + "20" }}
        >
          <Icon className="size-5" style={{ color }} />
        </div>
        <div>
          <p className="text-xl font-bold text-[var(--hisab-foreground)]">{value}</p>
          <p className="text-xs text-[var(--hisab-muted-fg)]">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}