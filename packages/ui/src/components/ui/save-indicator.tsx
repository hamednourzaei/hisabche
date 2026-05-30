"use client"

import React, { useEffect } from "react"
import { Check, Loader2 } from "lucide-react"
import { useSyncStore } from "@hisabche/store"

export interface SaveIndicatorProps {
  show?: boolean
  message?: string
}

const SaveIndicator: React.FC<SaveIndicatorProps> = ({ show, message }) => {
  const { saveStatus, setSaveStatus } = useSyncStore()

  useEffect(() => {
    if (show && saveStatus === 'idle') {
      setSaveStatus('saving')
      setTimeout(() => setSaveStatus('saved'), 800)
      setTimeout(() => setSaveStatus('idle'), 2500)
    }
  }, [show, saveStatus, setSaveStatus])

  if (saveStatus === 'idle' && !show) return null

  return (
    <div className="fixed top-4 start-1/2 -translate-x-1/2 z-[var(--z-toast)] animate-fade-in-up">
      <div className="glass-strong flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium">
        {saveStatus === 'saving' ? (
          <>
            <Loader2 className="size-4 animate-spin text-[var(--hisab-primary)]" />
            <span className="text-[var(--hisab-muted-fg)]">{message || "در حال ذخیره..."}</span>
          </>
        ) : saveStatus === 'saved' ? (
          <>
            <Check className="size-4 text-[var(--hisab-success)]" />
            <span className="text-[var(--hisab-success)]">{message || "ذخیره شد"}</span>
          </>
        ) : null}
      </div>
    </div>
  )
}

export { SaveIndicator }