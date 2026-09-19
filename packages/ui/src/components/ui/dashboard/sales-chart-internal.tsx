// packages/ui/src/components/ui/dashboard/sales-chart-internal.tsx
'use client'

// ============================================
// The dashboard's sales chart, drawn in the «balance chart card» layout
// (dashboardcn, MIT) on the owner's instruction — a line with a reference
// line and a marked peak. Colours come from this product's tokens, not the
// source palette.
//
// ⚠️ THE REFERENCE LINE IS THE AVERAGE OF WHAT IS DRAWN, AND IT SAYS SO.
// An unlabelled horizontal line invites the reader to take it for a target or
// a budget. It is the mean of the points in the selected window and nothing
// else, so it carries that label.
//
// ⚠️ THE PEAK IS MARKED ON THE AGGREGATED SERIES. Long ranges are downsampled
// below, so the marked point is the highest point ON SCREEN. Marking the raw
// maximum would put the dot where no drawn point sits.
// ============================================

import { memo, useMemo, useId } from 'react'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ReferenceDot,
} from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '../chart'

interface ChartDataPoint {
  label: string
  value: number
  date: string
  invoiceCount?: number
  customerCount?: number
}

interface InternalChartProps {
  data: ChartDataPoint[]
  fmt: (v: number) => string
  height: number
  animationDuration: number
  showInvoices?: boolean
  showCustomers?: boolean
}

// ✅ تابع aggregate با بررسی کامل TypeScript
function aggregateDataPoints(data: ChartDataPoint[], maxPoints: number): ChartDataPoint[] {
  if (data.length <= maxPoints) return data

  const step = Math.ceil(data.length / maxPoints)
  const result: ChartDataPoint[] = []

  for (let i = 0; i < data.length; i += step) {
    const chunk = data.slice(i, i + step)

    const first = chunk[0]
    if (!first) continue

    const total = chunk.reduce((sum, d) => sum + d.value, 0)
    const avg = Math.round(total / chunk.length)
    const hasInvoice = chunk.some((d) => d.invoiceCount !== undefined)
    const hasCustomer = chunk.some((d) => d.customerCount !== undefined)

    result.push({
      label: first.label,
      value: avg,
      date: first.date,
      // ✅ اگر داده‌ی اصلی این فیلد را نداشته باشد، نباید صفرِ ساختگی بسازیم؛
      // در غیر این صورت خطی با مقدار صفر رسم می‌شود که گمراه‌کننده است.
      ...(hasInvoice ? { invoiceCount: chunk.reduce((s, d) => s + (d.invoiceCount ?? 0), 0) } : {}),
      ...(hasCustomer
        ? { customerCount: chunk.reduce((s, d) => s + (d.customerCount ?? 0), 0) }
        : {}),
    })
  }

  return result
}

const chartConfig = {
  value: { label: 'فروش', color: 'hsl(var(--color-primary))' },
  invoiceCount: { label: 'فاکتور', color: 'hsl(var(--color-info))' },
  customerCount: { label: 'مشتری', color: 'hsl(var(--color-warning))' },
} satisfies ChartConfig

export default memo(function InternalSalesChart({
  data,
  fmt,
  height,
  animationDuration,
  showInvoices = true,
  showCustomers = true,
}: InternalChartProps) {
  const gradientId = useId()

  const chartData = useMemo(() => aggregateDataPoints(data ?? [], 30), [data])

  /**
   * The average, and the highest drawn point.
   *
   * ⚠️ `null` when there is nothing to average. A reference line at zero on an
   * empty window would read as «your average is zero», which is a claim about
   * the business rather than the absence of data.
   */
  const { average, peak } = useMemo(() => {
    if (chartData.length === 0) return { average: null, peak: null }

    const total = chartData.reduce((sum, point) => sum + (Number(point.value) || 0), 0)
    const mean = total / chartData.length

    let highest = chartData[0]!
    for (const point of chartData) {
      if ((Number(point.value) || 0) > (Number(highest.value) || 0)) highest = point
    }

    // A flat line of zeros has no peak worth marking.
    return {
      average: mean,
      peak: (Number(highest.value) || 0) > 0 ? highest : null,
    }
  }, [chartData])

  return (
    <ChartContainer config={chartConfig} className="w-full" style={{ height }}>
      <ComposedChart data={chartData} margin={{ top: 16, right: 8, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--color-primary))" stopOpacity={0.22} />
            <stop offset="100%" stopColor="hsl(var(--color-primary))" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid
          vertical={false}
          strokeDasharray="3 3"
          stroke="hsl(var(--border-default))"
          strokeOpacity={0.6}
        />

        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tick={{ fill: 'hsl(var(--fg-tertiary))', fontSize: 11 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          tick={{ fill: 'hsl(var(--fg-tertiary))', fontSize: 11 }}
          tickFormatter={(value: number) => fmt(value)}
        />

        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />

        {/* The area under the line is decoration for the same series — it
            carries no second number, so it shares the line's colour. */}
        <Area
          type="monotone"
          dataKey="value"
          stroke="none"
          fill={`url(#${gradientId})`}
          isAnimationActive={animationDuration > 0}
          animationDuration={animationDuration}
        />

        {average !== null && (
          <ReferenceLine
            y={average}
            stroke="hsl(var(--fg-tertiary))"
            strokeDasharray="4 4"
            strokeOpacity={0.9}
            label={{
              value: `${chartConfig.value.label}: ${fmt(Math.round(average))}`,
              position: 'insideTopLeft',
              fill: 'hsl(var(--fg-tertiary))',
              fontSize: 10,
            }}
          />
        )}

        <Line
          type="monotone"
          dataKey="value"
          stroke="hsl(var(--color-primary))"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0, fill: 'hsl(var(--color-primary))' }}
          isAnimationActive={animationDuration > 0}
          animationDuration={animationDuration}
        />

        {peak && (
          <ReferenceDot
            x={peak.label}
            y={peak.value}
            r={5}
            fill="hsl(var(--color-primary))"
            stroke="hsl(var(--surface-elevated))"
            strokeWidth={2}
            isFront
            label={{
              value: fmt(peak.value),
              position: 'top',
              fill: 'hsl(var(--fg-primary))',
              fontSize: 11,
              fontWeight: 600,
            }}
          />
        )}

        {showInvoices && (
          <Line
            type="monotone"
            dataKey="invoiceCount"
            stroke="hsl(var(--color-info))"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={animationDuration > 0}
            animationDuration={animationDuration}
            connectNulls={false}
          />
        )}

        {showCustomers && (
          <Line
            type="monotone"
            dataKey="customerCount"
            stroke="hsl(var(--color-warning))"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={animationDuration > 0}
            animationDuration={animationDuration}
            connectNulls={false}
          />
        )}

        <ChartLegend content={<ChartLegendContent />} />
      </ComposedChart>
    </ChartContainer>
  )
})
