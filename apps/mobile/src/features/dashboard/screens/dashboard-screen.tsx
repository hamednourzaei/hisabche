// ============================================
// Dashboard — visual parity with web.
//
// Web structure:
//   Level 1: Greeting header (time-of-day + sparkles)
//   Level 2: 4 equal KPI cards (2-col grid)
//   Level 3: Sales chart (2/3) + AI Insights (1/3)
//   Level 4: Recent Activities
//
// This screen follows the same hierarchy using shared mobile-ui primitives.
// The hero card and quick actions row were mobile-only inventions that
// diverged from web's equal-weight KPI grid. They are removed here.
// ============================================

import React, { useCallback, useMemo, useState } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { presetRange, type DateRange, type PresetKey } from '@hisabche/ui-contract'
import {
  useAIInsights,
  useDashboardKPIs,
  useDashboardSales,
  type AIInsight,
  type SalesDataPoint,
} from '@hisabche/api'
import {
  MobileCard,
  OfflineBanner,
  Sparkline,
  Text,
  TrendPill,
  useLayout,
  useTheme,
} from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { useCommonT } from '../../../shared/i18n/use-common-t'
import { DateRangeControl } from '../components/date-range-control'
import { RecentActivitiesCard } from '../components/recent-activities-card'
import { formatAmount } from '../../../shared/lib/format'
import { InsightCard } from '../components/insight-card'
import { useSyncRefresh } from '../../offline/use-sync-refresh'
import { asList } from '@hisabche/api'
import { toIsoDay } from '@hisabche/formatting'

// ─── Shared catalog keys ─────────────────────────────────────────────────
// `tCommon` reads the same message catalogs the web app renders through, so
// every label here is the exact string web shows. Fallbacks are for the rare
// key the catalog lacks.

// ─── Percent change vs. previous day — mirrors web's SalesChart ──────────
function percentChange(series: readonly SalesDataPoint[]): number | null {
  if (!series || series.length < 2) return null
  const prev = series[series.length - 2]?.value ?? 0
  if (prev <= 0) return null
  const last = series[series.length - 1]?.value ?? 0
  return ((last - prev) / prev) * 100
}

// ─── Greeting — matches web's Level 1 ────────────────────────────────────

