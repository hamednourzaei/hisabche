// packages/ui/src/components/ui/till/till-cash-flow-chart-internal.tsx
'use client'

// Cash in / out per day, with net as a line. Lazy-loaded (recharts is heavy).

import { memo } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../chart'

export interface CashFlowPoint {
  label: string
  in: number
  out: number
  net: number
}

export default memo(function TillCashFlowChartInternal({
  data,
  labels,
  fmt,
  height,
}: {
  data: CashFlowPoint[]
  labels: { in: string; out: string; net: string }
  fmt: (major: number) => string
  height: number
}) {
  const config = {
    in: { label: labels.in, color: 'hsl(var(--color-success))' },
    out: { label: labels.out, color: 'hsl(var(--color-destructive))' },
    net: { label: labels.net, color: 'hsl(var(--color-primary))' },
  } satisfies ChartConfig

  return (
    <ChartContainer config={config} className="w-full" style={{ height }}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeOpacity={0.35} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => fmt(v)} />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => fmt(Number(value))} />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="in"
          fill="hsl(var(--color-success))"
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
        />
        <Bar
          dataKey="out"
          fill="hsl(var(--color-destructive))"
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
        />
        <Line
          dataKey="net"
          stroke="hsl(var(--color-primary))"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartContainer>
  )
})
