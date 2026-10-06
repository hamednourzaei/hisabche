// packages/ui/src/hooks/dashboard/use-dashboard-data.ts
'use client'

import { useMemo } from 'react'
import {
  useDashboardKPIs,
  useAIInsights,
  useDashboardSales,
  useRealtime,
  useActivities,
} from '@hisabche/api'
import { getTodayDate, getDaysAgo } from '../../lib/dashboard/dashboard-utils'
import type { DateRange } from '../../components/ui/dashboard/date-range-picker'
import { toIsoDay } from '@hisabche/formatting'

// ─── Types ─────────────────────────────────────────────────────────────────

// ─── Main Hook ────────────────────────────────────────────────────────────

/** `YYYY-MM-DD` moved by whole days, in the calendar the API expects. */
function shiftDay(isoDay: string, days: number): string {
  const d = new Date(`${isoDay}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Which parts of the dashboard the person is looking at. A part that is off
 * is not fetched and holds no live subscription — hiding it is how somebody
 * who never reads it stops paying for it.
 */
export interface DashboardParts {
  kpis: boolean
  chart: boolean
  insights: boolean
  activities: boolean
}

const ALL_PARTS: DashboardParts = { kpis: true, chart: true, insights: true, activities: true }

export function useDashboardData(dateRange: DateRange, parts: DashboardParts = ALL_PARTS) {
  // ─── Data Fetching ──────────────────────────────────────────────────────

  const {
    data: kpis,
    isPending: kpiLoading,
    refetch: refetchKpis,
  } = useDashboardKPIs({ enabled: parts.kpis })

  const {
    data: insights,
    isPending: insightsLoading,
    refetch: refetchInsights,
  } = useAIInsights({ enabled: parts.insights })

  // ⚠️ LOCAL calendar days. `toISOString()` is UTC: local midnight east of
  // Greenwich is the PREVIOUS day there, so every range started a day early
  // (Kabul +4:30, Tehran +3:30) — the «7 days» chart summed eight.
  const fromDate = dateRange.from ? toIsoDay(dateRange.from) : getDaysAgo(30)
  const toDate = dateRange.to ? toIsoDay(dateRange.to) : getTodayDate()

  const {
    data: salesData,
    isPending: salesLoading,
    refetch: refetchSales,
  } = useDashboardSales(
    {
      from: fromDate,
      to: toDate,
    },
    // The range total is a KPI card AND the chart: read while either is shown.
    { enabled: parts.kpis || parts.chart },
  )

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
  const { data: previousSalesData, isPending: previousSalesLoading } = useDashboardSales(
    {
      from: shiftDay(fromDate, -rangeDays),
      to: shiftDay(fromDate, -1),
    },
    // Only the KPI card compares with the period before.
    { enabled: parts.kpis },
  )

  // `null` while unknown, never 0 — zero is a measurement.
  const rangeSalesTotal = typeof salesData?.total === 'number' ? salesData.total : null
  const previousRangeSalesTotal =
    typeof previousSalesData?.total === 'number' ? previousSalesData.total : null

  const { data: activitiesData, isPending: activitiesLoading } = useActivities(undefined, {
    enabled: parts.activities,
  })

  // ─── Realtime Subscriptions ─────────────────────────────────────────────

  // Anything under the `dashboard` key follows a new invoice — while a part
  // that reads it is shown.
  useRealtime({
    table: 'invoices',
    queryKey: ['dashboard'],
    enabled: parts.kpis || parts.chart || parts.insights,
  })

  // ─── Data Transformations ──────────────────────────────────────────────

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
    recentActivities: Array.isArray(activitiesData) ? activitiesData : [],
    pendingPaymentsCount,
    customerGrowth,
    lowStockAlerts,
    isLoading: kpiLoading || salesLoading,
    kpiLoading,
    insightsLoading,
    chartLoading: salesLoading,
    activitiesLoading,
    refetchKpis,
    refetchInsights,
    refetchSales,
  }
}
