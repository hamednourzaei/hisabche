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

        <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {GROUPS.map(({ key, icon: Icon, items }) => (
            <div
              key={key}
              className="group relative flex flex-col overflow-hidden rounded-3xl bg-[hsl(var(--surface-muted))] p-6 shadow-sm ring-1 ring-[hsl(var(--border-default))] transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-[hsl(var(--color-primary)/0.1)] hover:ring-[hsl(var(--color-primary)/0.3)] animate-in fade-in zoom-in-95 duration-700"
            >
              {/* Background Glow */}
              <div className="absolute -inset-4 bg-gradient-to-br from-[hsl(var(--color-primary)/0.15)] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

              <div className="relative">
                <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-[hsl(var(--color-primary)/0.1)] ring-1 ring-[hsl(var(--color-primary)/0.2)]">
                  <Icon className="size-6 text-[hsl(var(--color-primary))]" aria-hidden="true" />
                </div>
                <h3 className="mb-4 text-lg font-bold text-[hsl(var(--fg-primary))]">
                  {t(`landing.modules.group.${key}`)}
                </h3>
                <ul className="flex flex-wrap gap-2">
                  {items.map((item) => {
                    const label = t(`landing.modules.item.${item.key}`)
                    const chip =
                      'inline-flex items-center rounded-lg bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border-default))] px-3 py-1.5 text-sm font-medium text-[hsl(var(--fg-secondary))] transition-colors group-hover/item:border-[hsl(var(--color-primary)/0.4)] group-hover/item:bg-[hsl(var(--color-primary)/0.05)] group-hover/item:text-[hsl(var(--color-primary))]'

                    return (
                      <li key={item.key} className="group/item">
                        {item.href ? (
                          <NextLink
                            prefetch={false}
                            href={`${routePrefix}${item.href}`}
                            className={chip}
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
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
