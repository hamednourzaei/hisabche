'use client'

// ============================================
// packages/ui/src/components/ui/data-and-sync/data-and-sync-view.tsx
//
// Data & Sync — one entry point for everything that moves data in or out.
//
// ---------------------------------------------------------------------------
// SIX AREAS, NOT ONE OPERATION
//
// §20 is explicit that sync, import, migration, export, conflicts and history
// must stay distinguishable. They fail differently and a person acts on each
// differently: a conflict needs a decision, a queued change needs a
// connection, a migration needs a file. Collapsing them into one "data" page
// with a single spinner is how a user learns that the page tells them nothing.
//
// So this is a HUB, not a merge. Each card carries that area's own live state
// and its own way in. The destinations it links to already exist and keep
// working when reached directly.
//
// ---------------------------------------------------------------------------
// EVERY FIGURE IS LIVE OR ABSENT
//
// No card invents a number. A count the container could not obtain renders as
// nothing rather than as zero — "0 conflicts" and "we could not check" are
// different sentences and only one of them is safe to act on.
// ============================================

import { memo } from 'react'
import { useNow } from '../../../hooks/use-now'
import type { MigrationJob } from '@hisabche/api'

import {
  ActionButton,
  Badge,
  CapabilityHeader,
  CapabilityPage,
  Panel,
  Stat,
  StatGrid,
  type Tone,
} from '../capability/capability-kit'
import { WorkStateNote } from '../state/work-state'

export interface DataAndSyncViewProps {
  t: (key: string, fallback?: string) => string
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncedAt: number | null
  /** null means "could not be read", which is not the same as zero. */
  conflictCount: number | null
  lastMigration: MigrationJob | null
  migrationCount: number
  isLoading: boolean
  error: string | null
  onNavigate: (path: string) => void
  onRefresh: () => void
}

const MIGRATION_TONE: Record<string, Tone> = {
  completed: 'good',
  completed_with_warnings: 'warn',
  failed: 'bad',
  cancelled: 'neutral',
}

/**
 * Elapsed time in whole units, without a formatting library.
 *
 * Returns a key and a number so the sentence is assembled by the translator,
 * not by concatenation here — Persian and English disagree about where the
 * number sits, and `${n} minutes ago` bakes the English order in.
 */
function since(timestamp: number, now: number): { key: string; value: number } {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (seconds < 60) return { key: 'dataSync.seconds_ago', value: seconds }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return { key: 'dataSync.minutes_ago', value: minutes }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { key: 'dataSync.hours_ago', value: hours }
  return { key: 'dataSync.days_ago', value: Math.floor(hours / 24) }
}

