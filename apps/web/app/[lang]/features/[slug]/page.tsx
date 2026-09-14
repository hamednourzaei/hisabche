// apps/web/app/[lang]/features/[slug]/page.tsx
//
// Public feature pages. Two exist, both chosen from SERP evidence rather than
// from a keyword list:
//
//   customer-debt — نسیه / قرض. Neither the Iranian nor the Afghan market has a
//     vendor page dedicated to this intent; the SERP is app-store listings and
//     generic finance blogs. It is also the workflow Hisabche genuinely models
//     (see customerDebt in backend/src/services/analytics.service.ts).
//   offline — CORRECTED (2026-08): the earlier note here claimed this was "the
//     weakest SERP found in any market surveyed". That is disproven. Iranian
//     vendors (چالاک حساب, پارمیس, چرتکه) target حسابداری آفلاین directly, and
//     the English SERP is publisher listicles rather than product pages. What is
//     actually defensible, and what this page is now anchored on, is
//     offline-first WITH automatic cloud sync across phone, Windows and web —
//     versus a Windows install whose data never leaves one machine. Do not
//     re-derive the "uncontested offline" premise.
//     Honesty constraint baked into the copy: the real offline write queue is
//     mobile (apps/mobile/src/features/offline/outbox.store.ts) and desktop
//     (apps/desktop/src/features/sync/sync-engine.ts + electron SQLite). On web,
//     packages/store/src/slices/sync.slice.ts is only a pendingCount counter, so
//     the pages say so explicitly instead of claiming browser offline support.
//     The af page is framed around power cuts, انترنت cost and دوکان rather than
//     being a translation of the fa one: "حسابداری آفلاین" is spelled identically
//     in both locales and the two pages would otherwise cannibalise each other.
//
// Deliberately NOT created: pages for the head terms (نرم افزار حسابداری,
// "small business accounting software", inventory). Those SERPs are owned by
// established brands and editorial listicles; adding thin pages for them would
// cannibalise the home page, which is the correct target for the head term.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { FeaturePageClient, type RelatedLink } from '../FeaturePageClient'
import { buildLegalMetadata } from '../../legal/legal-metadata'
import { localeUrl, resolveLocale, localeToBcp47, locales } from '../../i18n-config'

export const revalidate = 3600

interface FeatureDef {
  /** Key under `landing.featurePage` in the message catalogue. */
  contentKey: string
  related: RelatedLink[]
}

const FEATURES: Record<string, FeatureDef> = {
  // Commercial-intent pages (Iran / Afghanistan / global), one per product area.
  'shop-accounting': {
    contentKey: 'shopAccounting',
    related: [
      {
        href: '/features/invoicing',
        labelKey: 'landing.footerLink.invoicingPage',
        labelFallback: 'Invoicing',
      },
      {
        href: '/features/inventory',
        labelKey: 'landing.footerLink.inventoryPage',
        labelFallback: 'Inventory',
      },
      {
        href: '/features/daybook',
        labelKey: 'landing.footerLink.daybookPage',
        labelFallback: 'Daybook',
      },
    ],
  },
  invoicing: {
    contentKey: 'invoicing',
    related: [
      {
        href: '/features/customer-debt',
        labelKey: 'landing.footerLink.customerDebt',
        labelFallback: 'Customer debt',
      },
      {
        href: '/features/inventory',
        labelKey: 'landing.footerLink.inventoryPage',
        labelFallback: 'Inventory',
      },
      {
        href: '/features/shop-accounting',
        labelKey: 'landing.footerLink.shopAccountingPage',
        labelFallback: 'Shop accounting',
      },
    ],
  },
  inventory: {
    contentKey: 'inventory',
    related: [
      {
        href: '/features/invoicing',
        labelKey: 'landing.footerLink.invoicingPage',
        labelFallback: 'Invoicing',
      },
      {
        href: '/features/offline',
        labelKey: 'landing.footerLink.offline',
        labelFallback: 'Offline accounting',
      },
      {
        href: '/features/shop-accounting',
        labelKey: 'landing.footerLink.shopAccountingPage',
        labelFallback: 'Shop accounting',
      },
    ],
  },
  daybook: {
    contentKey: 'daybook',
    related: [
      {
        href: '/features/invoicing',
        labelKey: 'landing.footerLink.invoicingPage',
        labelFallback: 'Invoicing',
      },
      {
        href: '/features/customer-debt',
        labelKey: 'landing.footerLink.customerDebt',
        labelFallback: 'Customer debt',
      },
      {
        href: '/features/shop-accounting',
        labelKey: 'landing.footerLink.shopAccountingPage',
        labelFallback: 'Shop accounting',
      },
    ],
  },
  'customer-debt': {
    contentKey: 'customerDebt',
    related: [
      {
        href: '/features/offline',
        labelKey: 'landing.featurePage.offline.h1',
        labelFallback: 'Offline accounting',
      },
      { href: '/about', labelKey: 'landing.footerLink.about', labelFallback: 'About' },
    ],
  },
  offline: {
    contentKey: 'offline',
    related: [
      {
        href: '/features/customer-debt',
        labelKey: 'landing.featurePage.customerDebt.h1',
        labelFallback: 'Customer debt',
      },
      { href: '/about', labelKey: 'landing.footerLink.about', labelFallback: 'About' },
    ],
  },
}

