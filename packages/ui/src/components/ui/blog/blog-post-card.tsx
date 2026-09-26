// packages/ui/src/components/ui/blog/blog-post-card.tsx — server component.
import Image from 'next/image'
import Link from 'next/link'
import type { BlogPostSummary } from '@hisabche/api'

export interface BlogPostCardProps {
  post: BlogPostSummary
  locale: string
  /** Already formatted by the page, in the reader's calendar. */
  dateLabel: string
  readingLabel: string
  /** h2 on a list page, h3 under «related articles». */
  headingLevel?: 2 | 3
}

export function BlogPostCard({
  post,
  locale,
  dateLabel,
  readingLabel,
  headingLevel = 2,
}: BlogPostCardProps) {
  const href = `/${locale}/blog/${encodeURIComponent(post.slug)}`
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <article className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] transition-shadow motion-reduce:transition-none hover:shadow-md">
      {post.coverUrl && post.coverAlt ? (
        <Link href={href} prefetch={false} tabIndex={-1} aria-hidden="true">
          <Image
            src={post.coverUrl}
            alt=""
            width={1200}
            height={630}
            sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
            className="aspect-[1200/630] w-full object-cover"
          />
        </Link>
      ) : null}
      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        {post.category ? (
          <Link
            href={`/${locale}/blog/category/${encodeURIComponent(post.category.slug)}`}
            prefetch={false}
            className="w-fit text-xs font-semibold text-[hsl(var(--color-primary))] hover:underline"
          >
            {post.category.name}
          </Link>
        ) : null}
        <Heading className="text-lg font-bold leading-snug text-[hsl(var(--fg-primary))]">
          <Link href={href} prefetch={false} className="hover:underline">
            {post.title}
          </Link>
        </Heading>
        <p className="line-clamp-3 text-sm leading-relaxed text-[hsl(var(--fg-secondary))]">
          {post.excerpt}
        </p>
        <p className="mt-auto pt-2 text-xs text-[hsl(var(--fg-tertiary))]">
          {dateLabel ? <time dateTime={post.publishedAt ?? undefined}>{dateLabel}</time> : null}
          {dateLabel ? <span aria-hidden="true"> · </span> : null}
          <span>{readingLabel}</span>
        </p>
      </div>
    </article>
  )
}
