// packages/ui/src/hooks/dashboard/use-dashboard-data.ts
'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  useDashboardKPIs,
  useAIInsights,
  useDashboardSales,
  useInvoices,
  useRealtime,
  useProducts,
  useActivities,
} from '@hisabche/api'
import { mapRecentInvoices, mapLowStockItems } from '../../lib/dashboard/dashboard-mappers'
import { getTodayDate, getDaysAgo } from '../../lib/dashboard/dashboard-utils'
import type { DateRange } from '../../components/ui/dashboard/date-range-picker'
import type { ProductsResponse, RawInvoice } from '../../lib/dashboard/dashboard-types'

// ─── Types ─────────────────────────────────────────────────────────────────

interface RecentInvoice {
  id: string
  customer: string
  total: number
  date: string
}

// ─── Main Hook ────────────────────────────────────────────────────────────

/** `YYYY-MM-DD` moved by whole days, in the calendar the API expects. */
function shiftDay(isoDay: string, days: number): string {
  const d = new Date(`${isoDay}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function useDashboardData(dateRange: DateRange) {
  const t = useTranslations()

  // ─── Data Fetching ──────────────────────────────────────────────────────

  const { data: kpis, isPending: kpiLoading, refetch: refetchKpis } = useDashboardKPIs()

  const { data: insights, isPending: insightsLoading, refetch: refetchInsights } = useAIInsights()

  // ✅ اصلاح: استفاده از تاریخ محلی
  const fromDate = dateRange.from ? dateRange.from.toISOString().slice(0, 10) : getDaysAgo(30)
  const toDate = dateRange.to ? dateRange.to.toISOString().slice(0, 10) : getTodayDate()

  const {
    data: salesData,
    isPending: salesLoading,
    refetch: refetchSales,
  } = useDashboardSales({
    from: fromDate,
    to: toDate,
  })

  // ─── The period before the selected one, of the same length ───────────────
  //
  // ⚠️ A REAL PREVIOUS PERIOD, NOT HALF OF THIS ONE. The range card compares
  // its total against the equally long stretch immediately before it. Without
  // that data the card shows no percentage at all — a delta invented from a
  // window that was never fetched would be a claim with no basis.
  const rangeDays = Math.max(
    1,
    Math.round((new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86_400_000) + 1,
  )
  const { data: previousSalesData, isPending: previousSalesLoading } = useDashboardSales({
    from: shiftDay(fromDate, -rangeDays),
    to: shiftDay(fromDate, -1),
  })

  // `null` while unknown, never 0 — zero is a measurement.
  const rangeSalesTotal = typeof salesData?.total === 'number' ? salesData.total : null
  const previousRangeSalesTotal =
    typeof previousSalesData?.total === 'number' ? previousSalesData.total : null

  const {
    data: invoicesData,
    isLoading: invoicesLoading,
    refetch: refetchInvoices,
  } = useInvoices({
    page: 1,
    limit: 5,
    sortDirection: 'desc',
  })

  const {
    data: productsData,
    isLoading: productsLoading,
    refetch: refetchProducts,
  } = useProducts({
    page: 1,
    limit: 100,
    sortDirection: 'desc',
  })

  const { data: activitiesData, isPending: activitiesLoading } = useActivities()

  // ─── Realtime Subscriptions ─────────────────────────────────────────────

  useRealtime({
    table: 'invoices',
    queryKey: ['invoices'],
  })

  useRealtime({
    table: 'invoices',
    queryKey: ['dashboard'],
  })

  // ─── Data Transformations ──────────────────────────────────────────────

  const recentInvoices: RecentInvoice[] = useMemo(() => {
    const invoices = (invoicesData?.invoices || []) as unknown as RawInvoice[]
    return mapRecentInvoices(invoices, (key) => t(key))
  }, [invoicesData, t])

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

  const lowStockItems = useMemo(() => {
    const products = (productsData as ProductsResponse)?.products
    return mapLowStockItems(products)
  }, [productsData])

  const pendingPaymentsCount = useMemo(() => {
    return kpis?.pendingPaymentsCount ?? 0
  }, [kpis])

  const customerGrowth = useMemo(() => {
    return kpis?.customerGrowth ?? 0
  }, [kpis])

  const lowStockAlerts = useMemo(() => {
    return kpis?.lowStockAlerts ?? 0
  }, [kpis])

  // ─── Return ────────────────────────────────────────────────────────────

  return {
    kpis,
    insights,
    salesChartData,
    rangeSalesTotal,
    previousRangeSalesTotal,
    rangeDays,
    rangeLoading: salesLoading || previousSalesLoading,
    recentInvoices,
    recentActivities: Array.isArray(activitiesData) ? activitiesData : [],
    lowStockItems,
    pendingPaymentsCount,
    customerGrowth,
    lowStockAlerts,
    isLoading: kpiLoading || salesLoading || invoicesLoading || productsLoading,
    kpiLoading,
    insightsLoading,
    chartLoading: salesLoading,
    invLoading: invoicesLoading,
    prodLoading: productsLoading,
    activitiesLoading,
    refetchKpis,
    refetchInsights,
    refetchSales,
    refetchInvoices,
    refetchProducts,
  }
}
