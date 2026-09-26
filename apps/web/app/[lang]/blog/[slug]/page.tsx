import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import type { BlogPostPublic } from '@hisabche/api'
import { BlogArticleView } from '@hisabche/ui/blog/blog-article-view'

import { fetchBlogPost } from '../../../../lib/blog-api'
import {
  localePath,
  localeToBcp47,
  localeUrl,
  resolveLocale,
  SITE_URL,
  isLocale,
  type Locale,
} from '../../i18n-config'
import { BlogChrome, blogDate, blogNumber, blogTranslator, cardLabels } from '../blog-shared'

// ISR per article: rendered on the first request, refreshed hourly or at once
// when an admin saves (the `blog` tag). A scheduled post appears on the first
// render after its time.
export const revalidate = 3600 // = BLOG_REVALIDATE_SECONDS (lib/blog-api.ts); segment config must be a literal

// No path is built ahead: the API may be unreachable during `next build`, and
// an article only exists once someone publishes it. An empty list still makes
// the route ISR — rendered on its first request, then cached for `revalidate`
// (without it the route is dynamic and renders on every request).
export function generateStaticParams() {
  return []
}

type Params = Promise<{ lang: string; slug: string }>

const OG_LOCALE: Record<Locale, string> = { fa: 'fa_IR', af: 'fa_AF', en: 'en_US' }

function articlePath(slug: string): string {
  return `/blog/${encodeURIComponent(slug)}`
}

/** hreflang: only translations that are really published, plus x-default. */
function languages(post: BlogPostPublic): Record<string, string> | undefined {
  const all = [
    { locale: post.locale, slug: post.slug },
    ...post.translations.filter((t) => t.locale !== post.locale),
  ]
  const valid = all.filter((t) => isLocale(t.locale))
  if (valid.length < 2) return undefined
  const map: Record<string, string> = {}
  for (const t of valid) map[localeToBcp47[t.locale]] = localePath(t.locale, articlePath(t.slug))
  const fallback = valid.find((t) => t.locale === 'fa') ?? valid[0]!
  map['x-default'] = localePath(fallback.locale, articlePath(fallback.slug))
  return map
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, slug } = await params
  const locale = resolveLocale(lang)
  const result = await fetchBlogPost(locale, decodeURIComponent(slug))
  if (result.kind !== 'ok') return { robots: { index: false, follow: true } }
  const post = result.data

  const title = post.metaTitle ?? post.title
  const description = post.metaDescription ?? post.excerpt
  const image = post.ogImageUrl ?? post.coverUrl
  const alternates = languages(post)
  return {
    // No brand here — the layout template appends «| حسابچه».
    title,
    description,
    keywords: post.focusKeyword ? [post.focusKeyword, ...post.keywords] : post.keywords,
    alternates: {
      canonical: post.canonicalUrl ?? localePath(locale, articlePath(post.slug)),
      ...(alternates ? { languages: alternates } : {}),
    },
    openGraph: {
      type: 'article',
      title,
      description,
      url: localeUrl(locale, articlePath(post.slug)),
      locale: OG_LOCALE[locale],
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt,
      ...(post.author ? { authors: [post.author.name] } : {}),
      ...(post.tags.length ? { tags: post.tags.map((t) => t.name) } : {}),
      ...(image
        ? { images: [{ url: image, width: 1200, height: 630, alt: post.coverAlt ?? title }] }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
    robots: post.noindex
      ? { index: false, follow: true }
      : {
          index: true,
          follow: true,
          googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
        },
  }
}

function JsonLd({
  post,
  locale,
  breadcrumb,
}: {
  post: BlogPostPublic
  locale: Locale
  breadcrumb: Array<{ name: string; url: string }>
}) {
  const url = localeUrl(locale, articlePath(post.slug))
  const image = post.ogImageUrl ?? post.coverUrl
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'BlogPosting',
      '@id': `${url}#article`,
      mainEntityOfPage: url,
      headline: post.title,
      description: post.metaDescription ?? post.excerpt,
      inLanguage: localeToBcp47[locale],
      datePublished: post.publishedAt,
      dateModified: post.updatedAt,
      ...(image ? { image } : {}),
      ...(post.focusKeyword || post.keywords.length
        ? { keywords: [post.focusKeyword, ...post.keywords].filter(Boolean).join(', ') }
        : {}),
      // A real person only when the author's profile has a name; otherwise the
      // organisation — never an invented byline.
      author: post.author
        ? { '@type': 'Person', name: post.author.name }
        : { '@id': `${SITE_URL}/#organization` },
      publisher: { '@id': `${SITE_URL}/#organization` },
      // Only real, visible votes (the same numbers are rendered on the page).
      ...(post.stats.ratingCount > 0 && post.stats.ratingAvg !== null
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: post.stats.ratingAvg,
              ratingCount: post.stats.ratingCount,
              bestRating: 5,
              worstRating: 1,
            },
          }
        : {}),
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: breadcrumb.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.url,
      })),
    },
  ]
  // Only when the questions are on the page — they are rendered from the same
  // `faq` array right below the article.
  if (post.faq.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      inLanguage: localeToBcp47[locale],
      mainEntity: post.faq.map((item) => ({
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
        __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(
          /</g,
          '\\u003c',
        ),
      }}
    />
  )
}

