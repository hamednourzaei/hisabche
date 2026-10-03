// apps/web/app/sitemap.ts
import { type MetadataRoute } from 'next'
import { DOCS_ARTICLES } from '@hisabche/ui'

import { fetchBlogSitemap } from '../lib/blog-api'
import { fetchMarketSitemap } from '../lib/market-api'
import { locales, localeUrl, localeToBcp47, defaultLocale, isLocale } from './[lang]/i18n-config'

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
  // The blog hub is NOT here: it is listed by blogEntries(), and only for a
  // language that has a published article. With none, the hub is noindex
  // (a thin page), and a sitemap must not submit a noindex URL — Search
  // Console reports it as «Submitted URL marked noindex» (BUG-086).
  // Feature pages — see app/[lang]/features/[slug]/page.tsx for why these two
  // and no others.
  { path: '/features/customer-debt' },
  { path: '/features/offline' },
  { path: '/features/shop-accounting' },
  { path: '/features/invoicing' },
  { path: '/features/inventory' },
  { path: '/features/daybook' },
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
const LAST_MODIFIED = '2026-09-15'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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

  entries.push(...(await blogEntries()))
  entries.push(...(await marketEntries()))
  return entries
}

/**
 * The goods marketplace — ONLY while a platform admin has it switched on.
 *
 * Off (the default) the API answers `enabled: false` and nothing is listed:
 * the pages are 404 + noindex, and a sitemap must not list a URL that answers
 * 404. On, it lists the hub, each seller with a public listing, and each
 * public listing with its real `updatedAt`, in all three languages with their
 * hreflang alternates.
 *
 * Failure is handled like the blog's: at runtime it throws (the last good
 * sitemap keeps being served); only during `next build` it is skipped.
 */
async function marketEntries(): Promise<MetadataRoute.Sitemap> {
  let result: Awaited<ReturnType<typeof fetchMarketSitemap>>
  try {
    result = await fetchMarketSitemap()
  } catch (error) {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      console.warn(
        '[sitemap] market API unreachable during build — market entries added on revalidation',
        error,
      )
      return []
    }
    throw error
  }
  if (result.kind !== 'ok' || !result.data.enabled) return []

  const pages: Array<{ path: string; lastModified?: string }> = [
    { path: '/market' },
    ...result.data.sellers.map((seller) => ({ path: `/market/${seller.slug}` })),
    ...result.data.listings.map((listing) => ({
      path: `/market/${listing.seller}/${listing.slug}`,
      lastModified: listing.updatedAt,
    })),
  ]

  const out: MetadataRoute.Sitemap = []
  for (const page of pages) {
    const languages: Record<string, string> = {}
    for (const locale of locales) languages[localeToBcp47[locale]] = localeUrl(locale, page.path)
    languages['x-default'] = localeUrl(defaultLocale, page.path)
    for (const locale of locales) {
      out.push({
        url: localeUrl(locale, page.path),
        ...(page.lastModified ? { lastModified: page.lastModified } : {}),
        alternates: { languages },
      })
    }
  }
  return out
}

/**
 * Every published, indexable article with its real `updatedAt`, the categories
 * that hold one, and tags with enough articles to be indexed — the API leaves
 * out noindex posts and thin tags (backend: BlogService.sitemap).
 *
 * ⚠️ AN API FAILURE IS NOT «NO ARTICLES». At runtime it throws: the render
 * fails, nothing is cached, and the last good sitemap keeps being served.
 * Only during `next build` — where the API may be unreachable (CI, a laptop)
 * — the blog entries are skipped with a warning; the hourly revalidation adds
 * them on the first regeneration. «Not set up yet» (503) lists nothing,
 * because there is nothing published.
 */
async function blogEntries(): Promise<MetadataRoute.Sitemap> {
  let result: Awaited<ReturnType<typeof fetchBlogSitemap>>
  try {
    result = await fetchBlogSitemap()
  } catch (error) {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      console.warn(
        '[sitemap] blog API unreachable during build — blog entries added on revalidation',
        error,
      )
      return []
    }
    throw error
  }
  if (result.kind !== 'ok') return []

  const out: MetadataRoute.Sitemap = []

  // The hub, for each language that has something published — the same rule
  // that decides whether the hub page itself is indexable (listMetadata).
  const hubLocales = locales.filter((locale) =>
    result.data.posts.some((post) => post.locale === locale),
  )
  const hubLanguages: Record<string, string> = {}
  for (const locale of hubLocales) hubLanguages[localeToBcp47[locale]] = localeUrl(locale, '/blog')
  for (const locale of hubLocales) {
    out.push({
      url: localeUrl(locale, '/blog'),
      ...(hubLocales.length > 1 ? { alternates: { languages: hubLanguages } } : {}),
    })
  }

  for (const post of result.data.posts) {
    if (!isLocale(post.locale)) continue
    const path = `/blog/${encodeURIComponent(post.slug)}`
    const translations = post.translations.filter((t) => isLocale(t.locale))
    const languages: Record<string, string> = {}
    if (translations.length > 1) {
      for (const t of translations) {
        if (isLocale(t.locale))
          languages[localeToBcp47[t.locale]] = localeUrl(
            t.locale,
            `/blog/${encodeURIComponent(t.slug)}`,
          )
      }
    }
    out.push({
      url: localeUrl(post.locale, path),
      lastModified: post.updatedAt,
      ...(translations.length > 1 ? { alternates: { languages } } : {}),
    })
  }
  for (const category of result.data.categories) {
    if (!isLocale(category.locale)) continue
    out.push({
      url: localeUrl(category.locale, `/blog/category/${encodeURIComponent(category.slug)}`),
      lastModified: category.updatedAt,
    })
  }
  for (const tag of result.data.tags) {
    if (!isLocale(tag.locale)) continue
    out.push({ url: localeUrl(tag.locale, `/blog/tag/${encodeURIComponent(tag.slug)}`) })
  }
  return out
}

// Out of the per-request render path: regenerated at most hourly (the blog's
// ISR window), or at once when an admin change expires the `blog` tag.
export const revalidate = 3600 // = BLOG_REVALIDATE_SECONDS (lib/blog-api.ts); segment config must be a literal
