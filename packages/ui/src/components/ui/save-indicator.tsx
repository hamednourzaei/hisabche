"use client"

import React from "react"
import { Check } from "lucide-react"

export interface SaveIndicatorProps {
  show: boolean
  message?: string
}

const SaveIndicator: React.FC<SaveIndicatorProps> = ({ show, message = "ذخیره شد" }) => {
  if (!show) return null

  return (
    <div className="fixed top-4 start-1/2 -translate-x-1/2 z-[100] animate-fade-in">
      <div className="flex items-center gap-2 px-4 py-2 rounded-full shadow-[var(--hisab-shadow-md)] text-sm font-medium"
        style={{
          background: 'hsl(var(--hisab-success))',
          color: 'white',
        }}>
        <Check className="size-4" />
        {message}
      </div>
    </div>
  )
}

export { SaveIndicator }