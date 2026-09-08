// apps/web/app/[lang]/docs/[slug]/page.tsx
//
// T12 — one documentation article. Public, like the index.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getMessages } from 'next-intl/server'

import { findArticle } from '@hisabche/ui'

import { DocsClient } from '../docs-client'
import { DocsShell } from '../docs-shell'
import { buildLegalMetadata } from '../../legal/legal-metadata'
import { localeUrl, resolveLocale } from '../../i18n-config'

export const revalidate = 3600

// ⚠️ NO `generateStaticParams` — AND THIS IS THE FIX FOR THE PRODUCTION 500.
//
// It used to be here, returning every article slug. That opts the route into
// STATIC prerendering, and the page reads its text through next-intl's
// `getMessages()`, which resolves the locale from the REQUEST. During a
// prerender there is no request, so Next throws:
//
//     digest: 'DYNAMIC_SERVER_USAGE'
//
// …and every `/[lang]/docs/<slug>` URL returns 500 in production. The build
// still succeeds, and dev still serves the page, which is why it was not
// caught here.
//
// ⚠️ THIS EXACT MISTAKE WAS ALREADY MADE, DIAGNOSED AND FIXED ONCE, on
// `app/[lang]/features/[slug]/page.tsx` — the comment there says the same
// thing. It was reintroduced because the docs route was written without
// reading it. Rendering on demand is what every other public page in this app
// does, and the `revalidate` above still caches the result.
//
// To make these static later, the supported route is next-intl's
// `setRequestLocale()` plus a `generateStaticParams` that returns `lang` AS
// WELL AS `slug`. That is a deliberate change to the locale plumbing, not
// something to reach for to shave a render.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>
}): Promise<Metadata> {
  const { lang, slug } = await params
  // ⚠️ RESOLVED, NOT PASSED THROUGH.
  //
  // `getMessages({ locale })` THROWS on a locale it does not know, and a
  // throw inside `generateMetadata` is a 500 rather than a 404. Every other
  // public page in this app resolves first; these two did not, which made
  // `/xx/docs/anything` a 500 instead of a not-found.
  const locale = resolveLocale(lang)
  const messages = (await getMessages({ locale })) as Record<string, any>
  const article = messages?.docs?.[slug] ?? {}

  // ⚠️ `seoTitle`, not `title`.
  //
  // The sidebar wants «فاکتور»; the <title> wants the phrasing people type.
  // Ranking help pages in this market use «راهنمای X در نرم‌افزار حسابداری» —
  // hesabfa.com/help ranks on exactly that shape — so the title tag follows
  // the query rather than the navigation label. Falls back to the short title
  // if a language has not set one.
  return buildLegalMetadata({
    lang,
    path: `/docs/${slug}`,
    title: article.seoTitle ?? `${article.title ?? slug} — Hisabche`,
    description: article.summary ?? '',
  })
}

export default async function DocsArticlePage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>
}) {
  const { lang, slug } = await params
  // An unknown slug is a 404, not an empty page: these URLs are indexed, and
  // a soft-200 on a missing article teaches the crawler the page exists.
  const article = findArticle(slug)
  if (!article) notFound()

  // Resolved, not passed through — see generateMetadata above.
  const locale = resolveLocale(lang)
  const messages = (await getMessages({ locale })) as Record<string, any>
  const text = messages?.docs?.[slug] ?? {}
  const site = messages?.docs ?? {}

  /**
   * Article + BreadcrumbList, as JSON-LD.
   *
   * ⚠️ The breadcrumb is emitted as DATA even though the page draws no
   * breadcrumb widget: it is what turns a bare URL in a result into
   * «hisabche.com › راهنما › فاکتور», which is a real click-through
   * difference on a help query.
   *
   * `TechArticle` rather than `Article`: this is documentation, and the type
   * is what a search engine uses to decide the result belongs in a how-to
   * context rather than a news one.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        headline: text.seoTitle ?? text.title ?? slug,
        description: text.summary ?? '',
        inLanguage: lang,
        isPartOf: {
          '@type': 'WebSite',
          name: lang === 'en' ? 'Hisabche' : 'حسابچه',
          url: localeUrl(locale, ''),
        },
        url: localeUrl(locale, `/docs/${slug}`),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: site.breadcrumbHome ?? 'Home',
            item: localeUrl(locale, ''),
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: site.title ?? 'Documentation',
            item: localeUrl(locale, '/docs'),
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: text.title ?? slug,
            item: localeUrl(locale, `/docs/${slug}`),
          },
        ],
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        // Serialised from values we control, not from user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <DocsShell>
        <DocsClient lang={lang} slug={slug} />
      </DocsShell>
    </>
  )
}
