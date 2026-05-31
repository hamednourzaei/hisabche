"use client"

import React from "react"
import { CloudOff } from "lucide-react"

export interface OfflineQueueProps {
  pendingCount: number
  onSync?: () => void
}

const OfflineQueue: React.FC<OfflineQueueProps> = ({
  pendingCount,
  onSync,
}) => {
  if (pendingCount === 0) return null

  return (
    <div className="fixed bottom-24 start-1/2 z-40 -translate-x-1/2 animate-fade-in-up">
      <button
        onClick={onSync}
        className="shimmer-btn flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all hover:scale-105 active:scale-95"
        aria-label={`${pendingCount} عملیات در انتظار همگام‌سازی`}
      >
        <CloudOff className="size-4" aria-hidden />
        {pendingCount} عملیات در انتظار
      </button>
    </div>
  )
}

export { OfflineQueue }