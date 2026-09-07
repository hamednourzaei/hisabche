'use client'

import { useEffect, useLayoutEffect, useRef, useState, useCallback, memo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { useNavigation } from '../../../hooks/menu/use-navigation-state'
import { useAuthStore } from '@hisabche/store'
import { cn } from '../../../lib/utils'

/* ═══════════════════════════════════════════════════════════════════════════
   TopNav v5 — Memoized · Performance Optimized · CRAWLABLE

   v4 emitted zero <a> elements: the logo, every nav item and the CTA were all
   `<button onClick>`. The site header — normally the single strongest internal
   linking surface on a site — therefore contributed nothing to Google's link
   graph, and the header was unusable without JavaScript.

   v5 emits real anchors while keeping the identical one-page-scroll UX:
   - Section items are `<a href="#id">`. The click handler still does the smooth
     scroll and sets the active-pill state; it only calls preventDefault so the
     URL fragment is not pushed mid-scroll. Middle-click / ctrl-click / "copy
     link address" and crawlers all now work.
   - Logo and CTA are `next/link` route links, so they are prefetch-aware
     navigations rather than imperative router.push calls.

   No new state, no extra client component, no added dependency — the component
   was already 'use client' for the scroll narrative.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface TopNavProps {
  variant?: 'landing' | 'dashboard'
  /**
   * Optional click interceptor for the CTA. The CTA is now a real
   * locale-prefixed `<Link href="…/signup">`, so navigation no longer depends
   * on a handler; this is for analytics or for a host that needs to override.
   * The removed `onNavigateLogin` prop pointed the "Start free" CTA at /login.
   */
  onNavigateCta?: () => void
  onLogout?: () => void
  businessName?: string
  /**
   * Locale segment to prefix route links with, e.g. "fa". Same contract as
   * SiteFooter's prop of the same name: on web, proxy.ts runs with
   * `localePrefix: 'always'`, so a bare "/signup" is a 307 whose target is
   * picked by Accept-Language rather than by the page being read. Desktop
   * mounts this nav through its own router with no locale prefix, so this stays
   * optional. When omitted it falls back to next-intl's `useLocale()`.
   */
  localePrefix?: string
}

// ─── NavItem Component ─────────────────────────────────────────────────────

const NavItem = memo(function NavItem({
  id,
  label,
  isActive,
  onClick,
}: {
  id: string
  label: string
  isActive: boolean
  onClick: (id: string) => void
}) {
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      // Let the browser handle modified clicks (new tab, new window, download)
      // exactly as it would for any other link.
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return
      event.preventDefault()
      onClick(id)
    },
    [id, onClick],
  )

  return (
    <li className="shrink-0">
      <a
        href={`#${id}`}
        data-section-id={id}
        aria-current={isActive ? 'true' : undefined}
        className={cn(
          'relative z-10 block px-2 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-colors',
          isActive
            ? 'text-[hsl(var(--fg-primary))] font-semibold'
            : 'text-[hsl(var(--fg-primary)/0.55)] hover:text-[hsl(var(--fg-primary)/0.85)]',
        )}
        onClick={handleClick}
      >
        {label}
      </a>
    </li>
  )
})
NavItem.displayName = 'NavItem'

// ─── Main Component ─────────────────────────────────────────────────────────

