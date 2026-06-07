"use client"

import { useState, useEffect, useRef } from "react"
import FloatingLines from "./floating-lines"

export interface CinematicHeroProps {
  onNavigateLogin: () => void
}

export default function CinematicHero({ onNavigateLogin }: CinematicHeroProps) {
  const ctaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const isMobile = window.matchMedia("(max-width: 767px)").matches
    if (prefersReduced || isMobile) return
    import("framer-motion").then(({ animate }) => {
      if (!ctaRef.current) return
      animate(ctaRef.current, { opacity: [0, 1], y: [20, 0] }, { delay: 0.6, duration: 0.4 })
    })
  }, [])

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <style>{`
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .hero-fade { animation: fadeInUp 0.7s ease both; }
        .shimmer-btn {
          background: linear-gradient(90deg, #a855f7, #06b6d4, #10b981, #06b6d4, #a855f7);
          background-size: 200% auto;
          animation: shimmer 3s linear infinite;
        }
      `}</style>

      <FloatingLines />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(168,85,247,0.18),transparent_40%),radial-gradient(circle_at_70%_80%,rgba(34,211,238,0.12),transparent_45%)]" />

      <div className="relative z-10 max-w-4xl px-6 text-center">
        <div className="hero-fade mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/5 px-4 py-1.5 text-xs text-purple-300">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
          ۳۴۰+ کسب‌وکار فعال در افغانستان
        </div>

        <h1 className="hero-fade mb-6 text-5xl font-bold leading-[1.15] tracking-tight text-[var(--hisab-foreground)] md:text-7xl" style={{ animationDelay: "0.1s" }}>
          حسابداری‌ای که
          <br />
          <span className="bg-gradient-to-r from-purple-400 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
            هیچ‌وقت فراموش نمی‌کنه
          </span>
        </h1>

        <p className="hero-fade mx-auto mb-10 max-w-xl text-lg leading-relaxed text-[var(--hisab-muted-fg)]" style={{ animationDelay: "0.2s" }}>
          این فقط یک اپ نیست — حافظه‌ی زنده‌ی کسب‌وکار توئه.
          فاکتور، گدام، بدهی — همه در یک جا.
        </p>

        <div ref={ctaRef} className="hero-fade flex flex-col items-center justify-center gap-4 sm:flex-row" style={{ animationDelay: "0.3s" }}>
          <button
            onClick={onNavigateLogin}
            className="shimmer-btn rounded-2xl px-8 py-4 text-base font-bold text-white shadow-2xl shadow-purple-500/20 transition-transform hover:scale-105 active:scale-100"
          >
            شروع کن — رایگان ←
          </button>
          <button
            onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            className="rounded-2xl border border-[var(--hisab-border)] px-8 py-4 text-base font-medium text-[var(--hisab-muted-fg)] transition-all hover:border-white/20 hover:text-[var(--hisab-foreground)]"
          >
            بیشتر بدون
          </button>
        </div>

        <div className="hero-fade mt-16 flex items-center justify-center gap-8 text-sm text-[var(--hisab-muted-fg)]" style={{ animationDelay: "0.4s" }}>
          {[["🔌","آفلاین واقعی"],["🔐","داده امن"],["📱","موبایل + وب"]].map(([icon, text]) => (
            <div key={text} className="flex items-center gap-2"><span>{icon}</span><span>{text}</span></div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-[var(--hisab-muted-fg)]">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 4v12M4 10l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </section>
  )
}