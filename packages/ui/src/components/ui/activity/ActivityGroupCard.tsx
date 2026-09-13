// packages/ui/src/components/ui/activity/ActivityGroupCard.tsx
// A single row in the activity feed. One entity (invoice/customer/payment/…)
// with its most recent activity shown inline, and the rest of its activities
// revealed on expand. Icons/colors/routes come from the shared entity
// registry (packages/ui/src/lib/activity/entity-registry.ts) so this stays
// visually consistent with the notification bell and dashboard.
'use client'

import { memo, useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, Clock, User } from 'lucide-react'
import { cn } from '../../../lib/utils'
import type { ActivityGroupDto, ActivityItemDto } from '@hisabche/api'
import { entityRegistry, type EntityType } from '../../../lib/activity/entity-registry'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { useNow } from '../../../hooks/use-now'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLOR_CLASSES: Record<string, string> = {
  amber: 'text-amber-500 bg-amber-500/10',
  emerald: 'text-emerald-500 bg-emerald-500/10',
  red: 'text-red-500 bg-red-500/10',
  blue: 'text-blue-500 bg-blue-500/10',
  rose: 'text-rose-500 bg-rose-500/10',
  gray: 'text-gray-500 bg-gray-500/10',
}

function timeAgo(iso: string, now: number | null, t: (key: string) => string): string {
  // `now` is null until mounted (see useNow) — the server and the first client
  // render then agree on empty text instead of on two different clocks.
  if (now === null) return ''
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60000)
  if (!Number.isFinite(minutes) || minutes < 1) return t('time.justNow')
  if (minutes < 60) return t('time.minutesAgo')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('time.hoursAgo')
  const days = Math.floor(hours / 24)
  if (days < 7) return t('time.daysAgo')
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return t('time.weeksAgo')
  const months = Math.floor(days / 30)
  if (months < 12) return t('time.monthsAgo')
  return t('time.yearsAgo')
}

