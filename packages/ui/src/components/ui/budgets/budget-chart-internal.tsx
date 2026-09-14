// packages/ui/src/components/ui/budgets/budget-chart-internal.tsx
'use client'

// ============================================
// Plan against actual, per sub-period. Loaded lazily (recharts is heavy on a
// low-end Android) by budgets-view through next/dynamic, the same way the
// dashboard's sales chart is.
//
// Open commitments are NOT drawn per sub-period: the server knows them per
// budget, not per month, and splitting them across months here would invent
// a distribution nobody recorded. They are on the KPI row instead.
// ============================================

import { memo } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../chart'

export interface BudgetChartPoint {
  label: string
  plan: number
  actual: number
}

export default memo(function BudgetChartInternal({
  data,
  planLabel,
  actualLabel,
  fmt,
  height,
}: {
  data: BudgetChartPoint[]
  planLabel: string
  actualLabel: string
  fmt: (major: number) => string
  height: number
}) {
  const config = {
    plan: { label: planLabel, color: 'hsl(var(--fg-tertiary))' },
    actual: { label: actualLabel, color: 'hsl(var(--color-primary))' },
  } satisfies ChartConfig

  return (
    <ChartContainer config={config} className="w-full" style={{ height }}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={false} strokeOpacity={0.35} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval="preserveStartEnd"
        />
        <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => fmt(v)} />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => fmt(Number(value))} />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="plan"
          fill="hsl(var(--fg-tertiary))"
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
        <Bar
          dataKey="actual"
          fill="hsl(var(--color-primary))"
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
  )
})
