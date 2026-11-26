'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { runRegisteredSyncDetailed } from '@hisabche/api'
import { useSyncStore, useBackupStore } from '@hisabche/store'
import { SyncCenterPage } from '../sync-center-page'
import type { SyncCenterPageProps } from '../sync-center-page'
import { BackupDownloadPanel } from '../backup-download-panel'
import { BackupRestorePanel } from '../backup-restore-panel'

export function SyncCenterContainer() {
  const t = useTranslations()
  const queryClient = useQueryClient()
  const {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncedAt,
    lastSyncOutcome,
    setLastSynced,
    setSyncOutcome,
    setSyncing,
  } = useSyncStore()
  const { backups, addBackup, createBackup } = useBackupStore()

  const safeT = useCallback(
    (key: string, fallback?: string) => {
      const v = t(key)
      return v && v !== key ? v : (fallback ?? key)
    },
    [t],
  )

  const timeAgo = useCallback(
    (ts: number) => {
      const s = Math.floor((Date.now() - ts) / 1000)
      // ⚠️ The messages carry their own placeholder («{m} دقیقه پیش»). The
      // number used to be put IN FRONT of it, so the page read «2 {m} دقیقه
      // پیش» (live audit #69, 14 Oct). The number goes INTO the message.
      if (s < 60) return t('sync.secondsAgo').replace('{s}', String(s))
      if (s < 3600) return t('sync.minutesAgo').replace('{m}', String(Math.floor(s / 60)))
      if (s < 86400) return t('sync.hoursAgo').replace('{h}', String(Math.floor(s / 3600)))
      return t('sync.daysAgo').replace('{d}', String(Math.floor(s / 86400)))
    },
    [t],
  )

  // Triggers actual push+pull coordinator when available and only advances
  // `lastSyncedAt` when real sync succeeds; query invalidation alone never spoofs sync.
  const handleSync = useCallback(async () => {
    setSyncing(true)
    try {
      const outcome = isOnline
        ? await runRegisteredSyncDetailed()
        : { ok: false, status: 'offline' as const }
      setSyncOutcome({
        status: outcome.status,
        ok: outcome.ok,
        pushedCount: outcome.pushedCount,
        pushFailureCount: outcome.pushFailureCount,
        pulledCount: outcome.pulledCount,
        conflictCount: outcome.conflictCount,
        error: outcome.error,
      })
      await queryClient.invalidateQueries()
      if (outcome.status === 'success' && outcome.ok) {
        setLastSynced(Date.now())
      }
    } finally {
      setSyncing(false)
    }
  }, [isOnline, queryClient, setLastSynced, setSyncOutcome, setSyncing])

  // Read on every render: a backup just taken changes it, and the loop is cheap.
  const localStorageSize = (() => {
    if (typeof window === 'undefined') return '0 KB'
    let bytes = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('hisabche-')) {
        bytes += new Blob([localStorage.getItem(key) || '']).size
      }
    }
    return bytes > 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`
  })()
  // ✅ FIX: قبلاً اندازه‌ی بکاپ با Math.random() ساخته می‌شد (عدد جعلی).
  // حالا از createBackup() واقعی استفاده می‌کند که داده‌های واقعی
  // localStorage را serialize کرده و اندازه‌ی واقعی (Blob.size) را
  // محاسبه می‌کند؛ فقط نوع رکورد را به "manual" تغییر می‌دهیم چون
  // createBackup() پیش‌فرض آن را "auto" ثبت می‌کند.
  const handleBackup = useCallback(() => {
    const backup = createBackup()
    addBackup({ ...backup, type: 'manual' })
  }, [createBackup, addBackup])

  return (
    <div className="space-y-4">
      <BackupDownloadPanel />
      <BackupRestorePanel />
      <SyncCenterPage
        t={safeT}
        timeAgo={timeAgo}
        isOnline={isOnline}
        isSyncing={isSyncing}
        pendingCount={pendingCount}
        lastSyncedAt={lastSyncedAt}
        lastSyncOutcome={lastSyncOutcome}
        backups={backups as SyncCenterPageProps['backups']}
        localStorageSize={localStorageSize}
        onSync={handleSync}
        onBackup={handleBackup}
      />
    </div>
  )
}
