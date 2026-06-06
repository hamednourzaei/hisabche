"use client"

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import Link from "next/link"
import { Card, CardContent } from "./card"
import { Badge } from "./badge"
import { Button } from "./button"
import { cn } from "../../lib/utils"

// ═══ Hooks ═══
function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true)
          obs.disconnect()
        }
      },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])

  return { ref, inView }
}

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
      if (cur !== last) {
        last = cur
        setCount(cur)
      }
      if (p < 1) id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [inView, end])

  return count
}

// ═══ Components ═══
// بعد — SSR مقدار نهایی رو نشون میده، animation فقط visual
export function AnimatedCounter({ end, label }: { end: number; label: string }) {
  const { ref, inView } = useInView()
  const count = useEasedCounter(end, inView)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // SSR و قبل از mount: مقدار نهایی نشون بده — بدون shift
  const display = mounted ? count : end

  return (
    <Card ref={ref} className="glass-card min-h-[96px]">
      <CardContent className="p-4 text-center" role="status" aria-label={`${label}: ${display.toLocaleString("fa-AF")}+`}>
        <div className="flex h-[36px] items-center justify-center text-2xl font-bold sm:h-[40px] sm:text-3xl">
          {display.toLocaleString("fa-AF")}+
        </div>
        <div className="mt-1 text-xs text-[var(--hisab-muted-fg)]">{label}</div>
      </CardContent>
    </Card>
  )
}

export function GradientMesh() {
  return (
    <div
      className="absolute inset-0 -z-10 overflow-hidden"
      aria-hidden="true"
    >
      <div className="absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-[var(--hisab-primary)]/3 blur-[100px] motion-safe:animate-float motion-reduce:hidden" />
      <div className="absolute bottom-0 right-1/3 h-[400px] w-[400px] rounded-full bg-[var(--hisab-warning)]/2 blur-[100px] motion-safe:animate-float-delayed motion-reduce:hidden" />
    </div>
  )
}

export function ShimmerCTA({
  children,
  onClick,
}: {
  children: ReactNode
  onClick: () => void
}) {
  return (
    <Button
      onClick={onClick}
      size="lg"
      className="shimmer-btn shadow-lg shadow-[var(--hisab-primary)]/20 active:scale-[0.97]"
    >
      {children}
    </Button>
  )
}

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
        "section px-4 py-14 sm:py-18",
        bordered &&
          "border-y border-[var(--hisab-border)] bg-[var(--hisab-muted)]/5",
        className
      )}
    >
      <div className="mx-auto max-w-5xl">{children}</div>
    </section>
  )
}

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
      className="group motion-safe:animate-fade-in-up motion-reduce:animate-none"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <CardContent className="p-6">
        <div className="mb-5 flex h-16 w-12 items-center justify-center rounded-xl bg-[var(--hisab-primary)]/8 text-2xl transition-transform duration-300 group-hover:scale-110 motion-reduce:group-hover:scale-100">
          {emoji}
        </div>
        <h3 className="mb-2 font-semibold">{title}</h3>
        <p className="text-sm text-[var(--hisab-muted-fg)]">
          {desc}
        </p>
      </CardContent>
    </Card>
  )
}

export function SectionHeading({
  badge,
  title,
  desc,
}: {
  badge?: string
  title: string
  desc?: string
}) {
  return (
    <div className="mb-12 text-center">
      {badge && (
        <Badge
          variant="secondary"
          className="mb-6 gap-2 px-4 py-1.5 text-xs"
        >
          {badge}
        </Badge>
      )}
      <h2 className="mb-3 text-2xl font-bold sm:text-3xl">
        {title}
      </h2>
      {desc && (
        <p className="mx-auto max-w-md text-sm text-[var(--hisab-muted-fg)]">
          {desc}
        </p>
      )}
    </div>
  )
}

export interface GlassNavbarProps {
  appName: string
  signInLabel: string
  navAriaLabel: string
  homeAriaLabel: string
  onNavigateLogin: () => void
}

export function GlassNavbar({
  appName,
  signInLabel,
  navAriaLabel,
  homeAriaLabel,
  onNavigateLogin,
}: GlassNavbarProps) {
  return (
    <nav
      className="sticky top-0 z-50 border-b border-[var(--hisab-border)] bg-[var(--hisab-background)]/70 backdrop-blur-md motion-reduce:backdrop-blur-none"
      aria-label={navAriaLabel}
    >
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 sm:h-14">
        <Link
          href="/"
          className="flex items-center gap-2"
          aria-label={homeAriaLabel}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--hisab-primary)]">
            <span className="text-xs font-bold text-[var(--hisab-primary-fg)]">
              ح
            </span>
          </div>
          <span className="text-sm font-bold">{appName}</span>
        </Link>
        <Button
          size="sm"
          onClick={onNavigateLogin}
          className="text-xs font-semibold"
        >
          {signInLabel}
        </Button>
      </div>
    </nav>
  )
}