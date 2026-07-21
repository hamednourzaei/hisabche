// packages/ui/src/components/ui/dashboard/dashboard-view.tsx
"use client";

import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { 
  Sparkles, 
  TrendingUp, 
  Receipt, 
} from "lucide-react";
import { SalesChart, type ChartDataPoint } from "./sales-chart";
import { DateRangePicker, type DateRange, type PresetKey } from "./date-range-picker";
import type { AIInsight } from "@hisabche/api";
import dynamic from "next/dynamic";
import { BusinessHealthPanel } from "./business-health-panel";

// ─── Types ────────────────────────────────────────────────────────────────

type Translate = (key: string, fallback?: string) => string;

interface DashboardViewProps {
  t: Translate;
  fmt: (v: number) => string;
  
  // KPI Data
  todaySales: number;
  todayInvoices: number;
  monthlyRevenue: number;
  monthlyGrowth: number;
  pendingPayments: number;
  pendingPaymentsCount: number;
  activeCustomers: number;
  customerGrowth: number;
  lowStockAlerts: number;
  lowStockItems: Array<{ name: string; quantity: number }>;
  
  // Loading States
  kpiLoading: boolean;
  insightsLoading: boolean;
  chartLoading: boolean;
  invLoading: boolean;
  
  // AI Insights
  insights: AIInsight[];
  
  // Chart Data
  salesChartData: ChartDataPoint[];
  dateRange: DateRange;
  
  // Invoices
  recentInvoices: Array<{
    id: string;
    customer: string;
    total: number;
    date: string;
  }>;
  
  // Actions
  onNavigate: (route: string) => void;
  onNavigateWarehouse: () => void;
  onNavigateCustomers: () => void;
  onNavigateQuickInvoice: () => void;
  onNavigateInvoice: (id: string) => void;
  onViewAllInvoices: () => void;
  onInsightAction: (action: string) => void;
  onDateRangeChange: (range: DateRange, preset: PresetKey) => void;
}

// ─── Lazy Load Components ─────────────────────────────────────────────────

const LazySalesChart = dynamic(
  () => import("./sales-chart").then(mod => mod.SalesChart),
  {
    ssr: false,
    loading: () => <div className="h-[180px] sm:h-[200px] rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
  }
);

const LazyDashboardInvoices = dynamic(
  () => import("./dashboard-invoices").then(mod => mod.DashboardInvoices),
  {
    ssr: false,
    loading: () => <div className="h-[180px] sm:h-[200px] rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
  }
);

// ─── Greeting ──────────────────────────────────────────────────────────────

const Greeting = memo(function Greeting({
  t,
}: {
  t: Translate;
}) {
  const h = new Date().getHours();
  const k = h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night";
  const label = k === "morning" ? "صبح بخیر" : k === "afternoon" ? "ظهر بخیر" : k === "evening" ? "عصر بخیر" : "شب بخیر";

  return (
    <header className="space-y-1 sm:space-y-1.5">
      <h1 className="flex items-center gap-1.5 sm:gap-2 text-xl sm:text-2xl md:text-3xl font-bold text-[hsl(var(--fg-primary))]">
        {t(`dashboard.greeting.${k}`, label)}
        <Sparkles className="size-4 sm:size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
      </h1>
      <p className="text-xs sm:text-sm text-[hsl(var(--fg-secondary))]">
        {t("dashboard.subtitle")}
      </p>
    </header>
  );
});
Greeting.displayName = "Greeting";

// ─── AI Insight ────────────────────────────────────────────────────────────

const AIInsightBanner = memo(function AIInsightBanner({
  insights,
  isLoading,
  onAction,
}: {
  insights: AIInsight[];
  isLoading: boolean;
  onAction: (action: string) => void;
}) {
  const { t } = useTranslation();
  
  if (isLoading) {
    return (
      <div className="h-14 sm:h-16 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
    );
  }
  
  if (!insights || insights.length === 0) {
    return null;
  }
  
  const insight = insights[0]!;
  
  return (
    <section
      className="rounded-2xl border border-[hsl(var(--color-primary)/0.2)] bg-[hsl(var(--color-primary)/0.05)] p-3 sm:p-4"
      aria-label={t("dashboard.aiInsight.aria")}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2.5 sm:gap-3">
        <div className="rounded-full bg-[hsl(var(--color-primary)/0.1)] p-1.5 sm:p-2 shrink-0">
          <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-[hsl(var(--fg-primary))] line-clamp-1">
            {insight.title}
          </p>
          <p className="text-[10px] sm:text-sm text-[hsl(var(--fg-secondary))] line-clamp-2">
            {insight.description}
          </p>
          {insight.action && (
            <button
              onClick={() => onAction(insight.action!)}
              className="mt-1 sm:mt-2 text-[10px] sm:text-sm font-medium text-[hsl(var(--color-primary))] hover:underline focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] rounded-md px-1.5 sm:px-2 py-0.5"
            >
              {insight.actionLabel || t("dashboard.aiInsight.action")}
            </button>
          )}
        </div>
      </div>
    </section>
  );
});
AIInsightBanner.displayName = "AIInsightBanner";

