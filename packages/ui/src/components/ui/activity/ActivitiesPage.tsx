// packages/ui/src/components/ui/activity/ActivitiesPage.tsx
// Activity / Events feed. Rebuilt on top of the app's shadcn-style
// primitives (Tabs, Badge) instead of a bespoke, overbuilt implementation.
// Data layer (hooks, filter semantics, click-through routing) is untouched —
// only presentation changed.
'use client'

import { useCallback, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CheckCheck } from 'lucide-react'
import { formatCompactCount, type UiLanguage } from '@hisabche/formatting'
import { cn } from '../../../lib/utils'
import {
  apiErrorMessage,
  useInfiniteActivities,
  useUnreadCount as useUnreadActivityCount,
  useMarkAllActivitiesAsRead,
  useMarkActivityAsRead,
  useActivityFilterCounts,
  type ActivityGroupDto,
  type ActivityItemDto,
  type ActivityFilter,
} from '@hisabche/api'
import { HubTabs } from '../hub-tabs'
import { SegmentedControl } from '../segmented-control'
import { Badge } from '../badge'
import { useToast } from '../toast-provider'
import { ActivityFeedList } from './ActivityFeedList'
import { ActivitySkeleton } from './ActivitySkeleton'
import { ActivityEmptyState } from './ActivityEmptyState'
import { AuditContainer } from '../audit/containers/audit-container'
import { useLocalePush } from '../../../hooks/use-locale-push'

// ─── Filter mapping (kept exactly as before — this logic is correct) ───────

type FilterType = 'all' | 'unread' | 'invoices' | 'payments' | 'customers'

const FILTER_ENTITY_MAP: Record<Exclude<FilterType, 'all' | 'unread'>, string> = {
  invoices: 'invoice',
  payments: 'payment',
  customers: 'customer',
}

const getEntityTypeFilter = (filter: FilterType): string | undefined => {
  if (filter === 'all' || filter === 'unread') return undefined
  return FILTER_ENTITY_MAP[filter]
}

// ─── Main Page Component ──────────────────────────────────────────────────────

type SectionType = 'activity' | 'audit'
export const ACTIVITY_SECTIONS: readonly SectionType[] = ['activity', 'audit']
export const ACTIVITY_FILTERS: readonly FilterType[] = [
  'all',
  'unread',
  'invoices',
  'payments',
  'customers',
]

