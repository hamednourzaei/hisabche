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
//   • LandingFaq    — accordion
//   • LandingFooter — the year (read after mount)
import { getTranslations } from 'next-intl/server'
import { resolveIntlLocale } from '@hisabche/formatting'

import { NavigationRegistry } from '../navigation/navigation-registry'
import CinematicHero from './cinematic-hero'
import CTAScene from './cta-scene'
import FeaturesScene from './features-scene'
import { LandingFaq, LandingFooter } from './landing-client-sections'
import { LandingShell } from './landing-shell'
import PainScene from './pain-scene'
import PricingScene from './pricing-scene'
import SecurityScene from './security-scene'
import SocialScene from './social-scene'
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

      <TrustBarScene t={t} />

      <NavigationRegistry id="pain">
        <PainScene t={t} intlLocale={resolveIntlLocale(locale)} />
      </NavigationRegistry>

      <NavigationRegistry id="features">
        <FeaturesScene t={t} localePrefix={locale} />
      </NavigationRegistry>

      <SecurityScene t={t} />

      <NavigationRegistry id="testimonials">
        <SocialScene t={t} />
      </NavigationRegistry>

      <PricingScene />

      <LandingFaq />

      <CTAScene t={t} locale={locale} />

      <LandingFooter localePrefix={locale} />
    </LandingShell>
  )
}
