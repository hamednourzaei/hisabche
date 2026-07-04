// packages/ui/src/components/ui/dashboard/containers/dashboard-container.tsx
"use client"

import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useDashboard } from "../../../../hooks/dashboard/use-dashboard"
import { DashboardView } from "../dashboard-view"
import { fmt } from "../../../../lib/dashboard/dashboard-format"
import { useState, useCallback } from "react"
import type { DateRange, PresetKey } from "../date-range-picker"

export function DashboardContainer() {
  const { t } = useTranslation()
  const router = useRouter()
  const dashboard = useDashboard()

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);
    return { from: weekAgo, to: today };
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

  // Fake chart data (جایگزین با API later)
  const salesChartData = [
    { label: "شنبه", value: 0 },
    { label: "یکشنبه", value: 0 },
    { label: "دوشنبه", value: 0 },
    { label: "سه‌شنبه", value: 0 },
    { label: "چهارشنبه", value: 0 },
    { label: "پنجشنبه", value: 0 },
    { label: "جمعه", value: 0 },
  ];

  return (
    <DashboardView
      t={safeT}
      fmt={fmt}
      todaySales={dashboard.todaySales}
      todayInvoices={dashboard.todayInvoices}
      monthlyRevenue={dashboard.monthlyRevenue}
      monthlyGrowth={dashboard.monthlyGrowth}
      pendingPayments={dashboard.pendingPayments}
      activeCustomers={dashboard.activeCustomers}
      lowStockAlerts={dashboard.lowStockAlerts}
      insights={dashboard.insights}
      insightsLoading={dashboard.insightsLoading}
      kpiLoading={dashboard.kpiLoading}
      salesChartData={salesChartData}
      chartLoading={false}
      dateRange={dateRange}
      totalDebt={dashboard.totalDebt}
      invLoading={dashboard.invLoading}
      prodLoading={dashboard.prodLoading}
      recentInvoices={dashboard.recentInvoices}
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