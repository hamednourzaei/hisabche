"use client"

import { useState, useEffect } from "react"

export default function FloatingLines() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px), (prefers-reduced-motion: reduce)")
    if (!mql.matches) setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="absolute h-px w-full bg-gradient-to-r from-transparent via-purple-400/15 to-transparent"
          style={{
            top: `${10 + i * 22}%`,
            animation: `floatLine ${8 + i * 3}s ease-in-out infinite`,
            animationDelay: `${i * 1.5}s`,
          }}
        />
      ))}

      <style>{`
        @keyframes floatLine {
          0%,100% { transform: translateX(-5%) scaleY(1); opacity: .2 }
          50% { transform: translateX(5%) scaleY(2.5); opacity: .6 }
        }
      `}</style>
    </div>
  )
}