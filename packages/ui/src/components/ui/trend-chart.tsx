// packages/ui/src/components/ui/trend-chart.tsx
'use client'

// ============================================
// TrendChart — THE shared time-series chart for monitoring surfaces.
// Recharts was already a runtime dependency of this package (ChartContainer,
// SalesChart); the admin monitor's div-bar chart is replaced by this, not by
// a new library (mission §11). Lazy-loaded with a skeleton, like SalesChart.
// ============================================

import dynamic from 'next/dynamic'
import { memo } from 'react'

import type { TrendChartInternalProps, TrendSeries } from './trend-chart-internal'

export type { TrendSeries }

export interface TrendChartProps extends Omit<TrendChartInternalProps, 'height'> {
  height?: number
}

const DynamicTrend = dynamic(
  () => import('./trend-chart-internal').then((m) => m.TrendChartInternal),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={200} />,
  },
)

const ChartSkeleton = memo(function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      className="w-full rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse"
      style={{ height }}
      aria-hidden="true"
    />
  )
})
ChartSkeleton.displayName = 'ChartSkeleton'

export const TrendChart = memo(function TrendChart({ height = 200, ...props }: TrendChartProps) {
  return <DynamicTrend {...props} height={height} />
})
TrendChart.displayName = 'TrendChart'