function formatAmount(amount: number, currency: string | undefined, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || 'AFN',
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${amount} ${currency || 'AFN'}`
  }
}

function getEntityConfig(entityType: string) {
  const key = entityType as EntityType
  return entityRegistry[key] ?? entityRegistry.invoice
}

// ─── Single activity row (used inside the expanded list) ────────────────────

const ActivityRow = memo(function ActivityRow({
  activity,
  onClick,
}: {
  activity: ActivityItemDto
  onClick: () => void
}) {
  const t = useTranslations()
  const now = useNow(60_000)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-start rounded-lg px-2 py-1.5 md:px-2.5 md:py-2',
        'hover:bg-[hsl(var(--surface-muted))] transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary)/0.4)]',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs md:text-sm text-[hsl(var(--fg-primary))] line-clamp-2">
          {activity.title}
        </p>
        {!activity.isRead && (
          <span
            className="shrink-0 mt-1 size-1.5 rounded-full bg-[hsl(var(--color-primary))]"
            aria-label={t('activity.unread')}
          />
        )}
      </div>
      {activity.description && (
        <p className="text-[11px] md:text-xs text-[hsl(var(--fg-secondary))] mt-0.5 line-clamp-2">
          {activity.description}
        </p>
      )}
      <div className="flex items-center gap-2 mt-1 text-[10px] md:text-[11px] text-[hsl(var(--fg-tertiary))]">
        {activity.actor && (
          <span className="inline-flex items-center gap-1 truncate max-w-[140px]">
            <User className="size-2.5 md:size-3 shrink-0" aria-hidden="true" />
            {t('activity.by', { actor: activity.actor })}
          </span>
        )}
        <span>{timeAgo(activity.timestamp, now, t)}</span>
      </div>
    </button>
  )
})
ActivityRow.displayName = 'ActivityRow'

// ─── Main card ────────────────────────────────────────────────────────────

export interface ActivityGroupCardProps {
  group: ActivityGroupDto
  onActivityClick: (activity: ActivityItemDto, group: ActivityGroupDto) => void
  className?: string
}

export const ActivityGroupCard = memo(function ActivityGroupCard({
  group,
  onActivityClick,
  className,
}: ActivityGroupCardProps) {
  const t = useTranslations()
  const locale = useIntlLocale()
  const now = useNow(60_000)
  const [isOpen, setIsOpen] = useState(false)

  const config = getEntityConfig(group.entityType)
  const Icon = config.icon
  const { entitySummary } = group
  const latest = group.activities[0]
  const restCount = Math.max(group.activities.length - 1, 0)

  const statusInfo = useMemo(() => {
    if (!entitySummary.status) return null
    if (!('statusRenderer' in config) || !config.statusRenderer) return null
    return config.statusRenderer(entitySummary.status)
  }, [config, entitySummary.status])

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsOpen((prev) => !prev)
  }, [])

  const handleOpenEntity = useCallback(() => {
    if (latest) onActivityClick(latest, group)
  }, [latest, group, onActivityClick])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleOpenEntity()
      }
    },
    [handleOpenEntity],
  )

  return (
    <div
      className={cn(
        'rounded-xl border border-[hsl(var(--border-default))]',
        'bg-[hsl(var(--surface-elevated))]',
        'transition-colors duration-150',
        group.hasUnread && 'border-[hsl(var(--color-primary)/0.35)]',
        className,
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleOpenEntity}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-full text-start flex items-start gap-2.5 md:gap-3 p-2.5 md:p-3 lg:p-3.5',
          'cursor-pointer rounded-xl',
          'hover:bg-[hsl(var(--surface-muted))] transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary)/0.4)]',
        )}
        aria-label={t('activity.itemLabel', {
          title: entitySummary.label,
        })}
      >
        {/* Icon */}
        <div
          className={cn(
            'shrink-0 rounded-full flex items-center justify-center',
            'w-8 h-8 md:w-9 md:h-9 lg:w-10 lg:h-10',
            config.bg,
          )}
        >
          <Icon
            className={cn('w-4 h-4 md:w-4.5 md:h-4.5 lg:w-5 lg:h-5', config.color)}
            aria-hidden="true"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={cn(
                'text-xs md:text-sm text-[hsl(var(--fg-primary))] truncate',
                group.hasUnread ? 'font-semibold' : 'font-medium',
              )}
            >
              {entitySummary.label}
            </span>
            {group.hasUnread && (
              <span
                className="shrink-0 size-1.5 rounded-full bg-[hsl(var(--color-primary))]"
                aria-label={t('activity.unread')}
              />
            )}
            {/* فید فروش و خرید را با هم نشان می‌دهد؛ بدون این نشان، یک خرید
                دقیقاً شبیه یک فروش دیده می‌شود. */}
            {entitySummary.transactionType && (
              <span
                className={cn(
                  'shrink-0 text-[10px] md:text-[11px] font-medium px-1.5 py-0.5 rounded',
                  entitySummary.transactionType === 'purchase'
                    ? (STATUS_COLOR_CLASSES.blue ?? STATUS_COLOR_CLASSES.gray)
                    : STATUS_COLOR_CLASSES.gray,
                )}
              >
                {t(`invoices.type.${entitySummary.transactionType}`)}
              </span>
            )}
            {statusInfo && (
              <span
                className={cn(
                  'shrink-0 text-[10px] md:text-[11px] font-medium px-1.5 py-0.5 rounded',
                  STATUS_COLOR_CLASSES[statusInfo.color] ?? STATUS_COLOR_CLASSES.gray,
                )}
              >
                {statusInfo.label}
              </span>
            )}
          </div>

          {latest && (
            <p className="text-[11px] md:text-xs text-[hsl(var(--fg-secondary))] mt-0.5 line-clamp-1">
              {latest.title}
            </p>
          )}

          <div className="flex items-center gap-2 md:gap-3 mt-1 flex-wrap text-[10px] md:text-[11px] text-[hsl(var(--fg-tertiary))]">
            {entitySummary.subtitle && (
              <span className="truncate max-w-[120px] md:max-w-[180px]">
                {entitySummary.subtitle}
              </span>
            )}
            {entitySummary.amount !== undefined && (
              <span className="font-medium text-[hsl(var(--fg-secondary))]">
                {formatAmount(entitySummary.amount, entitySummary.currency, locale)}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock className="size-2.5 md:size-3" aria-hidden="true" />
              {timeAgo(entitySummary.lastActivity, now, t)}
            </span>
          </div>
        </div>

        {/* Expand toggle */}
        {restCount > 0 && (
          <button
            type="button"
            onClick={handleToggle}
            aria-expanded={isOpen}
            aria-label={t('activity.showMore', { count: restCount })}
            className={cn(
              'shrink-0 rounded-lg p-1 md:p-1.5 mt-0.5',
              'text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))]',
              'hover:bg-[hsl(var(--surface-muted))] transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary)/0.4)]',
            )}
          >
            <ChevronDown
              className={cn(
                'size-3.5 md:size-4 transition-transform duration-200',
                isOpen && 'rotate-180',
              )}
            />
          </button>
        )}
      </div>

      {/* Expanded: remaining activities for this entity */}
      {restCount > 0 && (
        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-200 ease-in-out motion-reduce:transition-none',
            isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden">
            <div className="border-t border-[hsl(var(--border-default)/0.6)] px-2 md:px-2.5 py-1.5 space-y-0.5">
              {group.activities.slice(1).map((activity) => (
                <ActivityRow
                  key={activity.id}
                  activity={activity}
                  onClick={() => onActivityClick(activity, group)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

ActivityGroupCard.displayName = 'ActivityGroupCard'
