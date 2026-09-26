// packages/ui/src/components/ui/blog/blog-article-view.tsx — server component.
//
// One article. Everything a crawler needs is in this HTML: the title, the
// body, the outline, the questions and answers, the rating that the JSON-LD
// declares, and every internal link. Only the interaction below the article is
// a client island (BlogPostActions).
//
// `post.contentHtml` was sanitised by the backend on save (allowlist, see
// backend/src/services/blog/blog.sanitize.ts) — it is the only HTML rendered
// raw here.
import Image from 'next/image'
import Link from 'next/link'
import type { BlogPostPublic, BlogPostSummary } from '@hisabche/api'

import { BlogPostActions } from './blog-post-actions'
import { BlogPostCard } from './blog-post-card'

export interface BlogArticleViewProps {
  post: BlogPostPublic
  locale: string
  labels: {
    breadcrumbHome: string
    blog: string
    breadcrumbLabel: string
    published: string
    updated: string | null
    reading: string
    author: string | null
    toc: string
    faq: string
    tags: string
    related: string
    ratingSummary: string | null
    ctaTitle: string
    ctaBody: string
    ctaFeatures: string
    ctaSignup: string
  }
  relatedLabels: (post: BlogPostSummary) => { date: string; reading: string }
}

export function BlogArticleView({ post, locale, labels, relatedLabels }: BlogArticleViewProps) {
  const prefix = `/${locale}`
  const dir = locale === 'en' ? 'ltr' : 'rtl'

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <nav
        aria-label={labels.breadcrumbLabel}
        className="mb-4 text-xs text-[hsl(var(--fg-tertiary))]"
      >
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href={prefix} prefetch={false} className="hover:text-[hsl(var(--fg-primary))]">
              {labels.breadcrumbHome}
            </Link>
          </li>
          <li className="flex items-center gap-1">
            <span aria-hidden="true">›</span>
            <Link
              href={`${prefix}/blog`}
              prefetch={false}
              className="hover:text-[hsl(var(--fg-primary))]"
            >
              {labels.blog}
            </Link>
          </li>
          {post.category ? (
            <li className="flex items-center gap-1">
              <span aria-hidden="true">›</span>
              <Link
                href={`${prefix}/blog/category/${encodeURIComponent(post.category.slug)}`}
                prefetch={false}
                className="hover:text-[hsl(var(--fg-primary))]"
              >
                {post.category.name}
              </Link>
            </li>
          ) : null}
        </ol>
      </nav>

      <article>
        <header className="mb-6">
          <h1 className="text-2xl font-extrabold leading-tight text-[hsl(var(--fg-primary))] sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[hsl(var(--fg-tertiary))] sm:text-sm">
            {labels.author ? <span>{labels.author}</span> : null}
            {labels.author ? <span aria-hidden="true">·</span> : null}
            <time dateTime={post.publishedAt ?? undefined}>{labels.published}</time>
            {labels.updated ? (
              <>
                <span aria-hidden="true">·</span>
                <time dateTime={post.updatedAt}>{labels.updated}</time>
              </>
            ) : null}
            <span aria-hidden="true">·</span>
            <span>{labels.reading}</span>
          </p>
          {labels.ratingSummary ? (
            <p className="mt-2 text-xs text-[hsl(var(--fg-secondary))]">
              <span aria-hidden="true" className="text-[hsl(var(--color-warning))]">
                ★{' '}
              </span>
              {labels.ratingSummary}
            </p>
          ) : null}
        </header>

        {post.coverUrl && post.coverAlt ? (
          <Image
            src={post.coverUrl}
            alt={post.coverAlt}
            width={1200}
            height={630}
            priority
            sizes="(min-width: 768px) 720px, 100vw"
            className="mb-8 aspect-[1200/630] w-full rounded-[var(--radius-lg)] object-cover"
          />
        ) : null}

        {post.toc.length > 1 ? (
          <nav
            aria-labelledby="blog-toc-title"
            className="mb-8 rounded-[var(--radius-lg)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4"
          >
            <p id="blog-toc-title" className="mb-2 text-sm font-bold text-[hsl(var(--fg-primary))]">
              {labels.toc}
            </p>
            <ol className="space-y-1 text-sm">
              {post.toc.map((entry) => (
                <li key={entry.id} className={entry.level === 3 ? 'ps-4' : undefined}>
                  <a
                    href={`#${entry.id}`}
                    className="text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--color-primary))]"
                  >
                    {entry.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <div
          dir={dir}
          className="blog-prose"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />

        {post.faq.length > 0 ? (
          <section aria-labelledby="blog-faq-title" className="mt-10">
            <h2
              id="blog-faq-title"
              className="mb-4 text-xl font-bold text-[hsl(var(--fg-primary))]"
            >
              {labels.faq}
            </h2>
            <dl className="space-y-4">
              {post.faq.map((item) => (
                <div
                  key={item.q}
                  className="rounded-[var(--radius-lg)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4"
                >
                  <dt className="mb-2 font-semibold text-[hsl(var(--fg-primary))]">{item.q}</dt>
                  <dd className="text-sm leading-relaxed text-[hsl(var(--fg-secondary))]">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {post.tags.length > 0 ? (
          <div className="mt-8 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-[hsl(var(--fg-secondary))]">{labels.tags}:</span>
            {post.tags.map((tag) => (
              <Link
                key={tag.slug}
                href={`${prefix}/blog/tag/${encodeURIComponent(tag.slug)}`}
                prefetch={false}
                className="rounded-full border border-[hsl(var(--border-default))] px-3 py-1 text-xs text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]"
              >
                {tag.name}
              </Link>
            ))}
          </div>
        ) : null}
      </article>

      <BlogPostActions
        postId={post.id}
        locale={locale}
        slug={post.slug}
        initialStats={post.stats}
      />

      <aside className="mt-10 rounded-[var(--radius-lg)] border border-[hsl(var(--color-primary)/0.3)] bg-[hsl(var(--color-primary)/0.08)] p-6 text-center">
        <p className="mb-2 text-lg font-bold text-[hsl(var(--fg-primary))]">{labels.ctaTitle}</p>
        <p className="mb-4 text-sm text-[hsl(var(--fg-secondary))]">{labels.ctaBody}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`${prefix}/features/shop-accounting`}
            prefetch={false}
            className="rounded-full border border-[hsl(var(--border-default))] px-4 py-2 text-sm font-semibold text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))]"
          >
            {labels.ctaFeatures}
          </Link>
          <Link
            href={`${prefix}/signup`}
            prefetch={false}
            rel="nofollow"
            className="btn-primary inline-flex min-h-10 items-center rounded-full px-5 text-sm font-bold"
          >
            {labels.ctaSignup}
          </Link>
        </div>
      </aside>

      {post.related.length > 0 ? (
        <section aria-labelledby="blog-related-title" className="mt-12">
          <h2
            id="blog-related-title"
            className="mb-4 text-xl font-bold text-[hsl(var(--fg-primary))]"
          >
            {labels.related}
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {post.related.map((related) => {
              const l = relatedLabels(related)
              return (
                <BlogPostCard
                  key={related.id}
                  post={related}
                  locale={locale}
                  dateLabel={l.date}
                  readingLabel={l.reading}
                  headingLevel={3}
                />
              )
            })}
          </div>
        </section>
      ) : null}
    </main>
  )
}
