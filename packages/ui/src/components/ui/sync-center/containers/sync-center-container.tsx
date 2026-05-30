"use client"

import { useTranslation } from "react-i18next"
import { useSyncStore, useBackupStore } from "@hisabche/store"
import { SyncCenterPage } from "../sync-center-page"

export function SyncCenterContainer() {
  const { t } = useTranslation()
  const { isOnline, isSyncing, pendingCount, lastSyncedAt, setLastSynced } = useSyncStore()
  const { backups, autoBackupEnabled, setAutoBackup, addBackup, auditLog } = useBackupStore()

  const safeT = (key: string, fallback?: string) => { const v = t(key); return v && v !== key ? v : (fallback ?? key) }

  const timeAgo = (ts: number) => {
    const s = Math.floor((Date.now() - ts) / 1000)
    if (s < 60) return `${s} ${t("sync.secondsAgo", "ثانیه پیش")}`
    if (s < 3600) return `${Math.floor(s / 60)} ${t("sync.minutesAgo", "دقیقه پیش")}`
    if (s < 86400) return `${Math.floor(s / 3600)} ${t("sync.hoursAgo", "ساعت پیش")}`
    return `${Math.floor(s / 86400)} ${t("sync.daysAgo", "روز پیش")}`
  }

  return (
    <SyncCenterPage
      t={safeT}
      timeAgo={timeAgo}
      isOnline={isOnline}
      isSyncing={isSyncing}
      pendingCount={pendingCount}
      lastSyncedAt={lastSyncedAt}
      autoBackupEnabled={autoBackupEnabled}
      backups={backups as any}
      auditLog={auditLog as any}
      onSync={() => setLastSynced(Date.now())}
      onBackup={() => addBackup({ id: `backup-${Date.now()}`, timestamp: Date.now(), size: `${Math.floor(Math.random() * 500 + 100)} KB`, type: "manual", status: "completed" })}
      onToggleAutoBackup={() => setAutoBackup(!autoBackupEnabled)}
    />
  )
}