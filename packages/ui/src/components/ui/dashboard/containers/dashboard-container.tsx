// packages/ui/src/components/ui/dashboard/containers/dashboard-container.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'

import { DashboardView } from '../dashboard-view'
import { WorkQueueContainer } from '../../work-queue/containers/work-queue-container'
import { DateRangePicker, type DateRange, type PresetKey } from '../date-range-picker'
import { useDashboardData } from '../../../../hooks/dashboard/use-dashboard-data'
import { fmt } from '../../../../lib/dashboard/dashboard-format'

// ─── Types ─────────────────────────────────────────────────────────────────

type Translate = (key: string) => string

// ─── Main Container ──────────────────────────────────────────────────────

export function DashboardContainer() {
  const tOriginal = useTranslations()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      try {
        const v = tOriginal(key as Parameters<typeof tOriginal>[0])
        return v && v !== key ? v : (fallback ?? key)
      } catch (err) {
        console.error('[DEBUG dashboard] t() threw for key:', key, err)
        return fallback ?? key
      }
    },
    [tOriginal],
  )
  const router = useRouter()

  // ─── State ──────────────────────────────────────────────────────────────

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date()
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 6)
    return { from: weekAgo, to: today }
  })

  // ─── Data ──────────────────────────────────────────────────────────────

  const {
    kpis,
    insights,
    salesChartData,
    recentActivities,
    kpiLoading,
    insightsLoading,
    chartLoading,
    activitiesLoading,
  } = useDashboardData(dateRange)

  // ─── Callbacks ──────────────────────────────────────────────────────────

  const handleDateRangeChange = useCallback((range: DateRange, _preset: PresetKey) => {
    setDateRange(range)
  }, [])

  const handleAction = useCallback(
    (action: string) => {
      router.push(action)
    },
    [router],
  )

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* §12 — what needs doing, above what happened.
          `capabilities` is empty deliberately: no endpoint reports the
          capabilities the SERVER granted this actor, and inventing a list
          client-side would be a guess standing in for authorization. The
          contract shows only items whose capability is `null` — conflicts,
          approvals and unsent changes — and keeps the rest hidden until a real
          source exists. Under-showing is the safe direction; the alternative
          offers a door that refuses to open. */}
      <WorkQueueContainer capabilities={[]} onNavigate={(route) => router.push(route)} />

      <DashboardView
        t={t}
        fmt={fmt}
        totalSales={kpis?.totalSales ?? 0}
        todaySales={kpis?.todaySales ?? 0}
        customerDebt={kpis?.customerDebt ?? 0}
        warehouseValue={kpis?.warehouseValue ?? 0}
        monthlyGrowth={kpis?.monthlyGrowth ?? null}
        kpiLoading={kpiLoading}
        insights={Array.isArray(insights) ? insights : []}
        insightsLoading={insightsLoading}
        salesChartData={salesChartData}
        chartLoading={chartLoading}
        dateRange={dateRange}
        activitiesLoading={activitiesLoading}
        recentActivities={recentActivities}
        onNavigate={(route) => router.push(route)}
        onInsightAction={handleAction}
        onDateRangeChange={handleDateRangeChange}
      />
    </>
  )
}
