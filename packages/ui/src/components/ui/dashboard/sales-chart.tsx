// packages/ui/src/components/ui/dashboard/sales-chart.tsx
"use client";

import { memo, useMemo, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { ArrowUp, ArrowDown, FileText } from "lucide-react";
import {
  useMediaQuery,
  useIsMobile,
  useIsReducedMotion,
} from "../../../hooks/dashboard/use-media-query";

// Types
export interface ChartDataPoint {
  label: string;
  value: number;
  date: string;
  invoiceCount?: number;
  customerCount?: number;
}

interface SalesChartProps {
  data: ChartDataPoint[];
  isLoading: boolean;
  fmt: (v: number) => string;
  height?: number;
  previousPeriodTotal?: number;
  currentPeriodTotal?: number;
  onViewFullReport?: () => void;
}

// Lazy-load Recharts (بدون suspense)
const DynamicAreaChart = dynamic(() => import("./sales-chart-internal"), {
  ssr: false,
  loading: () => <ChartSkeleton height={200} />,
});

// ============= Skeleton =============
const ChartSkeleton = memo(function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      className="w-full rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse"
      style={{ height }}
      aria-hidden="true"
    />
  );
});
ChartSkeleton.displayName = "ChartSkeleton";

// ============= Main Component =============
export const SalesChart = memo(function SalesChart({
  data,
  isLoading,
  fmt,
  height = 200,
  previousPeriodTotal = 0,
  currentPeriodTotal = 0,
  onViewFullReport,
}: SalesChartProps) {
  const tOriginal = useTranslations();
  const t = (key: string, fallback?: string) => {
    try {
      const v = tOriginal(key as Parameters<typeof tOriginal>[0]);
      return v && v !== key ? v : (fallback ?? key);
    } catch (err) {
      console.error("[DEBUG dashboard] t() threw for key:", key, err);
      return fallback ?? key;
    }
  };
  const tCount = (key: string, values: Record<string, unknown>, fallback?: string) => {
    try {
      return tOriginal(key as Parameters<typeof tOriginal>[0], values as never);
    } catch (err) {
      console.error("[DEBUG dashboard] tOriginal() threw for key:", key, err);
      return fallback ?? key;
    }
  };
  const descriptionId = useId();
  const isMobile = useIsMobile();
  const isReducedMotion = useIsReducedMotion();
  const [showInvoices, setShowInvoices] = useState(true);
  const [showCustomers, setShowCustomers] = useState(true);

  // ✅ FIX (باگ toggle): اگر پاسخ API این سری‌ها را نداشته باشد، تیک زدن هیچ
  // خطی اضافه نمی‌کرد و کاربر فکر می‌کرد کنترل خراب است. حالا تیک غیرفعال
  // می‌شود و علتش در tooltip گفته می‌شود.
  const hasInvoiceSeries = useMemo(
    () => (data ?? []).some((d) => typeof d.invoiceCount === "number"),
    [data]
  );
  const hasCustomerSeries = useMemo(
    () => (data ?? []).some((d) => typeof d.customerCount === "number"),
    [data]
  );
  const noSeriesHint = "این داده در پاسخ سرور موجود نیست";

  // Calculate insights with safe percentage
  const { percentageChange, isPositive, allZero, hasData } = useMemo(() => {
    const hasData = data && data.length > 0;
    const allZero =
      hasData && data.every((d) => d.value === 0 || d.value === null || d.value === undefined);

    let percentageChange = 0;
    let isPositive = false;

    if (previousPeriodTotal > 0) {
      percentageChange = ((currentPeriodTotal - previousPeriodTotal) / previousPeriodTotal) * 100;
      isPositive = percentageChange >= 0;
    }

    percentageChange = Number.isFinite(percentageChange) ? percentageChange : 0;

    return { percentageChange, isPositive, allZero, hasData };
  }, [data, currentPeriodTotal, previousPeriodTotal]);

  // Loading state
  if (isLoading) {
    return <ChartSkeleton height={height} />;
  }

  // Empty state with motivation
  if (!hasData || allZero) {
    return (
      <section
        className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-8"
        style={{ height }}
        aria-label={t("dashboard.salesChart.emptyAria")}
      >
        <div className="rounded-full bg-[hsl(var(--color-primary)/0.1)] p-4">
          <FileText className="h-8 w-8 text-[hsl(var(--color-primary))]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-[hsl(var(--fg-primary))]">
            {t("dashboard.noSalesYet")}
          </p>
          <p className="text-xs text-[hsl(var(--fg-tertiary))] mt-1">
            {t("dashboard.startSelling")}
          </p>
        </div>
        <button
          type="button"
          onClick={onViewFullReport}
          className="mt-2 text-sm font-medium text-[hsl(var(--color-primary))] hover:underline focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] rounded-md px-2 py-1"
        >
          {t("dashboard.createInvoice")}
        </button>
      </section>
    );
  }

  // Determine animation duration based on device and preference
  const animationDuration = isMobile ? 0 : isReducedMotion ? 0 : 200;

  // ✅ اصلاح: استفاده از کلیدهای ترجمه‌ی صحیح
  const ariaLabel = t("dashboard.salesChart.ariaLabel");
  // ✅ FIX: این wrapper فقط رشته برمی‌گرداند و مقادیر ICU را جای‌گذاری نمی‌کند،
  // برای همین «{total}» و «{change}» عیناً نمایش داده می‌شدند.
  const description = t("dashboard.salesChart.description")
    .replace("{total}", fmt(currentPeriodTotal))
    .replace(
      "{change}",
      previousPeriodTotal > 0
        ? `${percentageChange >= 0 ? "+" : ""}${percentageChange.toFixed(1)}٪`
        : "—"
    );

  return (
    <section
      className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4"
      aria-label={ariaLabel}
    >
      {/* Hidden description for screen readers */}
      <div id={descriptionId} className="sr-only">
        {description}
      </div>

      <div className="flex flex-col gap-3">
        {/* Header: Context + Hero Metric */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-[hsl(var(--fg-secondary))]">
            {t("dashboard.todaySales")}
          </h3>
          <button
            type="button"
            onClick={onViewFullReport}
            className="text-xs text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))] transition-colors focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] rounded-md px-2 py-1"
          >
            {t("dashboard.viewReport")} →
          </button>
        </div>

        {/* Hero Metric + Comparison */}
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold text-[hsl(var(--fg-primary))] tracking-tight">
            {fmt(currentPeriodTotal)}
          </span>
          {previousPeriodTotal > 0 && (
            <span
              className={cn(
                "flex items-center gap-1 text-sm font-medium",
                isPositive ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-negative))]"
              )}
            >
              {isPositive ? (
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ArrowDown className="h-4 w-4" aria-hidden="true" />
              )}
              {Math.abs(percentageChange).toFixed(1)}%
              <span className="text-xs text-[hsl(var(--fg-tertiary))] font-normal">
                {t("dashboard.vsYesterday")}
              </span>
            </span>
          )}
        </div>

        {/* Chart with motion */}
        <div className="relative">
          <DynamicAreaChart
            data={data}
            fmt={fmt}
            height={height}
            animationDuration={animationDuration}
            showInvoices={showInvoices}
            showCustomers={showCustomers}
          />
        </div>

        {/* Contextual footer — سویچ‌های فعال/غیرفعال کردن هر خط (فروش همیشه روشن است) */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[hsl(var(--fg-tertiary))] pt-1 border-t border-[hsl(var(--border-default)/0.5)]">
          <span>{tCount("dashboard.dataRange", { count: data?.length ?? 0 }, `Last ${data?.length ?? 0} periods`)}</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-[hsl(var(--color-primary))]" />
              {t("dashboard.salesTrend")}
            </span>
            <label
              className={cn(
                "flex items-center gap-1 select-none",
                hasInvoiceSeries ? "cursor-pointer" : "cursor-not-allowed opacity-40"
              )}
              title={hasInvoiceSeries ? undefined : noSeriesHint}
            >
              <input
                type="checkbox"
                checked={showInvoices && hasInvoiceSeries}
                disabled={!hasInvoiceSeries}
                onChange={(e) => setShowInvoices(e.target.checked)}
                className="size-3 accent-[hsl(var(--status-info))]"
              />
              <span className="inline-block h-2 w-2 rounded-full bg-[hsl(var(--status-info))]" />
              {t("dashboard.invoicesLine", "فاکتورها")}
            </label>
            <label
              className={cn(
                "flex items-center gap-1 select-none",
                hasCustomerSeries ? "cursor-pointer" : "cursor-not-allowed opacity-40"
              )}
              title={hasCustomerSeries ? undefined : noSeriesHint}
            >
              <input
                type="checkbox"
                checked={showCustomers && hasCustomerSeries}
                disabled={!hasCustomerSeries}
                onChange={(e) => setShowCustomers(e.target.checked)}
                className="size-3 accent-[hsl(var(--color-warning))]"
              />
              <span className="inline-block h-2 w-2 rounded-full bg-[hsl(var(--color-warning))]" />
              {t("dashboard.customersLine", "مشتریان")}
            </label>
          </div>
        </div>
      </div>
    </section>
  );
});

SalesChart.displayName = "SalesChart";