function GreetingHeader() {
  const { spacing } = useTheme()
  const { t: tMobile } = useTranslation('mobile')
  const h = new Date().getHours()
  const key = h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night'
  const label =
    key === 'morning'
      ? 'صبح بخیر'
      : key === 'afternoon'
        ? 'ظهر بخیر'
        : key === 'evening'
          ? 'عصر بخیر'
          : 'شب بخیر'

  return (
    <View style={{ gap: spacing.xs, paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Ionicons name="sparkles" size={18} color="#8B5CF6" />
        <View style={{ flex: 1 }}>
          <Text variant="heading">{tMobile(`dashboard.greeting.${key}`, label)}</Text>
        </View>
      </View>
      <Text variant="caption" tone="secondary">
        {tMobile('dashboard.subtitle', 'امروز چه خبر از کسب‌وکارتان؟')}
      </Text>
    </View>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────

export function DashboardScreen() {
  const tCommon = useCommonT()
  const { t: tMobile } = useTranslation('mobile')
  const { spacing, colors } = useTheme()
  const { columns } = useLayout()
  const router = useRouter()

  const [preset, setPreset] = useState<PresetKey>('7days')
  const [range, setRange] = useState<DateRange>(() => presetRange('7days'))

  const kpis = useDashboardKPIs()
  const sales = useDashboardSales({
    // Local calendar days — toISOString() is UTC and starts the range a day early.
    from: toIsoDay(range.from),
    to: toIsoDay(range.to),
  })
  const insights = useAIInsights()

  // Pull-to-refresh through the sync: queued writes first, then the figures.
  const { refetch: refetchKpis } = kpis
  const { refetch: refetchSales } = sales
  const { refetch: refetchInsights } = insights
  const refetchAll = useCallback(
    () => Promise.all([refetchKpis(), refetchSales(), refetchInsights()]),
    [refetchKpis, refetchSales, refetchInsights],
  )
  const { refreshing, onRefresh, offlineNotice } = useSyncRefresh(refetchAll)

  const amount = useCallback((value: number | undefined) => formatAmount(value ?? 0), [])
  const data = kpis.data

  const series = useMemo(
    () => asList<SalesDataPoint>(sales.data?.data).map((point: SalesDataPoint) => point.value),
    [sales.data],
  )
  // Web's SalesChart computes today's change against the previous point in the
  // series; the greeting header and KPI grid use the same data.
  const todayChange = useMemo(
    () => percentChange(asList<SalesDataPoint>(sales.data?.data)),
    [sales.data],
  )
  const salesEmpty = useMemo(
    () => !sales.data?.data || sales.data.data.length === 0 || series.every((v: number) => v === 0),
    [sales.data, series],
  )

  if (kpis.isError && !data) {
    return (
      <AppScreen>
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}
        >
          <Text variant="body" tone="secondary" style={{ textAlign: 'center' }}>
            {kpis.error instanceof Error ? kpis.error.message : tCommon('common.error')}
          </Text>
        </View>
      </AppScreen>
    )
  }

  // 4 KPI cards matching web's Level 2 — same labels, same Ionicons, same trend logic.
  // Icon mapping mirrors web's lucide set: TrendingUp→trending-up, Wallet→wallet,
  // CreditCard→card, Boxes→cube.
  const kpiCards = [
    {
      icon: 'trending-up' as const,
      label: tCommon('dashboard.totalSales', 'فروش کل'),
      value: amount(data?.totalSales),
      trend: data?.monthlyGrowth ?? undefined,
      trendLabel: tCommon('dashboard.vsLastMonth', 'نسبت به ماه گذشته'),
      loading: kpis.isLoading,
      onPress: undefined,
    },
    {
      icon: 'wallet-outline' as const,
      label: tCommon('dashboard.todaySales', 'فروش امروز'),
      value: amount(data?.todaySales),
      // Same source as web's chart footer: today vs. the previous period.
      trend: todayChange ?? undefined,
      trendLabel: tCommon('dashboard.vsYesterday', 'نسبت به دیروز'),
      loading: kpis.isLoading || sales.isLoading,
      onPress: undefined,
    },
    {
      icon: 'card-outline' as const,
      label: tCommon('dashboard.customerDebt', 'بدهی مشتریان'),
      value: amount(data?.customerDebt),
      trend: undefined,
      trendLabel: undefined,
      loading: kpis.isLoading,
      onPress: () => router.push('/customers'),
    },
    {
      icon: 'cube-outline' as const,
      label: tCommon('dashboard.warehouseValue', 'ارزش کل انبار'),
      value: amount(data?.warehouseValue),
      trend: undefined,
      trendLabel: undefined,
      loading: kpis.isLoading,
      onPress: () => router.push('/(tabs)/warehouse'),
    },
  ]

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 110 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Level 1: Greeting */}
        <GreetingHeader />

        {offlineNotice ? (
          <OfflineBanner
            offline
            pendingCount={0}
            offlineLabel={tMobile('common.offlineLocalData')}
            pendingLabel=""
          />
        ) : null}

        {/* Level 2: 4 KPI cards — 2-col on phones, 4-col wide, same as web's
            `grid-cols-2 lg:grid-cols-4`. Web never stacks these single-column;
            a phone renders two per row exactly as the browser does. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {kpiCards.map((card) => {
            return (
              <View
                key={card.label}
                style={{
                  flexBasis: columns >= 4 ? '24%' : '47%',
                  flexGrow: 1,
                  minWidth: columns >= 4 ? 0 : 150,
                }}
              >
                <MobileCard onPress={card.onPress} padding="md" variant="outlined" elevated="none">
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Ionicons name={card.icon} size={16} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text variant="caption" tone="secondary" numberOfLines={1}>
                        {card.label}
                      </Text>
                    </View>
                  </View>

                  <View style={{ marginTop: spacing.md }}>
                    <Text variant="title" numberOfLines={1}>
                      {card.value}
                    </Text>
                  </View>

                  {card.trend !== undefined && !card.loading ? (
                    <View style={{ marginTop: spacing.sm }}>
                      <TrendPill value={card.trend} label={card.trendLabel} />
                    </View>
                  ) : card.trend === undefined && !card.loading ? (
                    <View style={{ marginTop: spacing.sm }}>
                      <Text variant="caption" tone="tertiary">
                        —
                      </Text>
                    </View>
                  ) : null}
                </MobileCard>
              </View>
            )
          })}
        </View>

        {/* Level 3: Sales chart card + AI Insights —
            mirrors web's SalesChart section semantics exactly. */}
        <View style={{ gap: spacing.lg }}>
          {/* Sales chart — web's `rounded-2xl border surface-elevated p-4` */}
          <MobileCard padding="md" variant="outlined" elevated="none">
            {/* Header: title + date range picker (web's header row) */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: spacing.md,
                minHeight: 36,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name="trending-up" size={16} color={colors.primary} />
                <Text variant="label">{tCommon('dashboard.salesChartTitle', 'نمودار فروش')}</Text>
              </View>
              <DateRangeControl
                value={preset}
                onChange={(next, nextRange) => {
                  setPreset(next)
                  setRange(nextRange)
                }}
              />
            </View>

            {salesEmpty && !sales.isLoading ? (
              /* Empty state — web shows a FileText hero + noSalesYet +
                 بگیرید action; /report redirects to پول و سود like web. */
              <View
                style={{
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingVertical: spacing.xl,
                }}
              >
                <View
                  style={{
                    borderRadius: 999,
                    backgroundColor: colors.primarySoft,
                    padding: spacing.lg,
                  }}
                >
                  <Ionicons name="document-text-outline" size={28} color={colors.primary} />
                </View>
                <View style={{ alignItems: 'center', gap: spacing.xs }}>
                  <Text variant="bodyStrong">
                    {tCommon('dashboard.noSalesYet', 'هنوز فروشی ثبت نشده است')}
                  </Text>
                  <Text variant="caption" tone="tertiary" style={{ textAlign: 'center' }}>
                    {tCommon('dashboard.startSelling', 'اولین فروش خود را ثبت کنید')}
                  </Text>
                </View>
                <Text
                  variant="label"
                  tone="brand"
                  onPress={() => router.push('/(tabs)/quick-invoice')}
                >
                  {tCommon('dashboard.createInvoice', 'ایجاد فاکتور')}
                </Text>
              </View>
            ) : (
              <>
                {/* Header: فروش امروز + مشاهده گزارش ← (web's chart header row) */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: spacing.xs,
                  }}
                >
                  <Text variant="caption" tone="secondary">
                    {tCommon('dashboard.todaySales', 'فروش امروز')}
                  </Text>
                  <Text variant="label" tone="tertiary" onPress={() => router.push('/accounting')}>
                    {tCommon('dashboard.viewReport', 'مشاهده گزارش')} ←
                  </Text>
                </View>

                {/* Hero metric + % change (web's text-3xl hero + vs yesterday pill) */}
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
                  <Text variant="heading" style={{ fontSize: 28 }}>
                    {amount(data?.todaySales ?? 0)}
                  </Text>
                  {todayChange !== null ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <Ionicons
                        name={todayChange >= 0 ? 'arrow-up' : 'arrow-down'}
                        size={13}
                        color={todayChange >= 0 ? colors.success : colors.destructive}
                      />
                      <Text
                        variant="caption"
                        style={{
                          color: todayChange >= 0 ? colors.success : colors.destructive,
                        }}
                      >
                        {Math.abs(todayChange).toFixed(1)}%
                      </Text>
                      <Text variant="legal" tone="tertiary">
                        {tCommon('dashboard.vsYesterday', 'نسبت به دیروز')}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={{ height: spacing.md }} />

                {/* Chart footer metadata — web's `dataRange` line ("Last N periods").
                    `invoiceCount`/`customerCount` series are not in the mobile
                    hook payload, so only the always-on sales legend renders. */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: colors.primary,
                      }}
                    />
                    <Text variant="legal" tone="tertiary">
                      {tCommon('dashboard.salesTrend', 'روند فروش')}
                    </Text>
                  </View>
                  <Text variant="legal" tone="tertiary">
                    {tCommon('dashboard.dataRange', `Last ${series.length} periods`).replace(
                      '{count}',
                      String(series.length),
                    )}
                  </Text>
                </View>

                <View style={{ height: spacing.md }} />

                {/* Sparkline — the chart body itself */}
                {series.length > 1 ? (
                  <Sparkline values={series} height={72} />
                ) : (
                  <View
                    style={{
                      height: 72,
                      borderRadius: 12,
                      backgroundColor: colors.surfaceMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text variant="caption" tone="tertiary">
                      {tCommon('dashboard.noSalesYet', 'هنوز فروشی ثبت نشده است')}
                    </Text>
                  </View>
                )}
              </>
            )}
          </MobileCard>

          {/* AI Insights — equivalent to web's Level 3 right column */}
          {insights.data && insights.data.length > 0 ? (
            <View>
              <Text
                variant="label"
                tone="secondary"
                style={{ marginBottom: spacing.md, paddingHorizontal: spacing.xs }}
              >
                {tCommon('dashboard.aiInsights', 'پیشنهادهای هوشمند')}
              </Text>
              <View style={{ gap: spacing.md }}>
                {insights.data.slice(0, 4).map((insight: AIInsight) => (
                  <InsightCard key={insight.title} insight={insight} />
                ))}
              </View>
            </View>
          ) : null}
        </View>

        {/* Level 4: Recent Activities — bottom of page */}
        <RecentActivitiesCard />
      </ScrollView>
    </AppScreen>
  )
}
