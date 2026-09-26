// packages/ui/src/components/ui/dashboard/dashboard-layout.tsx
'use client'

import type { ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore, useThemeStore, useOnboardingStore, useWorkspaceStore } from '@hisabche/store'
import { useMyCapabilities } from '@hisabche/api'
import { useTranslations, useLocale } from 'next-intl'
import {
  DashboardHeader,
  DashboardSidebar,
  BottomNav,
  CommandPalette,
  Breadcrumb,
  GlobalSearch,
  RouteProgress,
  SubscriptionLockNotice,
  SubscriptionLockDialog,
  useSubscriptionLocked,
  isRouteAllowedWhenExpired,
  useHeaderPeople,
  useToast,
} from '@hisabche/ui'
import { useEffect, useRef, useCallback, useMemo, useState, memo } from 'react'
import {
  NAV_ITEMS,
  PRIMARY_ITEMS,
  MORE_GROUPS,
  MORE_ICON,
  COMMAND_ITEMS,
  isNavLocked,
} from '@hisabche/ui/menu'
import { cn } from '@/lib/utils'
import '@hisabche/ui/globals.css'

/* ═══════════════════════════════════════════════════════════════════════════
   DashboardLayout v2 — Memoized · Performance Optimized · SaaS-Level
   ✅ memo · useCallback · useMemo · prefetch بهینه
   ═══════════════════════════════════════════════════════════════════════════ */

/** Where the sidebar's collapsed/expanded preference is remembered. */
const SIDEBAR_KEY = 'hisabche.sidebar.collapsed'

/** The roles this build has a word for. Anything else is left unnamed. */
const TRANSLATED_ROLES = ['owner', 'admin', 'member', 'viewer']

/** «owner» → «Owner», to build the `team.roleOwner` key. */
function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

// ─── Hook: Prefetch Routes ─────────────────────────────────────────────────

/**
 * Every destination in the menu, warmed while the browser is idle.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ WHY NAVIGATION FELT SLOW
 *
 * This prefetched THREE routes, chosen by a filter that mostly did not mean
 * anything: `currentPath.split('/').length === item.path.split('/').length`
 * matches every top-level page against every other, so which three got warmed
 * depended on the order of the array, not on where the user was likely to go.
 * Worse, `router.prefetch` was called with a BARE path — `/invoices` — while
 * every real navigation goes to `/fa/invoices`. A prefetch of a URL nobody
 * ever visits warms nothing at all.
 *
 * So the first click on any menu item waited for a full RSC round trip, on
 * both the sidebar and the mobile bar. The paths are prefixed now, and all of
 * them are warmed — the menu has ~20 entries, they are deduped by Next and
 * fetched only when the main thread is free.
 *
 * ⚠️ IDLE, NOT ON MOUNT. Firing twenty prefetches while the page is still
 * painting competes with the render the user is waiting for, which would make
 * the FIRST screen slower to fix the second one.
 */
function usePrefetchRoutes(locale: string) {
  const router = useRouter()

  useEffect(() => {
    const prefix = `/${locale}`
    const paths = [...new Set(NAV_ITEMS.map((item) => item.path))]
    let cancelled = false
    let index = 0

    const warmNext = (deadline?: IdleDeadline) => {
      if (cancelled) return
      // A few per idle slice: `prefetch` is cheap to call but each one is a
      // request, and a burst of twenty is its own stall.
      let budget = 4
      while (index < paths.length && budget > 0) {
        const path = paths[index++]
        if (path) router.prefetch(path === '/' ? prefix : `${prefix}${path}`)
        budget -= 1
      }
      if (index < paths.length) schedule()
      void deadline
    }

    const schedule = () => {
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(warmNext, { timeout: 2000 })
      } else {
        // Safari has no requestIdleCallback; a timeout keeps it off the
        // critical path without needing the API.
        window.setTimeout(warmNext, 300)
      }
    }

    schedule()
    return () => {
      cancelled = true
    }
    // Locale only: the set of destinations does not change with the page, and
    // re-running this on every navigation is what made it a per-route cost.
  }, [router, locale])
}

// ─── Hook: Redirect Guard ──────────────────────────────────────────────────

