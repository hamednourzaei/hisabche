'use client'

import { KpiCard, KpiGrid } from '../kpi-card'
import { cn } from '../../../lib/utils'
import {
  Cloud,
  CloudOff,
  RefreshCw,
  Clock,
  AlertTriangle,
  Download,
  Database,
  Shield,
  Activity,
  HardDrive,
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

export interface SyncCenterPageProps {
  t: (key: string, fallback?: string) => string
  timeAgo: (ts: number) => string
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncedAt: number | null
  backups: BackupItem[]
  /** اندازه‌ی واقعی داده‌ی محلی (hisabche-* در localStorage)، نه عدد ساختگی. */
  localStorageSize: string
  onSync: () => void
  onBackup: () => void
}

export function SyncCenterPage({
  t,
  timeAgo,
  isOnline,
  isSyncing,
  pendingCount,
  lastSyncedAt,
  backups,
  localStorageSize,
  onSync,
  onBackup,
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
          label={t('sync.pendingLabel', 'در صف ارسال')}
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
          </div>

          {lastSyncedAt && (
            <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-4 text-sm text-[hsl(var(--fg-secondary))]">
              <Clock className="size-4 text-[hsl(var(--color-success))]" aria-hidden="true" />
              {t('sync.lastSynced', 'آخرین همگام‌سازی')}: {timeAgo(lastSyncedAt)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
