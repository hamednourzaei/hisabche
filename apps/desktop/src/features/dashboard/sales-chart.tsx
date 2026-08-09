// ============================================
// Sales area chart.
//
// Split out of dashboard-page so recharts (~830 kB) is NOT part of the first
// authenticated screen's chunk. The page lazy-loads this module and renders a
// Skeleton meanwhile — the same Skeleton it already showed while the sales
// query was in flight, so there is no new visual state.
//
// Markup and props are byte-for-byte what dashboard-page rendered before.
// ============================================

import React from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import type { CurrencyCode } from '@/shared/lib/currency'
import { formatAmount, formatMoney } from '@/shared/lib/currency'

export interface SalesPoint {
  label: string
  value: number
}

export interface SalesChartProps {
  data: readonly SalesPoint[]
  currency: CurrencyCode
}

export default function SalesChart({ data, currency }: SalesChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={[...data]}>
        <defs>
          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--color-primary))" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(var(--color-primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--fg-tertiary))" />
        <YAxis
          tick={{ fontSize: 11 }}
          stroke="hsl(var(--fg-tertiary))"
          tickFormatter={formatAmount}
          width={64}
        />
        <Tooltip
          formatter={(value: number) => formatMoney(value, currency)}
          contentStyle={{
            background: 'hsl(var(--surface-elevated))',
            border: '1px solid hsl(var(--border-default))',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="hsl(var(--color-primary))"
          strokeWidth={2}
          fill="url(#salesFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
