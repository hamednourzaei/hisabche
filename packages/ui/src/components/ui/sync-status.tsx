"use client"

import React from "react"
import { cn } from "../../lib/utils"
import { Cloud, CloudOff, Wifi, WifiOff, RefreshCw, Check, Clock } from "lucide-react"

export interface SyncStatusProps {
  lastSyncedAt: number | null
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  className?: string
}

function timeAgo(timestamp: number): string {
  const s = Math.floor((Date.now() - timestamp) / 1000)
  if (s < 10) return "لحظاتی پیش"
  if (s < 60) return `${s} ثانیه پیش`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} دقیقه پیش`
  return `${Math.floor(m / 60)} ساعت پیش`
}

const SyncStatus: React.FC<SyncStatusProps> = ({ lastSyncedAt, isOnline, isSyncing, pendingCount, className }) => {
  return (
    <div className={cn("flex items-center gap-3 text-xs", className)}>
      {isOnline ? (
        <span className="sync-pill ok">● آنلاین</span>
      ) : (
        <span className="sync-pill off">● آفلاین</span>
      )}

      <div className="w-px h-3 bg-[var(--hisab-border)]" />

      {isSyncing ? (
        <span className="sync-pill syncing">◉ همگام‌سازی...</span>
      ) : lastSyncedAt ? (
        <div className="flex items-center gap-1.5 text-[var(--hisab-muted-fg)]">
          <Clock className="size-3.5" />
          <span>{timeAgo(lastSyncedAt)}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-[var(--hisab-muted-fg)]">
          <Cloud className="size-3.5" />
          <span>همگام‌سازی نشده</span>
        </div>
      )}

      {pendingCount > 0 && (
        <>
          <div className="w-px h-3 bg-[var(--hisab-border)]" />
          <span className="sync-pill off">● {pendingCount} در انتظار</span>
        </>
      )}
    </div>
  )
}

export { SyncStatus }