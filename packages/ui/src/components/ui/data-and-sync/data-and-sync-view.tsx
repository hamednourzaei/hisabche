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
import type { ConflictSummary, DuplicateSummary, MigrationJob, SyncOverview } from '@hisabche/api'
import { useDateFormat } from '../../../hooks/use-date-format'

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
  /** The open conflicts themselves, for the preview. null = not read. */
  conflicts: ConflictSummary[] | null
  /** Last local backup (sync-center owns backups). null = never. */
  lastBackupAt: number | null
  lastMigration: MigrationJob | null
  migrationCount: number
  /** Devices and rejected changes from the server's sync log. null = not read. */
  syncOverview: SyncOverview | null
  /** Duplicate candidates per entity. null = not read (or no access). */
  duplicates: DuplicateSummary[] | null
  isLoading: boolean
  /** Markers of the data's state (#42–#46), passed in by the container. */
  snapshotsSlot?: React.ReactNode
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
  conflicts,
  lastBackupAt,
  lastMigration,
  migrationCount,
  syncOverview,
  duplicates,
  isLoading,
  snapshotsSlot,
  error,
  onNavigate,
  onRefresh,
}: DataAndSyncViewProps) {
  const { dateTime } = useDateFormat()
  const financialConflicts =
    conflicts === null ? null : conflicts.filter((c) => c.hasFinancialDivergence).length
  const migrationRunning =
    lastMigration !== null &&
    !['completed', 'completed_with_warnings', 'failed', 'cancelled'].includes(lastMigration.status)
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

      {/* ─── Summary — each card is a way in, and says so ────────────────── */}
      <section
        aria-label={t('dataSync.summary', 'خلاصه‌ی وضعیت')}
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <button type="button" className="text-start" onClick={() => onNavigate('/sync-center')}>
          <Stat
            label={t('dataSync.sync_title', 'همگام‌سازی')}
            value={
              <Badge
                tone={
                  !isOnline ? 'neutral' : isSyncing ? 'info' : pendingCount > 0 ? 'warn' : 'good'
                }
              >
                {!isOnline
                  ? t('state.offline', 'آفلاین')
                  : isSyncing
                    ? t('dataSync.syncing', 'در حال همگام‌سازی')
                    : pendingCount > 0
                      ? t('dataSync.pending_short', 'در انتظار ارسال')
                      : t('dataSync.synced', 'همگام')}
              </Badge>
            }
            hint={
              !isOnline
                ? t(
                    'dataSync.offline_hint',
                    'تغییرات محلی ذخیره می‌شوند و پس از اتصال ارسال می‌شوند.',
                  )
                : undefined
            }
          />
        </button>
        <button type="button" className="text-start" onClick={() => onNavigate('/sync-center')}>
          <Stat label={t('dataSync.pending', 'در صف ارسال')} value={String(pendingCount)} />
        </button>
        <button type="button" className="text-start" onClick={() => onNavigate('/conflicts')}>
          <Stat
            label={t('dataSync.conflicts_title', 'تعارض‌ها')}
            value={conflictCount === null ? '—' : String(conflictCount)}
            hint={
              financialConflicts
                ? `${t('dataSync.financial_conflicts', 'مالی')}: ${financialConflicts}`
                : undefined
            }
          />
        </button>
        <button type="button" className="text-start" onClick={() => onNavigate('/data-migration')}>
          <Stat
            label={t('dataSync.last_migration', 'آخرین انتقال')}
            value={
              isLoading ? (
                '—'
              ) : lastMigration ? (
                <Badge tone={MIGRATION_TONE[lastMigration.status] ?? 'info'}>
                  {t(`migration.status_${lastMigration.status}`, lastMigration.status)}
                </Badge>
              ) : (
                t('dataSync.none', 'ندارد')
              )
            }
            hint={migrationRunning ? t('dataSync.migration_running', 'در حال انجام') : undefined}
          />
        </button>
      </section>

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
          <Stat
            label={t('dataSync.last_backup', 'آخرین پشتیبان محلی')}
            value={lastBackupAt === null ? t('dataSync.never', 'هرگز') : dateTime(lastBackupAt)}
          />
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
        ) : conflictCount === 0 ? (
          <p className="text-sm text-[hsl(var(--fg-tertiary))]">
            {t('dataSync.no_conflicts', 'تعارضی برای بررسی وجود ندارد.')}
          </p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--border-default))] text-sm">
            {(conflicts ?? []).slice(0, 3).map((conflict) => (
              <li
                key={conflict.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span className="min-w-0">
                  <span className="font-medium">
                    {conflict.entityLabel ??
                      t(`conflicts.entity_${conflict.entityType}`, conflict.entityType)}
                  </span>
                  <span className="ms-2 text-xs text-[hsl(var(--fg-tertiary))]">
                    {t('dataSync.fields_changed', 'فیلد متفاوت')}: {conflict.divergences.length}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {conflict.hasFinancialDivergence ? (
                    <Badge tone="bad">{t('dataSync.financial_conflicts', 'مالی')}</Badge>
                  ) : null}
                  <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                    {dateTime(conflict.createdAt)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
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
      {/* ─── Diagnostics — collapsed; every row is a real state ─────────── */}
      <details className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4">
        <summary className="min-h-11 cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary)/0.5)]">
          {t('dataSync.diagnostics', 'تشخیص و سلامت فنی')}
        </summary>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <DiagnosticRow
            label={t('dataSync.connection', 'اتصال')}
            ok={isOnline}
            okText={t('state.ready', 'آماده')}
            badText={t('state.offline', 'آفلاین')}
            neutralWhenBad
          />
          <DiagnosticRow
            label={t('dataSync.pending', 'در صف ارسال')}
            ok={pendingCount === 0}
            okText={t('dataSync.synced', 'همگام')}
            badText={String(pendingCount)}
          />
          <DiagnosticRow
            label={t('dataSync.conflicts_title', 'تعارض‌ها')}
            ok={conflictCount === 0}
            unknown={conflictCount === null}
            okText={t('dataSync.none', 'ندارد')}
            badText={String(conflictCount ?? '')}
            unknownText={t('dataSync.conflicts_unknown', 'تعداد تعارض‌ها خوانده نشد.')}
          />
          <DiagnosticRow
            label={t('dataSync.migration_engine', 'موتور انتقال داده')}
            ok={!error && lastMigration?.status !== 'failed'}
            unknown={isLoading}
            okText={t('state.ready', 'آماده')}
            badText={
              error
                ? t('dataSync.read_failed', 'خوانده نشد')
                : t('migration.status_failed', 'failed')
            }
            unknownText="—"
          />
          <DiagnosticRow
            label={t('dataSync.failed_changes', 'تغییرات ناموفق (۳۰ روز)')}
            ok={syncOverview?.failed.count === 0}
            unknown={syncOverview === null}
            okText={t('dataSync.none', 'ندارد')}
            badText={String(syncOverview?.failed.count ?? '')}
            unknownText="—"
          />
          <DiagnosticRow
            label={t('dataSync.devices', 'دستگاه‌های همگام‌شده (۳۰ روز)')}
            ok
            unknown={syncOverview === null}
            okText={String(syncOverview?.devices.length ?? '')}
            badText=""
            unknownText="—"
          />
          {(['customer', 'product'] as const).map((entity) => {
            const row = duplicates?.find((d) => d.entity === entity)
            return (
              <DiagnosticRow
                key={entity}
                label={
                  entity === 'customer'
                    ? t('dataSync.duplicate_customers', 'مشتریان احتمالاً تکراری')
                    : t('dataSync.duplicate_products', 'کالاهای احتمالاً تکراری')
                }
                ok={row?.candidates === 0}
                unknown={row === undefined}
                okText={t('dataSync.none', 'ندارد')}
                badText={String(row?.candidates ?? '')}
                unknownText="—"
              />
            )
          })}
        </dl>
        {syncOverview && syncOverview.truncated ? (
          <p className="mt-3 text-xs text-[hsl(var(--fg-tertiary))]">
            {t('dataSync.overview_truncated', 'فعالیت زیاد بود؛ اعداد حداقل مقدار واقعی‌اند.')}
          </p>
        ) : null}
        {syncOverview && syncOverview.devices.length > 0 ? (
          <ul className="mt-3 space-y-1 text-xs">
            {syncOverview.devices.slice(0, 10).map((device) => (
              <li key={device.deviceId} className="flex flex-wrap justify-between gap-2">
                <span className="font-mono text-[hsl(var(--fg-secondary))]">
                  {device.deviceId === 'unknown'
                    ? t('dataSync.device_unknown', 'دستگاه نامشخص')
                    : device.deviceId.slice(0, 12)}
                </span>
                <span className="text-[hsl(var(--fg-tertiary))]">
                  {dateTime(device.lastSeenAt)} · {device.applied} / {device.rejected}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {syncOverview && syncOverview.failed.recent.length > 0 ? (
          <ul className="mt-3 space-y-1 text-xs">
            {syncOverview.failed.recent.map((change) => (
              <li key={change.mutationId} className="flex flex-wrap justify-between gap-2">
                <span className="text-[hsl(var(--fg-secondary))]">
                  {change.entityType} · {change.operation}
                </span>
                <span className="text-[hsl(var(--color-destructive))]">
                  {change.errorCode ?? t('dataSync.read_failed', 'خوانده نشد')} ·{' '}
                  {dateTime(change.at)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </details>

      {snapshotsSlot}
    </CapabilityPage>
  )
})

DataAndSyncView.displayName = 'DataAndSyncView'

function DiagnosticRow({
  label,
  ok,
  unknown = false,
  okText,
  badText,
  unknownText,
  neutralWhenBad = false,
}: {
  label: string
  ok: boolean
  unknown?: boolean
  okText: string
  badText: string
  unknownText?: string
  /** Offline is an operating state, not a fault — never shown as an error. */
  neutralWhenBad?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-[hsl(var(--surface-muted)/0.4)] px-3 py-2">
      <dt>{label}</dt>
      <dd>
        <Badge tone={unknown ? 'neutral' : ok ? 'good' : neutralWhenBad ? 'neutral' : 'warn'}>
          {unknown ? (unknownText ?? '—') : ok ? okText : badText}
        </Badge>
      </dd>
    </div>
  )
}
