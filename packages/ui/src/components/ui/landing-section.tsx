// ═══════════════════════════════════════════════════════════
// packages/ui/src/components/ui/landing-section.tsx
// v3 — shared observer, easing counter, CSS modules ready
// ═══════════════════════════════════════════════════════════
"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useInView } from "../../lib/use-in-view"

// ─── Eased Counter (requestAnimationFrame + exponential decay) ──
function useEasedCounter(end: number, inView: boolean) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!inView || end === 0) return
    let animationId: number
    let current = 0
    const duration = 1500 // ms
    const startTime = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out: 1 - (1-t)^3
      const eased = 1 - Math.pow(1 - progress, 3)
      current = Math.round(eased * end)
      setCount(current)
      if (progress < 1) {
        animationId = requestAnimationFrame(tick)
      }
    }
    animationId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animationId)
  }, [inView, end])

  return count
}

// ─── Animated Counter ──────────────────────────────────
export function AnimatedCounter({ end, label }: { end: number; label: string }) {
  const { ref, inView } = useInView()
  const count = useEasedCounter(end, inView)

  return (
    <div ref={ref} className="text-center" role="status" aria-label={`${label}: ${count.toLocaleString("fa-AF")}+`}>
      <div className="text-2xl sm:text-3xl font-bold text-[var(--hisab-foreground)]">
        {count.toLocaleString("fa-AF")}+
      </div>
      <div className="text-xs text-[var(--hisab-muted-fg)] mt-1">{label}</div>
    </div>
  )
}

// ─── Gradient Mesh ─────────────────────────────────────
export function GradientMesh() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-[var(--hisab-primary)]/3 blur-[100px] gradient-float" />
      <div className="absolute bottom-0 right-1/3 w-[400px] h-[400px] rounded-full bg-[var(--hisab-warning)]/2 blur-[100px] gradient-float-delayed" />
      <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] rounded-full bg-[var(--hisab-success)]/2 blur-[100px] gradient-float-slow" />
    </div>
  )
}

// ─── Glass Navbar ──────────────────────────────────────
export function GlassNavbar() {
  const { t } = useTranslation()
  const router = useRouter()
  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--hisab-border)] bg-[var(--hisab-background)]/70 backdrop-blur-xl" aria-label="ناوبری اصلی">
      <div className="mx-auto flex h-12 sm:h-14 max-w-6xl items-center justify-between px-4">
        <a href="/" className="flex items-center gap-2" aria-label="حسابچه — صفحه اصلی">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--hisab-primary)]">
            <span className="text-white font-bold text-xs">ح</span>
          </div>
          <span className="font-bold text-sm text-[var(--hisab-foreground)]">{t("app.name")}</span>
        </a>
        <button
          onClick={() => router.push("/login")}
          className="rounded-lg bg-[var(--hisab-primary)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--hisab-primary)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--hisab-primary)]/50 transition-all active:scale-95"
        >
          {t("auth.signIn")}
        </button>
      </div>
    </nav>
  )
}

// ─── Shimmer CTA ───────────────────────────────────────
export function ShimmerCTA({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-[var(--hisab-primary)] px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-[var(--hisab-primary)]/20 transition-all active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-[var(--hisab-primary)]/50"
    >
      <span className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      {children}
    </button>
  )
}

// ─── Section Wrapper ───────────────────────────────────
export function Section({
  children,
  className = "",
  bordered = false,
}: {
  children: ReactNode
  className?: string
  bordered?: boolean
}) {
  const { ref, inView } = useInView(0.05)
  return (
    <section
      ref={ref}
      className={`px-4 py-14 sm:py-18 transition-all duration-500 ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      } ${bordered ? "border-y border-[var(--hisab-border)] bg-[var(--hisab-muted)]/5" : ""} ${className}`}
    >
      <div className="mx-auto max-w-5xl">{children}</div>
    </section>
  )
}

// ─── Feature Card ──────────────────────────────────────
export function FeatureCard({
  emoji,
  title,
  desc,
  index = 0,
}: {
  emoji: string
  title: string
  desc: string
  index?: number
}) {
  return (
    <div
      className="group rounded-2xl border border-[var(--hisab-border)] bg-[var(--hisab-card)] p-6 transition-all hover:border-[var(--hisab-primary)]/30 hover:shadow-lg hover:shadow-[var(--hisab-primary)]/5 hover:-translate-y-0.5"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--hisab-primary)]/8 text-2xl mb-5 group-hover:scale-110 transition-transform duration-300">
        {emoji}
      </div>
      <h3 className="font-semibold text-[var(--hisab-foreground)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--hisab-muted-fg)]">{desc}</p>
    </div>
  )
}

// ─── Section Heading ───────────────────────────────────
export function SectionHeading({
  badge,
  title,
  desc,
}: {
  badge?: string
  title: string
  desc?: string
}) {
  const { ref, inView } = useInView()
  return (
    <div
      ref={ref}
      className={`text-center mb-12 transition-all duration-500 ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      {badge && (
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--hisab-border)] bg-[var(--hisab-card)] px-4 py-1.5 text-xs text-[var(--hisab-muted-fg)] mb-6">
          {badge}
        </span>
      )}
      <h2 className="text-2xl sm:text-3xl font-bold text-[var(--hisab-foreground)] mb-3">{title}</h2>
      {desc && <p className="text-sm text-[var(--hisab-muted-fg)] max-w-md mx-auto">{desc}</p>}
    </div>
  )
}