export const TopNav = memo(function TopNav({
  variant = 'landing',
  onNavigateCta,
  onLogout,
  businessName,
  localePrefix,
}: TopNavProps) {
  const tOriginal = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0])
    return v && v !== key ? v : (fallback ?? key)
  }
  const { sections, setSection, activeSection, scrollProgress, narrativeState } = useNavigation()
  const user = useAuthStore((s) => s.user)
  const navListRef = useRef<HTMLUListElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, offset: 0 })

  // Was `getLocaleFromPathname`, matching /^\/(fa-IR|fa-AF|en)/ — segments this
  // app has never served. The real route segments are fa | af | en (see
  // apps/web/app/[lang]/i18n-config.ts), so every Persian and Dari page fell
  // through to the hardcoded "fa-IR" default. next-intl already knows the
  // active locale, and desktop's shim provides the same hook.
  const activeLocale = useLocale()
  const locale = localePrefix ?? activeLocale
  const isRTL = locale !== 'en'
  // Desktop mounts this component behind a router with no locale segment; web
  // always has one. An empty prefix must not produce a "//signup" href.
  const routePrefix = locale ? `/${locale}` : ''

  const displayName = businessName || user?.businessName || user?.fullName || t('app.name')

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.setAttribute('data-narrative-state', narrativeState)
    }
  }, [narrativeState])

  const updateIndicator = useCallback(() => {
    if (!navListRef.current) return
    const activeBtn = navListRef.current.querySelector(
      `[data-section-id="${activeSection}"]`,
    ) as HTMLElement
    if (!activeBtn) return

    const listRect = navListRef.current.getBoundingClientRect()
    const btnRect = activeBtn.getBoundingClientRect()

    setIndicatorStyle({
      width: btnRect.width,
      // ⚠️ `+ scrollLeft` MATTERS, AND ONLY ON NARROW SCREENS.
      //
      // The indicator is absolutely positioned inside the list, so `left` is
      // measured against the list's SCROLLED CONTENT. Both rects come from
      // `getBoundingClientRect`, which reports VIEWPORT positions — their
      // difference is how far the button is from the list's visible edge, not
      // from its content origin.
      //
      // The list is `overflow-x-auto`. On a desktop the pills fit, scrollLeft
      // is 0, and the two happen to agree. On a phone they do not fit, and the
      // pill highlight lands under the wrong pill by exactly the scroll
      // distance.
      offset: btnRect.left - listRect.left + navListRef.current.scrollLeft,
    })
  }, [activeSection])

  /**
   * ⚠️ LAYOUT EFFECT, NOT EFFECT — this is a visible flash, not a preference.
   *
   * `indicatorStyle` starts at `{ width: 0, offset: 0 }`. A plain `useEffect`
   * runs AFTER the browser has painted, so the first frame shows the highlight
   * collapsed at the start of the bar and the second frame shows it jump to
   * the active pill. On a phone, where the bar is also horizontally scrolled,
   * that jump is the width of the whole bar.
   *
   * `useLayoutEffect` measures and sets before paint, so the first frame is
   * already correct.
   *
   * Guarded for SSR: `useLayoutEffect` warns during server rendering, and this
   * component is server-rendered on the landing page.
   */
  const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

  useIsomorphicLayoutEffect(() => {
    updateIndicator()
    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [updateIndicator])

  const handleSetSection = useCallback((id: string) => setSection(id), [setSection])

  const ctaText = t('landing.cta', locale === 'en' ? 'Start Free' : 'شروع رایگان')
  const signOutText = t('auth.signOut', locale === 'en' ? 'Sign Out' : 'خروج')

  return (
    <header
      className={cn(
        'sticky top-0 z-[var(--z-sticky)] w-full',
        'bg-[hsl(var(--surface-base)/0.6)] backdrop-blur-md',
        'border-b border-transparent',
        'transition-all duration-300',
        'lg:top-4 lg:w-[90%] lg:mx-auto lg:rounded-full lg:py-0.5',
        'lg:bg-[hsl(var(--surface-base)/0.7)] lg:backdrop-blur-xl',
        'lg:border-[hsl(var(--border-default))]',
        'max-lg:py-3 max-lg:bg-[hsl(var(--surface-base))] max-lg:backdrop-blur-none',
        'max-lg:border-b max-lg:border-[hsl(var(--border-default))]',
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div
        className={cn(
          'mx-auto flex items-center justify-between',
          'h-14 px-4',
          'lg:h-[52px] lg:px-0 lg:w-[90%]',
          'max-lg:h-14',
        )}
      >
        {/* Logo — a real link to the locale home page. Google treats the site
            logo as the canonical "home" internal link; as a <button> it was
            invisible to crawlers and to keyboard/no-JS users alike. */}
        {/* ⚠️ WAS `hidden lg:flex`, SO A PHONE SAW NO BRAND AT ALL.
            On the landing page that is the first thing a visitor should see,
            and as the site's canonical internal "home" link it is also the
            strongest link in the header. It is smaller on mobile, not absent. */}
        <Link
          href={routePrefix || '/'}
          className="flex items-center gap-1 text-[hsl(var(--fg-primary))] font-bold text-base lg:text-lg shrink-0"
        >
          <span>{displayName}</span>
          <span className="text-[hsl(var(--color-primary))]" aria-hidden="true">
            .
          </span>
        </Link>

        {/* Navigation menu */}
        <nav className="flex-1 flex justify-center px-2 overflow-hidden">
          <ul
            ref={navListRef}
            className="relative flex items-center gap-1 list-none m-0 px-1 py-1 rounded-full bg-[hsl(var(--fg-primary)/0.04)] border border-[hsl(var(--fg-primary)/0.07)] max-w-full overflow-x-auto"
          >
            {/* Active indicator */}
            <span
              aria-hidden="true"
              className="absolute top-1 h-[calc(100%-8px)] rounded-full bg-[hsl(var(--color-primary)/0.15)] transition-all duration-300 z-0"
              style={{
                width: indicatorStyle.width || 0,
                left: indicatorStyle.offset || 0,
              }}
            />
            {sections.map(({ id, label }) => (
              <NavItem
                key={id}
                id={id}
                label={label}
                isActive={activeSection === id}
                onClick={handleSetSection}
              />
            ))}
          </ul>
        </nav>

        {/* CTA — Desktop (Landing).
            A real link to the locale-prefixed signup route. The label is
            "Start free", so it belongs on /signup, which is where every other
            CTA on the landing page already points; the old handler chain fell
            back to `onNavigateLogin` (/login) whenever `onNavigateCta` was not
            supplied, which it never was. `onNavigateCta` is still honoured for
            callers that need to intercept (analytics, desktop). */}
        {/* ⚠️ WAS `hidden lg:inline-flex` — SO ON A PHONE THE LANDING PAGE'S
            NAVIGATION OFFERED NO WAY TO SIGN UP.
            A landing page exists to get a visitor to one action, and on the
            device most visitors arrive on, the header's only content was the
            section pills. Compact on mobile (no arrow, tighter padding), full
            size from `lg` up. */}
        {variant === 'landing' && (
          <Link
            href={`${routePrefix}/signup`}
            // Spread rather than pass `undefined`: `exactOptionalPropertyTypes`
            // makes `onClick={undefined}` a type error on LinkProps.
            {...(onNavigateCta ? { onClick: onNavigateCta } : {})}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-white bg-[var(--gradient-brand)] hover:brightness-110 transition-all shrink-0 lg:px-5 lg:py-2 lg:text-sm"
          >
            <span className="cta-text">{ctaText}</span>
            <span aria-hidden="true" className="hidden lg:inline">
              {isRTL ? '←' : '→'}
            </span>
          </Link>
        )}

        {/* Logout button — Desktop (Dashboard) */}
        {variant === 'dashboard' && (
          <button
            type="button"
            onClick={onLogout}
            className="hidden lg:inline-flex rounded-full px-4 py-1.5 text-xs font-medium text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors"
          >
            {signOutText}
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 inset-x-0 h-0.5 bg-[hsl(var(--fg-primary)/0.06)] overflow-hidden">
        <div
          className="h-full bg-[var(--gradient-brand)] transition-all duration-150"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>
    </header>
  )
})

TopNav.displayName = 'TopNav'
