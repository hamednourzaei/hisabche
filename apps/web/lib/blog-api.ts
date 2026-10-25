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

/**
 * This file only ever runs on the server (server components + sitemap), so a
 * relative base is never valid: `fetch('/api/…')` throws
 * `TypeError: Failed to parse URL` and turns /blog into a 500. The deployed
 * browser config uses `/api`, so validate and fall back to the absolute API.
 */
function absoluteApiBase(raw: string | undefined, fallback: string): string {
  const value = raw?.trim().replace(/\/+$/, '') ?? ''
  if (!value) return fallback
  try {
    const url = new URL(value)
    if (url.protocol === 'http:' || url.protocol === 'https:') return value
  } catch {
    /* relative or malformed — not usable by a server-side fetch */
  }
  return fallback
}

const API_BASE = absoluteApiBase(
  process.env.BLOG_API_URL || process.env.NEXT_PUBLIC_API_URL,
  'https://api.hisabche.com/api',
)

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
  // ISR means one slow upstream must not turn a public page into a 500. Retry a
  // network error or a timeout once; a real 4xx/5xx answer is still handled as
  // an error below and never rendered as "no articles".
  const attempt = () =>
    fetch(`${API_BASE}${path}`, {
      headers: { accept: 'application/json' },
      next: { revalidate: BLOG_REVALIDATE_SECONDS, tags: ['blog'] },
      signal: AbortSignal.timeout(12_000),
    })
  let response: Response
  try {
    response = await attempt()
  } catch {
    try {
      response = await attempt()
    } catch (error) {
      throw new BlogUnavailableError(`blog API unreachable (${path}): ${String(error)}`)
    }
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