// Static, per locale × feature. This was deliberately on-demand: the content
// was read through `getMessages()` with the locale resolved from the REQUEST,
// and prerendering that throws DYNAMIC_SERVER_USAGE (every feature URL 500'd).
// The locale now comes from the route (`setRequestLocale` + `getMessages({ locale })`),
// which is the supported way to prerender — never one without the other.
export function generateStaticParams() {
  return locales.flatMap((lang) => Object.keys(FEATURES).map((slug) => ({ lang, slug })))
}

/**
 * Reads a `landing.featurePage.<key>.<field>` string straight from the request's
 * message catalogue. Metadata and JSON-LD must come from the SAME source the
 * body renders from — the older pages on this site keep titles in inline
 * `Record<string, string>` literals while the body uses i18n keys, which lets
 * the two drift apart silently.
 */
async function readContent(contentKey: string, lang: string) {
  const locale = resolveLocale(lang)
  setRequestLocale(locale)
  const messages = (await getMessages({ locale })) as Record<string, unknown>
  const landing = messages['landing'] as Record<string, unknown> | undefined
  const featurePage = landing?.['featurePage'] as Record<string, unknown> | undefined
  return (featurePage?.[contentKey] ?? {}) as {
    metaTitle?: string
    metaDescription?: string
    h1?: string
    faq?: { q: string; a: string }[]
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>
}): Promise<Metadata> {
  const { lang, slug } = await params
  const feature = FEATURES[slug]
  if (!feature) return {}

  const content = await readContent(feature.contentKey, lang)

  // Reuses the shared builder so canonical, hreflang, OG and robots stay
  // identical to every other standalone public page rather than being
  // re-derived here.
  return buildLegalMetadata({
    lang,
    path: `/features/${slug}`,
    title: content.metaTitle,
    description: content.metaDescription,
  })
}

function JsonLd({
  lang,
  slug,
  h1,
  faq,
}: {
  lang: string
  slug: string
  h1: string | undefined
  faq: { q: string; a: string }[]
}) {
  const locale = resolveLocale(lang)
  const url = localeUrl(locale, `/features/${slug}`)

  const graph: Record<string, unknown>[] = [
    {
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Hisabche', item: localeUrl(locale) },
        { '@type': 'ListItem', position: 2, name: h1 ?? slug, item: url },
      ],
    },
  ]

  // Only emitted when the questions genuinely render on the page — every item
  // below is in the DOM, unlike the landing page's FAQ where most sit behind a
  // "show all" toggle.
  if (faq.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      inLanguage: localeToBcp47[locale],
      mainEntity: faq.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    })
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }),
      }}
    />
  )
}

export default async function FeaturePage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>
}) {
  const { lang, slug } = await params
  const feature = FEATURES[slug]
  // An unknown slug must 404, not render an empty shell — a 200 with no content
  // is a soft 404 and Google treats it as a quality signal against the site.
  if (!feature) notFound()

  const content = await readContent(feature.contentKey, lang)
  const faq = Array.isArray(content.faq) ? content.faq : []

  return (
    <>
      <JsonLd lang={lang} slug={slug} h1={content.h1} faq={faq} />
      <FeaturePageClient contentKey={feature.contentKey} related={feature.related} />
    </>
  )
}
