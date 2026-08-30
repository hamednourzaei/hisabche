// ============================================
// Expiry and batches on a phone.
//
// Web anatomy (packages/ui/components/ui/expiry/expiry-view.tsx):
//   the report with expired first and what that stock is worth, the buckets,
//   and an issue plan that consumes nothing.
//
// Expired leads because it is the only group whose deadline has already
// passed. Batches that have expired appear under `blockedByExpiry`, not as an
// option with a warning, and this screen offers no override — medicine sold
// past its date is not a data-quality problem.
//
// A shortfall is shown as a shortfall. Stock the shop does not have reads as
// missing, never as a plan that quietly covers less than was asked for.
// ============================================

import React, { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  useBatches,
  useExpiryReport,
  usePlanIssue,
  type ExpiryBucket,
  type ExpiryState,
} from '@hisabche/api'
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  Skeleton,
  Text,
  useTheme,
} from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { NavScreenHeader } from '../../../shared/components/nav-screen-header'
import { useCommonT } from '../../../shared/i18n/use-common-t'
import { MinorMoney, Section, StatRow, StateBadge } from '../../capability/capability-kit'

const STATE_TONE = {
  expired: 'destructive',
  near_expiry: 'warning',
  fresh: 'success',
  no_expiry: 'neutral',
} as const

// Expired first. The server already orders the buckets this way; the screen
// states the order it depends on rather than trusting an array's shape.
const STATE_ORDER: ExpiryState[] = ['expired', 'near_expiry', 'fresh', 'no_expiry']

export function ExpiryScreen() {
  useTranslation('mobile')
  const t = useCommonT()
  const { spacing } = useTheme()

  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('')

  const report = useExpiryReport()
  const batches = useBatches()
  const planIssue = usePlanIssue()

  const buckets: ExpiryBucket[] = [...((report.data?.buckets ?? []) as ExpiryBucket[])].sort(
    (a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state),
  )

  return (
    <AppScreen>
      <NavScreenHeader id="expiry" />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {report.isLoading ? <Skeleton height={140} /> : null}

        {report.error ? (
          <ErrorState
            title={t('common.error', 'خطا')}
            description={(report.error as Error).message}
            retryLabel={t('common.retry', 'تلاش دوباره')}
            onRetry={() => report.refetch()}
          />
        ) : null}

        {report.data ? (
          <Section
            title={t('expiry.report', 'گزارش انقضا')}
            subtitle={`${t('expiry.as_of', 'تا تاریخ')}: ${report.data.asOf}`}
          >
            <StatRow
              label={t('expiry.expired_value', 'ارزش کالای منقضی')}
              hint={t('expiry.expired_value_hint', 'در ترازنامه هست، قابل فروش نیست.')}
              value={<MinorMoney minor={report.data.expiredValueMinor} />}
            />
          </Section>
        ) : null}

        {buckets
          .filter((bucket) => bucket.batches.length > 0 && bucket.state !== 'no_expiry')
          .map((bucket) => (
            <Section
              key={bucket.state}
              title={t(`expiry.state_${bucket.state}`, bucket.state)}
              trailing={
                <StateBadge tone={STATE_TONE[bucket.state]} label={String(bucket.totalQuantity)} />
              }
            >
              {bucket.batches.map((batch) => (
                <StatRow
                  key={batch.batchId}
                  label={batch.batchNumber}
                  hint={
                    batch.daysRemaining == null
                      ? (batch.expiryDate ?? undefined)
                      : `${batch.daysRemaining} ${t('expiry.days_remaining', 'روز باقی‌مانده')}`
                  }
                  value={String(batch.quantity)}
                />
              ))}
            </Section>
          ))}

        <Section
          title={t('expiry.plan_title', 'برنامه‌ی مصرف')}
          subtitle={t(
            'expiry.plan_hint',
            'نشان می‌دهد از کدام بچ برداشته می‌شود — چیزی مصرف نمی‌کند. پیش‌فرض FEFO.',
          )}
        >
          <Input
            label={t('expiry.product', 'کالا')}
            value={productId}
            onChangeText={setProductId}
          />
          <View style={{ marginTop: spacing.sm }}>
            <Input
              label={t('expiry.quantity', 'مقدار')}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
            />
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Button
              label={t('expiry.plan_action', 'محاسبه')}
              loading={planIssue.isPending}
              disabled={productId.trim() === '' || (Number(quantity) || 0) <= 0}
              onPress={() => {
                // Cleared first: a plan from a previous product, sitting next
                // to a new product's name, is a plan somebody will act on.
                planIssue.reset()
                planIssue.mutate({
                  productId: productId.trim(),
                  quantity: Number(quantity) || 0,
                })
              }}
              fullWidth
            />
          </View>

          {planIssue.data ? (
            <View style={{ marginTop: spacing.md }}>
              {planIssue.data.shortfall > 0 ? (
                <StateBadge
                  tone="destructive"
                  label={`${t('expiry.shortfall', 'کسری')}: ${planIssue.data.shortfall}`}
                />
              ) : null}

              {planIssue.data.allocations.map((allocation) => (
                <StatRow
                  key={allocation.batchId}
                  label={allocation.batchNumber}
                  hint={allocation.expiryDate ?? undefined}
                  value={String(allocation.quantity)}
                />
              ))}

              {planIssue.data.blockedByExpiry.length > 0 ? (
                <>
                  <Text variant="caption" tone="danger">
                    {t('expiry.blocked', 'به دلیل انقضا کنار گذاشته شد')}
                  </Text>
                  {planIssue.data.blockedByExpiry.map((blocked) => (
                    <StatRow
                      key={blocked.batchId}
                      label={blocked.batchNumber}
                      value={String(blocked.quantity)}
                    />
                  ))}
                </>
              ) : null}
            </View>
          ) : null}
        </Section>

        {!report.isLoading && !report.data && (batches.data ?? []).length === 0 ? (
          <EmptyState
            title={t('expiry.empty_title', 'بچی ثبت نشده')}
            description={t('expiry.empty_hint', 'بچ هنگام دریافت کالای تاریخ‌دار ثبت می‌شود.')}
          />
        ) : null}
      </ScrollView>
    </AppScreen>
  )
}
