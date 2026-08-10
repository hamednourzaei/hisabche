// ============================================
// Recent activities — the mobile rendering of the web dashboard's Level 4 panel.
//
// Same data (`useActivities`), same flatten-and-sort rule, same copy keys, same
// tap target (the entity behind the activity). The web panel shows eight rows
// beside a chart; a phone shows five before the section stops earning its
// scroll, and adds a "see all" into the Activities screen — which the web panel
// does not need because its sidebar entry is always visible.
// ============================================

import React, { useCallback, useMemo } from 'react'
import { Pressable, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useActivities, type ActivityGroup } from '@hisabche/api'
import { MobileCard, Skeleton, Text, useTheme } from '@hisabche/mobile-ui'

import { useCommonT } from '../../../shared/i18n/use-common-t'
import { formatDate } from '../../../shared/lib/format'
import { hrefFor } from '../../../shared/navigation/nav'

/** Web shows eight; a phone row costs more vertical space than a table row. */
const PREVIEW_ROWS = 5

interface FlatActivity {
  id: string
  title: string
  timestamp: string
  entityLabel: string
  route: string
}

function flatten(groups: ActivityGroup[] | undefined): FlatActivity[] {
  return (Array.isArray(groups) ? groups : [])
    .flatMap((group) =>
      (group.activities ?? []).map((activity) => ({
        id: activity.id,
        title: activity.title,
        timestamp: activity.timestamp,
        entityLabel: group.entitySummary?.label ?? '',
        route: group.entitySummary?.route ?? '',
      })),
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, PREVIEW_ROWS)
}

export function RecentActivitiesCard() {
  const t = useCommonT()
  const { spacing } = useTheme()
  const router = useRouter()

  const { data, isLoading } = useActivities()
  const items = useMemo(() => flatten(data), [data])

  const open = useCallback(
    (route: string) => {
      if (route) router.push(hrefFor(route))
    },
    [router],
  )

  return (
    <MobileCard padding="lg">
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/activities')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
      >
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {t('dashboard.recentActivities', 'فعالیت‌های اخیر')}
        </Text>
        <Text variant="legal" tone="brand">
          {/* `showMore` uses next-intl's `{count}` placeholder, which i18next
              leaves literal — substitute it the way web's ICU does. */}
          {t('activity.showMore', 'نمایش بیشتر').replace('{count}', String(items.length))}
        </Text>
      </Pressable>

      <View style={{ height: spacing.md }} />

      {isLoading ? (
        <View style={{ gap: spacing.sm }}>
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} height={32} />
          ))}
        </View>
      ) : items.length === 0 ? (
        <Text variant="caption" tone="tertiary" style={{ textAlign: 'center' }}>
          {t('dashboard.noActivities', 'فعالیتی ثبت نشده است')}
        </Text>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {items.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              testID={`activity-${item.id}`}
              onPress={() => open(item.route)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="caption" numberOfLines={1}>
                  {item.title}
                </Text>
                <Text variant="legal" tone="tertiary" numberOfLines={1}>
                  {item.entityLabel}
                </Text>
              </View>
              <Text variant="legal" tone="tertiary">
                {formatDate(item.timestamp)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </MobileCard>
  )
}
