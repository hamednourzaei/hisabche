// ============================================
// Sync centre — inspect and retry the offline outbox.
// ============================================

import React, { useCallback, useMemo } from 'react'
import { ScrollView, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import {
  Button,
  EmptyState,
  MetricCard,
  MobileCard,
  StatusChip,
  Text,
  useTheme,
} from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { NavScreenHeader } from '../../../shared/components/nav-screen-header'
import { useCommonT } from '../../../shared/i18n/use-common-t'
import { formatDate } from '../../../shared/lib/format'
import { useOutboxStore, type OutboxStatus } from '../outbox.store'
import { retryEntry, runSync } from '../sync-runner'
import { useIsOffline } from '../use-outbox'
import type { ComponentProps } from 'react'

type IconName = ComponentProps<typeof Ionicons>['name']

const TONE: Record<OutboxStatus, 'warning' | 'info' | 'destructive'> = {
  pending: 'warning',
  syncing: 'info',
  failed: 'destructive',
}

export function SyncScreen() {
  const { t } = useTranslation('mobile')
  const tCommon = useCommonT()
  const { spacing, colors } = useTheme()
  const queryClient = useQueryClient()

  const entries = useOutboxStore((s) => s.entries)
  const lastSyncedAt = useOutboxStore((s) => s.lastSyncedAt)
  const offline = useIsOffline()

  const onSyncAll = useCallback(() => void runSync(queryClient), [queryClient])

  // Web's KPI cards: connection / backups / pending / storage. Mobile maps the
  // meaningful subset: connection (آنلاین/آفلاین), pending count, last synced.
  const kpis = useMemo<{ id: string; icon: IconName; label: string; value: string }[]>(
    () => [
      {
        id: 'connection',
        icon: offline ? 'cloud-offline' : 'cloud-done',
        label: tCommon('sync.connectionStatus', 'وضعیت اتصال'),
        value: offline ? t('sync.offline') : t('sync.online', 'آنلاین'),
      },
      {
        id: 'pending',
        icon: 'time-outline',
        label: tCommon('sync.pending', 'عملیات معلق').replace('{count}', String(entries.length)),
        value: String(entries.length),
      },
      {
        id: 'last-synced',
        icon: 'checkmark-circle-outline',
        label: tCommon('sync.lastSynced', 'آخرین همگام‌سازی').replace('{time}', ''),
        value: lastSyncedAt ? formatDate(lastSyncedAt) : t('sync.never'),
      },
    ],
    [entries.length, lastSyncedAt, offline, t, tCommon],
  )

  return (
    <AppScreen>
      <NavScreenHeader
        id="sync"
        subtitle={`${t('sync.lastSync')}: ${lastSyncedAt ? formatDate(lastSyncedAt) : t('sync.never')}`}
      />

      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        {/* KPI header — mirrors web's sync-center cards row. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {kpis.map((kpi) => (
            <View key={kpi.id} style={{ flexBasis: '30%', flexGrow: 1, minWidth: 100 }}>
              <MetricCard
                label={kpi.label}
                amount={kpi.value}
                icon={<Ionicons name={kpi.icon} size={15} color={colors.primary} />}
              />
            </View>
          ))}
        </View>

        {entries.length === 0 ? (
          <View testID="sync-empty">
            <EmptyState title={t('sync.queueEmpty')} />
          </View>
        ) : (
          <>
            <Button testID="sync-now" label={t('sync.syncNow')} fullWidth onPress={onSyncAll} />
            {entries.map((entry, index) => (
              <MobileCard key={entry.clientId} testID={`sync-entry-${index}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Text variant="bodyStrong">{entry.kind}</Text>
                    <Text variant="caption" tone="secondary">
                      {formatDate(entry.createdAt)}
                    </Text>
                    {entry.lastError ? (
                      <Text variant="caption" tone="danger" numberOfLines={2}>
                        {entry.lastError}
                      </Text>
                    ) : null}
                  </View>
                  <StatusChip
                    label={t(`sync.${entry.status}`, { defaultValue: entry.status })}
                    tone={TONE[entry.status]}
                  />
                </View>

                {entry.status === 'failed' ? (
                  <View style={{ marginTop: spacing.sm }}>
                    <Button
                      label={t('common.retry')}
                      variant="ghost"
                      size="sm"
                      onPress={() => retryEntry(entry.clientId, queryClient)}
                    />
                  </View>
                ) : null}
              </MobileCard>
            ))}
          </>
        )}
      </ScrollView>
    </AppScreen>
  )
}
