"use client"

import React, { useEffect } from "react"
import { Check, Loader2 } from "lucide-react"
import { useSyncStore } from "@hisabche/store"

export interface SaveIndicatorProps {
  show?: boolean
  message?: string
}

const SaveIndicator: React.FC<SaveIndicatorProps> = ({
  show,
  message,
}) => {
  const { saveStatus, setSaveStatus } = useSyncStore()

  useEffect(() => {
    if (show && saveStatus === "idle") {
      setSaveStatus("saving")
      setTimeout(
        () => setSaveStatus("saved"),
        800
      )
      setTimeout(
        () => setSaveStatus("idle"),
        2500
      )
    }
  }, [show, saveStatus, setSaveStatus])

  if (saveStatus === "idle" && !show) return null

  return (
    <div className="fixed start-1/2 top-4 z-[var(--z-toast)] -translate-x-1/2 animate-fade-in-up">
      <div className="glass-strong flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium">
        {saveStatus === "saving" ? (
          <>
            <Loader2
              className="size-4 animate-spin text-[var(--hisab-primary)]"
              aria-hidden
            />
            <span className="text-[var(--hisab-muted-fg)]">
              {message || "در حال ذخیره..."}
            </span>
          </>
        ) : saveStatus === "saved" ? (
          <>
            <Check
              className="size-4 text-[var(--hisab-success)]"
              aria-hidden
            />
            <span className="text-[var(--hisab-success)]">
              {message || "ذخیره شد"}
            </span>
          </>
        ) : null}
      </div>
    </div>
  )
}

export { SaveIndicator }