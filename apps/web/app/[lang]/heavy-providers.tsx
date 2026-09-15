// apps/web/app/[lang]/heavy-providers.tsx
'use client'

import React, { useEffect, useRef, memo } from 'react'
import { useThemeStore, useAuthStore, useDeviceStore } from '@hisabche/store'
import { syncLanguageFromStorage } from '@hisabche/i18n'

let analyticsLoaded = false

function loadAnalytics() {
  if (analyticsLoaded) return
  analyticsLoaded = true

  const load = () => {
    import('@hisabche/analytics')
      .then((module) => {
        module.initPostHog?.()
        module.initSentry?.()
      })
      .catch(() => {})
  }

  // First real engagement only — no timer, no `scroll`. Both an "idle within
  // 3 s" start and a 12 s fallback ran PostHog (autocapture on) inside
  // PageSpeed's slow-4G trace: TBT went from 0.56 s to 6.1 s. Layout changes
  // fire scroll events by themselves, so scroll is not proof of a person.
  const events = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const
  let started = false
  const start = () => {
    if (started) return
    started = true
    events.forEach((e) => window.removeEventListener(e, start))
    load()
  }
  events.forEach((e) => window.addEventListener(e, start, { once: true, passive: true }))
}

// ─── Adaptive UI Initializer ──────────────────────────────────────────────

const AdaptiveUIInitializer = memo(function AdaptiveUIInitializer() {
  useEffect(() => {
    const root = document.documentElement
    const cores = navigator.hardwareConcurrency ?? 4
    const isLowPerf = cores <= 4

    root.dataset.perf = isLowPerf ? 'low' : 'high'
    root.style.setProperty('--motion-scale', isLowPerf ? '0.5' : '1')
    root.style.setProperty('--shadow-intensity', isLowPerf ? '0.6' : '1')
    root.style.setProperty('--glass-blur-scale', isLowPerf ? '0.5' : '1')
  }, [])

  return null
})
AdaptiveUIInitializer.displayName = 'AdaptiveUIInitializer'

// ─── Theme Initializer ─────────────────────────────────────────────────────

const ThemeInitializer = memo(function ThemeInitializer({
  children,
}: {
  children: React.ReactNode
}) {
  const { mode, setMode } = useThemeStore()
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // ✅ FIX: کلاس‌ها را دستی ست نکن — با mode==='system' هر دو کلاس پاک می‌شدند
    // و تم به حالت پیش‌فرض تیره برمی‌گشت. applyTheme داخل setMode این کار را می‌کند.
    setMode(mode)

    const html = document.documentElement

    // ✅ Device detection
    const { detectDevice, performanceMode, reducedMotion, dataSaver } = useDeviceStore.getState()
    detectDevice()

    if (performanceMode === 'lite' || reducedMotion) {
      html.classList.add('lite-mode')
      html.dataset.perf = 'low'
    }
    if (dataSaver) {
      html.classList.add('data-saver')
    }
  }, [mode, setMode])

  return <>{children}</>
})
ThemeInitializer.displayName = 'ThemeInitializer'

// ─── Auth Initializer ──────────────────────────────────────────────────────

const AuthInitializer = memo(function AuthInitializer({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const identified = useRef(false)

  useEffect(() => {
    if (!user || identified.current) return
    identified.current = true

    const timer = setTimeout(async () => {
      try {
        const analytics = await import('@hisabche/analytics')
        analytics.identifyUser?.(user.id, {
          email: user.email,
          businessName: user.businessName,
        })
        analytics.setUser?.(user.id, user.email)
      } catch {
        // ✅ Silently fail - analytics not critical
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [user])

  return <>{children}</>
})
AuthInitializer.displayName = 'AuthInitializer'

// ─── Language Initializer ──────────────────────────────────────────────────

const LanguageInitializer = memo(function LanguageInitializer({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    const timer = setTimeout(() => syncLanguageFromStorage(), 100)
    return () => clearTimeout(timer)
  }, [])

  return <>{children}</>
})
LanguageInitializer.displayName = 'LanguageInitializer'

// ─── Analytics Bootstrap ───────────────────────────────────────────────────

const AnalyticsBootstrap = memo(function AnalyticsBootstrap() {
  useEffect(() => {
    loadAnalytics()
  }, [])

  return null
})
AnalyticsBootstrap.displayName = 'AnalyticsBootstrap'

// ─── Main Component ────────────────────────────────────────────────────────

/**
 * Client-side bootstrap only. Every initializer above does its work in a
 * `useEffect` and passes `children` straight through — none of them provides
 * context or renders anything on the server.
 *
 * `children` is therefore optional, and Providers no longer routes the page
 * through it. It used to: this component is `lazy()`-imported, so wrapping the
 * app in it made React suspend the whole tree during SSR and flush
 * `<body><div hidden><!--$--><!--/$--></div>` — an empty document. Titles,
 * canonicals and JSON-LD were fine (those come from the Metadata API and the
 * <head>), but no <h1>, no body copy and no internal links existed in the
 * served HTML on any public page. Rendering children outside the lazy boundary
 * restores real server-rendered HTML while keeping this bootstrap off the
 * critical path.
 */
export const HeavyProviders = memo(function HeavyProviders({
  children,
}: {
  children?: React.ReactNode
}) {
  return (
    <>
      <AdaptiveUIInitializer />
      <AnalyticsBootstrap />
      <ThemeInitializer>
        <AuthInitializer>
          <LanguageInitializer>{children}</LanguageInitializer>
        </AuthInitializer>
      </ThemeInitializer>
    </>
  )
})

HeavyProviders.displayName = 'HeavyProviders'
