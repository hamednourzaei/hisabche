// apps/web/app/[lang]/docs/[slug]/page.tsx
//
// T12 — one documentation article. Public, like the index.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getMessages, setRequestLocale } from 'next-intl/server'

import { DOCS_ARTICLES, findArticle } from '@hisabche/ui'

import { DocsClient } from '../docs-client'
import { DocsShell } from '../docs-shell'
import { buildLegalMetadata } from '../../legal/legal-metadata'
import { localeUrl, locales, resolveLocale } from '../../i18n-config'

export const revalidate = 3600

// ⚠️ STATIC — ONLY BECAUSE THE LOCALE COMES FROM THE ROUTE.
//
// This route once had `generateStaticParams` while reading messages with the
// locale resolved from the REQUEST: a prerender has no request, Next threw
// DYNAMIC_SERVER_USAGE, and every `/[lang]/docs/<slug>` returned 500 in
// production (the build still passed). The same mistake had been made on the
// features route first.
//
// The supported form is what is here now: `generateStaticParams` returns
// `lang` AS WELL AS `slug`, and every next-intl server call gets the locale
// explicitly (`setRequestLocale` + `getMessages({ locale })`). Never add the
// first without the second.
export function generateStaticParams() {
  return locales.flatMap((lang) => DOCS_ARTICLES.map((article) => ({ lang, slug: article.slug })))
}

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
  setRequestLocale(locale)
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
    // No brand suffix: the root layout's title template appends it.
    title: article.seoTitle ?? article.title ?? slug,
    // `seoDescription` is written for search; the one-line sidebar summary
    // (26–69 chars, identical in fa and af) was too thin for a snippet.
    description: article.seoDescription ?? article.summary ?? '',
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
  setRequestLocale(locale)
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
