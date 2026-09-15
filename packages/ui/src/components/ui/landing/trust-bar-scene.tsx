// packages/ui/src/components/ui/landing/trust-bar-scene.tsx

import type { LucideIcon } from 'lucide-react'
import { Briefcase, Factory, Store, Truck } from 'lucide-react'

import { LANDING_CONTAINER, LANDING_SECTION, SectionHeader } from './landing-primitives'

/* ═══════════════════════════════════════════════════════════════════════════
   TrustBarScene v8 — four business scenarios, then every business type as a
   static list. The marquee (two infinitely animated ribbons) is gone: PageSpeed
   counted 85–90 animated elements on the landing, and a list you have to wait
   for is worse to scan than one you can read.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface TrustBarSceneProps {
  t: (key: string, fallback?: string) => string
}

// Only business types whose day-to-day workflow the product covers (stock,
// invoices, till, purchasing, production). Hotels, clinics, fuel stations and
// the like were listed before — nothing here handles bookings, patients or
// pumps, so saying it is "built for" them was not true.
const INDUSTRIES = [
  { key: 'retail', fallback: 'Retail Store' },
  { key: 'wholesale', fallback: 'Wholesale' },
  { key: 'supermarket', fallback: 'Supermarket' },
  { key: 'grocery', fallback: 'Grocery Store' },
  { key: 'pharmacy', fallback: 'Pharmacy' },
  { key: 'restaurant', fallback: 'Restaurant' },
  { key: 'bakery', fallback: 'Bakery' },
  { key: 'boutique', fallback: 'Boutique' },
  { key: 'fashion', fallback: 'Fashion Store' },
  { key: 'cosmetics', fallback: 'Cosmetics Store' },
  { key: 'electronics', fallback: 'Electronics Store' },
  { key: 'mobile', fallback: 'Mobile Shop' },
  { key: 'computer', fallback: 'Computer Store' },
  { key: 'hardware', fallback: 'Hardware Store' },
  { key: 'construction', fallback: 'Building Materials' },
  { key: 'furniture', fallback: 'Furniture Store' },
  { key: 'home', fallback: 'Home Appliances' },
  { key: 'stationery', fallback: 'Stationery' },
  { key: 'bookstore', fallback: 'Bookstore' },
  { key: 'autoParts', fallback: 'Auto Parts' },
  { key: 'service', fallback: 'Service Business' },
  { key: 'distribution', fallback: 'Distribution' },
  { key: 'warehouse', fallback: 'Warehouse' },
  { key: 'manufacturing', fallback: 'Manufacturing' },
]

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

        <p className="mb-3 mt-8 text-center text-sm font-medium text-[hsl(var(--fg-tertiary))] sm:mt-10">
          {t('landing.industries.all')}
        </p>
        <ul className="mx-auto flex max-w-4xl flex-wrap justify-center gap-2">
          {INDUSTRIES.map(({ key, fallback }) => (
            <li
              key={key}
              className="rounded-full border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] px-3 py-1 text-xs font-medium text-[hsl(var(--fg-secondary))] sm:text-sm"
            >
              {t(`landing.industry.${key}`, fallback)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
