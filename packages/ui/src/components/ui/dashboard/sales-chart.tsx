// packages/ui/src/components/ui/dashboard/sales-chart.tsx
"use client";

import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  type TooltipProps,
} from "recharts";

export interface ChartDataPoint {
  label: string;
  value: number;
}

interface SalesChartProps {
  data: ChartDataPoint[];
  isLoading: boolean;
  fmt: (v: number) => string;
  height?: number;
}

/* ─── Custom Tooltip ──────────────────────────────────────────────────────── */

function CustomTooltip({
  active,
  payload,
  fmt,
}: TooltipProps<number, string> & { fmt: (v: number) => string }) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;

  return (
    <div
      className={cn(
        "rounded-xl px-3 py-2 shadow-lg border",
        "bg-[hsl(var(--surface-elevated)/0.98)] backdrop-blur-md",
        "border-[hsl(var(--border-default))]",
      )}
    >
      <p className="text-[11px] text-[hsl(var(--fg-tertiary))] mb-0.5">
        {payload[0].payload.label}
      </p>
      <p className="text-sm font-semibold text-[hsl(var(--color-primary))]">
        {fmt(payload[0].value as number)}
      </p>
    </div>
  );
}
/* ─── Skeleton ────────────────────────────────────────────────────────────── */

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      className="animate-pulse rounded-2xl bg-[hsl(var(--surface-muted))]"
      style={{ height }}
      aria-hidden="true"
    />
  );
}

/* ─── Sales Chart ─────────────────────────────────────────────────────────── */

export function SalesChart({ data, isLoading, fmt, height = 200 }: SalesChartProps) {
  if (isLoading) {
    return <ChartSkeleton height={height} />;
  }

  if (!data || !data.length) {

    return (
      <div
        className="flex items-center justify-center text-sm text-[hsl(var(--fg-tertiary))]"
        style={{ height }}
      >
        داده‌ای برای نمایش نیست
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="hsl(var(--color-primary))"
              stopOpacity={0.2}
            />
            <stop
              offset="100%"
              stopColor="hsl(var(--color-primary))"
              stopOpacity={0}
            />
          </linearGradient>
        </defs>

        <CartesianGrid
          stroke="hsl(var(--border-default))"
          strokeDasharray="3 3"
          vertical={false}
        />

        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "hsl(var(--fg-tertiary))" }}
          dy={8}
        />

        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "hsl(var(--fg-tertiary))" }}
          tickFormatter={(v: number) => fmt(v)}
          width={60}
        />

        <Tooltip content={<CustomTooltip fmt={fmt} />} />

        <Area
          type="monotone"
          dataKey="value"
          stroke="hsl(var(--color-primary))"
          strokeWidth={2}
          fill="url(#salesGradient)"
          dot={false}
          activeDot={{
            r: 4,
            fill: "hsl(var(--color-primary))",
            stroke: "hsl(var(--surface-elevated))",
            strokeWidth: 2,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}