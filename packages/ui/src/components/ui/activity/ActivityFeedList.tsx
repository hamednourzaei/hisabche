// packages/ui/src/components/ui/activity/ActivityFeedList.tsx
// Plain feed, 20 groups at a time from the server. The next page comes from a
// button the reader presses (owner request, 9 Nov 2026): the old scroll
// sentinel left «بارگذاری بیشتر...» standing at the bottom of the page and
// fetched pages nobody asked for. Same pattern as the wallet history.
'use client'

import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { cn } from '../../../lib/utils'
import type { ActivityGroupDto, ActivityItemDto } from '@hisabche/api'
import { ActivityGroupCard } from './ActivityGroupCard'
import { ActivityGroupTable } from './ActivityGroupTable'

export interface ActivityFeedListProps {
  groups: ActivityGroupDto[]
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  onActivityClick: (activity: ActivityItemDto, group: ActivityGroupDto) => void
  className?: string
}

export function ActivityFeedList({
  groups,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onActivityClick,
  className,
}: ActivityFeedListProps) {
  const t = useTranslations()

  return (
    <div
      className={cn('overflow-y-auto h-full', className)}
      role="feed"
      aria-busy={isFetchingNextPage}
      aria-label={t('activity.feedLabel')}
    >
      {/* Below tablet: cards — a shrunken desktop table is unreadable on a
          phone. From tablet up: the same rows as a table, like /invoices.
          CSS decides, so server and client render the same tree. */}
      <div className="space-y-2 md:hidden">
        {groups.map((group) => (
          <ActivityGroupCard
            key={`${group.entityType}-${group.entityId}`}
            group={group}
            onActivityClick={onActivityClick}
          />
        ))}
      </div>
      <div className="hidden md:block" data-activity-table="">
        <ActivityGroupTable groups={groups} onActivityClick={onActivityClick} />
      </div>

      {hasNextPage ? (
        <div className="flex items-center justify-center py-3 md:py-4">
          <button
            type="button"
            data-activity-more=""
            onClick={fetchNextPage}
            disabled={isFetchingNextPage}
            className={cn(
              'inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium',
              'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] text-[hsl(var(--fg-primary))]',
              'hover:bg-[hsl(var(--surface-muted))] disabled:opacity-60',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]',
            )}
          >
            {isFetchingNextPage ? (
              <Loader2
                className="size-4 animate-spin text-[hsl(var(--color-primary))]"
                aria-hidden="true"
              />
            ) : null}
            {t('activity.showMore')}
          </button>
        </div>
      ) : null}

      {!hasNextPage && groups.length > 0 && (
        <div className="flex items-center justify-center py-3 md:py-4">
          <span className="text-[11px] md:text-xs text-[hsl(var(--fg-tertiary))]">
            {t('activity.endOfList')}
          </span>
        </div>
      )}
    </div>
  )
}

ActivityFeedList.displayName = 'ActivityFeedList'
