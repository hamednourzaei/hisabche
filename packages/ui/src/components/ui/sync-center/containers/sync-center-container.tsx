"use client"

import { useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useQueryClient } from "@tanstack/react-query"
import { useSyncStore, useBackupStore } from "@hisabche/store"
import { SyncCenterPage } from "../sync-center-page"
import type { SyncCenterPageProps } from "../sync-center-page"

export function SyncCenterContainer() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { isOnline, isSyncing, pendingCount, lastSyncedAt, setLastSynced } = useSyncStore()
  const { backups, autoBackupEnabled, setAutoBackup, addBackup, createBackup, auditLog } = useBackupStore()

  const safeT = useCallback(
    (key: string, fallback?: string) => {
      const v = t(key)
      return v && v !== key ? v : (fallback ?? key)
    },
    [t]
  )

  const timeAgo = useCallback(
    (ts: number) => {
      const s = Math.floor((Date.now() - ts) / 1000)
      if (s < 60) return `${s} ${t("sync.secondsAgo", "ثانیه پیش")}`
      if (s < 3600) return `${Math.floor(s / 60)} ${t("sync.minutesAgo", "دقیقه پیش")}`
      if (s < 86400) return `${Math.floor(s / 3600)} ${t("sync.hoursAgo", "ساعت پیش")}`
      return `${Math.floor(s / 86400)} ${t("sync.daysAgo", "روز پیش")}`
    },
    [t]
  )

  // ✅ FIX: قبلاً «همگام‌سازی الآن» فقط یک ساعت محلی را عوض می‌کرد و هیچ
  // کاری واقعی انجام نمی‌داد. حالا واقعاً تمام کش‌های TanStack Query را
  // invalidate می‌کند تا داده‌ی هر صفحه از سرور دوباره خوانده شود.
  const handleSync = useCallback(() => {
    queryClient.invalidateQueries()
    setLastSynced(Date.now())
  }, [queryClient, setLastSynced])

  const localStorageSize = useMemo(() => {
    if (typeof window === "undefined") return "0 KB"
    let bytes = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith("hisabche-")) {
        bytes += new Blob([localStorage.getItem(key) || ""]).size
      }
    }
    return bytes > 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`
  }, [backups, auditLog])
  // ✅ FIX: قبلاً اندازه‌ی بکاپ با Math.random() ساخته می‌شد (عدد جعلی).
  // حالا از createBackup() واقعی استفاده می‌کند که داده‌های واقعی
  // localStorage را serialize کرده و اندازه‌ی واقعی (Blob.size) را
  // محاسبه می‌کند؛ فقط نوع رکورد را به "manual" تغییر می‌دهیم چون
  // createBackup() پیش‌فرض آن را "auto" ثبت می‌کند.
  const handleBackup = useCallback(() => {
    const backup = createBackup()
    addBackup({ ...backup, type: "manual" })
  }, [createBackup, addBackup])
  const handleToggleAutoBackup = useCallback(() => setAutoBackup(!autoBackupEnabled), [autoBackupEnabled, setAutoBackup])

  return (
    <SyncCenterPage
      t={safeT}
      timeAgo={timeAgo}
      isOnline={isOnline}
      isSyncing={isSyncing}
      pendingCount={pendingCount}
      lastSyncedAt={lastSyncedAt}
      autoBackupEnabled={autoBackupEnabled}
      backups={backups as SyncCenterPageProps["backups"]}
      auditLog={auditLog as SyncCenterPageProps["auditLog"]}
      localStorageSize={localStorageSize}
      onSync={handleSync}
      onBackup={handleBackup}
      onToggleAutoBackup={handleToggleAutoBackup}
    />
  )
}