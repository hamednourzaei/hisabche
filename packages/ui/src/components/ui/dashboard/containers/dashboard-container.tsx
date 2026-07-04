// packages/ui/src/components/ui/dashboard/containers/dashboard-container.tsx
"use client"

import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useDashboardKPIs, useAIInsights, useDashboardSales, type SalesDataPoint } from "@hisabche/api"
import { DashboardView } from "../dashboard-view"
import { fmt } from "../../../../lib/dashboard/dashboard-format"
import { useState, useCallback, useMemo } from "react"
import type { DateRange, PresetKey } from "../date-range-picker"

interface RecentInvoice {
  id: string;
  customer: string;
  total: number;
  date: string;
}

export function DashboardContainer() {
  const { t } = useTranslation()
  const router = useRouter()

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);
    return { from: weekAgo, to: today };
  });

  const { 
    data: kpis, 
    isLoading: kpiLoading 
  } = useDashboardKPIs();

  const { 
    data: insights, 
    isLoading: insightsLoading 
  } = useAIInsights();

  const fromDate = dateRange.from ? dateRange.from.toISOString().slice(0, 10) : undefined;
  const toDate = dateRange.to ? dateRange.to.toISOString().slice(0, 10) : undefined;

  const { 
    data: salesData, 
    isLoading: salesLoading 
  } = useDashboardSales({
    ...(fromDate && { from: fromDate }),
    ...(toDate && { to: toDate }),
  });

  const handleDateRangeChange = useCallback((range: DateRange, _preset: PresetKey) => {
    setDateRange(range);
  }, []);

  const safeT = (key: string, fallback?: string) => {
    const v = t(key)
    return v !== key ? v : (fallback ?? key)
  }

  const handleAction = (action: string) => {
    router.push(action)
  }

  const salesChartData: SalesDataPoint[] = useMemo(() => {
    if (salesData?.data && salesData.data.length > 0) {
      return salesData.data;
    }
    
    const days = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
    const today = new Date();
    
    return days.map((label, i) => {
      const d = new Date(today.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
      return {
        label,
        value: 0,
        date: d.toISOString().slice(0, 10),
      };
    });
  }, [salesData]);

  const recentInvoices: RecentInvoice[] = [];

  return (
    <DashboardView
      t={safeT}
      fmt={fmt}
      todaySales={kpis?.todaySales ?? 0}
      todayInvoices={kpis?.todayInvoices ?? 0}
      monthlyRevenue={kpis?.monthlyRevenue ?? 0}
      monthlyGrowth={kpis?.monthlyGrowth ?? 0}
      pendingPayments={kpis?.pendingPayments ?? 0}
      activeCustomers={kpis?.activeCustomers ?? 0}
      lowStockAlerts={kpis?.lowStockAlerts ?? 0}
      insights={insights ?? []}
      insightsLoading={insightsLoading}
      kpiLoading={kpiLoading}
      salesChartData={salesChartData}
      chartLoading={salesLoading}
      dateRange={dateRange}
      totalDebt={kpis?.pendingPayments ?? 0}
      invLoading={false}
      prodLoading={false}
      recentInvoices={recentInvoices}
      onNavigate={(route) => router.push(route)}
      onNavigateGodam={() => router.push("/godam")}
      onNavigateBaqidari={() => router.push("/baqidari")}
      onNavigateQuickInvoice={() => router.push("/quick-invoice")}
      onNavigateInvoice={(id) => router.push(`/invoices/${id}`)}
      onViewAllInvoices={() => router.push("/invoices")}
      onInsightAction={handleAction}
      onDateRangeChange={handleDateRangeChange}
    />
  )
}