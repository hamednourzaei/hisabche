// packages/ui/src/components/ui/dashboard/sales-chart-internal.tsx
"use client";

import { memo, useMemo, useId } from "react";
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "../chart";

interface ChartDataPoint {
  label: string;
  value: number;
  date: string;
  invoiceCount?: number;
  customerCount?: number;
}

interface InternalChartProps {
  data: ChartDataPoint[];
  fmt: (v: number) => string;
  height: number;
  animationDuration: number;
  showInvoices?: boolean;
  showCustomers?: boolean;
}

// ✅ تابع aggregate با بررسی کامل TypeScript
function aggregateDataPoints(data: ChartDataPoint[], maxPoints: number): ChartDataPoint[] {
  if (data.length <= maxPoints) return data;

  const step = Math.ceil(data.length / maxPoints);
  const result: ChartDataPoint[] = [];

  for (let i = 0; i < data.length; i += step) {
    const chunk = data.slice(i, i + step);

    const first = chunk[0];
    if (!first) continue;

    const total = chunk.reduce((sum, d) => sum + d.value, 0);
    const avg = Math.round(total / chunk.length);
    const hasInvoice = chunk.some((d) => d.invoiceCount !== undefined);
    const hasCustomer = chunk.some((d) => d.customerCount !== undefined);

    result.push({
      label: first.label,
      value: avg,
      date: first.date,
      // ✅ اگر داده‌ی اصلی این فیلد را نداشته باشد، نباید صفرِ ساختگی بسازیم؛
      // در غیر این صورت خطی با مقدار صفر رسم می‌شود که گمراه‌کننده است.
      ...(hasInvoice
        ? { invoiceCount: chunk.reduce((s, d) => s + (d.invoiceCount ?? 0), 0) }
        : {}),
      ...(hasCustomer
        ? { customerCount: chunk.reduce((s, d) => s + (d.customerCount ?? 0), 0) }
        : {}),
    });
  }

  return result;
}

const chartConfig = {
  value: { label: "فروش", color: "hsl(var(--color-primary))" },
  invoiceCount: { label: "فاکتور", color: "hsl(var(--status-info))" },
  customerCount: { label: "مشتری", color: "hsl(var(--color-warning))" },
} satisfies ChartConfig;

export default memo(function InternalSalesChart({
  data,
  fmt,
  height,
  animationDuration,
  showInvoices = true,
  showCustomers = true,
}: InternalChartProps) {
  const gradientId = useId();

  const aggregatedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.length > 12 ? aggregateDataPoints(data, 12) : data;
  }, [data]);

  // ✅ FIX (باگ toggle): خط فقط وقتی رسم می‌شود که داده‌اش واقعاً موجود باشد.
  // بک‌اند این فیلدها را می‌سازد، ولی تا وقتی نسخه‌ی جدید دیپلوی نشده باشد
  // پاسخ فقط {label,value,date} دارد و <Line> چیزی برای کشیدن ندارد — یعنی
  // تیک روشن/خاموش می‌شد بدون این‌که خطی اضافه شود.
  const hasInvoiceSeries = useMemo(
    () => aggregatedData.some((d) => typeof d.invoiceCount === "number"),
    [aggregatedData]
  );
  const hasCustomerSeries = useMemo(
    () => aggregatedData.some((d) => typeof d.customerCount === "number"),
    [aggregatedData]
  );

  const renderInvoices = showInvoices && hasInvoiceSeries;
  const renderCustomers = showCustomers && hasCustomerSeries;
  const hasRightAxis = renderInvoices || renderCustomers;

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
    <ChartContainer config={chartConfig} className="w-full" style={{ height }}>
      <ComposedChart
        data={aggregatedData}
        margin={{ top: 4, right: hasRightAxis ? 20 : 4, left: -20, bottom: 0 }}
      >
        <defs>
          <linearGradient id={`salesGradient-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.2} />
            <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" vertical={false} />

        <XAxis dataKey="label" axisLine={false} tickLine={false} dy={8} tick={{ fontSize: 11 }} />

        <YAxis
          yAxisId="value"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => fmt(v)}
          width={60}
        />

        {hasRightAxis && (
          <YAxis
            yAxisId="count"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
            allowDecimals={false}
            width={30}
          />
        )}

        <ChartTooltip
          content={
            <ChartTooltipContent
              labelKey="label"
              formatter={(value: any, name: any) =>
                name === "value" ? fmt(Number(value)) : String(value)
              }
            />
          }
        />

        {hasRightAxis && <ChartLegend content={<ChartLegendContent />} />}

        <Area
          yAxisId="value"
          type="monotone"
          dataKey="value"
          stroke="var(--color-value)"
          strokeWidth={2}
          fill={`url(#salesGradient-${gradientId})`}
          dot={false}
          activeDot={{
            r: 4,
            fill: "var(--color-value)",
            stroke: "hsl(var(--surface-elevated))",
            strokeWidth: 2,
            tabIndex: 0,
          }}
          animationDuration={animationDuration}
          animationEasing="ease-out"
        />

        {renderInvoices && (
          <Line
            yAxisId="count"
            type="monotone"
            dataKey="invoiceCount"
            stroke="var(--color-invoiceCount)"
            strokeWidth={2}
            dot={false}
            animationDuration={animationDuration}
          />
        )}

        {renderCustomers && (
          <Line
            yAxisId="count"
            type="monotone"
            dataKey="customerCount"
            stroke="var(--color-customerCount)"
            strokeWidth={2}
            dot={false}
            animationDuration={animationDuration}
          />
        )}
      </ComposedChart>
    </ChartContainer>
  );
});
