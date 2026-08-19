// packages/ui/src/components/ui/landing/landing-page.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { NavigationProvider } from '../../../hooks/menu/use-navigation-state'
import { TopNav } from '../navigation/top-nav'
import { NavigationRegistry } from '../navigation/navigation-registry'

import dynamic from 'next/dynamic'

// ─── Components ──────────────────────────────────────────────────────────────
// ✅ Hero is the LCP element — imported eagerly (no dynamic wrapper) so it
// ships in the main bundle with no extra network round-trip.
// Everything below the fold is dynamically imported so its JS is fetched
// in a separate chunk and hydrated only once it reaches the viewport,
// instead of blocking the initial script evaluation.
import CinematicHero from './cinematic-hero'

const sceneLoading = () => <div className="min-h-[40vh]" aria-hidden="true" />

const PainScene = dynamic(() => import('./pain-scene'), { loading: sceneLoading })
const FeaturesScene = dynamic(() => import('./features-scene'), { loading: sceneLoading })
const SocialScene = dynamic(() => import('./social-scene'), { loading: sceneLoading })
const FaqScene = dynamic(() => import('./faq-scene'), { loading: sceneLoading })
const CTAScene = dynamic(() => import('./cta-scene'), { loading: sceneLoading })
const TrustBarScene = dynamic(() => import('./trust-bar-scene'), { loading: sceneLoading })
const SecurityScene = dynamic(() => import('./security-scene'), { loading: sceneLoading })
const PricingScene = dynamic(() => import('./pricing-scene'), { loading: sceneLoading })
const SiteFooter = dynamic(() => import('./site-footer'), { loading: sceneLoading })
const DashboardShowcaseScene = dynamic(() => import('./dashboard-showcase-scene'), {
  loading: sceneLoading,
})

const sectionFallbacks: Record<string, Record<string, string>> = {
  en: {
    hero: 'Home',
    pain: 'Problem',
    transform: 'Solution',
    features: 'Features',
    testimonials: 'Trust',
    cta: 'Start',
  },
  fa: {
    hero: 'خانه',
    pain: 'مشکل',
    transform: 'راه‌حل',
    features: 'امکانات',
    testimonials: 'اعتماد',
    cta: 'شروع',
  },
  af: {
    hero: 'خانه',
    pain: 'مشکل',
    transform: 'راه حل',
    features: 'امکانات',
    testimonials: 'اعتماد',
    cta: 'شروع',
  },
}

// ─── Main LandingPage ──────────────────────────────────────────────────────

export function LandingPage() {
  const router = useRouter()
  const t = useTranslations()
  // next-intl همیشه پیام‌های همان locale مسیر جاری را برمی‌گرداند —
  // برخلاف react-i18next نیازی به sync دستی (changeLanguage) یا حالت
  // "ready" برای منتظرماندن آن sync نیست.
  const locale = useLocale()
  const navigateLogin = useCallback(() => router.push('/login'), [router])
  // دکمه‌های «شروع کن» کاربر تازه را به ثبت‌نام می‌برند، نه صفحه‌ی ورود.
  const navigateSignup = useCallback(() => router.push('/signup'), [router])

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
        id: 'transform' as const,
        label: safeT('landing.navTransform', fallbacks?.transform ?? 'Solution'),
        narrative: 'clarity' as const,
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
      {
        id: 'cta' as const,
        label: safeT('landing.navCTA', fallbacks?.cta ?? 'Start'),
        narrative: 'action' as const,
      },
    ],
    [safeT, fallbacks],
  )

  return (
    <NavigationProvider sections={NAVIGATION_SECTIONS}>
      <div className="min-h-screen bg-[hsl(var(--surface-base))]">
        <TopNav variant="landing" onNavigateLogin={navigateLogin} />

        <main>
          <NavigationRegistry id="hero">
            <CinematicHero t={safeT} onNavigateLogin={navigateSignup} />
          </NavigationRegistry>

          <TrustBarScene t={safeT} />

          <NavigationRegistry id="pain">
            <PainScene t={safeT} />
          </NavigationRegistry>

          <DashboardShowcaseScene t={safeT} />

          {/* The "behind the scenes of every sale" scene (TransformScene) was
              removed from the landing page. The component file stays in place —
              nothing else references it, and it is cheap to re-add. */}

          <NavigationRegistry id="features">
            <FeaturesScene t={safeT} />
          </NavigationRegistry>

          <SecurityScene t={safeT} />

          <NavigationRegistry id="testimonials">
            <SocialScene t={safeT} />
          </NavigationRegistry>

          <PricingScene t={safeT} onNavigateLogin={navigateSignup} />

          <FaqScene t={safeT} />

          <NavigationRegistry id="cta">
            <CTAScene t={safeT} onNavigateLogin={navigateSignup} />
          </NavigationRegistry>

          <SiteFooter t={safeT} localePrefix={locale} />
        </main>
      </div>
    </NavigationProvider>
  )
}
