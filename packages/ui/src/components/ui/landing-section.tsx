// ═══════════════════════════════════════════════════════════
// packages/ui/src/components/ui/landing-section.tsx (v5)
// ✅ motion-reduce, optimized RAF, i18n aria-labels, Link, split client/server
// ═══════════════════════════════════════════════════════════
"use client"
import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useInView } from "../../lib/use-in-view"
import { Card, CardContent } from "./card"
import { Badge } from "./badge"
import { Button } from "./button"
import { cn } from "../../lib/utils"

// ═══════════════════════════════════════════════════════════
// Eased Counter — only re-renders when value changes
// ═══════════════════════════════════════════════════════════
function useEasedCounter(end: number, inView: boolean) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!inView || end === 0) return
    let animationId: number
    let lastRendered = 0
    const duration = 1500
    const startTime = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(eased * end)

      // ✅ Only re-render if value actually changed
      if (current !== lastRendered) {
        lastRendered = current
        setCount(current)
      }
      if (progress < 1) animationId = requestAnimationFrame(tick)
    }
    animationId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animationId)
  }, [inView, end])

  return count
}

// ═══════════════════════════════════════════════════════════
// Animated Counter
// ═══════════════════════════════════════════════════════════
export function AnimatedCounter({ end, label }: { end: number; label: string }) {
  const { ref, inView } = useInView()
  const count = useEasedCounter(end, inView)

  return (
    <Card ref={ref} className="border-[var(--hisab-border)] bg-transparent">
      <CardContent
        className="text-center p-4"
        role="status"
        aria-label={`${label}: ${count.toLocaleString("fa-AF")}+`}
      >
        <div className="text-2xl sm:text-3xl font-bold text-[var(--hisab-foreground)]">
          {count.toLocaleString("fa-AF")}+
        </div>
        <div className="text-xs text-[var(--hisab-muted-fg)] mt-1">{label}</div>
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════
// Gradient Mesh (server-safe — no hooks)
// ═══════════════════════════════════════════════════════════
export function GradientMesh() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-[var(--hisab-primary)]/3 blur-[100px] gradient-float motion-reduce:hidden" />
      <div className="absolute bottom-0 right-1/3 w-[400px] h-[400px] rounded-full bg-[var(--hisab-warning)]/2 blur-[100px] gradient-float-delayed motion-reduce:hidden" />
      <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] rounded-full bg-[var(--hisab-success)]/2 blur-[100px] gradient-float-slow motion-reduce:hidden" />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// Glass Navbar — Link instead of <a>, i18n aria-labels
// ═══════════════════════════════════════════════════════════
export function GlassNavbar() {
  const { t } = useTranslation()
  const router = useRouter()

  return (
    <nav
      className="sticky top-0 z-50 border-b border-[var(--hisab-border)] bg-[var(--hisab-background)]/70 backdrop-blur-md motion-reduce:backdrop-blur-none"
      aria-label={t("nav.ariaLabel", "ناوبری اصلی")}
    >
      <div className="mx-auto flex h-12 sm:h-14 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2"
          aria-label={t("nav.homeAriaLabel", "حسابچه — صفحه اصلی")}
        >
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

// ═══════════════════════════════════════════════════════════
// Shimmer CTA
// ═══════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════
// Section Wrapper
// ═══════════════════════════════════════════════════════════
export function Section({
  children,
  className,
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
      className={cn(
        "px-4 py-14 sm:py-18 transition-all duration-500 motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0",
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        bordered && "border-y border-[var(--hisab-border)] bg-[var(--hisab-muted)]/5",
        className
      )}
    >
      <div className="mx-auto max-w-5xl">{children}</div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════
// Feature Card
// ═══════════════════════════════════════════════════════════
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
    <Card
      interactive
      className="group border-[var(--hisab-border)] animate-fade-in-up motion-reduce:animate-none"
      style={{ animationDelay: `${index * 80}ms` }}
    >
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

// ═══════════════════════════════════════════════════════════
// Section Heading
// ═══════════════════════════════════════════════════════════
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
      className={cn(
        "text-center mb-12 transition-all duration-500 motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0",
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      {badge && (
        <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs gap-2">
          {badge}
        </Badge>
      )}
      <h2 className="text-2xl sm:text-3xl font-bold text-[var(--hisab-foreground)] mb-3">{title}</h2>
      {desc && <p className="text-sm text-[var(--hisab-muted-fg)] max-w-md mx-auto">{desc}</p>}
    </div>
  )
}