'use client'

import { useEffect, useRef, useState, useCallback, memo, type ReactNode } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { cn } from '../../lib/utils'

/* ═══════════════════════════════════════════════════════════════════════════
   Landing Section v4 — Memoized · Performance Optimized
   ✅ memo · useCallback · useMemo · safeT wrapper
   ═══════════════════════════════════════════════════════════════════════════ */

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
      { threshold },
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

// ─── AnimatedCounter ────────────────────────────────────────────────────────

export const AnimatedCounter = memo(function AnimatedCounter({
  end,
  label,
}: {
  end: number
  label: string
}) {
  const { ref, inView } = useInView()
  const count = useEasedCounter(end, inView)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const display = mounted ? count : end

  return (
    <div
      ref={ref}
      className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] min-h-[96px] shadow-sm"
      role="status"
      aria-label={`${label}: ${display.toLocaleString('fa-AF')}+`}
    >
      <div className="p-4 text-center">
        <div className="flex h-[36px] items-center justify-center text-2xl font-bold tabular-nums text-[hsl(var(--fg-primary))] sm:h-[40px] sm:text-3xl">
          {display.toLocaleString('fa-AF')}+
        </div>
        <div className="mt-1 text-xs text-[hsl(var(--fg-tertiary))]">{label}</div>
      </div>
    </div>
  )
})
AnimatedCounter.displayName = 'AnimatedCounter'

// ─── GradientMesh ──────────────────────────────────────────────────────────

export const GradientMesh = memo(function GradientMesh() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute start-1/4 top-0 h-[500px] w-[500px] rounded-full bg-[hsl(var(--color-primary)/0.06)] blur-[100px] motion-safe:animate-float motion-reduce:hidden" />
      <div className="absolute bottom-0 end-1/3 h-[400px] w-[400px] rounded-full bg-[hsl(var(--color-warning)/0.04)] blur-[100px] motion-safe:animate-float-delayed motion-reduce:hidden" />
    </div>
  )
})
GradientMesh.displayName = 'GradientMesh'

// ─── ShimmerCTA ─────────────────────────────────────────────────────────────

export const ShimmerCTA = memo(function ShimmerCTA({
  children,
  onClick,
}: {
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2',
        'rounded-full px-8 py-3',
        'text-sm font-bold text-white',
        'bg-[image:var(--gradient-brand)]',
        'shadow-lg shadow-[hsl(var(--color-primary)/0.2)]',
        'transition-all duration-200',
        'hover:brightness-110',
        'active:scale-[0.97]',
        'motion-reduce:transition-none',
      )}
    >
      {children}
    </button>
  )
})
ShimmerCTA.displayName = 'ShimmerCTA'

// ─── Section ────────────────────────────────────────────────────────────────

export const Section = memo(function Section({
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
        'px-4 py-14 sm:py-18',
        bordered &&
          'border-y border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted)/0.3)]',
        className,
      )}
    >
      <div className="mx-auto max-w-5xl">{children}</div>
    </section>
  )
})
Section.displayName = 'Section'

// ─── FeatureCard ────────────────────────────────────────────────────────────

export const FeatureCard = memo(function FeatureCard({
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
      className={cn(
        'group rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]',
        'transition-shadow duration-300 hover:shadow-lg',
        'motion-safe:animate-fade-in-up motion-reduce:animate-none',
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="p-6">
        <div className="mb-5 flex h-16 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary)/0.08)] text-2xl transition-transform duration-300 group-hover:scale-110 motion-reduce:group-hover:scale-100">
          {emoji}
        </div>
        <h3 className="mb-2 font-semibold text-[hsl(var(--fg-primary))]">{title}</h3>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{desc}</p>
      </div>
    </div>
  )
})
FeatureCard.displayName = 'FeatureCard'

// ─── SectionHeading ────────────────────────────────────────────────────────

export const SectionHeading = memo(function SectionHeading({
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
        <span
          className={cn(
            'mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium',
            'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]',
            'border border-[hsl(var(--border-default))]',
          )}
        >
          {badge}
        </span>
      )}
      <h2 className="mb-3 text-2xl font-bold text-[hsl(var(--fg-primary))] sm:text-3xl">{title}</h2>
      {desc && <p className="mx-auto max-w-md text-sm text-[hsl(var(--fg-secondary))]">{desc}</p>}
    </div>
  )
})
SectionHeading.displayName = 'SectionHeading'

// ─── GlassNavbar ────────────────────────────────────────────────────────────

export interface GlassNavbarProps {
  appName: string
  signInLabel: string
  navAriaLabel: string
  homeAriaLabel: string
  onNavigateLogin: () => void
}

export const GlassNavbar = memo(function GlassNavbar({
  appName,
  signInLabel,
  navAriaLabel,
  homeAriaLabel,
  onNavigateLogin,
}: GlassNavbarProps) {
  const t = useTranslations()

  return (
    <nav
      className={cn(
        'sticky top-0 z-50',
        'border-b border-[hsl(var(--border-default))]',
        'bg-[hsl(var(--surface-base)/0.7)] backdrop-blur-md',
        'motion-reduce:backdrop-blur-none',
      )}
      aria-label={navAriaLabel}
    >
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 sm:h-14">
        <Link href="/" className="flex items-center gap-2" aria-label={homeAriaLabel}>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--color-primary))]">
            <span className="text-xs font-bold text-white">{t('app.name').charAt(0)}</span>
          </div>
          <span className="text-sm font-bold text-[hsl(var(--fg-primary))]">{appName}</span>
        </Link>

        <button
          type="button"
          onClick={onNavigateLogin}
          className={cn(
            'rounded-full px-4 py-1.5',
            'text-xs font-semibold text-white',
            'bg-[image:var(--gradient-brand)]',
            'transition-all duration-200',
            'hover:brightness-110',
            'motion-reduce:transition-none',
          )}
        >
          {signInLabel}
        </button>
      </div>
    </nav>
  )
})
GlassNavbar.displayName = 'GlassNavbar'
