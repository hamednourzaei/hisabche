// packages/ui/src/components/ui/dashboard/containers/dashboard-container.tsx
"use client"

import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useDashboard } from "../../../../hooks/dashboard/use-dashboard"
import { DashboardView } from "../dashboard-view"
import { fmt } from "../../../../lib/dashboard/dashboard-format"

export function DashboardContainer() {
  const { t } = useTranslation()
  const router = useRouter()
  const dashboard = useDashboard()

  const safeT = (key: string, fallback?: string) => {
    const v = t(key)
    return v !== key ? v : (fallback ?? key)
  }

  const handleAction = (action: string) => {
    router.push(action)
  }

  return (
    <DashboardView
      t={safeT}
      fmt={fmt}
      // KPIهای جدید
      todaySales={dashboard.todaySales}
      todayInvoices={dashboard.todayInvoices}
      monthlyRevenue={dashboard.monthlyRevenue}
      monthlyGrowth={dashboard.monthlyGrowth}
      pendingPayments={dashboard.pendingPayments}
      activeCustomers={dashboard.activeCustomers}
      lowStockAlerts={dashboard.lowStockAlerts}
      // AI Insights
      insights={dashboard.insights}
      insightsLoading={dashboard.insightsLoading}
      kpiLoading={dashboard.kpiLoading}
      // قبلی
      totalDebt={dashboard.totalDebt}
      invLoading={dashboard.invLoading}
      prodLoading={dashboard.prodLoading}
      recentInvoices={dashboard.recentInvoices}
      // Navigation
      onNavigate={(route) => router.push(route)}
      onNavigateGodam={() => router.push("/godam")}
      onNavigateBaqidari={() => router.push("/baqidari")}
      onNavigateQuickInvoice={() => router.push("/quick-invoice")}
      onNavigateInvoice={(id) => router.push(`/invoices/${id}`)}
      onViewAllInvoices={() => router.push("/invoices")}
      onInsightAction={handleAction}
    />
  )
}