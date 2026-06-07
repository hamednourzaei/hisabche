"use client"

import { useEffect, useRef } from "react"
import FloatingLines from "./floating-lines"

export interface CinematicHeroProps {
  onNavigateLogin: () => void
}

function getCTA() {
  if (typeof window === "undefined") return "شروع کن — رایگان"
  const v = localStorage.getItem("cta_variant")
  if (v) return v === "B" ? "ساخت حساب در ۳۰ ثانیه ←" : "شروع کن — رایگان ←"

  const variant = Math.random() > 0.5 ? "A" : "B"
  localStorage.setItem("cta_variant", variant)

  return variant === "B"
    ? "ساخت حساب در ۳۰ ثانیه ←"
    : "شروع کن — رایگان ←"
}

export default function CinematicHero({ onNavigateLogin }: CinematicHeroProps) {
  const ctaRef = useRef<HTMLDivElement>(null)
  const ctaText = getCTA()

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const isMobile = window.matchMedia("(max-width: 767px)").matches
    if (prefersReduced || isMobile) return

    import("framer-motion").then(({ animate }) => {
      if (!ctaRef.current) return
      animate(ctaRef.current, { opacity: [0, 1], y: [20, 0] }, { duration: 0.4 })
    })
  }, [])

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <FloatingLines />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(168,85,247,0.18),transparent_40%),radial-gradient(circle_at_70%_80%,rgba(34,211,238,0.12),transparent_45%)]" />

      <div className="relative z-10 max-w-4xl px-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/5 px-4 py-1.5 text-xs text-purple-300">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
          340+ کسب‌وکار فعال در افغانستان
        </div>

        <h1 className="mb-6 text-5xl font-bold leading-[1.15] tracking-tight text-foreground md:text-7xl">
          حسابداری‌ای که
          <br />
          <span className="bg-gradient-to-r from-purple-400 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
            هیچ‌وقت فراموش نمی‌کنه
          </span>
        </h1>

        <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-muted-foreground">
          این فقط یک اپ نیست — حافظه‌ی زنده‌ی کسب‌وکار توئه. فاکتور، گدام، بدهی — همه در یک جا.
        </p>

        <div ref={ctaRef} className="flex flex-col items-center gap-4 sm:flex-row">
          <button
            onClick={onNavigateLogin}
            className="rounded-2xl bg-gradient-to-r from-purple-500 to-cyan-500 px-8 py-4 text-base font-bold text-white shadow-2xl transition-transform hover:scale-105"
          >
            {ctaText}
          </button>

          <button
            onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            className="rounded-2xl border border-border px-8 py-4 text-base text-muted-foreground"
          >
            بیشتر بدون
          </button>
        </div>

        <div className="mt-6 text-xs text-muted-foreground">
          بدون کارت بانکی · فعال در ۳۰ ثانیه
        </div>

        <div className="mt-16 flex items-center justify-center gap-8 text-sm text-muted-foreground">
          {[
            ["🔌", "آفلاین واقعی"],
            ["🔐", "داده امن"],
            ["📱", "موبایل + وب"],
          ].map(([icon, text]) => (
            <div key={text} className="flex items-center gap-2">
              <span>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}