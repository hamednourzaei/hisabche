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
// ⚠️ Every item is a module with a dashboard route and backend endpoints.
import NextLink from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Cog, Gauge, Landmark, ShoppingCart } from 'lucide-react'

import { LANDING_CONTAINER, LANDING_SECTION, SectionHeader } from './landing-primitives'

export interface ModulesSceneProps {
  t: (key: string, fallback?: string) => string
  /** Locale segment for route links — same contract as SiteFooter/TopNav. */
  localePrefix?: string | undefined
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

export default function ModulesScene({ t, localePrefix }: ModulesSceneProps) {
  const routePrefix = localePrefix ? `/${localePrefix}` : ''

  return (
    <section id="features" className={LANDING_SECTION}>
      <div className={LANDING_CONTAINER}>
        <SectionHeader
          label={t('landing.modules.label')}
          title={t('landing.modules.title')}
          description={t('landing.modules.desc')}
        />

        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {GROUPS.map(({ key, icon: Icon, items }) => (
            <div
              key={key}
              className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated)/0.6)] p-4 sm:p-5"
            >
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-[hsl(var(--fg-primary))]">
                <Icon className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
                {t(`landing.modules.group.${key}`)}
              </h3>
              <ul className="flex flex-wrap gap-1.5">
                {items.map((item) => {
                  const label = t(`landing.modules.item.${item.key}`)
                  const chip =
                    'block rounded-md bg-[hsl(var(--surface-muted))] px-2 py-1 text-sm text-[hsl(var(--fg-secondary))]'
                  return (
                    <li key={item.key}>
                      {item.href ? (
                        <NextLink
                          prefetch={false}
                          href={`${routePrefix}${item.href}`}
                          className={`${chip} underline decoration-[hsl(var(--color-primary)/0.4)] underline-offset-4 hover:text-[hsl(var(--color-primary))]`}
                        >
                          {label}
                        </NextLink>
                      ) : (
                        <span className={chip}>{label}</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
