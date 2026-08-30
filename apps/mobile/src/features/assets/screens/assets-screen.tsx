// ============================================
// Fixed assets on a phone.
//
// Web anatomy (packages/ui/components/ui/assets/assets-view.tsx):
//   register → tap an asset → its whole depreciation schedule, dated, with
//   posted / pending / cancelled marked; a run button whose `skipped` list is
//   shown as loudly as its `posted` count.
//
// Mobile shows the same, one asset at a time. The schedule is fetched, never
// re-derived from cost and life: a formula cannot say which two months the
// shop was closed and never posted, and those are the months a late run has to
// recover.
// ============================================

import React, { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  useAssetSchedule,
  useAssets,
  usePostDepreciation,
  type FixedAsset,
  type ScheduleRow,
} from '@hisabche/api'
import { Button, EmptyState, ErrorState, Skeleton, Text, useTheme } from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { NavScreenHeader } from '../../../shared/components/nav-screen-header'
import { useCommonT } from '../../../shared/i18n/use-common-t'
import { MinorMoney, Section, StatRow, StateBadge } from '../../capability/capability-kit'

export function AssetsScreen() {
  useTranslation('mobile')
  const t = useCommonT()
  const { spacing } = useTheme()

  const [selectedId, setSelectedId] = useState<string | null>(null)

  const assets = useAssets()
  const schedule = useAssetSchedule(selectedId ?? '')
  const postDue = usePostDepreciation()

  const rows: ScheduleRow[] = schedule.data ?? []
  const assetList: FixedAsset[] = assets.data ?? []
  const posted = rows.filter((row) => row.posted_at != null)
  const lastPosted = posted[posted.length - 1]

  return (
    <AppScreen>
      <NavScreenHeader id="assets" />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {assets.isLoading ? <Skeleton height={140} /> : null}

        {assets.error ? (
          <ErrorState
            title={t('common.error', 'خطا')}
            description={(assets.error as Error).message}
            retryLabel={t('common.retry', 'تلاش دوباره')}
            onRetry={() => assets.refetch()}
          />
        ) : null}

        {!assets.isLoading && assetList.length === 0 ? (
          <EmptyState
            title={t('assets.empty_title', 'هنوز دارایی ثابتی ثبت نشده')}
            description={t(
              'assets.empty_hint',
              'دارایی ثابت از فاکتور خرید یا از تنظیمات حسابداری ثبت می‌شود.',
            )}
          />
        ) : null}

        {assetList.length > 0 ? (
          <Section title={t('assets.register', 'دفتر دارایی')}>
            {assetList.map((asset) => (
              <Pressable
                key={asset.id}
                onPress={() => setSelectedId(asset.id === selectedId ? null : asset.id)}
              >
                <StatRow
                  label={asset.name}
                  hint={t(`assets.method_${asset.method}`, asset.method)}
                  value={<MinorMoney minor={asset.costMinor} />}
                />
                {asset.disposedOn ? (
                  <StateBadge tone="neutral" label={t('assets.disposed', 'واگذارشده')} />
                ) : null}
              </Pressable>
            ))}

            <View style={{ marginTop: spacing.md }}>
              <Button
                label={t('assets.run_depreciation', 'اجرای استهلاک')}
                onPress={() => postDue.mutate({})}
                loading={postDue.isPending}
                fullWidth
              />
            </View>
          </Section>
        ) : null}

        {postDue.data ? (
          <Section
            title={t('assets.run_result', 'نتیجه‌ی اجرا')}
            subtitle={t('assets.run_hint', 'اجرای دوباره چیزی ثبت نمی‌کند — هر دوره یک بار.')}
          >
            <StatRow
              label={t('assets.posted_count', 'ثبت‌شده')}
              value={String(postDue.data.posted.length)}
            />
            {/* Said out loud: an asset with no accounts configured simply never
                depreciates, and silence is how a year of it goes missing. */}
            {postDue.data.skipped.map((item, index) => (
              <Text
                key={`${item.assetId}-${item.period}-${index}`}
                variant="caption"
                tone="warning"
              >
                {t('assets.period', 'دوره')} {item.period} — {item.reason}
              </Text>
            ))}
          </Section>
        ) : null}

        {selectedId ? (
          <Section
            title={t('assets.schedule', 'جدول استهلاک')}
            subtitle={t('assets.schedule_hint', 'کل جدول از پیش محاسبه شده و تاریخ‌دار است.')}
          >
            {schedule.isLoading ? <Skeleton height={100} /> : null}

            <StatRow
              label={t('assets.accumulated', 'استهلاک انباشته')}
              hint={`${posted.length} / ${rows.length}`}
              value={<MinorMoney minor={lastPosted?.accumulated_minor ?? 0} />}
            />
            <StatRow
              label={t('assets.book_value', 'ارزش دفتری')}
              value={<MinorMoney minor={lastPosted?.book_value_minor ?? 0} />}
            />

            {rows.map((row) => (
              <StatRow
                key={row.period}
                label={`${t('assets.period', 'دوره')} ${row.period} · ${row.on_date?.slice(0, 10)}`}
                hint={
                  row.cancelled_at
                    ? t('assets.cancelled', 'لغوشده')
                    : row.posted_at
                      ? t('assets.posted', 'ثبت‌شده')
                      : t('assets.pending', 'در انتظار')
                }
                value={<MinorMoney minor={row.amount_minor} />}
              />
            ))}
          </Section>
        ) : null}
      </ScrollView>
    </AppScreen>
  )
}
