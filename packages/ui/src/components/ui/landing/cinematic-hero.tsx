"use client"

import { useState, useEffect, useRef } from "react"
import { GradientMesh, ShimmerCTA } from "@hisabche/ui"
import FloatingLines from "./floating-lines"

export interface CinematicHeroProps {
  onNavigateLogin: () => void
}

export default function CinematicHero({ onNavigateLogin }: CinematicHeroProps) {
  const ctaRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const isMobile = window.matchMedia("(max-width: 767px)").matches
    if (prefersReduced || isMobile) return

    import("framer-motion").then(({ animate }) => {
      if (!ctaRef.current) return
      animate(
        ctaRef.current,
        { opacity: [0, 1], y: [20, 0] },
        { delay: 0.6, duration: 0.4 }
      )
    })

    setLoaded(true)
  }, [])

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <GradientMesh />
      <FloatingLines />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(168,85,247,0.18),transparent_40%),radial-gradient(circle_at_70%_80%,rgba(34,211,238,0.12),transparent_45%)]" />

      <div className="relative z-10 max-w-4xl px-6 text-center">
        <p className="mb-6 text-xs tracking-[0.3em] text-[var(--hisab-muted-fg)]">
          CINEMATIC PRODUCT EXPERIENCE
        </p>

        <h1 className="text-5xl font-bold leading-tight text-[var(--hisab-foreground)] md:text-7xl">
          حسابداری‌ای که
          <br />
          <span className="bg-gradient-to-r from-purple-400 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
            هیچ‌وقت فراموش نمی‌کنه
          </span>
        </h1>

        <p className="mt-6 text-lg text-[var(--hisab-muted-fg)]">
          این فقط یک اپ نیست — حافظه‌ی زنده‌ی کسب‌وکار توئه.
        </p>

        <div ref={ctaRef} className="mt-10 flex justify-center gap-4">
          <ShimmerCTA onClick={onNavigateLogin}>شروع تجربه</ShimmerCTA>
        </div>
      </div>
    </section>
  )
}