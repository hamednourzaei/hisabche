// apps/web/lib/blog-api.ts
//
// The blog's data, fetched ON THE SERVER for the blog's server components and
// the sitemap. Every response is cached under the `blog` tag and refreshed
// hourly, or at once when the backend calls /api/revalidate after an admin
// change (backend/src/services/blog/blog.revalidate.ts).
//
// ⚠️ ERROR AND EMPTY ARE DIFFERENT ANSWERS (راهنمای سشن §۷٫۳).
//   ok            the data
//   not-found     404 — the page calls notFound()
//   unconfigured  503 — the migration has not been run; the page says so and
//                 is noindex. Explicit, never presented as «no articles».
//   anything else (network, 5xx) THROWS — the render fails and nothing is
//                 cached, so ISR keeps serving the last good page.
import type { BlogListResponse, BlogPostPublic, BlogSitemapResponse } from '@hisabche/api'

const API_BASE = (
  process.env.BLOG_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://api.hisabche.com/api'
)
  .trim()
  .replace(/\/+$/, '')

/** One hour — the same window a scheduled post waits at most. */
export const BLOG_REVALIDATE_SECONDS = 3600

export type BlogResult<T> =
  { kind: 'ok'; data: T } | { kind: 'not-found' } | { kind: 'unconfigured' }

export class BlogUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BlogUnavailableError'
  }
}

async function getJson<T>(path: string): Promise<BlogResult<T>> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { accept: 'application/json' },
      next: { revalidate: BLOG_REVALIDATE_SECONDS, tags: ['blog'] },
      signal: AbortSignal.timeout(10_000),
    })
  } catch (error) {
    throw new BlogUnavailableError(`blog API unreachable (${path}): ${String(error)}`)
  }
  if (response.status === 404) return { kind: 'not-found' }
  if (response.status === 503) return { kind: 'unconfigured' }
  if (!response.ok) throw new BlogUnavailableError(`blog API answered ${response.status} (${path})`)
  return { kind: 'ok', data: (await response.json()) as T }
}

export const BLOG_PAGE_SIZE = 12

export function fetchBlogList(input: {
  locale: string
  page: number
  category?: string | undefined
  tag?: string | undefined
}): Promise<BlogResult<BlogListResponse>> {
  const query = new URLSearchParams({
    locale: input.locale,
    page: String(input.page),
    pageSize: String(BLOG_PAGE_SIZE),
  })
  if (input.category) query.set('category', input.category)
  if (input.tag) query.set('tag', input.tag)
  return getJson<BlogListResponse>(`/blog/posts?${query.toString()}`)
}

export function fetchBlogPost(locale: string, slug: string): Promise<BlogResult<BlogPostPublic>> {
  return getJson<BlogPostPublic>(`/blog/posts/${locale}/${encodeURIComponent(slug)}`)
}

export function fetchBlogSitemap(): Promise<BlogResult<BlogSitemapResponse>> {
  return getJson<BlogSitemapResponse>('/blog/sitemap')
}
