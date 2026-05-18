"use client"

import React from "react"
import { WifiOff } from "lucide-react"

export interface OfflineBannerProps {
  pendingCount: number
  isOnline: boolean
}

const OfflineBanner: React.FC<OfflineBannerProps> = ({ pendingCount, isOnline }) => {
  if (isOnline && pendingCount === 0) return null

  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-center animate-slide-up"
      style={{
        background: isOnline ? 'hsl(var(--hisab-success) / 0.1)' : 'hsl(var(--hisab-warning) / 0.1)',
        color: isOnline ? 'hsl(var(--hisab-success))' : 'hsl(var(--hisab-warning))',
        borderBottom: `1px solid ${isOnline ? 'hsl(var(--hisab-success) / 0.3)' : 'hsl(var(--hisab-warning) / 0.3)'}`,
      }}
      role="alert"
    >
      <WifiOff className="size-4" />
      {!isOnline
        ? `شما آفلاین هستید — ${pendingCount > 0 ? `${pendingCount} عملیات در انتظار همگام‌سازی` : 'اطلاعات ذخیره شده قابل مشاهده است'}`
        : `${pendingCount} عملیات در حال همگام‌سازی...`}
    </div>
  )
}

export { OfflineBanner }