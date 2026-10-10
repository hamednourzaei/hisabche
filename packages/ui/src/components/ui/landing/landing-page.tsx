// packages/ui/src/components/ui/landing/landing-page.tsx
//
// ⚠️ SERVER COMPONENT. The landing page used to be one client tree: every
// section hydrated on load, and PageSpeed's mobile run measured up to 6.9 s of
// Total Blocking Time — most of it React hydrating sections that have no
// interactivity at all (text, images, links).
//
// Now the static sections render on the server and ship NO JavaScript. The
// client parts are limited to what actually responds to a person:
//   • LandingShell  — header, section menu, mobile drawer
//   • NavigationRegistry — marks a section active while it is in view
//   • PricingScene  — plan tabs + live prices from the billing API
//   (FAQ is native <details>; the footer is server-rendered with the year.)
import { getTranslations } from 'next-intl/server'

import { NavigationRegistry } from '../navigation/navigation-registry'
import CompareScene from './compare-scene'
import CTAScene from './cta-scene'
import FaqScene from './faq-scene'
import { JourneyHero } from './journey/journey-hero'
import ChapterScene from './chapter-scene'
import { LandingShell } from './landing-shell'
import ModulesScene from './modules-scene'
import PricingScene from './pricing-scene'
import SecurityScene from './security-scene'
import SiteFooterView from './site-footer-view'
import TrustBarScene from './trust-bar-scene'

export async function LandingPage({ locale }: { locale: string }) {
  const translate = await getTranslations({ locale })
  type Key = Parameters<typeof translate>[0]
  // Same contract as the client `safeT`: a missing key shows the fallback, never
  // the raw key and never an exception.
  const t = (key: string, fallback?: string): string =>
    translate.has(key as Key) ? translate(key as Key) : (fallback ?? key)

  // A sentence with {placeholders} is handed over unformatted; the journey fills
  // it in itself, once per figure.
  const raw = (key: string): string =>
    translate.has(key as Key) ? String(translate.raw(key as Key)) : key

  return (
    <LandingShell>
      <NavigationRegistry id="hero">
        <JourneyHero t={t} raw={raw} locale={locale} />
      </NavigationRegistry>

      {/* Story order (IA of 15 Sep 2026): one system → how an operation flows →
          the accounting core → money → stock → offline → reports → who it is
          built for → AI → control → many businesses → price → questions → CTA. */}
      <NavigationRegistry id="features">
        <ModulesScene t={t} localePrefix={locale} />
      </NavigationRegistry>

      <NavigationRegistry id="offline">
        <ChapterScene t={t} localePrefix={locale} chapter="offline" />
      </NavigationRegistry>

      <TrustBarScene t={t} />

      <ChapterScene t={t} localePrefix={locale} chapter="ai" />

      <NavigationRegistry id="security">
        <SecurityScene t={t} />
      </NavigationRegistry>

      <CompareScene t={t} />

      <PricingScene />

      <FaqScene t={t} />

      <CTAScene t={t} locale={locale} />

      {/* Server-rendered: the year is fixed when the page is built or
          revalidated, and this markup is never hydrated. */}
      <SiteFooterView t={t} localePrefix={locale} year={new Date().getFullYear()} />
    </LandingShell>
  )
}
