// packages/ui/src/components/ui/trend-chart-internal.tsx
'use client'

// ============================================
// The recharts body of TrendChart — lazy-loaded by trend-chart.tsx so the
// chart library stays out of the first paint (the SalesChart pattern).
// Built on the SAME ChartContainer/ChartTooltip as every other chart here;
// no second chart library, no parallel wrapper.
//
// GAPS STAY GAPS: a null value is a missing sample, and `connectNulls` is
// false — the line breaks instead of inventing a straight line through a
// window where nothing was measured.
// ============================================

import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from './chart'

export interface TrendSeries {
  key: string
  label: string
  /** A CSS color — pass a design token, e.g. `hsl(var(--color-primary))`. */
  color: string
  kind?: 'area' | 'line'
}

export interface TrendChartInternalProps {
  data: Array<Record<string, string | number | null>>
  xKey: string
  series: TrendSeries[]
  height: number
  formatValue?: ((value: number, key: string) => string) | undefined
  formatX?: ((value: string) => string) | undefined
  ariaLabel: string
}

export function TrendChartInternal({
  data,
  xKey,
  series,
  height,
  formatValue,
  formatX,
  ariaLabel,
}: TrendChartInternalProps) {
  const config: ChartConfig = Object.fromEntries(
    series.map((entry) => [entry.key, { label: entry.label, color: entry.color }]),
  )

  return (
    <div dir="ltr" role="img" aria-label={ariaLabel} style={{ height }} className="w-full">
      <ChartContainer config={config} className="h-full w-full">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey={xKey}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={40}
            tickFormatter={(value: string) => (formatX ? formatX(value) : value)}
          />
          <YAxis tickLine={false} axisLine={false} width={44} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={formatX ? (value) => formatX(String(value)) : undefined}
                formatter={
                  formatValue
                    ? (value, name) =>
                        typeof value === 'number' ? formatValue(value, String(name)) : String(value)
                    : undefined
                }
              />
            }
          />
          {series.map((entry) =>
            entry.kind === 'line' ? (
              <Line
                key={entry.key}
                type="monotone"
                dataKey={entry.key}
                stroke={`var(--color-${entry.key})`}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ) : (
              <Area
                key={entry.key}
                type="monotone"
                dataKey={entry.key}
                stroke={`var(--color-${entry.key})`}
                fill={`var(--color-${entry.key})`}
                fillOpacity={0.15}
                strokeWidth={2}
                connectNulls={false}
                isAnimationActive={false}
              />
            ),
          )}
        </ComposedChart>
      </ChartContainer>
    </div>
  )
}
