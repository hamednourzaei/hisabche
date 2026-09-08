// apps/web/app/sitemap.ts
import { type MetadataRoute } from 'next'
import { DOCS_ARTICLES } from '@hisabche/ui'

import { locales, localeUrl, localeToBcp47, defaultLocale } from './[lang]/i18n-config'

// Only public, indexable pages. `/pricing`, `/login`, `/signup`, `/forgot-password`,
// `/onboarding` and `/accept-invite` are intentionally excluded: `/pricing` has no
// route (pricing is a section on the homepage, see PricingScene in the landing page),
// and the rest carry `robots: { index: false }` in their own metadata — listing
// noindex or non-existent URLs in the sitemap wastes crawl budget and can trigger
// Search Console "Submitted URL marked noindex" / 404 errors.
//
// `/public-invoice/[token]` and `/public-task/[token]` must never appear here: they
// render real customer invoice data behind an unguessable token.
const routes = [
  { path: '' },
  { path: '/about' },
  { path: '/contact' },
  // Feature pages — see app/[lang]/features/[slug]/page.tsx for why these two
  // and no others.
  { path: '/features/customer-debt' },
  { path: '/features/offline' },
  { path: '/legal/terms' },
  { path: '/legal/privacy' },
  { path: '/legal/cookies' },
  { path: '/legal/disclaimer' },
  { path: '/legal/refund' },
  { path: '/legal/accessibility' },
  { path: '/legal/security' },
  { path: '/legal/data-deletion' },
  { path: '/legal/gdpr' },
  { path: '/legal/copyright' },

  // T12 — public documentation. Listed rather than hand-maintained: the
  // article set is data, and a hardcoded copy here would silently stop
  // matching the moment an article is added.
  // `/docs` is deliberately absent: it is a 308 to the first article, and a
  // sitemap that lists a redirect spends crawl budget to be told to go
  // somewhere else. The articles themselves are listed on the next line.
  ...DOCS_ARTICLES.map((article) => ({ path: `/docs/${article.slug}` })),
]

// Content-change date for the public marketing/legal surface. Deliberately a
// fixed value rather than `new Date()`: a sitemap that reports every URL as
// modified "now" on every crawl is noise, and Google discounts the signal
// entirely. Bump this when the public pages' content actually changes — the
// legal pages already display this same date via `landing.legalPage.lastUpdated`.
// 2026-08-19: landing H1/subtitle rewritten, both /features/* pages rewritten,
// /contact gained subheadings.
const LAST_MODIFIED = '2026-08-19'

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = []

  for (const route of routes) {
    // hreflang alternates are identical for every locale variant of a route and
    // are what tie the three localized URLs together as true equivalents.
    const languages: Record<string, string> = {}
    for (const locale of locales) {
      languages[localeToBcp47[locale]] = localeUrl(locale, route.path)
    }
    languages['x-default'] = localeUrl(defaultLocale, route.path)

    for (const locale of locales) {
      entries.push({
        // Was `locale === "fa" ? route.path : ...`, i.e. unprefixed for fa —
        // which contradicted this entry's own `hreflang="fa"` alternate and made
        // all 13 fa URLs 307 redirects rather than the 200s a sitemap must list.
        url: localeUrl(locale, route.path),
        lastModified: LAST_MODIFIED,
        alternates: { languages },
      })
    }
  }

  return entries
}

// Keep the sitemap out of the per-request render path — its contents only change
// when `routes` or `LAST_MODIFIED` change.
export const dynamic = 'force-static'
