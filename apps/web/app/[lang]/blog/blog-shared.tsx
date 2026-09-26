// apps/web/app/[lang]/blog/blog-shared.tsx
//
// What every blog page shares: the server translator, date and number
// formatting in the reader's calendar, the list page renderer and its
// metadata. Server-only; nothing here reaches the browser.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { formatDate, resolveIntlLocale } from '@hisabche/formatting'
import type { BlogListResponse, BlogPostSummary } from '@hisabche/api'
import { BlogHeader } from '@hisabche/ui/blog/blog-header'
import { BlogListView } from '@hisabche/ui/blog/blog-list-view'
import SiteFooterView from '@hisabche/ui/landing/site-footer-view'

import { BLOG_PAGE_SIZE, fetchBlogList } from '../../../lib/blog-api'
import {
  languageAlternates,
  localePath,
  localeUrl,
  resolveLocale,
  type Locale,
} from '../i18n-config'

export type Translate = (key: string, values?: Record<string, string | number>) => string

export async function blogTranslator(locale: Locale): Promise<Translate> {
  const translate = await getTranslations({ locale })
  type Key = Parameters<typeof translate>[0]
  type Values = Parameters<typeof translate>[1]
  return (key, values) =>
    translate.has(key as Key) ? translate(key as Key, values as Values) : key
}

/**
 * Publication dates are shown in the calendar of the reader's language, and on
 * the day it is in the place that language is read: the server runs in UTC and
 * cannot know the reader's zone, so each language takes its main one.
 */
const TIME_ZONE: Record<Locale, string> = { fa: 'Asia/Tehran', af: 'Asia/Kabul', en: 'UTC' }

export function blogDate(value: string | null, locale: Locale): string {
  return formatDate(value, locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: TIME_ZONE[locale],
  })
}

export function blogNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(resolveIntlLocale(locale)).format(value)
}

export function cardLabels(locale: Locale, t: Translate) {
  return (post: BlogPostSummary) => ({
    date: blogDate(post.publishedAt, locale),
    reading: t('blog.readingMinutes', { minutes: blogNumber(post.readingMinutes, locale) }),
  })
}

/** Page segment of a paginated URL: '2' → 2. Anything else (or 1) is not a page. */
export function parsePageSegment(raw: string): number | null {
  if (!/^[1-9]\d{0,3}$/.test(raw)) return null
  const page = Number(raw)
  return page >= 2 ? page : null
}

export interface ListScope {
  kind: 'all' | 'category' | 'tag'
  slug?: string | undefined
}

export function listBasePath(scope: ListScope): string {
  if (scope.kind === 'category') return `/blog/category/${encodeURIComponent(scope.slug ?? '')}`
  if (scope.kind === 'tag') return `/blog/tag/${encodeURIComponent(scope.slug ?? '')}`
  return '/blog'
}

/** Fewer public posts than this and a tag page is thin: noindex (backend: MIN_POSTS_FOR_INDEXED_TAG). */
const MIN_POSTS_FOR_INDEXED_TAG = 3

function heading(t: Translate, scope: ListScope, data: BlogListResponse | null): string {
  if (scope.kind === 'category' && data?.category)
    return t('blog.categoryTitle', { name: data.category.name })
  if (scope.kind === 'tag' && data?.tag) return t('blog.tagTitle', { name: data.tag.name })
  return t('blog.title')
}

export async function listMetadata(
  lang: string,
  scope: ListScope,
  page: number,
): Promise<Metadata> {
  const locale = resolveLocale(lang)
  const t = await blogTranslator(locale)
  const result = await fetchBlogList({
    locale,
    page,
    category: scope.kind === 'category' ? scope.slug : undefined,
    tag: scope.kind === 'tag' ? scope.slug : undefined,
  })
  if (result.kind === 'not-found') return {}

  const data = result.kind === 'ok' ? result.data : null
  const base = listBasePath(scope)
  const path = page > 1 ? `${base}/page/${page}` : base
  // No brand in <title>: the layout template appends «| حسابچه». The index's
  // H1 («وبلاگ حسابچه») is not its title for that reason.
  const baseTitle = scope.kind === 'all' ? t('blog.metaTitle') : heading(t, scope, data)
  const title =
    page > 1
      ? `${baseTitle} — ${t('blog.pageSuffix', { page: blogNumber(page, locale) })}`
      : baseTitle
  const description =
    (scope.kind === 'category' ? data?.category?.description : null) ?? t('blog.metaDescription')

  // Not worth an index entry: nothing published yet, not set up, or a tag
  // with too few articles to be more than a thin list. Links still followed.
  const thin =
    !data || data.total === 0 || (scope.kind === 'tag' && data.total < MIN_POSTS_FOR_INDEXED_TAG)

  return {
    title,
    description,
    alternates: {
      // Self-canonical on every page, including page 2+ (not page 1).
      canonical: localePath(locale, path),
      // The blog index exists in every language; a category, a tag or a later
      // page is per-language content with no equivalent to point at.
      ...(scope.kind === 'all' && page === 1 ? { languages: languageAlternates('/blog') } : {}),
    },
    openGraph: { title, description, url: localeUrl(locale, path), type: 'website' },
    robots: thin ? { index: false, follow: true } : { index: true, follow: true },
  }
}

