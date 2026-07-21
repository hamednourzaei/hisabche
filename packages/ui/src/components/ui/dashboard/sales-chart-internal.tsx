// packages/ui/src/components/ui/dashboard/sales-chart-internal.tsx
"use client";

import { memo, useMemo, useId } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";

interface ChartDataPoint {
  label: string;
  value: number;
  date: string;
}

interface InternalChartProps {
  data: ChartDataPoint[];
  fmt: (v: number) => string;
  height: number;
  animationDuration: number;
}

const GRID_STROKE = "hsl(var(--border-default))";

// ✅ تابع aggregate با بررسی کامل TypeScript
function aggregateDataPoints(data: ChartDataPoint[], maxPoints: number): ChartDataPoint[] {
  if (data.length <= maxPoints) return data;

  const step = Math.ceil(data.length / maxPoints);
  const result: ChartDataPoint[] = [];

  for (let i = 0; i < data.length; i += step) {
    const chunk = data.slice(i, i + step);

    // ✅ بررسی وجود اولین عنصر
    const first = chunk[0];
    if (!first) continue;

    const total = chunk.reduce((sum, d) => sum + d.value, 0);
    const avg = Math.round(total / chunk.length);

    result.push({
      label: first.label,
      value: avg,
      date: first.date,
    });
  }

  return result;
}

// ✅ CustomTooltip با TypeScript کامل
const CustomTooltip = memo(function CustomTooltip({
  active,
  payload,
  fmt,
}: {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: {
      label: string;
      value: number;
      date: string;
    };
  }>;
  fmt: (v: number) => string;
}) {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }

  const dataPoint = payload[0].payload;

  return (
    <div
      className={cn(
        "rounded-xl px-3 py-2 shadow-lg border",
        "bg-[hsl(var(--surface-elevated)/0.98)] backdrop-blur-md",
        "border-[hsl(var(--border-default))]"
      )}
    >
      <p className="text-[11px] text-[hsl(var(--fg-tertiary))] mb-0.5">
        {dataPoint.label}
      </p>
      <p className="text-sm font-semibold text-[hsl(var(--color-primary))]">
        {fmt(dataPoint.value)}
      </p>
    </div>
  );
});
CustomTooltip.displayName = "CustomTooltip";

export default memo(function InternalSalesChart({
  data,
  fmt,
  height,
  animationDuration,
}: InternalChartProps) {
  const gradientId = useId();

  const aggregatedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.length > 12 ? aggregateDataPoints(data, 12) : data;
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height }}>
        <p className="text-sm text-[hsl(var(--fg-tertiary))]">
          هیچ داده‌ای برای نمایش وجود ندارد
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={aggregatedData}
        margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
      >
        <defs>
          <linearGradient
            id={`salesGradient-${gradientId}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
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
          stroke={GRID_STROKE}
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
          fill={`url(#salesGradient-${gradientId})`}
          dot={false}
          activeDot={{
            r: 4,
            fill: "hsl(var(--color-primary))",
            stroke: "hsl(var(--surface-elevated))",
            strokeWidth: 2,
            tabIndex: 0,
          }}
          animationDuration={animationDuration}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});