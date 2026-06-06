"use client"

import { useState, useEffect } from "react"
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useReducedMotion,
} from "framer-motion"
import { GradientMesh, ShimmerCTA } from "@hisabche/ui"
import FloatingLines from "./floating-lines"

function useCinematicCamera() {
  const { scrollYProgress } = useScroll()
  const smooth = useSpring(scrollYProgress, {
    stiffness: 80,
    damping: 25,
    mass: 0.2,
  })
  const zoom = useTransform(smooth, [0, 0.5, 1], [1, 1.05, 1.1])
  const fade = useTransform(smooth, [0, 0.2, 0.8, 1], [1, 1, 0.9, 0.8])
  return { zoom, fade }
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)")
    const handler = () => setIsMobile(mql.matches)
    handler()
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [])
  return isMobile
}

export interface CinematicHeroProps {
  onNavigateLogin: () => void
}

export default function CinematicHero({ onNavigateLogin }: CinematicHeroProps) {
  const { zoom, fade } = useCinematicCamera()
  const reduceMotion = useReducedMotion()
  const isMobile = useIsMobile()
  const shouldAnimate = !reduceMotion && !isMobile

  const ctaMotionProps = shouldAnimate
    ? {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { delay: 0.6 },
      }
    : {}

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* animation روی overlay — h1 بلاک نمیشه */}
      {shouldAnimate && (
        <motion.div
          style={{ scale: zoom, opacity: fade }}
          className="absolute inset-0 pointer-events-none"
        />
      )}

      <GradientMesh />
      <FloatingLines />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(168,85,247,0.18),transparent_40%),radial-gradient(circle_at_70%_80%,rgba(34,211,238,0.12),transparent_45%)]" />

      <div className="relative z-10 max-w-4xl px-6 text-center">
        <p className="mb-6 text-xs tracking-[0.3em] text-[var(--hisab-muted-fg)]">
          CINEMATIC PRODUCT EXPERIENCE
        </p>

        {/* h1 مستقیم رندر میشه — LCP element بلاک نیست */}
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

        <motion.div {...ctaMotionProps} className="mt-10 flex justify-center gap-4">
          <ShimmerCTA onClick={onNavigateLogin}>شروع تجربه</ShimmerCTA>
        </motion.div>
      </div>
    </section>
  )
}