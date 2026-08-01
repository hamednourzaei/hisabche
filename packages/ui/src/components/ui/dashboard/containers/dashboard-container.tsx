// packages/ui/src/components/ui/dashboard/containers/dashboard-container.tsx
"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { DashboardView } from "../dashboard-view";
import { DateRangePicker, type DateRange, type PresetKey } from "../date-range-picker";
import { useDashboardData } from "../../../../hooks/dashboard/use-dashboard-data";
import { fmt } from "../../../../lib/dashboard/dashboard-format";

// ─── Types ─────────────────────────────────────────────────────────────────

type Translate = (key: string) => string;

// ─── Main Container ──────────────────────────────────────────────────────

export function DashboardContainer() {
  const tOriginal = useTranslations();
  const t = useCallback(
    (key: string, fallback?: string): string => {
      try {
        const v = tOriginal(key as Parameters<typeof tOriginal>[0]);
        return v && v !== key ? v : (fallback ?? key);
      } catch (err) {
        console.error("[DEBUG dashboard] t() threw for key:", key, err);
        return fallback ?? key;
      }
    },
    [tOriginal]
  );
  const router = useRouter();

  // ─── State ──────────────────────────────────────────────────────────────

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);
    return { from: weekAgo, to: today };
  });

  // ─── Data ──────────────────────────────────────────────────────────────

  const {
    kpis,
    insights,
    salesChartData,
    recentActivities,
    kpiLoading,
    insightsLoading,
    chartLoading,
    activitiesLoading,
  } = useDashboardData(dateRange);

  // 🔍 DEBUG: موقتی — برای تشخیص این‌که چرا ۴ کارت اول همیشه صفر نشان
  // می‌دهند. اگر در کنسول `kpis` مقادیر totalSales/todaySales/customerDebt/
  // warehouseValue را "undefined" نشان دهد (نه عدد ۰ واقعی)، یعنی بک‌اند
  // (Render) هنوز نسخه‌ی جدید analytics.service.ts را ندارد و باید جدا
  // دیپلوی شود — چون این فیلدها فقط در فرانت (Vercel) پوش نمی‌شوند.
  useEffect(() => {
    console.error("[DEBUG dashboard] kpiLoading:", kpiLoading, "kpis:", kpis);
  }, [kpiLoading, kpis]);

  // ─── Callbacks ──────────────────────────────────────────────────────────

  const handleDateRangeChange = useCallback((range: DateRange, _preset: PresetKey) => {
    setDateRange(range);
  }, []);

  const handleAction = useCallback(
    (action: string) => {
      router.push(action);
    },
    [router]
  );

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <DashboardView
      t={t}
      fmt={fmt}
      totalSales={kpis?.totalSales ?? 0}
      todaySales={kpis?.todaySales ?? 0}
      customerDebt={kpis?.customerDebt ?? 0}
      warehouseValue={kpis?.warehouseValue ?? 0}
      kpiLoading={kpiLoading}
      insights={insights ?? []}
      insightsLoading={insightsLoading}
      salesChartData={salesChartData}
      chartLoading={chartLoading}
      dateRange={dateRange}
      activitiesLoading={activitiesLoading}
      recentActivities={recentActivities}
      onNavigate={(route) => router.push(route)}
      onInsightAction={handleAction}
      onDateRangeChange={handleDateRangeChange}
    />
  );
}