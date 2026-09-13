'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '../../lib/utils'
import { Clock, Cloud } from 'lucide-react'
import { Badge } from './badge'
import { useNow } from '../../hooks/use-now'

export interface SyncStatusProps {
  lastSyncedAt: number | null
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  className?: string
}

function timeAgo(timestamp: number, now: number, t: (key: string) => string): string {
  const s = Math.floor((now - timestamp) / 1000)
  if (s < 10) return t('sync.justNow')
  if (s < 60) return t('sync.secondsAgo').replace('{s}', String(s))
  const m = Math.floor(s / 60)
  if (m < 60) return t('sync.minutesAgo').replace('{m}', String(m))
  return t('sync.hoursAgo').replace('{h}', String(Math.floor(m / 60)))
}

const SyncStatus: React.FC<SyncStatusProps> = ({
  lastSyncedAt,
  isOnline,
  isSyncing,
  pendingCount,
  className,
}) => {
  const t = useTranslations()
  // Read after mount (see useNow) and ticked so "12s ago" stays current.
  const now = useNow(10_000)

  return (
    <div
      className={cn('flex items-center gap-3 text-xs', className)}
      role="status"
      aria-live="polite"
    >
      {isOnline ? (
        <Badge variant="success" className="gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {t('sync.online')}
        </Badge>
      ) : (
        <Badge variant="warning" className="gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {t('sync.offline')}
        </Badge>
      )}

      <div className="h-3 w-px bg-border" />

      {isSyncing ? (
        <Badge variant="secondary" className="gap-1 animate-pulse">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {t('sync.syncing')}
        </Badge>
      ) : lastSyncedAt ? (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="size-3.5" aria-hidden />
          <span>{now === null ? '' : timeAgo(lastSyncedAt, now, t)}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Cloud className="size-3.5" aria-hidden />
          <span>{t('sync.notSynced')}</span>
        </div>
      )}

      {pendingCount > 0 && (
        <>
          <div className="h-3 w-px bg-border" />
          <Badge variant="warning" className="gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {t('sync.pending').replace('{count}', String(pendingCount))}
          </Badge>
        </>
      )}
    </div>
  )
}

export { SyncStatus }
