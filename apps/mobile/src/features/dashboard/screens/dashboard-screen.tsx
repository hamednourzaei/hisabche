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
import { MobileCard, Sparkline, Text, TrendPill, useLayout, useTheme } from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { useCommonT } from '../../../shared/i18n/use-common-t'
import { DateRangeControl } from '../components/date-range-control'
import { RecentActivitiesCard } from '../components/recent-activities-card'
import { formatAmount } from '../../../shared/lib/format'
import { InsightCard } from '../components/insight-card'

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
  const { spacing, colors } = useTheme()
  const { columns } = useLayout()
  const router = useRouter()

  const [preset, setPreset] = useState<PresetKey>('7days')
  const [range, setRange] = useState<DateRange>(() => presetRange('7days'))

  const kpis = useDashboardKPIs()
  const sales = useDashboardSales({
    from: range.from.toISOString().slice(0, 10),
    to: range.to.toISOString().slice(0, 10),
  })
  const insights = useAIInsights()

  const onRefresh = useCallback(() => {
    void kpis.refetch()
    void sales.refetch()
    void insights.refetch()
  }, [kpis, sales, insights])

  const amount = useCallback((value: number | undefined) => formatAmount(value ?? 0), [])
  const data = kpis.data

  const series = useMemo(
    () => (sales.data?.data ?? []).map((point: SalesDataPoint) => point.value),
    [sales.data],
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
      trend: undefined, // web computes this from chart data; acceptable gap
      trendLabel: undefined,
      loading: kpis.isLoading,
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
            refreshing={kpis.isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Level 1: Greeting */}
        <GreetingHeader />

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

        {/* Level 3: Sales chart card + AI Insights */}
        <View style={{ gap: spacing.lg }}>
          {/* Sales chart — equivalent to web's Level 3 left column */}
          <MobileCard padding="md" variant="outlined" elevated="none">
            {/* Header with title + date range picker */}
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

            {/* Total amount */}
            <View style={{ marginBottom: spacing.md }}>
              <Text variant="caption" tone="secondary">
                {tCommon('dashboard.totalSales', 'فروش کل')}
              </Text>
              <Text variant="title">{amount(sales.data?.total ?? 0)}</Text>
            </View>

            {/* Sparkline */}
            {series.length > 1 ? (
              <Sparkline values={series} height={56} />
            ) : (
              <View
                style={{
                  height: 56,
                  borderRadius: 12,
                  backgroundColor: colors.surfaceMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text variant="caption" tone="tertiary">
                  {tCommon('dashboard.noSalesData', 'هنوز داده‌ی فروشی موجود نیست')}
                </Text>
              </View>
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
