// packages/ui/src/components/ui/landing/modules-scene.tsx
//
// "Every tool in one system": the shipped modules, grouped the way an owner
// thinks about the business — finance, sales & customers, operations,
// management. SERVER COMPONENT — never hydrated.
//
// Replaces features-scene.tsx (12 cards + two screenshot blocks). The module
// names that have their own indexable page link to it, so this stays the
// landing's in-content link to /features/* (see crawlable-nav.test.ts).
//
// The four groups are drawn as four ruled columns of one ledger, not as four
// floating cards: a single border around the set, hairlines between the groups
// and between the rows. An owner scans it top to bottom the way they scan their
// own books.
//
// ⚠️ Every item is a module with a dashboard route and backend endpoints.
import NextLink from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Cog, Gauge, Landmark, ShoppingCart } from 'lucide-react'

import { CardAccent, LANDING_CONTAINER, LANDING_SECTION, SectionHeader } from './landing-primitives'

export interface ModulesSceneProps {
  t: (key: string, fallback?: string) => string
  /** Locale segment for route links — same contract as SiteFooter/TopNav. */
  localePrefix?: string | undefined
  /** Chapter number of this section on the page (`01`). */
  index?: string | undefined
}

interface ModuleItem {
  key: string
  /** Route beneath the locale segment, when the module has its own page. */
  href?: string
}

const GROUPS: Array<{ key: string; icon: LucideIcon; items: ModuleItem[] }> = [
  {
    key: 'finance',
    icon: Landmark,
    items: [
      { key: 'ledger', href: '/features/daybook' },
      { key: 'receivables', href: '/features/customer-debt' },
      { key: 'payables' },
      { key: 'till' },
      { key: 'bank' },
      { key: 'budget' },
      { key: 'statements' },
    ],
  },
  {
    key: 'sales',
    icon: ShoppingCart,
    items: [
      { key: 'invoices', href: '/features/invoicing' },
      { key: 'pos' },
      { key: 'purchasing' },
      { key: 'customers' },
      { key: 'payments' },
    ],
  },
  {
    key: 'operations',
    icon: Cog,
    items: [
      { key: 'inventory', href: '/features/inventory' },
      { key: 'manufacturing' },
      { key: 'people' },
      { key: 'branches' },
      { key: 'offline', href: '/features/offline' },
    ],
  },
  {
    key: 'management',
    icon: Gauge,
    items: [
      { key: 'dashboard', href: '/features/shop-accounting' },
      { key: 'reports' },
      { key: 'permissions' },
      { key: 'audit' },
      { key: 'ai' },
    ],
  },
]

export default function ModulesScene({ t, localePrefix, index }: ModulesSceneProps) {
  const routePrefix = localePrefix ? `/${localePrefix}` : ''

  return (
    <section id="features" className={LANDING_SECTION}>
      <div className={LANDING_CONTAINER}>
        <SectionHeader
          index={index}
          label={t('landing.modules.label')}
          title={t('landing.modules.title')}
          description={t('landing.modules.desc')}
        />

        {/* One ledger: a single hairline frame, hairlines between the columns
            and between the rows. `gap-px` over a bordered background is what
            draws them — no per-cell border arithmetic, so RTL and LTR need
            nothing different. */}
        <ul className="grid gap-px overflow-hidden rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--border-default))] sm:grid-cols-2 lg:grid-cols-4">
          {GROUPS.map(({ key, icon: Icon, items }, groupIndex) => (
            <li
              key={key}
              className="group relative flex flex-col bg-[hsl(var(--surface-base))] p-5 transition-colors duration-300 hover:bg-[hsl(var(--surface-elevated))] sm:p-6"
            >
              <CardAccent />

              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs tabular-nums text-[hsl(var(--fg-tertiary))]">
                  {String(groupIndex + 1).padStart(2, '0')}
                </span>
                <Icon className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
              </div>

              <h3 className="mt-4 text-lg font-bold text-[hsl(var(--fg-primary))] sm:text-xl">
                {t(`landing.modules.group.${key}`)}
              </h3>

              <ul className="mt-3 border-t border-[hsl(var(--border-default))]">
                {items.map((item) => {
                  const label = t(`landing.modules.item.${item.key}`)
                  const row =
                    'flex min-h-9 items-center justify-between gap-3 border-b border-[hsl(var(--border-default)/0.6)] py-1.5 text-sm text-[hsl(var(--fg-secondary))] transition-colors'

                  return (
                    <li key={item.key}>
                      {item.href ? (
                        <NextLink
                          prefetch={false}
                          href={`${routePrefix}${item.href}`}
                          className={`${row} after:text-[hsl(var(--fg-tertiary))] after:content-['←'] hover:text-[hsl(var(--color-primary))] ltr:after:content-['→']`}
                        >
                          {label}
                        </NextLink>
                      ) : (
                        <span className={row}>{label}</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
