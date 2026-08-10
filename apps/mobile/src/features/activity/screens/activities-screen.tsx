// ============================================
// Activities — the mobile rendering of the web activity feed.
//
// Same data (`useActivities`), same grouping (one card per entity, its
// activities nested), same copy keys as the shared feed. The web feed opens the
// entity via `entitySummary.route`; those routes are web paths, which mobile now
// serves under the same names, so the link works here unchanged.
// ============================================

import React, { useCallback } from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useActivities, useMarkAllAsRead, useUnreadCount, type ActivityGroup } from '@hisabche/api'
import { Badge, Button, MobileCard, StatusChip, Text, useTheme } from '@hisabche/mobile-ui'
import type { BadgeTone } from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { QueryList } from '../../../shared/components/query-list'
import { ScreenHeader } from '../../../shared/components/screen-header'
import { formatDate } from '../../../shared/lib/format'
import { hrefFor } from '../../../shared/navigation/nav'

/** Priority reads as urgency, which is what the web feed's accent colour says. */
const PRIORITY_TONE: Record<ActivityGroup['priority'], BadgeTone> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  urgent: 'destructive',
}

/** How many activities a card shows before it stops. The web feed collapses the
 *  same way behind «نمایش بیشتر»; tapping the card opens the full entity. */
const PREVIEW_ACTIVITIES = 3

export function ActivitiesScreen() {
  const { t } = useTranslation('common')
  const { spacing } = useTheme()
  const router = useRouter()

  const { data, isLoading, isRefetching, error, refetch } = useActivities()
  const unread = useUnreadCount()
  const markAllAsRead = useMarkAllAsRead()

  const openEntity = useCallback(
    (group: ActivityGroup) => {
      if (group.entitySummary.route) router.push(hrefFor(group.entitySummary.route))
    },
    [router],
  )

  const renderGroup = useCallback(
    ({ item }: { item: ActivityGroup }) => (
      <MobileCard
        padding="lg"
        onPress={item.entitySummary.route ? () => openEntity(item) : undefined}
      >
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {item.entitySummary.label}
              </Text>
              {item.entitySummary.subtitle ? (
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {item.entitySummary.subtitle}
                </Text>
              ) : null}
            </View>
            {item.unreadCount > 0 ? (
              <Badge label={String(item.unreadCount)} tone="primary" />
            ) : null}
            <StatusChip
              label={formatDate(item.latestAt)}
              tone={PRIORITY_TONE[item.priority] ?? 'neutral'}
            />
          </View>

          <View style={{ gap: spacing.xs }}>
            {item.activities.slice(0, PREVIEW_ACTIVITIES).map((activity) => (
              <View key={activity.id} style={{ gap: 2 }}>
                <Text variant="caption" numberOfLines={1}>
                  {activity.title}
                </Text>
                <Text variant="legal" tone="tertiary" numberOfLines={1}>
                  {t('activity.by')} {activity.actor} · {formatDate(activity.timestamp)}
                </Text>
              </View>
            ))}
            {item.activities.length > PREVIEW_ACTIVITIES ? (
              <Text variant="legal" tone="tertiary">
                {t('activity.showMore')}
              </Text>
            ) : null}
          </View>
        </View>
      </MobileCard>
    ),
    [openEntity, spacing, t],
  )

  const hasUnread = (unread.data ?? 0) > 0

  return (
    <AppScreen>
      <ScreenHeader
        title={t('activity.title')}
        trailing={
          hasUnread ? (
            <Button
              testID="mark-all-read"
              label={t('activity.markAllRead')}
              size="sm"
              variant="ghost"
              loading={markAllAsRead.isPending}
              onPress={() => markAllAsRead.mutate()}
            />
          ) : undefined
        }
      />

      <QueryList<ActivityGroup>
        data={data}
        estimatedItemSize={168}
        isLoading={isLoading}
        isRefetching={isRefetching}
        error={error}
        onRetry={refetch}
        keyExtractor={(item, index) => `${item.entityType}-${item.entityId}-${index}`}
        emptyTitle={t('activity.empty')}
        renderItem={renderGroup}
      />
    </AppScreen>
  )
}