export default async function BlogArticlePage({ params }: { params: Params }) {
  const { lang, slug } = await params
  const locale = resolveLocale(lang)
  setRequestLocale(locale)
  const t = await blogTranslator(locale)
  const result = await fetchBlogPost(locale, decodeURIComponent(slug))
  if (result.kind === 'not-found') notFound()

  if (result.kind === 'unconfigured') {
    return (
      <BlogChrome locale={locale} t={t}>
        <main className="mx-auto w-full max-w-3xl px-4 py-16 text-center sm:px-6">
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('blog.unavailable')}</p>
        </main>
      </BlogChrome>
    )
  }

  const post = result.data
  const published = blogDate(post.publishedAt, locale)
  const updated = blogDate(post.updatedAt, locale)
  const ratingSummary =
    post.stats.ratingCount > 0 && post.stats.ratingAvg !== null
      ? t('blog.actions.ratingSummary', {
          avg: blogNumber(post.stats.ratingAvg, locale),
          count: blogNumber(post.stats.ratingCount, locale),
        })
      : null

  const breadcrumb = [
    { name: t('blog.breadcrumbHome'), url: localeUrl(locale) },
    { name: t('blog.title'), url: localeUrl(locale, '/blog') },
    ...(post.category
      ? [
          {
            name: post.category.name,
            url: localeUrl(locale, `/blog/category/${encodeURIComponent(post.category.slug)}`),
          },
        ]
      : []),
    { name: post.title, url: localeUrl(locale, articlePath(post.slug)) },
  ]

  return (
    <BlogChrome locale={locale} t={t}>
      <JsonLd post={post} locale={locale} breadcrumb={breadcrumb} />
      <BlogArticleView
        post={post}
        locale={locale}
        relatedLabels={cardLabels(locale, t)}
        labels={{
          breadcrumbHome: t('blog.breadcrumbHome'),
          blog: t('blog.title'),
          breadcrumbLabel: t('blog.breadcrumbLabel'),
          published: t('blog.publishedOn', { date: published }),
          // Shown only when it is a different day from publication.
          updated: updated && updated !== published ? t('blog.updatedOn', { date: updated }) : null,
          reading: t('blog.readingMinutes', { minutes: blogNumber(post.readingMinutes, locale) }),
          author: post.author ? t('blog.by', { name: post.author.name }) : null,
          toc: t('blog.toc'),
          faq: t('blog.faq'),
          tags: t('blog.tags'),
          related: t('blog.related'),
          ratingSummary,
          ctaTitle: t('blog.cta.title'),
          ctaBody: t('blog.cta.body'),
          ctaFeatures: t('blog.cta.features'),
          ctaSignup: t('blog.cta.signup'),
        }}
      />
    </BlogChrome>
  )
}
