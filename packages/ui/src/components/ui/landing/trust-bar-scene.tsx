// packages/ui/src/components/ui/landing/trust-bar-scene.tsx

import { Marquee } from '../marquee'

/* ═══════════════════════════════════════════════════════════════════════════
   TrustBarScene v7 — Infinite marquee · 50 business categories
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

function IndustryChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium text-[hsl(var(--fg-secondary))] bg-[hsl(var(--surface-muted))] border border-[hsl(var(--border-default))] whitespace-nowrap hover:border-[hsl(var(--color-primary)/0.3)] hover:text-[hsl(var(--fg-primary))] transition-colors duration-200">
      {label}
    </span>
  )
}

export default function TrustBarScene({ t }: TrustBarSceneProps) {
  const firstHalf = INDUSTRIES.slice(0, Math.ceil(INDUSTRIES.length / 2))
  const secondHalf = INDUSTRIES.slice(Math.ceil(INDUSTRIES.length / 2))

  return (
    <section
      id="trust-bar"
      className="relative overflow-hidden border-y border-[hsl(var(--border-default))] py-8 sm:py-10"
    >
      <div className="mx-auto mb-6 w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-medium text-[hsl(var(--fg-tertiary))] sm:text-sm">
          {/*
            ⚠️ THIS SAID «Trusted by every type of business».

            The LIST below is honest — it is business TYPES (Supermarket,
            Pharmacy, Bakery), not named customers. The CLAIM around it was
            not: «trusted by» asserts that businesses of every one of these
            types use the product, which nothing in this codebase knows.

            The list is a statement about what the software SUITS. The label
            now says that, which is both true and the more useful thing for a
            visitor deciding whether it fits their shop.
          */}
          {t('landing.trustBarLabel', 'Built for every type of business')}
        </p>
      </div>

      <Marquee pauseOnHover repeat={2} className="[--duration:100s] py-0.5 sm:py-1">
        {firstHalf.map(({ key, fallback }) => (
          <IndustryChip key={key} label={t(`landing.industry.${key}`, fallback)} />
        ))}
      </Marquee>

      <Marquee pauseOnHover repeat={2} reverse className="[--duration:90s] py-0.5 sm:py-1">
        {secondHalf.map(({ key, fallback }) => (
          <IndustryChip key={key} label={t(`landing.industry.${key}`, fallback)} />
        ))}
      </Marquee>

      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-10 sm:w-12 lg:w-24 bg-gradient-to-r from-[hsl(var(--surface-base))] to-transparent z-10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-10 sm:w-12 lg:w-24 bg-gradient-to-l from-[hsl(var(--surface-base))] to-transparent z-10"
        aria-hidden="true"
      />
    </section>
  )
}
