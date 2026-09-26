// The activity feed as a TABLE — from tablet width up, like /invoices.
//
// Same rows as the cards (one per entity, its newest event first), the same
// click-through, the shared DataTable (sortable headers, column settings). No
// search: the owner removed it from this page (26 Sep 2026); the five tabs
// above are the filter.
'use client'

import { memo, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import type { ActivityGroupDto, ActivityItemDto } from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { timeAgo } from '../../../lib/time-ago'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { useNow } from '../../../hooks/use-now'
import { DataTable } from '../data-table/data-table'
import type { TableColumn } from '../data-table/table-types'
import { STATUS_COLOR_CLASSES, formatAmount, getEntityConfig } from './ActivityGroupCard'

export interface ActivityGroupTableProps {
  groups: ActivityGroupDto[]
  onActivityClick: (activity: ActivityItemDto, group: ActivityGroupDto) => void
}

const pill = 'inline-block rounded px-1.5 py-0.5 text-[11px] font-medium'

export const ActivityGroupTable = memo(function ActivityGroupTable({
  groups,
  onActivityClick,
}: ActivityGroupTableProps) {
  const t = useTranslations()
  const locale = useIntlLocale()
  const now = useNow(60_000)
  // Every key this table passes exists in fa, af and en (activity.col.*,
  // table.*). No `t.has`: the desktop shell's next-intl shim has none.
  const tr = (key: string) => t(key)

  const columns = useMemo<TableColumn<ActivityGroupDto>[]>(
    () => [
      {
        id: 'entity',
        labelKey: 'activity.col.entity',
        labelFallback: 'رکورد',
        locked: true,
        sortValue: (g) => g.entitySummary.label,
        render: (g) => {
          const config = getEntityConfig(g.entityType)
          const Icon = config.icon
          return (
            <span className="inline-flex items-center gap-2">
              <span
                className={cn('grid size-7 shrink-0 place-items-center rounded-full', config.bg)}
              >
                <Icon className={cn('size-3.5', config.color)} aria-hidden="true" />
              </span>
              <span
                className={cn(
                  'text-[hsl(var(--fg-primary))]',
                  g.hasUnread ? 'font-semibold' : 'font-medium',
                )}
              >
                {g.entitySummary.label}
              </span>
              {g.hasUnread && (
                <span
                  className="size-1.5 shrink-0 rounded-full bg-[hsl(var(--color-primary))]"
                  aria-label={t('activity.unread')}
                />
              )}
            </span>
          )
        },
      },
      {
        id: 'type',
        labelKey: 'activity.col.type',
        labelFallback: 'نوع',
        showFrom: 'lg',
        sortValue: (g) => g.entitySummary.transactionType ?? '',
        render: (g) =>
          g.entitySummary.transactionType ? (
            <span
              className={cn(
                pill,
                g.entitySummary.transactionType === 'purchase'
                  ? STATUS_COLOR_CLASSES.blue
                  : STATUS_COLOR_CLASSES.gray,
              )}
            >
              {t(`invoices.type.${g.entitySummary.transactionType}`)}
            </span>
          ) : null,
      },
      {
        id: 'status',
        labelKey: 'activity.col.status',
        labelFallback: 'وضعیت',
        sortValue: (g) => g.entitySummary.status ?? '',
        render: (g) => {
          const config = getEntityConfig(g.entityType)
          if (!g.entitySummary.status || !('statusRenderer' in config) || !config.statusRenderer)
            return null
          const info = config.statusRenderer(g.entitySummary.status)
          return (
            <span
              className={cn(pill, STATUS_COLOR_CLASSES[info.color] ?? STATUS_COLOR_CLASSES.gray)}
            >
              {info.label}
            </span>
          )
        },
      },
      {
        id: 'latest',
        labelKey: 'activity.col.latest',
        labelFallback: 'آخرین رخداد',
        render: (g) => (
          <span className="block max-w-[280px] truncate text-[hsl(var(--fg-secondary))]">
            {g.activities[0]?.title ?? ''}
          </span>
        ),
      },
      {
        id: 'actor',
        labelKey: 'activity.col.actor',
        labelFallback: 'انجام‌دهنده',
        showFrom: 'lg',
        sortValue: (g) => g.activities[0]?.actor ?? '',
        render: (g) => (
          <span className="text-[hsl(var(--fg-secondary))]">{g.activities[0]?.actor ?? '—'}</span>
        ),
      },
      {
        id: 'amount',
        labelKey: 'activity.col.amount',
        labelFallback: 'مبلغ',
        align: 'end',
        sortValue: (g) => g.entitySummary.amount ?? null,
        render: (g) =>
          g.entitySummary.amount !== undefined ? (
            <span className="font-medium tabular-nums text-[hsl(var(--fg-primary))]">
              {formatAmount(g.entitySummary.amount, g.entitySummary.currency, locale)}
            </span>
          ) : null,
      },
      {
        id: 'time',
        labelKey: 'activity.col.time',
        labelFallback: 'زمان',
        sortValue: (g) => Date.parse(g.entitySummary.lastActivity) || 0,
        render: (g) => (
          <span className="text-[hsl(var(--fg-tertiary))]">
            {timeAgo(g.entitySummary.lastActivity, now, t)}
          </span>
        ),
      },
    ],
    [t, locale, now],
  )

  return (
    <DataTable
      tableId="activities"
      t={tr}
      rows={groups}
      columns={columns}
      rowKey={(g) => `${g.entityType}-${g.entityId}`}
      onRowClick={(g) => {
        const latest = g.activities[0]
        if (latest) onActivityClick(latest, g)
      }}
      minWidthClass="min-w-[640px]"
    />
  )
})

ActivityGroupTable.displayName = 'ActivityGroupTable'
