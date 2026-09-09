// packages/ui/src/hooks/dashboard/use-dashboard.ts
'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  useInvoices,
  useProducts,
  useDashboardKPIs,
  useAIInsights,
  useDashboardSales, // ✅ اضافه شد
} from '@hisabche/api'
import { mapRecentInvoices } from '../../lib/dashboard/dashboard-mappers'
import { useCurrency } from './use-currency'
import { getDaysAgo, getTodayDate } from '../../lib/dashboard/dashboard-utils'
import type { InvoicesResponse } from '../../lib/dashboard/dashboard-types'

// ─── Types ─────────────────────────────────────────────────────────────────

interface InvoicesSummary {
  todaySales?: number
  todayCount?: number
  monthlyRevenue?: number
  totalDebt?: number
  customerCount?: number
  pendingCount?: number
}

interface ProductsSummary {
  lowStockCount?: number
  lowStockItems?: Array<{
    id: string
    name: string
    quantity: number
    reorderPoint: number
  }>
}

interface ProductsResponse {
  products?: Array<{
    id: string
    name: string
    quantity: number
    reorderPoint: number
  }>
  summary?: ProductsSummary
}

type InvoicesResponseWithSummary = InvoicesResponse & { summary?: InvoicesSummary }
type ProductsResponseWithSummary = ProductsResponse & { summary?: ProductsSummary }

// ─── Main Hook ─────────────────────────────────────────────────────────────

export function useDashboard() {
  const t = useTranslations()
  const currency = useCurrency()

  // ─── 1. Fetch KPI data ──────────────────────────────────────────────────
  const { data: kpis, isLoading: kpiLoading, isError: kpiError } = useDashboardKPIs()

  // ─── 2. Fetch Sales data for chart (last 7 days) ──────────────────────
  // ✅ اصلاح: استفاده از تاریخ محلی به جای UTC
  // ⚠️ FOURTEEN, NOT SEVEN — IT MUST MATCH WHAT THE SERVER CHARTS.
  //
  // `analytics.service.ts` builds `chartData` from the last FOURTEEN days of
  // whatever range it is asked for. Asking for seven therefore threw away half
  // the window the chart was designed around, and a shop whose last sale was
  // ten days ago got an empty chart — under the words «هنوز فروشی ثبت نشده
  // است», a claim about their whole history made from one week of it.
  //
  // Asking for MORE than fourteen gains nothing: the server's own filter caps
  // it. These two numbers have to agree, and this is the one that was wrong.
  // `sales-chart-window.test.ts` fails if they drift apart again.
  const fromDate = getDaysAgo(14)
  const toDate = getTodayDate()

  const {
    data: salesData,
    isLoading: salesLoading,
    isError: salesError,
  } = useDashboardSales({
    from: fromDate,
    to: toDate,
  })

  // ─── 3. Fetch AI Insights ──────────────────────────────────────────────
  const { data: insights, isLoading: insightsLoading } = useAIInsights()

  // ─── 4. Fetch Invoices (limited to 5 recent) ──────────────────────────
  const {
    data: invoicesData,
    isLoading: invLoading,
    isError: invError,
  } = useInvoices({ page: 1, limit: 5, sortDirection: 'desc' }) as {
    data: InvoicesResponseWithSummary | undefined
    isLoading: boolean
    isError: boolean
  }

  // ─── 5. Fetch Products (for low stock alerts) ─────────────────────────
  const {
    data: productsData,
    isLoading: prodLoading,
    isError: prodError,
  } = useProducts({ page: 1, limit: 100, sortDirection: 'desc' }) as {
    data: ProductsResponseWithSummary | undefined
    isLoading: boolean
    isError: boolean
  }

  // ─── 6. Determine fallback status ──────────────────────────────────────
  const needsFallback = kpiError || (!kpiLoading && !kpis)
  const usingFallbackData = needsFallback && (!!invoicesData || !!productsData)
  const hasAnyError = kpiError || invError || prodError || salesError

  // ─── 7. Compute derived values with fallbacks ─────────────────────────
  const todaySales = kpis?.todaySales ?? invoicesData?.summary?.todaySales ?? 0
  const todayInvoices = kpis?.todayInvoices ?? invoicesData?.summary?.todayCount ?? 0
  const monthlyRevenue = kpis?.monthlyRevenue ?? invoicesData?.summary?.monthlyRevenue ?? 0
  const monthlyGrowth = kpis?.monthlyGrowth ?? 0
  const pendingPayments = kpis?.pendingPayments ?? invoicesData?.summary?.totalDebt ?? 0
  const pendingPaymentsCount =
    kpis?.pendingPaymentsCount ?? invoicesData?.summary?.pendingCount ?? 0
  const activeCustomers = kpis?.activeCustomers ?? invoicesData?.summary?.customerCount ?? 0
  const customerGrowth = kpis?.customerGrowth ?? 0
  const lowStockAlerts = kpis?.lowStockAlerts ?? productsData?.summary?.lowStockCount ?? 0
  const totalDebt = invoicesData?.summary?.totalDebt ?? 0

  // ─── 8. Compute low stock items ────────────────────────────────────────
  const lowStockItems = useMemo(() => {
    if (productsData?.summary?.lowStockItems) {
      return productsData.summary.lowStockItems
    }

    if (!productsData?.products) return []

    return productsData.products
      .filter((p) => p.quantity <= p.reorderPoint)
      .slice(0, 5)
      .map((p) => ({
        name: p.name,
        quantity: p.quantity,
      }))
  }, [productsData])

  // ─── 9. Map recent invoices ────────────────────────────────────────────
  const simpleT = (key: string): string => t(key)

  const recentInvoices = useMemo(
    () => mapRecentInvoices(invoicesData?.invoices, simpleT),
    [invoicesData, t],
  )

  // ─── 10. Sales chart data ──────────────────────────────────────────────
  // ✅ اصلاح: استفاده از داده‌های salesData برای نمودار
  const salesChartData = useMemo(() => {
    if (
      salesData?.chartData &&
      Array.isArray(salesData.chartData) &&
      salesData.chartData.length > 0
    ) {
      return salesData.chartData
    }
    if (salesData?.data && Array.isArray(salesData.data) && salesData.data.length > 0) {
      return salesData.data
    }
    if (Array.isArray(salesData)) {
      return salesData
    }
    return []
  }, [salesData])

  // ─── 11. Return unified dashboard data ────────────────────────────────
  return {
    // KPI Data
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
    totalDebt,

    // Recent Invoices
    recentInvoices,

    // AI Insights
    insights: insights ?? [],

    // Sales Chart Data ✅ اضافه شد
    salesChartData,
    salesLoading,

    // Loading States
    isLoading: kpiLoading || salesLoading || (needsFallback && (invLoading || prodLoading)),
    kpiLoading,
    insightsLoading,
    invLoading,
    prodLoading,

    // Status
    isError: hasAnyError,
    usingFallbackData,
    needsFallback,

    // Utility functions
    fmt: currency.format,
    getSymbol: currency.getSymbol,
    t,
  }
}
