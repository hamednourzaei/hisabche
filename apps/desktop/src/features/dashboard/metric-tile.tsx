import React, { memo, type ReactNode } from 'react'

import { Card, cn, Skeleton } from '@/components/ui/primitives'

export interface MetricTileProps {
  label: string
  value: string
  trend?: number | undefined
  icon?: ReactNode
  loading?: boolean
  onClick?: (() => void) | undefined
}

function trendClass(trend: number): string {
  if (trend > 0) return 'text-[hsl(var(--color-success))]'
  if (trend < 0) return 'text-[hsl(var(--color-destructive))]'
  return 'text-[hsl(var(--fg-tertiary))]'
}

export const MetricTile = memo(function MetricTile({
  label,
  value,
  trend,
  icon,
  loading = false,
  onClick,
}: MetricTileProps) {
  return (
    <Card className={cn(onClick && 'cursor-pointer hover:border-[hsl(var(--border-strong))]')}>
      <div
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        className="flex flex-col gap-2"
      >
        <div className="flex items-center gap-2 text-xs text-[hsl(var(--fg-secondary))]">
          {icon}
          <span className="truncate">{label}</span>
        </div>

        {loading ? (
          <Skeleton className="h-7 w-32" />
        ) : (
          <span className="text-xl font-bold tabular-nums">{value}</span>
        )}

        {trend !== undefined && !loading ? (
          <span className={cn('text-xs tabular-nums', trendClass(trend))}>
            {`${trend > 0 ? '↑' : trend < 0 ? '↓' : '—'} ${Math.abs(trend).toFixed(1)}%`}
          </span>
        ) : null}
      </div>
    </Card>
  )
})
