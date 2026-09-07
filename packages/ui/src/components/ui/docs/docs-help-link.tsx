'use client'

// ============================================
// packages/ui/src/components/ui/docs/docs-help-link.tsx
//
// The «?» beside a page title that opens that page's documentation.
//
// ---------------------------------------------------------------------------
// ⚠️ CONTEXTUAL DEEP LINK, NOT A HELP HUB
//
// It goes to `/docs/inventory` from the warehouse screen, never to `/docs`.
// A generic help link makes the reader search for their own question again on
// arrival, which is the moment most of them give up — and it passes no topical
// signal, because a link every page shares says nothing about any of them.
//
// ---------------------------------------------------------------------------
// ⚠️ THE ROUTE IS DETECTED, NOT PASSED
//
// Thirty screens share `CapabilityHeader`. Requiring each to declare its docs
// slug would mean thirty edits and thirty chances for one to be forgotten or
// to drift when an article is renamed. The mapping lives in one table below
// and a guard checks every entry points at a real article.
//
// ---------------------------------------------------------------------------
// ⚠️ THE ANCHOR TEXT NAMES THE DESTINATION
//
// «?» alone is not an accessible name, and «help» on every page is the
// «click here» of internal linking — it describes nothing, for a reader or a
// crawler. The accessible name is «راهنمای <article>», built from the
// article's own title.
// ============================================

import * as React from 'react'

import { HelpCircle } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'

import { DOCS_ARTICLES } from '../../../lib/docs/docs-content'
import { cn } from '../../../lib/utils'

/**
 * Dashboard route → documentation article.
 *
 * ⚠️ Keyed by the route segment WITHOUT its locale prefix. A route with no
 * entry gets no «?» at all — an icon linking to an article that does not
 * answer the question is worse than none, because the reader spends the click
 * finding that out.
 */
export const ROUTE_DOCS_MAP: Record<string, string> = {
  // Sales
  invoices: 'invoices',
  'invoice-detail': 'invoices',
  'quick-invoice': 'invoices',
  customers: 'customers',
  'customer-list': 'customers',
  crm: 'customers',

  // Stock
  warehouse: 'inventory',
  'inventory-workspace': 'inventory',
  'product-list': 'inventory',
  products: 'inventory',
  'stock-count': 'inventory',
  expiry: 'inventory',
  operations: 'inventory',

  // Money
  accounting: 'accounting',
  'accounting-workspace': 'accounting',
  payments: 'invoices',
  till: 'pos',
  pos: 'pos',
  bank: 'accounting',
  budgets: 'accounting',
  assets: 'accounting',

  // Team
  permissions: 'permissions',
  governance: 'permissions',
  'people-workspace': 'permissions',
  'human-resources': 'permissions',
  timesheets: 'permissions',
  branches: 'branches',

  // Platform
  'data-and-sync': 'offline',
  conflicts: 'offline',
  'data-migration': 'data-and-backup',
  settings: 'data-and-backup',
  dashboard: 'getting-started',
}

/** The article for a pathname, or null when the route has no documentation. */
export function docsSlugForPath(pathname: string): string | null {
  // `/fa/warehouse/123` → `warehouse`. The locale is always the first segment
  // on web; desktop mounts without one, so this takes the first segment that
  // is not a known locale rather than assuming a position.
  const segments = pathname.split('/').filter(Boolean)
  const locales = new Set(['fa', 'af', 'en'])
  const route = segments.find((segment) => !locales.has(segment))
  if (!route) return null

  const slug = ROUTE_DOCS_MAP[route]
  if (!slug) return null

  // Never link to an article that does not exist — a 404 from a help icon is
  // worse than no help icon.
  return DOCS_ARTICLES.some((article) => article.slug === slug) ? slug : null
}

export interface DocsHelpLinkProps {
  /** Override the detected route. Rarely needed — see the header note. */
  pathname?: string | undefined
  className?: string | undefined
}

/**
 * ⚠️ SELF-SUFFICIENT ON PURPOSE.
 *
 * It reads the route and the locale itself rather than taking them as props.
 * Thirty screens render through `CapabilityHeader`; threading three props
 * through all of them would be thirty edits, thirty chances to forget one, and
 * a permanent invitation for new screens to ship without the link.
 *
 * `usePathname` and `useTranslations` are both shimmed on desktop
 * (`apps/desktop/src/shims/`), so this works in the Electron renderer too.
 */
export function DocsHelpLink({ pathname, className }: DocsHelpLinkProps) {
  const routerPath = usePathname()
  const locale = useLocale()
  const translate = useTranslations()

  const t = (key: string, fallback: string): string => {
    try {
      const value = translate(key)
      return value === key ? fallback : value
    } catch {
      return fallback
    }
  }

  const slug = docsSlugForPath(pathname ?? routerPath ?? '')
  if (!slug) return null

  const hrefFor = (articleSlug: string) => `/${locale}/docs/${articleSlug}`
  const articleTitle = t(`docs.${slug}.title`, slug)
  // Descriptive, not «help». This is the anchor text a screen reader announces
  // and the signal a crawler reads.
  const label = `${t('docs.helpFor', 'راهنمای')} ${articleTitle}`

  return (
    <a
      href={hrefFor(slug)}
      // Opens in a new tab: the reader is mid-task on a dashboard screen, and
      // navigating away loses whatever they were part-way through entering.
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded-full',
        'text-[hsl(var(--fg-tertiary))] transition-colors',
        'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--color-primary))]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]',
        className,
      )}
    >
      <HelpCircle className="size-4" aria-hidden="true" />
    </a>
  )
}

export default DocsHelpLink
