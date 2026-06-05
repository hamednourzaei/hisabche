"use client"

import React from "react"
import { cn } from "../../lib/utils"
import { Clock, Cloud } from "lucide-react"
import { Badge } from "./badge"

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

const SyncStatus: React.FC<SyncStatusProps> = ({
  lastSyncedAt,
  isOnline,
  isSyncing,
  pendingCount,
  className,
}) => {
  return (
    <div
      className={cn(
        "flex items-center gap-3 text-xs",
        className
      )}
      role="status"
      aria-live="polite"
    >
      {isOnline ? (
        <Badge variant="success" className="gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          آنلاین
        </Badge>
      ) : (
        <Badge variant="warning" className="gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          آفلاین
        </Badge>
      )}

      <div className="h-3 w-px bg-border" />

      {isSyncing ? (
        <Badge variant="secondary" className="gap-1 animate-pulse">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          همگام‌سازی...
        </Badge>
      ) : lastSyncedAt ? (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="size-3.5" aria-hidden />
          <span>{timeAgo(lastSyncedAt)}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Cloud className="size-3.5" aria-hidden />
          <span>همگام‌سازی نشده</span>
        </div>
      )}

      {pendingCount > 0 && (
        <>
          <div className="h-3 w-px bg-border" />
          <Badge variant="warning" className="gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {pendingCount} در انتظار
          </Badge>
        </>
      )}
    </div>
  )
}

export { SyncStatus }