// apps/web/app/[lang]/heavy-providers.tsx
'use client'

import React, { useEffect, useRef, memo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useThemeStore, useAuthStore, useDeviceStore, useWorkspaceStore } from '@hisabche/store'

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

// ⚠️ NO ROOT STYLE WRITES AFTER HYDRATION. An `AdaptiveUIInitializer` used to
// set `data-perf` and three CSS variables (--motion-scale, --shadow-intensity,
// --glass-blur-scale) on <html> — none of which any stylesheet reads. Every
// write to the root re-styles the whole document (~1,300 elements on the
// landing); a headless-Chrome profile at PageSpeed-like CPU speed showed three
// 100–230 ms style+layout frames during load. `lite-mode` / `data-saver` are now
// decided before first paint by the inline script in layout.tsx.

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

    // Keeps the persisted device profile current for Settings. The html classes
    // it implies (lite-mode, data-saver) were already applied before first
    // paint by the inline script in layout.tsx — applying them here re-styled
    // the whole page after hydration.
    useDeviceStore.getState().detectDevice()
  }, [mode, setMode])

  return <>{children}</>
})
ThemeInitializer.displayName = 'ThemeInitializer'

// ─── Device cache ──────────────────────────────────────────────────────────

/**
 * The last answers, kept on this device: a reload or a return to a screen shows
 * the previous numbers at once, and the normal refetch replaces only what
 * changed. The same module the Windows and mobile shell use.
 *
 * ⚠️ Loaded on demand, and only for somebody signed in (or just signed out —
 * that is when the cache must be wiped). An anonymous visitor on the landing
 * never downloads it.
 * ⚠️ Before the store has hydrated, «no user» means «not read yet»; treating
 * it as a sign-out would wipe the cache on every load.
 */
const DeviceCache = memo(function DeviceCache() {
  const client = useQueryClient()
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const workspaceId = useWorkspaceStore((s) => s.workspaceId)
  const cache = useRef<{ setOwner: (owner: string | null) => Promise<void> } | null>(null)

  useEffect(() => {
    if (!hasHydrated) return
    // Nobody signed in and nothing loaded: there is nothing to wipe either.
    if (!userId && !cache.current) return
    let cancelled = false
    void import('@hisabche/api/src/lib/persisted-query-cache')
      .then((persisted) => {
        if (cancelled) return
        cache.current ??= persisted.createPersistedQueryCache(
          client,
          persisted.createQueryCachePersister(window.localStorage),
        )
        return cache.current.setOwner(persisted.cacheOwner(userId, workspaceId))
      })
      // A device cache is a convenience: without it the app fetches as before.
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [client, hasHydrated, userId, workspaceId])

  return null
})
DeviceCache.displayName = 'DeviceCache'

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

// ⚠️ NO i18next HERE. A `LanguageInitializer` used to import `@hisabche/i18n`
// (i18next + react-i18next + three legacy JSON catalogs, ~313 KB on every
// page) only to call `syncLanguageFromStorage()` — which does
// `document.documentElement.dir/lang = <localStorage 'hisabche-lang'>`. The web
// app's language is the ROUTE (/fa, /af, /en, via next-intl), so on web that
// call could only overwrite the correct direction with a stale one.

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
      <AnalyticsBootstrap />
      <DeviceCache />
      <ThemeInitializer>
        <AuthInitializer>{children}</AuthInitializer>
      </ThemeInitializer>
    </>
  )
})

HeavyProviders.displayName = 'HeavyProviders'