/**
 * Where an unauthenticated visitor is sent, and in which language.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ IT DROPPED THE LOCALE, AND THAT IS A REAL REDIRECT BUG.
 *
 * This used to call `router.replace('/login')` — a bare path, with no locale
 * prefix, in an app configured `localePrefix: 'always'`. Every other
 * navigation in this file goes through `withLocale()`; the file even carries a
 * comment explaining why, for `handleNavigate`. The guard itself did not.
 *
 * So an English or Dari user whose token expired was bounced to the DEFAULT
 * locale's login page. They signed in again and the whole product was suddenly
 * in a different language, with no indication of why. The same applied to the
 * onboarding redirect.
 *
 * ⚠️ AND IT FIRES ON A 401, NOT ONLY ON A COLD LOAD. `packages/store`'s
 * `setOnUnauthorized` clears the session when any request returns 401, so
 * `isAuthenticated` flips to false and this effect runs. That is the path an
 * EXPIRED token takes — the session is valid at page load and stops being
 * valid mid-visit, which is exactly what was reported: every request failing
 * with 401 while the dashboard kept rendering.
 */
function useRedirectGuard(currentLang: string) {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const isOnboardingComplete = useOnboardingStore((s) => s.isCompleted)
  const redirected = useRef(false)

  useEffect(() => {
    if (!hasHydrated) return

    // The locale the person is actually reading, kept across the bounce.
    const to = (path: string) => `/${currentLang}${path}`

    if (!isAuthenticated && !redirected.current) {
      redirected.current = true
      router.replace(to('/login'))
      return
    }

    if (isAuthenticated && !isOnboardingComplete && !redirected.current) {
      redirected.current = true
      router.replace(to('/onboarding'))
      return
    }

    if (isAuthenticated && isOnboardingComplete) {
      redirected.current = false
    }
  }, [hasHydrated, isAuthenticated, isOnboardingComplete, router, currentLang])
}

// ─── Main Component ─────────────────────────────────────────────────────────

/** The blocked-module list back from its comma-joined key. */
const blockedOf = (key: string): string[] => (key ? key.split(',') : [])

