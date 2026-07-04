// packages/ui/src/hooks/dashboard/use-dashboard.ts
"use client"

import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useInvoices, useProducts, useDashboardKPIs, useAIInsights } from "@hisabche/api"
import { mapRecentInvoices } from "../../lib/dashboard/dashboard-mappers"
import type { InvoicesResponse } from "../../lib/dashboard/dashboard-types"

interface InvoicesSummary {
  todaySales?: number
  todayCount?: number
  monthlyRevenue?: number
  totalDebt?: number
  customerCount?: number
}

interface ProductsSummary {
  lowStockCount?: number
}

type InvoicesResponseWithSummary = InvoicesResponse & { summary?: InvoicesSummary }
type ProductsResponseWithSummary = { summary?: ProductsSummary }

export function useDashboard() {
  const { t } = useTranslation()

  const {
    data: kpis,
    isLoading: kpiLoading,
    isError: kpiError,
  } = useDashboardKPIs()

  const { data: insights, isLoading: insightsLoading } = useAIInsights()

  const needsFallback = kpiError || (!kpiLoading && !kpis)

  // ✅ Fix: useInvoices فقط ۱ آرگومان قبول میکنه
  const {
    data: invoicesData,
    isLoading: invLoading,
    isError: invError,
  } = useInvoices(
    { page: 1, limit: 5, sortDirection: "desc" }
  ) as { data: InvoicesResponseWithSummary | undefined; isLoading: boolean; isError: boolean }

  // ✅ Fix: useProducts فقط ۱ آرگومان قبول میکنه
  const {
    data: productsData,
    isLoading: prodLoading,
    isError: prodError,
  } = useProducts(
    { page: 1, limit: 100, sortDirection: "desc" }
  ) as { data: ProductsResponseWithSummary | undefined; isLoading: boolean; isError: boolean }

  // ❌ حذف: دیگه نیازی به enabled نیست
  // اگر میخوای فقط در صورت نیاز فچ بشه، از isEnabled استفاده کن
  // ولی بهتره همیشه فچ بشه و fallback باشه

  const usingFallbackData = needsFallback && (!!invoicesData || !!productsData)
  const hasAnyError = kpiError && invError && prodError

  const todaySales = kpis?.todaySales ?? invoicesData?.summary?.todaySales ?? 0
  const todayInvoices = kpis?.todayInvoices ?? invoicesData?.summary?.todayCount ?? 0
  const monthlyRevenue = kpis?.monthlyRevenue ?? invoicesData?.summary?.monthlyRevenue ?? 0
  const monthlyGrowth = kpis?.monthlyGrowth ?? 0
  const pendingPayments = kpis?.pendingPayments ?? invoicesData?.summary?.totalDebt ?? 0
  const activeCustomers = kpis?.activeCustomers ?? invoicesData?.summary?.customerCount ?? 0
  const lowStockAlerts = kpis?.lowStockAlerts ?? productsData?.summary?.lowStockCount ?? 0
  const totalDebt = invoicesData?.summary?.totalDebt ?? 0

  const simpleT = (key: string): string => t(key)

  const recentInvoices = useMemo(
    () => mapRecentInvoices(invoicesData?.invoices, simpleT),
    [invoicesData, t],
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

    isLoading: kpiLoading || (needsFallback && (invLoading || prodLoading)),
    kpiLoading,
    insightsLoading,
    invLoading,
    prodLoading,

    isError: hasAnyError,
    usingFallbackData,
  }
}