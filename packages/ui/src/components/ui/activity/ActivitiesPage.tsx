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
  useInfiniteActivities,
  useUnreadCount as useUnreadActivityCount,
  useMarkAllAsRead as useMarkAllActivitiesAsRead,
  useActivityFilterCounts,
  type ActivityGroupDto,
  type ActivityItemDto,
  type ActivityFilter,
} from '@hisabche/api'
import { Tabs, TabsList, TabsTrigger } from '../tabs'
import { Badge } from '../badge'
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

const filterGroupsByType = (groups: ActivityGroupDto[], filter: FilterType): ActivityGroupDto[] => {
  if (filter === 'all') return groups
  if (filter === 'unread') return groups.filter((g) => g.unreadCount > 0)
  const targetType = FILTER_ENTITY_MAP[filter]
  return groups.filter((g) => g.entityType === targetType)
}

// ─── Main Page Component ──────────────────────────────────────────────────────

type SectionType = 'activity' | 'audit'

export function ActivitiesPage() {
  const t = useTranslations()
  const push = useLocalePush()
  const [section, setSection] = useState<SectionType>('activity')
  const [filter, setFilter] = useState<FilterType>('all')
  const lang = useLocale() as UiLanguage

  const activityFilter = useMemo<ActivityFilter>(() => {
    const entityType = getEntityTypeFilter(filter)
    const result: ActivityFilter = {}
    if (entityType) result.type = entityType
    return result
  }, [filter])

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteActivities(activityFilter)

  const { data: unreadCount = 0 } = useUnreadActivityCount()
  const { mutate: markAllAsRead, isPending: isMarkingAll } = useMarkAllActivitiesAsRead()

  const allGroups = useMemo<ActivityGroupDto[]>(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data],
  )

  const filteredGroups = useMemo(() => filterGroupsByType(allGroups, filter), [allGroups, filter])

  // ⚠️ From the server, exact. These were the lengths of the pages loaded so
  // far — «همه (12)» meant «12 on screen», whatever the account held.
  const { data: filterCounts } = useActivityFilterCounts()

  const handleActivityClick = useCallback(
    (_activity: ActivityItemDto, group: ActivityGroupDto) => {
      const route = group.entitySummary.route || '/dashboard'
      push(route)
    },
    [push],
  )

  return (
    // No side padding of its own: the route already pads the page. The two
    // together left a wide empty margin on phones (reported).
    <div className="flex flex-col h-full w-full">
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 pb-3 md:pb-4 lg:pb-5">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="font-bold text-[hsl(var(--fg-primary))] truncate text-lg md:text-xl lg:text-2xl">
            {t('nav.events')}
          </h1>
          {unreadCount > 0 && (
            <Badge variant="destructive" size="sm" className="shrink-0">
              {unreadCount} {t('activity.new')}
            </Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllAsRead()}
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
      <Tabs value={section} onValueChange={(v) => setSection(v as SectionType)}>
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="activity">{t('nav.events')}</TabsTrigger>
          <TabsTrigger value="audit">{t('nav.history')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {section === 'audit' ? (
        <div className="pt-3 md:pt-4 lg:pt-5">
          <AuditContainer />
        </div>
      ) : (
        <>
          {/* ─── Filter tabs (no search — removed at the owner's request) ─── */}
          <div className="space-y-2 md:space-y-3 lg:space-y-4 pb-3 md:pb-4 lg:pb-5 pt-3 md:pt-4 lg:pt-5">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
              <TabsList className="w-full md:w-auto flex-nowrap md:flex-wrap justify-start">
                <TabsTrigger value="all">
                  {t('activity.filter.all')}
                  <TabCount count={filterCounts?.all} lang={lang} />
                </TabsTrigger>
                <TabsTrigger value="unread">
                  {t('activity.filter.unread')}
                  <TabCount count={filterCounts?.unread} lang={lang} />
                </TabsTrigger>
                <TabsTrigger value="invoices">
                  {t('activity.filter.invoices')}
                  <TabCount count={filterCounts?.invoices} lang={lang} />
                </TabsTrigger>
                <TabsTrigger value="payments">
                  {t('activity.filter.payments')}
                  <TabCount count={filterCounts?.payments} lang={lang} />
                </TabsTrigger>
                <TabsTrigger value="customers">
                  {t('activity.filter.customers')}
                  <TabCount count={filterCounts?.customers} lang={lang} />
                </TabsTrigger>
              </TabsList>
            </Tabs>
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

/** A tab badge: exact, and short past 999 («1.3k»). Nothing until known, or when zero. */
function TabCount({ count, lang }: { count: number | undefined; lang: UiLanguage }) {
  if (!count) return null
  return (
    <span
      className="font-normal tabular-nums text-[hsl(var(--fg-tertiary))]"
      data-tab-count={count}
    >
      ({formatCompactCount(count, lang)})
    </span>
  )
}