export async function BlogListPage({
  lang,
  scope,
  page,
}: {
  lang: string
  scope: ListScope
  page: number
}) {
  const locale = resolveLocale(lang)
  const t = await blogTranslator(locale)
  const result = await fetchBlogList({
    locale,
    page,
    category: scope.kind === 'category' ? scope.slug : undefined,
    tag: scope.kind === 'tag' ? scope.slug : undefined,
  })
  if (result.kind === 'not-found') notFound()

  const prefix = `/${locale}`
  const base = listBasePath(scope)

  if (result.kind === 'unconfigured') {
    return (
      <BlogChrome locale={locale} t={t}>
        <main className="mx-auto w-full max-w-3xl px-4 py-16 text-center sm:px-6">
          <h1 className="mb-3 text-2xl font-extrabold text-[hsl(var(--fg-primary))]">
            {t('blog.title')}
          </h1>
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('blog.unavailable')}</p>
        </main>
      </BlogChrome>
    )
  }

  const data = result.data
  const pages = Math.max(1, Math.ceil(data.total / BLOG_PAGE_SIZE))
  // A page past the end is not an empty page — it does not exist.
  if (page > pages) notFound()

  const breadcrumb: Array<{ name: string; href: string | null }> = [
    { name: t('blog.breadcrumbHome'), href: prefix },
  ]
  if (scope.kind === 'all') {
    breadcrumb.push({ name: t('blog.title'), href: page > 1 ? `${prefix}/blog` : null })
  } else {
    breadcrumb.push({ name: t('blog.title'), href: `${prefix}/blog` })
    breadcrumb.push({ name: heading(t, scope, data), href: page > 1 ? `${prefix}${base}` : null })
  }

  return (
    <BlogChrome locale={locale} t={t}>
      <BlogListView
        locale={locale}
        heading={heading(t, scope, data)}
        intro={
          scope.kind === 'category'
            ? (data.category?.description ?? null)
            : scope.kind === 'all'
              ? t('blog.intro')
              : null
        }
        posts={data.posts}
        page={page}
        pages={pages}
        basePath={`${prefix}${base}`}
        labelsFor={cardLabels(locale, t)}
        breadcrumb={breadcrumb}
        labels={{
          breadcrumbLabel: t('blog.breadcrumbLabel'),
          empty: t('blog.empty'),
          paginationLabel: t('blog.pagination.label'),
          previous: t('blog.pagination.previous'),
          next: t('blog.pagination.next'),
          status: t('blog.pagination.status', {
            page: blogNumber(page, locale),
            pages: blogNumber(pages, locale),
          }),
        }}
      />
    </BlogChrome>
  )
}

/** Header + page + the marketing footer, all server-rendered. */
export function BlogChrome({
  locale,
  t,
  children,
}: {
  locale: Locale
  t: Translate
  children: React.ReactNode
}) {
  const footerT = (key: string, fallback?: string) => {
    const value = t(key)
    return value === key ? (fallback ?? key) : value
  }
  return (
    <div className="flex min-h-screen flex-col bg-[hsl(var(--surface-base))]">
      <BlogHeader
        locale={locale}
        labels={{
          brand: t('app.name'),
          blog: t('blog.nav.blog'),
          docs: t('blog.nav.docs'),
          signIn: t('auth.signIn'),
          signUp: t('landing.cta'),
          dashboard: t('landing.navDashboard'),
        }}
      />
      <div className="flex-1">{children}</div>
      {/* Server-rendered: the year is fixed when the page is built or
          revalidated, and this markup is never hydrated. */}
      <SiteFooterView t={footerT} localePrefix={locale} year={new Date().getFullYear()} />
    </div>
  )
}
