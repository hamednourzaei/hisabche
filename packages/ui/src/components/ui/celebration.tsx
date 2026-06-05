"use client"

import React, { useEffect, useState, useCallback } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { cn } from "../../lib/utils"

export interface CelebrationProps {
  show: boolean
  message: string
  emoji?: string
  duration?: number
  onComplete?: () => void
}

const CONFETTI_COLORS = [
  "#FFD700",
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
]

const Celebration: React.FC<CelebrationProps> = ({
  show,
  message,
  emoji = "🎉",
  duration = 3000,
  onComplete,
}) => {
  const [open, setOpen] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const handleComplete = useCallback(() => onComplete?.(), [onComplete])

  useEffect(() => {
    if (show && !open) {
      setOpen(true)
      setIsLeaving(false)
      const timer = setTimeout(() => {
        setIsLeaving(true)
        setTimeout(() => {
          setOpen(false)
          handleComplete()
        }, 500)
      }, duration)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [show, duration, handleComplete, open])

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/30 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        />
        <Dialog.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-full max-w-sm translate-x-[-50%] translate-y-[-50%]",
            "focus:outline-none",
            "duration-500",
            isLeaving ? "opacity-0" : "opacity-100",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          {/* Confetti */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  width: `${Math.random() * 10 + 6}px`,
                  height: `${Math.random() * 10 + 6}px`,
                  borderRadius: "50%",
                  background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                  top: "-5%",
                  left: `${Math.random() * 100}%`,
                  animation: `confettiFall ${Math.random() * 2 + 2}s linear ${Math.random() * 0.6}s forwards`,
                }}
              />
            ))}
          </div>

          {/* Card */}
          <div
            className="pointer-events-auto relative z-10"
            style={{
              animation:
                "scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
            }}
          >
            <div className="mb-4 animate-bounce text-center text-6xl">
              {emoji}
            </div>
            <div className="glass-card px-8 py-6">
              <p className="text-center text-xl font-bold">{message}</p>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export { Celebration }