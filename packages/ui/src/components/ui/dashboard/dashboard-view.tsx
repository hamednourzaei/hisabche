// packages/ui/src/components/ui/dashboard/dashboard-view.tsx
"use client";

import { cn } from "@/lib/utils";
import { Sparkles, Receipt, TrendingUp } from "lucide-react";
import { StatCard } from "./dashboard-stats";
import { KPICards } from "./kpi-cards";
import { AIInsights } from "./ai-insights";
import { DashboardInvoices } from "./dashboard-invoices";
import { SalesChart, type ChartDataPoint } from "./sales-chart";
import { DateRangePicker, type DateRange, type PresetKey } from "./date-range-picker";
import type { AIInsight } from "@hisabche/api";

interface DashboardViewProps {
  t: (key: string, fallback?: string) => string;
  fmt: (v: number) => string;
  // KPI
  todaySales: number;
  todayInvoices: number;
  monthlyRevenue: number;
  monthlyGrowth: number;
  pendingPayments: number;
  activeCustomers: number;
  lowStockAlerts: number;
  kpiLoading: boolean;
  // AI Insights
  insights: AIInsight[];
  insightsLoading: boolean;
  // Chart
  salesChartData: ChartDataPoint[];
  chartLoading: boolean;
  dateRange: DateRange;
  // Debt/Invoices
  totalDebt: number;
  invLoading: boolean;
  prodLoading: boolean;
  recentInvoices: Array<{
    id: string;
    customer: string;
    total: number;
    date: string;
  }>;
  // Navigation
  onNavigate: (route: string) => void;
  onNavigateGodam: () => void;
  onNavigateBaqidari: () => void;
  onNavigateQuickInvoice: () => void;
  onNavigateInvoice: (id: string) => void;
  onViewAllInvoices: () => void;
  onInsightAction: (action: string) => void;
  // Date Range
  onDateRangeChange: (range: DateRange, preset: PresetKey) => void;
}

function Greeting({ t }: { t: (key: string, fallback?: string) => string }) {
  const h = new Date().getHours();
  const k =
    h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night";
  const greetings: Record<string, string> = {
    morning: "صبح بخیر",
    afternoon: "ظهر بخیر",
    evening: "عصر بخیر",
    night: "شب بخیر",
  };
  return (
    <div className="space-y-1.5">
      <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl text-[hsl(var(--fg-primary))]">
        {t(`dashboard.greeting.${k}`, greetings[k])}
        <Sparkles
          className="size-5 text-[hsl(var(--color-primary))]"
          aria-hidden="true"
        />
      </h1>
      <p className="text-sm text-[hsl(var(--fg-secondary))]">
        {t("dashboard.subtitle", "آمار چه خبر از کسب‌وکارت؟")}
      </p>
    </div>
  );
}

export function DashboardView(props: DashboardViewProps) {
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
    onNavigateGodam,
    onNavigateBaqidari,
    onNavigateQuickInvoice,
    onNavigateInvoice,
    onViewAllInvoices,
    onInsightAction,
    onDateRangeChange,
  } = props;

  return (
    <div className="space-y-6">
      <Greeting t={t} />

      {/* KPI Cards */}
      <KPICards
        data={{
          todaySales,
          todayInvoices,
          monthlyRevenue,
          monthlyGrowth,
          pendingPayments,
          activeCustomers,
          lowStockAlerts,
        }}
        isLoading={kpiLoading}
        onNavigate={onNavigate}
      />

      {/* Sales Chart + Date Range */}
      <div
        className={cn(
          "rounded-2xl border border-[hsl(var(--border-default))]",
          "bg-[hsl(var(--surface-elevated))]",
          "p-5",
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

          {/* ✅ Date Range Picker */}
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
              "overflow-hidden",
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
}