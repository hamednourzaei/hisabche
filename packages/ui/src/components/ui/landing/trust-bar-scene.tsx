// packages/ui/src/components/ui/landing/trust-bar-scene.tsx

import type { LucideIcon } from 'lucide-react'
import { Briefcase, Factory, Store, Truck } from 'lucide-react'

import { LANDING_CONTAINER, LANDING_SECTION, SectionHeader } from './landing-primitives'

/* ═══════════════════════════════════════════════════════════════════════════
   TrustBarScene v9 — four business scenarios. The list of every business type
   moved to the boards on the walls of the journey hall (`journey-industries.ts`).
   Before that it was a static list here, and before that a marquee: The marquee (two infinitely animated ribbons) is gone: PageSpeed
   counted 85–90 animated elements on the landing, and a list you have to wait
   for is worse to scan than one you can read.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface TrustBarSceneProps {
  t: (key: string, fallback?: string) => string
}

/** What each kind of business runs in the product — the modules, not a promise. */
const SCENARIOS: Array<{ key: string; icon: LucideIcon }> = [
  { key: 'shop', icon: Store },
  { key: 'wholesale', icon: Truck },
  { key: 'production', icon: Factory },
  { key: 'services', icon: Briefcase },
]

export default function TrustBarScene({ t }: TrustBarSceneProps) {
  return (
    <section id="industries" className={LANDING_SECTION}>
      <div className={LANDING_CONTAINER}>
        {/*
          ⚠️ THIS SAID «Trusted by every type of business».

          The list is business TYPES (Supermarket, Pharmacy, Bakery), not named
          customers. «Trusted by» asserted that businesses of every one of these
          types use the product, which nothing in this codebase knows. The label
          says what the software is BUILT for instead.
        */}
        <SectionHeader
          label={t('landing.industries.label')}
          title={t('landing.trustBarLabel', 'Built for every type of business')}
        />

        <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {SCENARIOS.map(({ key, icon: Icon }) => (
            <li
              key={key}
              className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated)/0.6)] p-4 sm:p-5"
            >
              <Icon className="mb-3 size-6 text-[hsl(var(--color-primary))]" aria-hidden="true" />
              <h3 className="mb-1 text-balance text-base font-semibold text-[hsl(var(--fg-primary))]">
                {t(`landing.industries.${key}.title`)}
              </h3>
              <p className="text-pretty text-sm leading-relaxed text-[hsl(var(--fg-secondary))]">
                {t(`landing.industries.${key}.desc`)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
