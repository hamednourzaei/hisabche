// packages/ui/src/components/ui/blog/blog-list-view.tsx — server component.
//
// The blog index, a category (pillar) page or a tag page. Pagination is by
// PATH (`…/page/2`) so every page is a static, self-canonical URL.
import Link from 'next/link'
import type { BlogPostSummary } from '@hisabche/api'

import { BlogPostCard } from './blog-post-card'

export interface BlogListViewProps {
  locale: string
  heading: string
  intro: string | null
  posts: BlogPostSummary[]
  page: number
  pages: number
  /** The list's first page, e.g. `/fa/blog` or `/fa/blog/category/invoice`. */
  basePath: string
  /** Formatted by the page: date and reading time per post. */
  labelsFor: (post: BlogPostSummary) => { date: string; reading: string }
  labels: {
    breadcrumbLabel: string
    empty: string
    paginationLabel: string
    previous: string
    next: string
    status: string
  }
  breadcrumb: Array<{ name: string; href: string | null }>
}

export function pageHref(basePath: string, page: number): string {
  return page <= 1 ? basePath : `${basePath}/page/${page}`
}

export function BlogListView({
  heading,
  intro,
  posts,
  page,
  pages,
  basePath,
  labelsFor,
  labels,
  breadcrumb,
  locale,
}: BlogListViewProps) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <nav
        aria-label={labels.breadcrumbLabel}
        className="mb-4 text-xs text-[hsl(var(--fg-tertiary))]"
      >
        <ol className="flex flex-wrap items-center gap-1">
          {breadcrumb.map((item, index) => (
            <li key={`${item.name}-${index}`} className="flex items-center gap-1">
              {index > 0 ? <span aria-hidden="true">›</span> : null}
              {item.href ? (
                <Link
                  href={item.href}
                  prefetch={false}
                  className="hover:text-[hsl(var(--fg-primary))]"
                >
                  {item.name}
                </Link>
              ) : (
                <span aria-current="page">{item.name}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <header className="mb-8 max-w-3xl">
        <h1 className="text-2xl font-extrabold text-[hsl(var(--fg-primary))] sm:text-3xl">
          {heading}
        </h1>
        {intro ? (
          <p className="mt-3 text-sm leading-relaxed text-[hsl(var(--fg-secondary))] sm:text-base">
            {intro}
          </p>
        ) : null}
      </header>

      {posts.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[hsl(var(--border-default))] p-8 text-center text-sm text-[hsl(var(--fg-secondary))]">
          {labels.empty}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => {
            const l = labelsFor(post)
            return (
              <BlogPostCard
                key={post.id}
                post={post}
                locale={locale}
                dateLabel={l.date}
                readingLabel={l.reading}
              />
            )
          })}
        </div>
      )}

      {pages > 1 ? (
        <nav
          aria-label={labels.paginationLabel}
          className="mt-10 flex items-center justify-between gap-3 text-sm"
        >
          {page > 1 ? (
            <Link
              href={pageHref(basePath, page - 1)}
              prefetch={false}
              rel="prev"
              className="rounded-full border border-[hsl(var(--border-default))] px-4 py-2 hover:bg-[hsl(var(--surface-muted))]"
            >
              {labels.previous}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-[hsl(var(--fg-tertiary))]">{labels.status}</span>
          {page < pages ? (
            <Link
              href={pageHref(basePath, page + 1)}
              prefetch={false}
              rel="next"
              className="rounded-full border border-[hsl(var(--border-default))] px-4 py-2 hover:bg-[hsl(var(--surface-muted))]"
            >
              {labels.next}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </main>
  )
}
