// packages/ui/src/components/ui/landing/landing-shell.tsx
'use client'

import { useCallback, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { NavigationProvider } from '../../../hooks/menu/use-navigation-state'
import { TopNav } from '../navigation/top-nav'

const sectionFallbacks: Record<string, Record<string, string>> = {
  en: {
    hero: 'Home',
    pain: 'Problem',
    features: 'Features',
    testimonials: 'Trust',
  },
  fa: {
    hero: 'خانه',
    pain: 'مشکل',
    features: 'امکانات',
    testimonials: 'اعتماد',
  },
  af: {
    hero: 'خانه',
    pain: 'مشکل',
    features: 'امکانات',
    testimonials: 'اعتماد',
  },
}

// ─── Main LandingPage ──────────────────────────────────────────────────────

/**
 * Client shell of the landing: the section menu (NavigationProvider + TopNav) and
 * the page wrapper. The sections themselves arrive as `children` from the server
 * composition in landing-page.tsx, so they are never hydrated.
 *
 * «شروع کنید» (the CTA section) is not in the menu: the header already has the
 * «شروع رایگان» button, and the item duplicated it.
 */
export function LandingShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations()
  // next-intl همیشه پیام‌های همان locale مسیر جاری را برمی‌گرداند —
  // برخلاف react-i18next نیازی به sync دستی (changeLanguage) یا حالت
  // "ready" برای منتظرماندن آن sync نیست.
  const locale = useLocale()

  const fallbacks = sectionFallbacks[locale] || sectionFallbacks.fa

  const safeT = useCallback(
    (key: string, fallback?: string) => {
      const result = t(key as Parameters<typeof t>[0])
      return result && result !== key ? result : (fallback ?? key)
    },
    [t],
  )

  const NAVIGATION_SECTIONS = useMemo(
    () => [
      {
        id: 'hero' as const,
        label: safeT('landing.navHero', fallbacks?.hero ?? 'Home'),
        narrative: 'frustration' as const,
      },
      {
        id: 'pain' as const,
        label: safeT('landing.navPain', fallbacks?.pain ?? 'Problem'),
        narrative: 'confusion' as const,
      },
      {
        id: 'features' as const,
        label: safeT('landing.navFeatures', fallbacks?.features ?? 'Features'),
        narrative: 'confidence' as const,
      },
      {
        id: 'testimonials' as const,
        label: safeT('landing.navTestimonials', fallbacks?.testimonials ?? 'Trust'),
        narrative: 'trust' as const,
      },
    ],
    [safeT, fallbacks],
  )

  return (
    <NavigationProvider sections={NAVIGATION_SECTIONS}>
      {/* ⚠️ `overflow-x-hidden` — T5.2, «صفحه اول به راست می‌پرد».

          Nothing on this page is meant to scroll sideways, and nothing here
          previously stopped it. The document had no `overflow-x` guard, so any
          decorative element that reached past the viewport for one frame —
          a scene animating in from a translate, an absolutely positioned
          connector, a marquee before its clamp applies — made the whole
          document horizontally scrollable. In RTL that reads as the page
          starting off to one side and then settling.

          ⚠️ THIS IS CONTAINMENT, NOT A DIAGNOSIS. I could not pin it to one
          element by reading: the two elements wide enough to do it
          (`pricing-scene`'s 800px table, `pain-scene`'s translate-x-full
          connector) are both `hidden sm:block` and so are not on a phone at
          all. What this guarantees is that no element CAN cause it, which for
          a landing page is the correct rule regardless of which one did.

          ⚠️ `clip`, NOT `hidden`. `overflow-x: hidden` turns this wrapper into a
          scroll container, and a `position: sticky` descendant sticks to its
          nearest scroll container — so the header scrolled away with the page
          (measured at 360px: top −3520 after a section jump). `clip` cuts the
          overflow the same way without creating one. */}
      <div className="min-h-screen overflow-x-clip bg-[hsl(var(--surface-base))]">
        <TopNav variant="landing" localePrefix={locale} />

        <main>{children}</main>
      </div>
    </NavigationProvider>
  )
}
