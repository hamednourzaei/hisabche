// ═══════════════════════════════════════════════════════════
// packages/ui/src/components/ui/landing-section.tsx (v6)
// ✅ motion-reduce, optimized RAF, i18n aria-labels, Link
// ✅ CLS fix: fixed height on counters, no opacity animation on mobile
// ═══════════════════════════════════════════════════════════
"use client"
import { useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Card, CardContent } from "./card"
import { Badge } from "./badge"
import { Button } from "./button"
import { cn } from "../../lib/utils"

// ═══ Optimized useInView (no external dep) ═══
function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
([entry]) => { if (entry?.isIntersecting) { setInView(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])

  return { ref, inView }
}

// ═══ Eased Counter — only re-renders when value changes ═══
function useEasedCounter(end: number, inView: boolean) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!inView || end === 0) return
    let id: number
    let last = 0
    const start = performance.now()
    const duration = 1500

    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      const cur = Math.round(eased * end)
      if (cur !== last) { last = cur; setCount(cur) }
      if (p < 1) id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [inView, end])

  return count
}

// ═══ Animated Counter — CLS safe ═══
export function AnimatedCounter({ end, label }: { end: number; label: string }) {
  const { ref, inView } = useInView()
  const count = useEasedCounter(end, inView)

  return (
    <Card ref={ref} className="border-[var(--hisab-border)] bg-transparent min-h-[96px]">
      <CardContent
        className="text-center p-4"
        role="status"
        aria-label={`${label}: ${count.toLocaleString("fa-AF")}+`}
      >
        <div className="text-2xl sm:text-3xl font-bold text-[var(--hisab-foreground)] h-[36px] sm:h-[40px] flex items-center justify-center">
          {count.toLocaleString("fa-AF")}+
        </div>
        <div className="text-xs text-[var(--hisab-muted-fg)] mt-1">{label}</div>
      </CardContent>
    </Card>
  )
}

// ═══ Gradient Mesh (static, no hooks) ═══
export function GradientMesh() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-[var(--hisab-primary)]/3 blur-[100px] motion-safe:animate-float motion-reduce:hidden" />
      <div className="absolute bottom-0 right-1/3 w-[400px] h-[400px] rounded-full bg-[var(--hisab-warning)]/2 blur-[100px] motion-safe:animate-float-delayed motion-reduce:hidden" />
    </div>
  )
}

// ═══ Shimmer CTA ═══
export function ShimmerCTA({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      size="lg"
      className="group relative overflow-hidden shadow-lg shadow-[var(--hisab-primary)]/20 active:scale-[0.97]"
    >
      <span className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity motion-reduce:opacity-0" />
      {children}
    </Button>
  )
}

// ═══ Section Wrapper — CLS safe (no opacity animation) ═══
export function Section({
  children,
  className,
  bordered = false,
}: {
  children: ReactNode
  className?: string
  bordered?: boolean
}) {
  return (
    <section
      className={cn(
        "px-4 py-14 sm:py-18",
        bordered && "border-y border-[var(--hisab-border)] bg-[var(--hisab-muted)]/5",
        className
      )}
    >
      <div className="mx-auto max-w-5xl">{children}</div>
    </section>
  )
}

// ═══ Feature Card ═══
export function FeatureCard({
  emoji, title, desc, index = 0,
}: {
  emoji: string; title: string; desc: string; index?: number
}) {
  return (
    <Card interactive className="group border-[var(--hisab-border)] motion-safe:animate-fade-in-up motion-reduce:animate-none"
      style={{ animationDelay: `${index * 80}ms` }}>
      <CardContent className="p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--hisab-primary)]/8 text-2xl mb-5 group-hover:scale-110 transition-transform duration-300 motion-reduce:group-hover:scale-100">
          {emoji}
        </div>
        <h3 className="font-semibold text-[var(--hisab-foreground)] mb-2">{title}</h3>
        <p className="text-sm text-[var(--hisab-muted-fg)]">{desc}</p>
      </CardContent>
    </Card>
  )
}

// ═══ Section Heading ═══
export function SectionHeading({ badge, title, desc }: { badge?: string; title: string; desc?: string }) {
  return (
    <div className="text-center mb-12">
      {badge && <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs gap-2">{badge}</Badge>}
      <h2 className="text-2xl sm:text-3xl font-bold text-[var(--hisab-foreground)] mb-3">{title}</h2>
      {desc && <p className="text-sm text-[var(--hisab-muted-fg)] max-w-md mx-auto">{desc}</p>}
    </div>
  )
}

// ═══ Glass Navbar ═══
export function GlassNavbar() {
  const { t } = useTranslation()
  const router = useRouter()
  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--hisab-border)] bg-[var(--hisab-background)]/70 backdrop-blur-md motion-reduce:backdrop-blur-none"
      aria-label={t("nav.ariaLabel", "ناوبری اصلی")}>
      <div className="mx-auto flex h-12 sm:h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2" aria-label={t("nav.homeAriaLabel", "حسابچه — صفحه اصلی")}>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--hisab-primary)]">
            <span className="text-white font-bold text-xs">ح</span>
          </div>
          <span className="font-bold text-sm text-[var(--hisab-foreground)]">{t("app.name")}</span>
        </Link>
        <Button size="sm" onClick={() => router.push("/login")} className="text-xs font-semibold">
          {t("auth.signIn")}
        </Button>
      </div>
    </nav>
  )
}