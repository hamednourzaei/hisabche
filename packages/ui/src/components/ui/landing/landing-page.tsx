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
import CinematicHero from './cinematic-hero'
import CompareScene from './compare-scene'
import CTAScene from './cta-scene'
import FaqScene from './faq-scene'
import ChapterScene from './chapter-scene'
import { LandingShell } from './landing-shell'
import ModulesScene from './modules-scene'
import PricingScene from './pricing-scene'
import SecurityScene from './security-scene'
import SiteFooterView from './site-footer-view'
import SystemScene from './system-scene'
import TrustBarScene from './trust-bar-scene'

export async function LandingPage({ locale }: { locale: string }) {
  const translate = await getTranslations({ locale })
  type Key = Parameters<typeof translate>[0]
  // Same contract as the client `safeT`: a missing key shows the fallback, never
  // the raw key and never an exception.
  const t = (key: string, fallback?: string): string =>
    translate.has(key as Key) ? translate(key as Key) : (fallback ?? key)

  return (
    <LandingShell>
      <NavigationRegistry id="hero">
        <CinematicHero t={t} locale={locale} />
      </NavigationRegistry>

      {/* Story order (IA of 15 Sep 2026): one system → how an operation flows →
          the accounting core → money → stock → offline → reports → who it is
          built for → AI → control → many businesses → price → questions → CTA. */}
      <NavigationRegistry id="features">
        <ModulesScene t={t} localePrefix={locale} />
      </NavigationRegistry>

      <SystemScene t={t} />

      <NavigationRegistry id="ledger">
        <ChapterScene t={t} chapter="ledger" muted />
      </NavigationRegistry>
      <ChapterScene t={t} chapter="money" />
      <ChapterScene t={t} chapter="inventory" muted />

      <NavigationRegistry id="offline">
        <ChapterScene t={t} chapter="offline" />
      </NavigationRegistry>
      <ChapterScene t={t} chapter="reports" muted />

      <TrustBarScene t={t} />

      <ChapterScene t={t} chapter="ai" />

      <NavigationRegistry id="security">
        <SecurityScene t={t} />
      </NavigationRegistry>
      <ChapterScene t={t} chapter="multi" />

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
