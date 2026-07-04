// packages/ui/src/hooks/dashboard/use-dashboard.ts
"use client"

import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useInvoices, useProducts, useDashboardKPIs, useAIInsights } from "@hisabche/api"
import { mapRecentInvoices } from "../../lib/dashboard/dashboard-mappers"
import type { InvoicesResponse } from "../../lib/dashboard/dashboard-types"

export function useDashboard() {
  const { t } = useTranslation()

  // API جدید (فاز ۲۲ + ۲۳)
  const { data: kpis, isLoading: kpiLoading } = useDashboardKPIs()
  const { data: insights, isLoading: insightsLoading } = useAIInsights()

  // APIهای قبلی — fallback
  const { data: invoicesData, isLoading: invLoading } = useInvoices({
    page: 1,
    limit: 5,
    sortDirection: "desc",
  }) as { data: InvoicesResponse | undefined; isLoading: boolean }

  const { data: productsData, isLoading: prodLoading } = useProducts({
    page: 1,
    limit: 100,
    sortDirection: "desc",
  })

  // ✅ از داده‌های واقعی invoices/products به عنوان fallback استفاده کن
  const todaySales = kpis?.todaySales 
    ?? (invoicesData as any)?.summary?.todaySales 
    ?? 0
    
  const todayInvoices = kpis?.todayInvoices 
    ?? (invoicesData as any)?.summary?.todayCount 
    ?? 0
    
  const monthlyRevenue = kpis?.monthlyRevenue 
    ?? (invoicesData as any)?.summary?.monthlyRevenue 
    ?? 0
    
  const monthlyGrowth = kpis?.monthlyGrowth ?? 0
  const pendingPayments = kpis?.pendingPayments 
    ?? (invoicesData as any)?.summary?.totalDebt 
    ?? 0
    
  const activeCustomers = kpis?.activeCustomers 
    ?? (invoicesData as any)?.summary?.customerCount 
    ?? 0
    
  const lowStockAlerts = kpis?.lowStockAlerts 
    ?? (productsData as any)?.summary?.lowStockCount 
    ?? 0
    
  const totalDebt = (invoicesData as any)?.summary?.totalDebt ?? 0

  const simpleT = (key: string): string => t(key)

  const recentInvoices = useMemo(
    () => mapRecentInvoices(invoicesData?.invoices, simpleT),
    [invoicesData, t]
  )

  return {
    todaySales,
    todayInvoices,
    monthlyRevenue,
    monthlyGrowth,
    pendingPayments,
    activeCustomers,
    lowStockAlerts,
    totalDebt,
    recentInvoices,
    insights: insights ?? [],
    kpiLoading,
    insightsLoading,
    invLoading,
    prodLoading,
  }
}