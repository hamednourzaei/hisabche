'use client'

import { KpiCard, KpiGrid } from '../kpi-card'
import { cn } from '../../../lib/utils'
import {
  Cloud,
  CloudOff,
  RefreshCw,
  Clock,
  Check,
  AlertTriangle,
  Download,
  History,
  Database,
  Shield,
  Activity,
  HardDrive,
  Wifi,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════════════════
   SyncCenterPage v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   No external component dependencies
   ═══════════════════════════════════════════════════════════════════════════ */

interface BackupItem {
  id: string
  timestamp: number
  size: string
  type: 'auto' | 'manual'
  status: 'completed' | 'failed'
}

interface AuditItem {
  id: string
  action: string
  entity: string
  timestamp: number
}

export interface SyncCenterPageProps {
  t: (key: string, fallback?: string) => string
  timeAgo: (ts: number) => string
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncedAt: number | null
  autoBackupEnabled: boolean
  backups: BackupItem[]
  auditLog: AuditItem[]
  /** اندازه‌ی واقعی داده‌ی محلی (hisabche-* در localStorage)، نه عدد ساختگی. */
  localStorageSize: string
  onSync: () => void
  onBackup: () => void
  onToggleAutoBackup: () => void
}

export function SyncCenterPage({
  t,
  timeAgo,
  isOnline,
  isSyncing,
  pendingCount,
  lastSyncedAt,
  autoBackupEnabled,
  backups,
  auditLog,
  localStorageSize,
  onSync,
  onBackup,
  onToggleAutoBackup,
}: SyncCenterPageProps) {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="space-y-1.5">
        <h1 className="flex items-center gap-3 text-3xl font-bold text-[hsl(var(--fg-primary))]">
          <Shield className="size-8 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          {t('nav.sync', 'همگام‌سازی')}
        </h1>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">
          {t('sync.description', 'مدیریت امنیت، بکاپ و وضعیت اتصال برنامه')}
        </p>
      </div>

      {/*
        The product's KPI row. These were four hand-built cards with a 56-pixel
        icon tile each — a sixth way of drawing a figure with a caption.
        The icon still carries the state (online/offline, pending or clear),
        which is what this screen needs from it.
      */}
      <KpiGrid>
        <KpiCard
          icon={isOnline ? Cloud : CloudOff}
          label={t('sync.connectionStatus', 'وضعیت اتصال')}
          value={isOnline ? t('sync.online', 'آنلاین') : t('sync.offline', 'آفلاین')}
        />
        <KpiCard icon={Database} label={t('sync.backups', 'بکاپ')} value={backups.length} />
        <KpiCard
          icon={AlertTriangle}
          label={t('sync.pending', 'عملیات معلق')}
          value={pendingCount}
        />
        <KpiCard
          icon={HardDrive}
          label={t('sync.localStorage', 'حافظه محلی')}
          value={localStorageSize}
        />
      </KpiGrid>

      {/* Quick Actions */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Activity className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
            <h2 className="text-lg font-bold text-[hsl(var(--fg-primary))]">
              {t('sync.quickActions', 'عملیات سریع')}
            </h2>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onSync}
              disabled={isSyncing}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-4 py-2.5',
                'text-sm font-bold text-white',
                'bg-[image:var(--gradient-brand)]',
                'shadow-sm shadow-[hsl(var(--color-primary)/0.15)]',
                'transition-all duration-200 hover:brightness-110 active:scale-[0.98]',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                'motion-reduce:transition-none',
              )}
            >
              <RefreshCw className={cn('size-4', isSyncing && 'animate-spin')} aria-hidden="true" />
              {t('sync.syncNow', 'به‌روزرسانی اطلاعات')}
            </button>

            <button
              type="button"
              onClick={onBackup}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-4 py-2.5',
                'text-sm font-medium',
                'border border-[hsl(var(--border-default))]',
                'text-[hsl(var(--fg-secondary))]',
                'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
                'transition-colors duration-150',
                'motion-reduce:transition-none',
              )}
            >
              <Download className="size-4" aria-hidden="true" />
              {t('sync.manualBackup', 'بکاپ دستی')}
            </button>

            <button
              type="button"
              onClick={onToggleAutoBackup}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-4 py-2.5',
                'text-sm font-medium transition-all duration-200',
                'motion-reduce:transition-none',
                autoBackupEnabled
                  ? 'bg-[image:var(--gradient-brand)] text-white shadow-sm'
                  : 'border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]',
              )}
            >
              <Database className="size-4" aria-hidden="true" />
              {t('sync.autoBackup', 'بکاپ خودکار')}
            </button>
          </div>

          {lastSyncedAt && (
            <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-4 text-sm text-[hsl(var(--fg-secondary))]">
              <Clock className="size-4 text-[hsl(var(--color-success))]" aria-hidden="true" />
              {t('sync.lastSynced', 'آخرین همگام‌سازی')}: {timeAgo(lastSyncedAt)}
            </div>
          )}
        </div>
      </div>

      {/* Backup History */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <History className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
            <h2 className="text-lg font-bold text-[hsl(var(--fg-primary))]">
              {t('sync.backupHistory', 'تاریخچه بکاپ')}
            </h2>
          </div>

          {backups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[hsl(var(--border-default))] py-10 text-center">
              <Database
                className="mx-auto mb-3 size-10 text-[hsl(var(--fg-tertiary))]"
                aria-hidden="true"
              />
              <p className="text-sm text-[hsl(var(--fg-tertiary))]">
                {t('sync.noBackups', 'هنوز بکاپی ثبت نشده')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.slice(0, 6).map((backup) => (
                <div
                  key={backup.id}
                  className="flex items-center justify-between rounded-xl border border-[hsl(var(--border-default))] p-4 transition-all duration-200 hover:border-[hsl(var(--color-primary)/0.3)]"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full shrink-0',
                        backup.status === 'completed'
                          ? 'bg-[hsl(var(--color-success)/0.1)]'
                          : 'bg-[hsl(var(--color-destructive)/0.1)]',
                      )}
                    >
                      {backup.status === 'completed' ? (
                        <Check
                          className="size-5 text-[hsl(var(--color-success))]"
                          aria-hidden="true"
                        />
                      ) : (
                        <AlertTriangle
                          className="size-5 text-[hsl(var(--color-destructive))]"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-[hsl(var(--fg-primary))]">
                        {backup.type === 'auto'
                          ? t('sync.autoBackup', 'بکاپ خودکار')
                          : t('sync.manualBackup', 'بکاپ دستی')}
                      </p>
                      <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                        {timeAgo(backup.timestamp)} • {backup.size}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0',
                      backup.status === 'completed'
                        ? 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))] border border-[hsl(var(--color-success)/0.2)]'
                        : 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))] border border-[hsl(var(--color-destructive)/0.2)]',
                    )}
                  >
                    {backup.status === 'completed'
                      ? t('sync.success', 'موفق')
                      : t('sync.error', 'خطا')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Audit Log */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Shield className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
            <h2 className="text-lg font-bold text-[hsl(var(--fg-primary))]">
              {t('sync.recentActivity', 'فعالیت‌های اخیر')}
            </h2>
          </div>

          {auditLog.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[hsl(var(--border-default))] py-10 text-center">
              <History
                className="mx-auto mb-3 size-10 text-[hsl(var(--fg-tertiary))]"
                aria-hidden="true"
              />
              <p className="text-sm text-[hsl(var(--fg-tertiary))]">
                {t('sync.noActivity', 'هنوز فعالیتی ثبت نشده')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {auditLog.slice(0, 10).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-[hsl(var(--border-default))] p-3 transition-all duration-200 hover:border-[hsl(var(--color-primary)/0.3)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-[hsl(var(--color-primary))] shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-[hsl(var(--fg-primary))]">
                        {item.action}
                      </p>
                      <p className="text-xs text-[hsl(var(--fg-tertiary))]">{item.entity}</p>
                    </div>
                  </div>
                  <span className="text-xs text-[hsl(var(--fg-tertiary))] shrink-0">
                    {timeAgo(item.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Network Status */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Wifi className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
            <h2 className="text-lg font-bold text-[hsl(var(--fg-primary))]">
              {t('sync.networkStatus', 'وضعیت شبکه')}
            </h2>
          </div>
          {/* ✅ FIX: کارت «وضعیت سرور: پایدار» حذف شد — این یک متن hardcoded
              بود که هیچ health-check واقعی پشتش نبود و همیشه «پایدار»
              نشان می‌داد، حتی اگر سرور واقعاً پایین بود. */}
          <div className="rounded-2xl border border-[hsl(var(--border-default))] p-4 text-start">
            <p className="mb-1 text-sm text-[hsl(var(--fg-secondary))]">
              {t('sync.internet', 'اینترنت')}
            </p>
            <p
              className={cn(
                'font-semibold',
                isOnline ? 'text-[hsl(var(--color-success))]' : 'text-[hsl(var(--color-warning))]',
              )}
            >
              {isOnline ? t('sync.connected', 'متصل') : t('sync.disconnected', 'قطع')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
