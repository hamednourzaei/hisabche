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
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 10) return "لحظاتی پیش"
  if (seconds < 60) return `${seconds} ثانیه پیش`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} دقیقه پیش`
  const hours = Math.floor(minutes / 60)
  return `${hours} ساعت پیش`
}

const SyncStatus: React.FC<SyncStatusProps> = ({
  lastSyncedAt,
  isOnline,
  isSyncing,
  pendingCount,
  className,
}) => {
  return (
    <div className={cn("flex items-center gap-3 text-xs", className)}>
      {isOnline ? (
        <div className="flex items-center gap-1.5 text-[var(--hisab-success)]">
          <Wifi className="size-3.5" />
          <span>آنلاین</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-[var(--hisab-warning)]">
          <WifiOff className="size-3.5" />
          <span>آفلاین</span>
        </div>
      )}

      <div className="w-px h-3 bg-[var(--hisab-border)]" />

      {isSyncing ? (
        <div className="flex items-center gap-1.5 text-[var(--hisab-info)]">
          <RefreshCw className="size-3.5 animate-spin" />
          <span>همگام‌سازی...</span>
        </div>
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
          <div className="flex items-center gap-1.5 text-[var(--hisab-warning)]">
            <CloudOff className="size-3.5" />
            <span>{pendingCount} در انتظار</span>
          </div>
        </>
      )}
    </div>
  )
}

export { SyncStatus }