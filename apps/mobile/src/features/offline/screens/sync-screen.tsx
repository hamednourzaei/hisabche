// ============================================
// Sync centre — inspect and retry the offline outbox.
// ============================================

import React, { useCallback } from 'react'
import { ScrollView, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Button, EmptyState, MobileCard, StatusChip, Text, useTheme } from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { ScreenHeader } from '../../../shared/components/screen-header'
import { formatDate } from '../../../shared/lib/format'
import { useOutboxStore, type OutboxStatus } from '../outbox.store'
import { retryEntry, runSync } from '../sync-runner'

const TONE: Record<OutboxStatus, 'warning' | 'info' | 'destructive'> = {
  pending: 'warning',
  syncing: 'info',
  failed: 'destructive',
}

export function SyncScreen() {
  const { t } = useTranslation('mobile')
  const { spacing } = useTheme()
  const queryClient = useQueryClient()

  const entries = useOutboxStore((s) => s.entries)
  const lastSyncedAt = useOutboxStore((s) => s.lastSyncedAt)

  const onSyncAll = useCallback(() => void runSync(queryClient), [queryClient])

  return (
    <AppScreen>
      <ScreenHeader
        title={t('sync.title')}
        subtitle={`${t('sync.lastSync')}: ${lastSyncedAt ? formatDate(lastSyncedAt) : t('sync.never')}`}
      />

      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        {entries.length === 0 ? (
          <EmptyState title={t('sync.queueEmpty')} />
        ) : (
          <>
            <Button label={t('sync.syncNow')} fullWidth onPress={onSyncAll} />
            {entries.map((entry) => (
              <MobileCard key={entry.clientId}>
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
                  <StatusChip label={t(`sync.${entry.status}`, { defaultValue: entry.status })} tone={TONE[entry.status]} />
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
