// packages/ui/src/hooks/dashboard/use-dashboard.ts
"use client"

import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useInvoices, useProducts, useDashboardKPIs, useAIInsights } from "@hisabche/api"
import { mapRecentInvoices } from "../../lib/dashboard/dashboard-mappers"
import type { InvoicesResponse } from "../../lib/dashboard/dashboard-types"

export function useDashboard() {
  const { t } = useTranslation()

  // APIهای جدید (فاز ۲۲ + ۲۳)
  const { data: kpis, isLoading: kpiLoading } = useDashboardKPIs()
  const { data: insights, isLoading: insightsLoading } = useAIInsights()

  // APIهای قبلی
  const { data: invoicesData, isLoading: invLoading } = useInvoices({
    page: 1,
    limit: 5,
    sortDirection: "desc",
  }) as { data: InvoicesResponse | undefined; isLoading: boolean }

  const { data: productsData, isLoading: prodLoading } = useProducts({
    page: 1,
    limit: 100,
    sortDirection: "desc",
    lowStock: true,
  })

  // مقادیر KPI (از API جدید، fallback به قدیم)
  const todaySales = kpis?.todaySales ?? (invoicesData as any)?.summary?.todaySales ?? 0
  const todayInvoices = kpis?.todayInvoices ?? 0
  const monthlyRevenue = kpis?.monthlyRevenue ?? 0
  const monthlyGrowth = kpis?.monthlyGrowth ?? 0
  const pendingPayments = kpis?.pendingPayments ?? 0
  const activeCustomers = kpis?.activeCustomers ?? 0
  const lowStockAlerts = kpis?.lowStockAlerts ?? (invoicesData as any)?.summary?.lowStockCount ?? 0
  const totalDebt = (invoicesData as any)?.summary?.totalDebt ?? 0

  const simpleT = (key: string): string => t(key)

  const recentInvoices = useMemo(
    () => mapRecentInvoices(invoicesData?.invoices, simpleT),
    [invoicesData, t]
  )

  return {
    // KPIهای جدید (فاز ۲۲)
    todaySales,
    todayInvoices,
    monthlyRevenue,
    monthlyGrowth,
    pendingPayments,
    activeCustomers,
    lowStockAlerts,
    // قبلی
    totalDebt,
    recentInvoices,
    // AI (فاز ۲۳)
    insights: insights ?? [],
    // Loading states
    kpiLoading,
    insightsLoading,
    invLoading,
    prodLoading,
  }
}