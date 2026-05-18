"use client"

import React from "react"
import { CloudOff } from "lucide-react"

export interface OfflineQueueProps {
  pendingCount: number
  onSync?: () => void
}

const OfflineQueue: React.FC<OfflineQueueProps> = ({ pendingCount, onSync }) => {
  if (pendingCount === 0) return null

  return (
    <div className="fixed bottom-24 start-1/2 -translate-x-1/2 z-40 animate-slide-up">
      <button
        onClick={onSync}
        className="flex items-center gap-2 px-4 py-2 rounded-full shadow-[var(--hisab-shadow-lg)] text-sm font-medium transition-all hover:scale-105 active:scale-95 offline-queue-badge"
        style={{
          background: 'hsl(var(--hisab-warning))',
          color: 'white',
        }}
      >
        <CloudOff className="size-4" />
        {pendingCount} عملیات در انتظار
      </button>
    </div>
  )
}

export { OfflineQueue }