// ============================================
// Dashboard — priority based.
// One hero KPI, a quick-action row, secondary tiles, then trends.
// Data comes from the shared analytics hooks; no local business logic.
// ============================================

import React, { useCallback, useMemo } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import {
  useAIInsights,
  useDashboardKPIs,
  useDashboardSales,
  type AIInsight,
  type SalesDataPoint,
} from '@hisabche/api'
import {
  ErrorState,
  HeroMetricCard,
  MetricCard,
  MobileCard,
  QuickAction,
  SectionHeader,
  useLayout,
  useTheme,
} from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { useCommonT } from '../../../shared/i18n/use-common-t'
import { DashboardHeader } from '../components/dashboard-header'
import { RecentActivitiesCard } from '../components/recent-activities-card'
import { formatAmount, useCurrencySign } from '../../../shared/lib/format'
import { useCurrency } from '../../settings/preferences.store'
import { InsightCard } from '../components/insight-card'
import { SalesTrendCard } from '../components/sales-trend-card'

export function DashboardScreen() {
  const { t } = useTranslation('mobile')
  // KPI and section labels come from the shared catalog. The mobile-only
  // `home.*` copy had drifted — «کل فروش» vs web's «فروش کل», «ارزش انبار» vs
  // «ارزش کل انبار» — so the same number was captioned differently per device.
  const tCommon = useCommonT()
  const { spacing, colors } = useTheme()
  const { isWide } = useLayout()
  // Two per row on a phone, three across on a tablet — the same widening web
  // does at its `lg` breakpoint.
  const tileBasis = isWide ? '30%' : '45%'
  const router = useRouter()
  const currency = useCurrency()
  const sign = useCurrencySign(currency)

  const kpis = useDashboardKPIs()
  const sales = useDashboardSales()
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
        <DashboardHeader />
        <ErrorState
          title={t('common.error')}
          description={kpis.error instanceof Error ? kpis.error.message : undefined}
          retryLabel={t('common.retry')}
          onRetry={onRefresh}
        />
      </AppScreen>
    )
  }

  return (
    <AppScreen>
      <DashboardHeader />

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
        <HeroMetricCard
          label={tCommon('dashboard.totalSales')}
          amount={amount(data?.totalSales)}
          sign={sign}
          trend={data?.monthlyGrowth}
          trendLabel={t('home.vsLastMonth')}
          series={series}
          loading={kpis.isLoading}
        />

        <MobileCard variant="muted" elevated="none" padding="sm">
          <View style={{ flexDirection: 'row' }}>
            <QuickAction
              tone="brand"
              label={t('home.quickInvoice')}
              icon={<Ionicons name="add" size={22} color={colors.primary} />}
              onPress={() => router.push('/(tabs)/quick-invoice')}
            />
            <QuickAction
              label={t('inventory.scanBarcode')}
              icon={<Ionicons name="barcode-outline" size={22} color={colors.fgSecondary} />}
              onPress={() => router.push('/warehouse/scan')}
            />
            <QuickAction
              label={t('customers.title')}
              icon={<Ionicons name="people-outline" size={22} color={colors.fgSecondary} />}
              onPress={() => router.push('/customers')}
            />
            <QuickAction
              label={t('accounting.title')}
              icon={<Ionicons name="stats-chart-outline" size={22} color={colors.fgSecondary} />}
              onPress={() => router.push('/accounting')}
            />
          </View>
        </MobileCard>

        {/* Secondary KPIs. Web renders these as `grid-cols-2 lg:grid-cols-4`;
            a phone has room for two per row, a tablet for all three, so the row
            wraps on a width the layout hook derives from the same breakpoints. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          <View style={{ flexBasis: tileBasis, flexGrow: 1, minWidth: 150 }}>
            <MetricCard
              label={tCommon('dashboard.todaySales')}
              amount={amount(data?.todaySales)}
              sign={sign}
              loading={kpis.isLoading}
              icon={<Ionicons name="today-outline" size={15} color={colors.primary} />}
            />
          </View>
          <View style={{ flexBasis: tileBasis, flexGrow: 1, minWidth: 150 }}>
            <MetricCard
              label={tCommon('dashboard.customerDebt')}
              amount={amount(data?.customerDebt)}
              sign={sign}
              tone="warning"
              trend={data?.customerGrowth}
              loading={kpis.isLoading}
              onPress={() => router.push('/customers')}
              icon={<Ionicons name="wallet-outline" size={15} color={colors.primary} />}
            />
          </View>
          <View style={{ flexBasis: tileBasis, flexGrow: 1, minWidth: 150 }}>
            <MetricCard
              label={tCommon('dashboard.warehouseValue')}
              amount={amount(data?.warehouseValue)}
              sign={sign}
              loading={kpis.isLoading}
              onPress={() => router.push('/(tabs)/warehouse')}
              icon={<Ionicons name="cube-outline" size={15} color={colors.primary} />}
            />
          </View>
        </View>

        <SalesTrendCard
          points={sales.data?.data ?? []}
          total={amount(sales.data?.total)}
          sign={sign}
          loading={sales.isLoading}
        />

        {/* Level 4 on web, same position here: the feed closes the page. */}
        <RecentActivitiesCard />

        {insights.data && insights.data.length > 0 ? (
          <View>
            <SectionHeader title={tCommon('dashboard.aiInsights', 'پیشنهادهای هوشمند')} />
            <View style={{ gap: spacing.md }}>
              {insights.data.slice(0, 4).map((insight: AIInsight) => (
                <InsightCard key={insight.title} insight={insight} />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </AppScreen>
  )
}