const DashboardLayout = memo(function DashboardLayout({ children }: { children: ReactNode }) {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  /**
   * Routes that take over the whole phone screen.
   *
   * Only invoice creation so far. Matched on the path rather than a flag on
   * the page, because the layout renders above the page and cannot read it.
   */
  const isFullscreenWorkflow = /\/invoices\/new(\/|$)/.test(pathname ?? '')
  // The signed-in person, for the header identity block and the account menu.
  const user = useAuthStore((s) => s.user)
  // Pages the owner took away from this person: drawn locked, and a click
  // explains instead of opening onto a 403. A string so memos re-run only when
  // the set changes.
  const blockedKey = (useMyCapabilities().data?.blockedModules ?? []).join(',')
  const toast = useToast()
  // ⚠️ The workspace was loaded only by the workspace settings page, so for
  // anyone who never opened it `workspaceId` was null and realtime subscribed
  // to nothing — another employee's work appeared only after a reload.
  const fetchWorkspace = useWorkspaceStore((s) => s.fetchWorkspace)
  const userId = user?.id ?? null
  useEffect(() => {
    if (userId) void fetchWorkspace(userId)
  }, [userId, fetchWorkspace])
  const isDark = useThemeStore((s) => s.isDark)
  const toggle = useThemeStore((s) => s.toggle)
  const [optimisticPath, setOptimisticPath] = useState<string | null>(null)
  const lastSyncedAt = useRef(Date.now())

  // Expired subscription: only dashboard, invoices (view) and billing open.
  // The server's verdict, not a browser flag — and the server refuses writes
  // regardless of what renders here.
  const subscriptionLocked = useSubscriptionLocked()
  const routeLocked = subscriptionLocked && !isRouteAllowedWhenExpired(pathname ?? '')

  usePrefetchRoutes(locale)
  useRedirectGuard(locale)

  const activeNav = optimisticPath ?? pathname

  useEffect(() => {
    if (optimisticPath) {
      setOptimisticPath(null)
    }
  }, [pathname])

  const currentLang = locale

  // ✅ FIX: مسیرهای واقعی af/fa/en هستن، نه fa-IR/fa-AF (که فرمت
  // قدیمی locale JSON هاست) — قبلاً این regex هیچ‌وقت match
  // نمی‌شد و مسیر جدید دوباره‌پیشونددار می‌شد (مثلاً /fa/af/...)
  const withLocale = useCallback(
    (path: string, lang: string = currentLang) => {
      const pathWithoutLocale = path.replace(/^\/(fa|af|en)(?=\/|$)/, '') || '/'
      // ✅ localePrefix: 'always' — همه‌ی زبان‌ها از جمله fa پیشوند می‌گیرند.
      return `/${lang}${pathWithoutLocale}`
    },
    [currentLang],
  )

  const toggleLang = useCallback(
    (lang: string) => {
      if (lang === currentLang) return

      const newPath = withLocale(pathname, lang)

      // ✅ FIX: middleware با localeDetection:true کوکی NEXT_LOCALE را می‌خواند.
      // چون فارسی (locale پیش‌فرض) بدون پیشوند سرو می‌شود، مسیر «/dashboard»
      // توسط کوکی قدیمی (مثلاً af) دوباره به «/af/dashboard» ریدایرکت می‌شد و
      // انتخاب فارسی هیچ‌وقت نمی‌گرفت. با به‌روزرسانی کوکی، تشخیص زبان با
      // انتخاب کاربر هم‌راستا می‌شود.
      document.cookie = `NEXT_LOCALE=${lang};path=/;max-age=31536000;samesite=lax`

      router.push(newPath)
      router.refresh()
    },
    [pathname, currentLang, router, withLocale],
  )

  const handleNavigate = useCallback(
    (_id: string, path: string) => {
      // `path` from NAV_ITEMS/PRIMARY_ITEMS/MORE_GROUPS is always bare
      // (e.g. "/dashboard") — re-prefix with the current locale so the
      // user isn't silently switched back to the default locale, and so
      // isPathActive() stays consistent with the resulting pathname.
      if (isNavLocked(path, blockedOf(blockedKey))) {
        toast.info(t('nav.lockedByOwner'))
        return
      }
      const localizedPath = withLocale(path)
      setOptimisticPath(localizedPath)
      router.push(localizedPath)
    },
    [router, withLocale, blockedKey, toast, t],
  )

  const handleLogout = useCallback(() => {
    useAuthStore.getState().logout()
    // Locale-prefixed, like every other navigation here. Signing out used to
    // drop an English or Dari user onto the default locale's login page.
    router.replace(withLocale('/login'))
  }, [router, withLocale])

  const handleNavigateLogin = useCallback(
    () => router.push(withLocale('/login')),
    [router, withLocale],
  )

  const primaryItems = useMemo(
    () =>
      PRIMARY_ITEMS.map((item) => ({
        id: item.id,
        icon: item.icon,
        label: t(item.labelKey),
        path: item.path,
        locked: isNavLocked(item.path, blockedOf(blockedKey)),
      })),
    [t, blockedKey],
  )

  const moreGroups = useMemo(
    () =>
      MORE_GROUPS.map((g) => ({
        id: g.id,
        label: t(g.labelKey),
        icon: g.icon,
        items: g.items.map((item) => ({
          id: item.id,
          icon: item.icon,
          label: t(item.labelKey),
          path: item.path,
          locked: isNavLocked(item.path, blockedOf(blockedKey)),
        })),
      })),
    [t, blockedKey],
  )

  // ✅ صفحه‌های قابل جستجو — از همان NAV_ITEMS ساخته می‌شوند تا با منو
  // هم‌خوان بمانند و جای دیگری نگهداری نشوند.
  const searchablePages = useMemo(
    () =>
      NAV_ITEMS.map((item) => ({
        id: item.id,
        label: t(item.labelKey),
        path: item.path,
      })),
    [t],
  )

  const handleSearchNavigate = useCallback(
    (path: string) => {
      const localizedPath = withLocale(path)
      setOptimisticPath(localizedPath)
      router.push(localizedPath)
    },
    [router, withLocale],
  )
  const commands = useMemo(
    () =>
      COMMAND_ITEMS.map((cmd) => ({
        id: cmd.id,
        label: t(cmd.labelKey),
        description: t(cmd.descriptionKey),
        icon: cmd.icon,
        ...(cmd.shortcut ? { shortcut: cmd.shortcut } : {}),
        onSelect: () => {
          const localizedPath = withLocale(cmd.path)
          setOptimisticPath(localizedPath)
          router.push(localizedPath)
        },
      })),
    [router, t, withLocale],
  )

  // ⚠️ PERSISTED, AND READ AFTER MOUNT. Reading localStorage during render
  // makes the server's HTML and the first client render disagree, and React 19
  // throws the whole tree away on a hydration mismatch — the dashboard would
  // flash empty. So it starts expanded and corrects itself once.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    try {
      setSidebarCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === '1')
    } catch {
      // Private mode, or storage disabled. An unremembered preference is not
      // worth an error boundary.
    }
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0')
      } catch {
        /* see above */
      }
      return next
    })
  }, [])

  const openSettings = useCallback(() => {
    const localizedPath = withLocale('/settings')
    setOptimisticPath(localizedPath)
    router.push(localizedPath)
  }, [router, withLocale])

  // The role's own name, for the header pill.
  //
  // ⚠️ ONLY THE FOUR ROLES THAT HAVE A TRANSLATION. `t()` THROWS on a missing
  // key, so a role this build has no word for — one added to the database
  // later, or anything unexpected — would replace the entire dashboard with an
  // error boundary, over a caption. An unnamed role simply shows «پنل مدیریت»
  // with no suffix, which is what it did before the role existed at all.
  const roleLabel = useMemo(() => {
    const role = user?.role
    if (!role || !TRANSLATED_ROLES.includes(role)) return undefined
    return t(`team.role${cap(role)}` as never) as string
  }, [t, user?.role])

  // Who is in this workspace and who is online — the same hook the
  // desktop/mobile shell uses (packages/ui use-header-people).
  const translate = useCallback((key: string) => t(key as never) as string, [t])
  const { people, canSeePeople, isLoadingPeople } = useHeaderPeople(
    user?.id ? { id: user.id, fullName: user.fullName, email: user.email, role: user.role } : null,
    translate,
  )

  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  if (hasHydrated && !isAuthenticated) return null

  const isRtl = currentLang === 'fa' || currentLang === 'af'

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className={cn(
        'flex min-h-screen',
        'bg-[hsl(var(--surface-base))]',
        'text-[hsl(var(--fg-primary))]',
      )}
    >
      {/* Answers the click immediately, even before the route's `loading.tsx`
          takes over — and covers cached transitions that never suspend. */}
      <RouteProgress pathname={pathname ?? ''} />

      <CommandPalette commands={commands} />

      <SubscriptionLockDialog />

      <DashboardSidebar
        primaryItems={primaryItems}
        moreGroups={moreGroups}
        moreIcon={MORE_ICON}
        activeNav={activeNav}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onExpand={() => setSidebarCollapsed(false)}
        onOpenSettings={openSettings}
      />

      {/* ✅ FIX (رسپانسیو): این یک flex item است و مقدار پیش‌فرض
          min-width:auto اجازه نمی‌دهد کوچک‌تر از عرض محتوایش شود. جدول‌ها
          min-w-[820px] دارند، پس بدون min-w-0 کل صفحه پهن می‌شد و در موبایل
          overflow افقی می‌داد — به‌جای اینکه خودِ جدول داخل
          overflow-x-auto اسکرول شود. این یک اصلاح در همین‌جا، همه‌ی
          صفحه‌های جدول‌دار (انبار، فاکتورها، مشتریان، CRM) را درست می‌کند. */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <DashboardHeader
          variant="dashboard"
          appName={t('app.name')}
          appSubtitle={t('nav.adminPanel')}
          // Display only — every permission is decided server-side. `null`
          // (several memberships, or not yet loaded) leaves the label its
          // neutral colour rather than guessing the lowest role.
          role={user?.role ?? null}
          roleLabel={roleLabel}
          isSidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
          userName={user?.fullName || undefined}
          userEmail={user?.email || undefined}
          people={people}
          canSeePeople={canSeePeople}
          isLoadingPeople={isLoadingPeople}
          lastSyncedAt={lastSyncedAt.current}
          isOnline={true}
          isSyncing={false}
          pendingCount={0}
          currentLang={currentLang}
          isDark={isDark}
          signInLabel={t('auth.signIn')}
          signOutLabel={t('auth.signOut')}
          onToggleTheme={toggle}
          onToggleLang={toggleLang}
          onLogout={handleLogout}
          onNavigateLogin={handleNavigateLogin}
          searchSlot={
            <GlobalSearch
              compact
              pages={searchablePages}
              onNavigate={handleSearchNavigate}
              t={(key, fallback) => {
                const v = t(key as Parameters<typeof t>[0])
                return v && v !== key ? v : (fallback ?? key)
              }}
            />
          }
        />

        <main className="min-w-0 flex-1 overflow-y-auto p-4 pb-20 lg:pb-4">
          <Breadcrumb className="mb-4" />
          {routeLocked ? <SubscriptionLockNotice /> : children}
        </main>

        {/* The invoice builder owns the bottom of the screen on mobile: it
            has its own sticky total and forward action there. Two stacked
            bars leave a phone with almost no form visible, and the global nav
            would sit on top of the CTA. So it stands down for the duration of
            the workflow — the builder's own back arrow is the way out. */}
        {/* Published so a sticky in-page action bar can sit ON TOP of the nav
            instead of under it. The nav is a floating pill: 1rem of offset,
            3.5rem tall, plus the safe area. Zero while it is stood down. */}
        <style>{`:root{--bottom-nav-h:${isFullscreenWorkflow ? '0px' : 'calc(4.5rem + env(safe-area-inset-bottom,0px))'}}`}</style>

        {isFullscreenWorkflow ? null : (
          <BottomNav
            primaryItems={primaryItems}
            moreGroups={moreGroups}
            moreIcon={MORE_ICON}
            activeNav={activeNav}
            onNavigate={handleNavigate}
          />
        )}
      </div>
    </div>
  )
})

DashboardLayout.displayName = 'DashboardLayout'

export default DashboardLayout
