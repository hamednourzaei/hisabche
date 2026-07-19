// packages/ui/src/components/ui/dashboard/sales-chart.tsx
"use client";

import { memo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, type TooltipProps } from "recharts";

export interface ChartDataPoint { label: string; value: number; date: string; }

interface SalesChartProps { data: ChartDataPoint[]; isLoading: boolean; fmt: (v: number) => string; height?: number; }

const CustomTooltip = memo(function CustomTooltip({
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
        "border-[hsl(var(--border-default))]"
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
});
CustomTooltip.displayName = "CustomTooltip";

const ChartSkeleton = memo(function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      className="animate-pulse rounded-2xl bg-[hsl(var(--surface-muted))]"
      style={{ height }}
      aria-hidden="true"
    />
  );
});
ChartSkeleton.displayName = "ChartSkeleton";

export const SalesChart = memo(function SalesChart({
  data,
  isLoading,
  fmt,
  height = 200,
}: SalesChartProps) {
  const { t } = useTranslation();

  if (isLoading) return <ChartSkeleton height={height} />;

  // ✅ اگر داده وجود ندارد یا خالی است
  if (!data || !data.length) {
    return (
      <div
        className="flex items-center justify-center text-sm text-[hsl(var(--fg-tertiary))]"
        style={{ height }}
      >
        {t("dashboard.noData", "داده‌ای برای نمایش نیست")}
      </div>
    );
  }

  // ✅ بررسی اینکه آیا همه مقادیر صفر هستند
  const allZero = data.every((d) => d.value === 0 || d.value === null || d.value === undefined);
  
  // ✅ اگر همه مقادیر صفر هستند، اما داده وجود دارد، پیام مناسب نشان بده
  if (allZero) {
    return (
      <div
        className="flex flex-col items-center justify-center text-sm text-[hsl(var(--fg-tertiary))] gap-2"
        style={{ height }}
      >
        <span>{t("dashboard.noSalesYet", "هنوز فروشی ثبت نشده است")}</span>
        <span className="text-xs text-[hsl(var(--fg-tertiary)/0.7)]">
          {t("dashboard.startSelling", "اولین فاکتور را ثبت کنید")}
        </span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--color-primary))" stopOpacity={0.2} />
            <stop offset="100%" stopColor="hsl(var(--color-primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="hsl(var(--border-default))" strokeDasharray="3 3" vertical={false} />
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
          activeDot={{ r: 4, fill: "hsl(var(--color-primary))", stroke: "hsl(var(--surface-elevated))", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});

SalesChart.displayName = "SalesChart";