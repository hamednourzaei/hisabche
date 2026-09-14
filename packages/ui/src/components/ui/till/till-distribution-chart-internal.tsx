// packages/ui/src/components/ui/till/till-distribution-chart-internal.tsx
'use client'

// Share of the drawer's events by kind, as a donut. Lazy-loaded (recharts).
// Only drawn when there are a handful of kinds — a donut of one slice or of
// many thin slices says nothing a list would not say better.

import { memo } from 'react'
import { Cell, Pie, PieChart } from 'recharts'

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '../chart'

export interface DistributionSlice {
  key: string
  label: string
  count: number
  color: string
}

export default memo(function TillDistributionChartInternal({
  data,
  centerLabel,
  size,
}: {
  data: DistributionSlice[]
  centerLabel: string
  size: number
}) {
  const config = Object.fromEntries(
    data.map((slice) => [slice.key, { label: slice.label, color: slice.color }]),
  ) satisfies ChartConfig
  const total = data.reduce((sum, slice) => sum + slice.count, 0)

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <ChartContainer config={config} className="h-full w-full">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent />} />
          <Pie
            data={data}
            dataKey="count"
            nameKey="key"
            innerRadius="62%"
            outerRadius="95%"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {data.map((slice) => (
              <Cell key={slice.key} fill={slice.color} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums">{total}</span>
        <span className="text-xs text-[hsl(var(--fg-tertiary))]">{centerLabel}</span>
      </div>
    </div>
  )
})