export const DataAndSyncView = memo(function DataAndSyncView({
  t,
  isOnline,
  isSyncing,
  pendingCount,
  lastSyncedAt,
  conflictCount,
  lastMigration,
  migrationCount,
  isLoading,
  error,
  onNavigate,
  onRefresh,
}: DataAndSyncViewProps) {
  // The clock is read after mount (see useNow). Until then a synced workspace
  // shows a neutral dash — never «هرگز», which would be a false statement.
  const now = useNow(10_000)
  const elapsed = lastSyncedAt === null || now === null ? null : since(lastSyncedAt, now)

  return (
    <CapabilityPage>
      <CapabilityHeader
        title={t('dataSync.title', 'داده و همگام‌سازی')}
        description={t('dataSync.subtitle', 'هرچه داده را وارد، خارج یا همگام می‌کند — در یک جا.')}
        action={
          <ActionButton variant="quiet" onClick={onRefresh} disabled={isLoading}>
            {t('common.refresh', 'تازه‌سازی')}
          </ActionButton>
        }
      />

      {/* The one line that says how things stand, in the product's single
          state vocabulary rather than this page's own. */}
      <WorkStateNote
        t={t}
        isOffline={!isOnline}
        isSyncing={isSyncing}
        pendingCount={pendingCount}
        conflictCount={conflictCount ?? 0}
        hasError={Boolean(error)}
        isLoading={isLoading}
        onAction={() => onNavigate('/conflicts')}
        actionLabelKey="dataSync.open_conflicts"
      />

      {/* ─── Sync ───────────────────────────────────────────────────────── */}

      <Panel
        title={t('dataSync.sync_title', 'همگام‌سازی')}
        description={t('dataSync.sync_hint', 'وضعیت اتصال و تغییرهایی که هنوز نرفته‌اند.')}
        action={
          <ActionButton variant="quiet" onClick={() => onNavigate('/sync-center')}>
            {t('dataSync.open_sync', 'مرکز همگام‌سازی')}
          </ActionButton>
        }
      >
        <StatGrid>
          <Stat
            label={t('dataSync.connection', 'اتصال')}
            value={
              <Badge tone={isOnline ? 'good' : 'warn'}>
                {isOnline ? t('state.ready', 'آماده') : t('state.offline', 'آفلاین')}
              </Badge>
            }
          />
          <Stat label={t('dataSync.pending', 'در صف ارسال')} value={String(pendingCount)} />
          <Stat
            label={t('dataSync.last_synced', 'آخرین همگام‌سازی')}
            value={
              lastSyncedAt === null
                ? t('dataSync.never', 'هرگز')
                : elapsed === null
                  ? '—'
                  : t(elapsed.key, String(elapsed.value)).replace('{n}', String(elapsed.value))
            }
          />
        </StatGrid>
      </Panel>

      {/* ─── Conflicts ──────────────────────────────────────────────────── */}

      <Panel
        title={t('dataSync.conflicts_title', 'تعارض‌ها')}
        description={t(
          'dataSync.conflicts_hint',
          'رکوردهایی که روی دو دستگاه تغییر کرده‌اند و باید یکی انتخاب شود.',
        )}
        action={
          <ActionButton variant="quiet" onClick={() => onNavigate('/conflicts')}>
            {t('dataSync.open_conflicts', 'بازبینی تعارض‌ها')}
          </ActionButton>
        }
      >
        {conflictCount === null ? (
          // Not zero. A count that could not be read is a different fact, and
          // showing it as zero would tell someone there is nothing to do.
          <p className="text-sm text-[hsl(var(--fg-tertiary))]">
            {t('dataSync.conflicts_unknown', 'تعداد تعارض‌ها خوانده نشد.')}
          </p>
        ) : (
          <StatGrid>
            <Stat
              label={t('dataSync.open_count', 'باز')}
              value={
                <Badge tone={conflictCount > 0 ? 'warn' : 'good'}>{String(conflictCount)}</Badge>
              }
            />
          </StatGrid>
        )}
      </Panel>

      {/* ─── Import & migration ─────────────────────────────────────────── */}

      <Panel
        title={t('dataSync.import_title', 'ورود داده و انتقال')}
        description={t(
          'dataSync.import_hint',
          'مشتریان و کالاها را از فایل موجود وارد کنید — با پیش‌نمایش پیش از ثبت.',
        )}
        action={
          <ActionButton onClick={() => onNavigate('/data-migration')}>
            {t('dataSync.open_migration', 'شروع انتقال')}
          </ActionButton>
        }
      >
        {lastMigration ? (
          <StatGrid>
            <Stat
              label={t('dataSync.last_migration', 'آخرین انتقال')}
              value={
                <Badge tone={MIGRATION_TONE[lastMigration.status] ?? 'neutral'}>
                  {t(`migration.status_${lastMigration.status}`, lastMigration.status)}
                </Badge>
              }
              hint={lastMigration.originalFilename}
            />
            <Stat
              label={t('migration.created', 'ساخته شد')}
              value={String(lastMigration.rowsCreated)}
            />
            <Stat
              label={t('migration.updated', 'به‌روز شد')}
              value={String(lastMigration.rowsUpdated)}
            />
            <Stat
              label={t('dataSync.migration_count', 'کل انتقال‌ها')}
              value={String(migrationCount)}
            />
          </StatGrid>
        ) : (
          <p className="text-sm text-[hsl(var(--fg-tertiary))]">
            {t('dataSync.no_migration', 'هنوز انتقالی انجام نشده است.')}
          </p>
        )}
      </Panel>

      {/* ─── Export ─────────────────────────────────────────────────────── */}
      {/* Listed because §20 names it as one of the six areas, and stating
          plainly where it lives is better than a card that pretends to be a
          feature. Export today happens per-list, not centrally. */}
      <Panel
        title={t('dataSync.export_title', 'خروجی گرفتن')}
        description={t(
          'dataSync.export_hint',
          'خروجی از هر فهرست، از دکمه‌ی خروجی همان صفحه گرفته می‌شود. خروجی مرکزی هنوز ساخته نشده.',
        )}
      >
        <p className="text-sm text-[hsl(var(--fg-tertiary))]">
          {t(
            'dataSync.export_where',
            'فهرست مشتریان، کالاها و فاکتورها هرکدام خروجی خودشان را دارند.',
          )}
        </p>
      </Panel>
    </CapabilityPage>
  )
})

DataAndSyncView.displayName = 'DataAndSyncView'
