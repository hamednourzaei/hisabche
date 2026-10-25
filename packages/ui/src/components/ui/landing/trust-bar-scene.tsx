// packages/ui/src/components/ui/landing/trust-bar-scene.tsx

import type { LucideIcon } from 'lucide-react'
import { Briefcase, Factory, Store, Truck } from 'lucide-react'

import { CardAccent, LANDING_CONTAINER, LANDING_SECTION, SectionHeader } from './landing-primitives'

/* ═══════════════════════════════════════════════════════════════════════════
   TrustBarScene v10 — four business scenarios, drawn as four ruled columns.
   The list of every business type moved to the boards on the walls of the
   journey hall (`journey-industries.ts`). Before that it was a static list
   here, and before that a marquee: PageSpeed counted 85–90 animated elements
   on the landing, and a list you have to wait for is worse to scan than one
   you can read.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface TrustBarSceneProps {
  t: (key: string, fallback?: string) => string
  /** Chapter number of this section on the page (`03`). */
  index?: string | undefined
}

/** What each kind of business runs in the product — the modules, not a promise. */
const SCENARIOS: Array<{ key: string; icon: LucideIcon }> = [
  { key: 'shop', icon: Store },
  { key: 'wholesale', icon: Truck },
  { key: 'production', icon: Factory },
  { key: 'services', icon: Briefcase },
]

export default function TrustBarScene({ t, index }: TrustBarSceneProps) {
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
          index={index}
          label={t('landing.industries.label')}
          title={t('landing.trustBarLabel', 'Built for every type of business')}
        />

        <ul className="grid gap-px overflow-hidden rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--border-default))] sm:grid-cols-2 lg:grid-cols-4">
          {SCENARIOS.map(({ key, icon: Icon }, i) => (
            <li
              key={key}
              className="group relative flex flex-col bg-[hsl(var(--surface-base))] p-5 transition-colors duration-300 hover:bg-[hsl(var(--surface-elevated))] sm:p-6"
            >
              <CardAccent />
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs tabular-nums text-[hsl(var(--fg-tertiary))]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <Icon className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-balance text-base font-bold text-[hsl(var(--fg-primary))] sm:text-lg">
                {t(`landing.industries.${key}.title`)}
              </h3>
              <p className="mt-1 text-pretty text-sm leading-6 text-[hsl(var(--fg-secondary))]">
                {t(`landing.industries.${key}.desc`)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
