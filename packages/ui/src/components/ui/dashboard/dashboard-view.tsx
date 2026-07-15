// packages/ui/src/components/ui/dashboard/dashboard-view.tsx
"use client";

import { memo, useMemo } from "react";  // ✅ اضافه شد
import { cn } from "@/lib/utils";
import { Sparkles, Receipt, TrendingUp } from "lucide-react";
import { StatCard } from "./dashboard-stats";
import { KPICards } from "./kpi-cards";
import { AIInsights } from "./ai-insights";
import { DashboardInvoices } from "./dashboard-invoices";
import { SalesChart, type ChartDataPoint } from "./sales-chart";
import { DateRangePicker, type DateRange, type PresetKey } from "./date-range-picker";
import type { AIInsight } from "@hisabche/api";

/* ═══════════════════════════════════════════════════════════════════════════
   DashboardView v2 — Memoized · Performance Optimized
   ✅ memo · useMemo · Greeting جدا شده
   ═══════════════════════════════════════════════════════════════════════════ */

interface DashboardViewProps {
  t: (key: string, fallback?: string) => string;
  fmt: (v: number) => string;
  todaySales: number;
  todayInvoices: number;
  monthlyRevenue: number;
  monthlyGrowth: number;
  pendingPayments: number;
  activeCustomers: number;
  lowStockAlerts: number;
  kpiLoading: boolean;
  insights: AIInsight[];
  insightsLoading: boolean;
  salesChartData: ChartDataPoint[];
  chartLoading: boolean;
  dateRange: DateRange;
  totalDebt: number;
  invLoading: boolean;
  prodLoading: boolean;
  recentInvoices: Array<{
    id: string;
    customer: string;
    total: number;
    date: string;
  }>;
  onNavigate: (route: string) => void;
  onNavigatewarehouse: () => void;
  onNavigatecustomers: () => void;
  onNavigateQuickInvoice: () => void;
  onNavigateInvoice: (id: string) => void;
  onViewAllInvoices: () => void;
  onInsightAction: (action: string) => void;
  onDateRangeChange: (range: DateRange, preset: PresetKey) => void;
}

// ─── Greeting (جدا شده با memo) ──────────────────────────────────────────

const Greeting = memo(function Greeting({
  t,
}: {
  t: (key: string, fallback?: string) => string;
}) {
  const h = new Date().getHours();
  const k = h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night";
  const label =
    k === "morning"
      ? "صبح بخیر"
      : k === "afternoon"
      ? "ظهر بخیر"
      : k === "evening"
      ? "عصر بخیر"
      : "شب بخیر";

  return (
    <div className="space-y-1.5">
      <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl text-[hsl(var(--fg-primary))]">
        {t(`dashboard.greeting.${k}`, label)}
        <Sparkles className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
      </h1>
      <p className="text-sm text-[hsl(var(--fg-secondary))]">
        {t("dashboard.subtitle", "آمار چه خبر از کسب‌وکارت؟")}
      </p>
    </div>
  );
});
Greeting.displayName = "Greeting";

// ─── Main Component ────────────────────────────────────────────────────────

export const DashboardView = memo(function DashboardView(props: DashboardViewProps) {
  const {
    t,
    fmt,
    todaySales,
    todayInvoices,
    monthlyRevenue,
    monthlyGrowth,
    pendingPayments,
    activeCustomers,
    lowStockAlerts,
    kpiLoading,
    insights,
    insightsLoading,
    salesChartData,
    chartLoading,
    dateRange,
    totalDebt,
    invLoading,
    prodLoading,
    recentInvoices,
    onNavigate,
    onNavigatewarehouse,
    onNavigatecustomers,
    onNavigateQuickInvoice,
    onNavigateInvoice,
    onViewAllInvoices,
    onInsightAction,
    onDateRangeChange,
  } = props;

  // ✅ useMemo برای KPI data
  const kpiData = useMemo(
    () => ({
      todaySales,
      todayInvoices,
      monthlyRevenue,
      monthlyGrowth,
      pendingPayments,
      activeCustomers,
      lowStockAlerts,
    }),
    [todaySales, todayInvoices, monthlyRevenue, monthlyGrowth, pendingPayments, activeCustomers, lowStockAlerts]
  );

  return (
    <div className="space-y-6">
      <Greeting t={t} />

      <KPICards
        data={kpiData}
        isLoading={kpiLoading}
        onNavigate={onNavigate}
      />

      {/* Sales Chart + Date Range */}
      <div
        className={cn(
          "rounded-2xl border border-[hsl(var(--border-default))]",
          "bg-[hsl(var(--surface-elevated))]",
          "p-5"
        )}
      >
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp
              className="size-5 text-[hsl(var(--color-primary))]"
              aria-hidden="true"
            />
            <h2 className="text-base font-semibold text-[hsl(var(--fg-primary))]">
              {t("dashboard.salesChart", "نمودار فروش")}
            </h2>
          </div>

          <DateRangePicker
            value={dateRange}
            onChange={onDateRangeChange}
            t={t}
            disabled={chartLoading}
          />
        </div>

        <SalesChart
          data={salesChartData}
          isLoading={chartLoading}
          fmt={fmt}
          height={220}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent invoices */}
        <div className="lg:col-span-2 space-y-6">
          <div
            className={cn(
              "rounded-2xl border border-[hsl(var(--border-default))]",
              "bg-[hsl(var(--surface-elevated))]",
              "overflow-hidden"
            )}
          >
            <div className="flex items-center gap-2 px-6 pt-5 pb-3">
              <Receipt
                className="size-5 text-[hsl(var(--color-primary))]"
                aria-hidden="true"
              />
              <h2 className="text-base font-semibold text-[hsl(var(--fg-primary))]">
                {t("dashboard.recentInvoices", "آخرین فاکتورها")}
              </h2>
            </div>
            <div className="px-6 pb-5">
              <DashboardInvoices
                t={t}
                invLoading={invLoading}
                recentInvoices={recentInvoices}
                onNavigateInvoice={onNavigateInvoice}
                onNavigateQuickInvoice={onNavigateQuickInvoice}
                onViewAllInvoices={onViewAllInvoices}
              />
            </div>
          </div>
        </div>

        {/* AI Insights Panel */}
        <div className="lg:col-span-1">
          <AIInsights
            insights={insights}
            isLoading={insightsLoading}
            onAction={onInsightAction}
          />
        </div>
      </div>
    </div>
  );
});

DashboardView.displayName = "DashboardView";