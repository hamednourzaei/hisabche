// packages/ui/src/components/ui/dashboard/containers/dashboard-container.tsx
"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { DashboardView } from "../dashboard-view";
import { DateRangePicker, type DateRange, type PresetKey } from "../date-range-picker";
import { useDashboardData } from "../../../../hooks/dashboard/use-dashboard-data";
import { fmt } from "../../../../lib/dashboard/dashboard-format";

// ─── Types ─────────────────────────────────────────────────────────────────

type Translate = (key: string) => string;

// ─── Main Container ──────────────────────────────────────────────────────

export function DashboardContainer() {
  const t = useTranslations();
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
    recentInvoices,
    lowStockItems,
    pendingPaymentsCount,
    customerGrowth,
    lowStockAlerts,
    kpiLoading,
    insightsLoading,
    chartLoading,
    invLoading,
  } = useDashboardData(dateRange);

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
      todaySales={kpis?.todaySales ?? 0}
      todayInvoices={kpis?.todayInvoices ?? 0}
      monthlyRevenue={kpis?.monthlyRevenue ?? 0}
      monthlyGrowth={kpis?.monthlyGrowth ?? 0}
      pendingPayments={kpis?.pendingPayments ?? 0}
      pendingPaymentsCount={pendingPaymentsCount}
      activeCustomers={kpis?.activeCustomers ?? 0}
      customerGrowth={customerGrowth}
      lowStockAlerts={lowStockAlerts}
      lowStockItems={lowStockItems}
      kpiLoading={kpiLoading}
      insights={insights ?? []}
      insightsLoading={insightsLoading}
      salesChartData={salesChartData}
      chartLoading={chartLoading}
      dateRange={dateRange}
      invLoading={invLoading}
      recentInvoices={recentInvoices}
      onNavigate={(route) => router.push(route)}
      onNavigateWarehouse={() => router.push("/warehouse")}
      onNavigateCustomers={() => router.push("/customers")}
      onNavigateQuickInvoice={() => router.push("/quick-invoice")}
      onNavigateInvoice={(id) => router.push(`/invoices/${id}`)}
      onViewAllInvoices={() => router.push("/invoices")}
      onInsightAction={handleAction}
      onDateRangeChange={handleDateRangeChange}
    />
  );
}