export function ActivitiesPage() {
  const t = useTranslations()
  const push = useLocalePush()
  const { toast } = useToast()
  const [section, setSection] = useState<SectionType>('activity')
  const [filter, setFilter] = useState<FilterType>('all')
  const [locallyReadIds, setLocallyReadIds] = useState<Set<string>>(new Set())
  const [retainedKeys, setRetainedKeys] = useState<Set<string>>(new Set())
  const lang = useLocale() as UiLanguage

  const activityFilter = useMemo<ActivityFilter>(() => {
    const entityType = getEntityTypeFilter(filter)
    const result: ActivityFilter = {}
    if (entityType) result.type = entityType
    if (filter === 'unread') result.unread = true
    return result
  }, [filter])

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteActivities(activityFilter)

  const { data: unreadCount = 0 } = useUnreadActivityCount()
  const { mutate: markAllAsRead, isPending: isMarkingAll } = useMarkAllActivitiesAsRead()
  const { mutate: markAsRead } = useMarkActivityAsRead()

  const allGroups = useMemo<ActivityGroupDto[]>(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data],
  )

  const groupsWithLocalReads = useMemo(() => {
    if (locallyReadIds.size === 0) return allGroups
    return allGroups.map((group) => {
      const hasLocalRead = group.activities.some((a) => locallyReadIds.has(a.id))
      if (!hasLocalRead) return group
      const updatedActivities = group.activities.map((a) =>
        locallyReadIds.has(a.id) ? { ...a, isRead: true } : a,
      )
      const unread = updatedActivities.filter((a) => !a.isRead).length
      return {
        ...group,
        activities: updatedActivities,
        unreadCount: unread,
        hasUnread: unread > 0,
      }
    })
  }, [allGroups, locallyReadIds])

  const filteredGroups = useMemo(() => {
    if (filter === 'all') return groupsWithLocalReads
    if (filter === 'unread') {
      return groupsWithLocalReads.filter(
        (g) => g.unreadCount > 0 || retainedKeys.has(`${g.entityType}:${g.entityId}`),
      )
    }
    const targetType = FILTER_ENTITY_MAP[filter]
    return groupsWithLocalReads.filter((g) => g.entityType === targetType)
  }, [groupsWithLocalReads, filter, retainedKeys])

  const { data: filterCounts } = useActivityFilterCounts()

  // The hook already took what was just read off the cached counts; taking
  // `locallyReadIds` off again counted every opened event twice.
  const effectiveUnreadCount = unreadCount

  const currentTabUnread = useMemo(() => {
    if (filter === 'all' || filter === 'unread') return effectiveUnreadCount
    return filterCounts?.[filter] ?? 0
  }, [filter, effectiveUnreadCount, filterCounts])

  const handleFilterChange = useCallback((newFilter: FilterType) => {
    setFilter(newFilter)
    setRetainedKeys(new Set())
  }, [])

  const handleActivityClick = useCallback(
    (_activity: ActivityItemDto, group: ActivityGroupDto) => {
      const unreadIds = group.activities
        .filter((a) => !a.isRead && !locallyReadIds.has(a.id))
        .map((a) => a.id)

      if (unreadIds.length > 0) {
        setLocallyReadIds((prev) => new Set([...prev, ...unreadIds]))
        setRetainedKeys((prev) => new Set([...prev, `${group.entityType}:${group.entityId}`]))

        markAsRead(unreadIds, {
          onError: (err) => {
            setLocallyReadIds((prev) => {
              const next = new Set(prev)
              for (const id of unreadIds) next.delete(id)
              return next
            })
            toast({
              title: apiErrorMessage(err, t('error.title')),
              variant: 'error',
            })
          },
        })
      }

      const route = group.entitySummary.route || '/dashboard'
      push(route)
    },
    [locallyReadIds, markAsRead, push, t, toast],
  )

  return (
    <div className="flex flex-col h-full w-full">
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 pb-3 md:pb-4 lg:pb-5">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="font-bold text-[hsl(var(--fg-primary))] truncate text-lg md:text-xl lg:text-2xl">
            {t('nav.events')}
          </h1>
          {effectiveUnreadCount > 0 && (
            <Badge
              variant="destructive"
              size="sm"
              className="shrink-0"
              title={t('activity.newCountBadge', { count: effectiveUnreadCount })}
              aria-label={t('activity.newCountBadge', { count: effectiveUnreadCount })}
            >
              {formatCompactCount(effectiveUnreadCount, lang)} {t('activity.new')}
            </Badge>
          )}
        </div>
        {currentTabUnread > 0 && (
          <button
            type="button"
            onClick={() =>
              markAllAsRead(filter === 'all' || filter === 'unread' ? undefined : filter)
            }
            disabled={isMarkingAll}
            className={cn(
              'shrink-0 inline-flex items-center gap-1.5 rounded-lg font-medium',
              'px-2 md:px-3 lg:px-4 py-1 md:py-1.5 lg:py-2',
              'text-[11px] md:text-xs lg:text-sm',
              'text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.1)]',
              'transition-colors disabled:opacity-40',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary)/0.4)]',
              'min-h-[28px] md:min-h-[36px] lg:min-h-[40px]',
            )}
          >
            <CheckCheck className="size-3.5 md:size-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('activity.markAllRead')}</span>
          </button>
        )}
      </div>

      {/* ─── Section switch: activity feed vs audit log ────── */}
      <HubTabs
        label={t('nav.events')}
        items={ACTIVITY_SECTIONS.map((id) => ({
          id,
          label: id === 'audit' ? t('nav.history') : t('nav.events'),
        }))}
        active={section}
        onSelect={setSection}
      />

      {section === 'audit' ? (
        <div className="pt-3 md:pt-4 lg:pt-5">
          <AuditContainer />
        </div>
      ) : (
        <>
          {/* ─── Filter tabs (no search — removed at the owner's request) ─── */}
          <div className="space-y-2 md:space-y-3 lg:space-y-4 pb-3 md:pb-4 lg:pb-5 pt-3 md:pt-4 lg:pt-5">
            <SegmentedControl
              branch
              label={t('activity.filter.all')}
              options={ACTIVITY_FILTERS.map((value) => {
                const count = filterCounts?.[value]
                const displayCount = count
                return {
                  value,
                  // The count rides in the label, as it did on the tab.
                  label:
                    displayCount !== undefined && displayCount !== null
                      ? `${t(`activity.filter.${value}`)} (${formatCompactCount(displayCount, lang)})`
                      : t(`activity.filter.${value}`),
                }
              })}
              value={filter}
              onChange={handleFilterChange}
              className="max-w-full flex-wrap"
            />
          </div>

          {/* ─── Body ───────────────────────────────────────────── */}
          <div className="flex-1 min-h-[400px]">
            {isLoading && allGroups.length === 0 ? (
              <ActivitySkeleton />
            ) : filteredGroups.length === 0 ? (
              <div className="p-4 md:p-6 lg:p-8">
                <ActivityEmptyState
                  title={t('activity.empty.title')}
                  subtitle={
                    filter === 'unread' ? t('activity.empty.unread') : t('activity.empty.all')
                  }
                />
              </div>
            ) : (
              <ActivityFeedList
                groups={filteredGroups}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                fetchNextPage={fetchNextPage}
                onActivityClick={handleActivityClick}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}

ActivitiesPage.displayName = 'ActivitiesPage'