// ─── Main Component ───────────────────────────────────────────────────────

export const DashboardView = memo(function DashboardView(props: DashboardViewProps) {
  const {
    t,
    fmt,
    todaySales,
    todayInvoices,
    monthlyRevenue,
    monthlyGrowth,
    pendingPayments,
    pendingPaymentsCount,
    activeCustomers,
    customerGrowth,
    lowStockAlerts,
    lowStockItems,
    kpiLoading,
    insights,
    insightsLoading,
    salesChartData,
    chartLoading,
    dateRange,
    invLoading,
    recentInvoices,
    onNavigate,
    onNavigateWarehouse,
    onNavigateCustomers,
    onNavigateQuickInvoice,
    onNavigateInvoice,
    onViewAllInvoices,
    onInsightAction,
    onDateRangeChange,
  } = props;

  const handleHealthAction = (action: "invoice" | "payments" | "warehouse" | "customers") => {
    switch (action) {
      case "invoice":
        onNavigateQuickInvoice();
        break;
      case "payments":
        onNavigate("/invoices?filter=pending");
        break;
      case "warehouse":
        onNavigateWarehouse();
        break;
      case "customers":
        onNavigateCustomers();
        break;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Level 1: Context */}
      <Greeting t={t} />
      
      {/* Level 2: What's important */}
      <AIInsightBanner
        insights={insights}
        isLoading={insightsLoading}
        onAction={onInsightAction}
      />

      {/* Level 3: Business Health Panel */}
      <BusinessHealthPanel
        data={{
          todaySales,
          todayInvoices,
          monthlyRevenue,
          monthlyGrowth,
          pendingPayments,
          pendingPaymentsCount,
          activeCustomers,
          customerGrowth,
          lowStockAlerts,
          lowStockItems,
        }}
        isLoading={kpiLoading}
        onAction={handleHealthAction}
      />

      {/* Level 4: Deep Dive */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Chart - 2 columns */}
        <div className="lg:col-span-2">
          <div className={cn(
            "rounded-2xl border border-[hsl(var(--border-default))]",
            "bg-[hsl(var(--surface-elevated))]",
            "p-4 sm:p-5"
          )}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-3 sm:mb-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <TrendingUp className="size-4 sm:size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
                <h2 className="text-sm sm:text-base font-semibold text-[hsl(var(--fg-primary))]">
                  {t("dashboard.salesChart")}
                </h2>
              </div>
              <DateRangePicker
                value={dateRange}
                onChange={onDateRangeChange}
                t={t}
                disabled={chartLoading}
              />
            </div>
            <LazySalesChart
              data={salesChartData}
              isLoading={chartLoading}
              fmt={fmt}
              height={180}
              previousPeriodTotal={monthlyRevenue}
              currentPeriodTotal={todaySales}
              onViewFullReport={() => onNavigate("/reports")}
            />
          </div>
        </div>

        {/* Recent Invoices - 1 column */}
        <div className="lg:col-span-1">
          <div className={cn(
            "rounded-2xl border border-[hsl(var(--border-default))]",
            "bg-[hsl(var(--surface-elevated))]",
            "overflow-hidden"
          )}>
            <div className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 pt-4 sm:pt-5 pb-2 sm:pb-3">
              <Receipt className="size-4 sm:size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
              <h2 className="text-sm sm:text-base font-semibold text-[hsl(var(--fg-primary))]">
                {t("dashboard.recentInvoices")}
              </h2>
            </div>
            <div className="px-4 sm:px-6 pb-4 sm:pb-5">
              <LazyDashboardInvoices
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
      </div>
    </div>
  );
});

DashboardView.displayName = "DashboardView";