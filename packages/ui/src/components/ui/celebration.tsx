"use client"

import React, { useEffect, useState, useCallback } from "react"

export interface CelebrationProps {
  show: boolean
  message: string
  emoji?: string
  duration?: number
  onComplete?: () => void
}

const CONFETTI_COLORS = ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7"]

const Celebration: React.FC<CelebrationProps> = ({
  show,
  message,
  emoji = "🎉",
  duration = 3000,
  onComplete,
}) => {
  const [phase, setPhase] = useState<"idle" | "visible" | "fading">("idle")

  const handleComplete = useCallback(() => { onComplete?.() }, [onComplete])

  useEffect(() => {
    if (show && phase === "idle") {
      setPhase("visible")
      const fadeTimer = setTimeout(() => setPhase("fading"), duration)
      const cleanupTimer = setTimeout(() => { setPhase("idle"); handleComplete() }, duration + 500)
      return () => { clearTimeout(fadeTimer); clearTimeout(cleanupTimer) }
    }
    return undefined
  }, [show, duration, handleComplete, phase])

  if (phase === "idle") return null

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm transition-opacity duration-500 ${phase === "fading" ? "opacity-0" : "opacity-100"}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute", width: `${Math.random() * 10 + 6}px`, height: `${Math.random() * 10 + 6}px`,
              borderRadius: "50%", background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              top: "-5%", left: `${Math.random() * 100}%`,
              animation: `confettiFall ${Math.random() * 2 + 2}s linear ${Math.random() * 0.6}s forwards`,
            }}
          />
        ))}
      </div>

      <div className="pointer-events-auto relative z-10" style={{ animation: "scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards" }}>
        <div className="text-6xl mb-4 text-center animate-bounce">{emoji}</div>
        <div className="glass-card px-8 py-6">
          <p className="text-xl font-bold text-center">{message}</p>
        </div>
      </div>
    </div>
  )
}

export { Celebration }