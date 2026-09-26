// ============================================
// backend/src/services/blog/blog.domain.ts
//
// Pure rules of the blog: publication, reading time, the table of contents,
// link attributes, and the error vocabulary. No database, no clock of its own —
// `now` is always passed in.
// ============================================

import {
  BLOG_FOLLOWED_SECTIONS,
  BLOG_LOCALES,
  countWords,
  htmlToText,
  isInternalHref,
  type BlogLocale,
  type BlogPostStatus,
} from '@hisabche/validation'

import { BaseError } from '../../errors/base.error'

export type BlogErrorCode =
  | 'BLOG_MIGRATION_PENDING'
  | 'BLOG_POST_NOT_FOUND'
  | 'BLOG_SLUG_TAKEN'
  | 'BLOG_TRANSLATION_TAKEN'
  | 'BLOG_CONTENT_INVALID'
  | 'BLOG_COMMENT_NOT_FOUND'
  | 'BLOG_COMMENT_REPLY_INVALID'
  | 'BLOG_TAXONOMY_TAKEN'
  | 'BLOG_TAXONOMY_NOT_FOUND'
  | 'BLOG_IMAGE_INVALID'

const STATUS: Record<BlogErrorCode, number> = {
  // The code shipped before a human ran docs/blog-migration.sql.
  BLOG_MIGRATION_PENDING: 503,
  BLOG_POST_NOT_FOUND: 404,
  BLOG_SLUG_TAKEN: 409,
  BLOG_TRANSLATION_TAKEN: 409,
  BLOG_CONTENT_INVALID: 400,
  BLOG_COMMENT_NOT_FOUND: 404,
  BLOG_COMMENT_REPLY_INVALID: 400,
  BLOG_TAXONOMY_TAKEN: 409,
  BLOG_TAXONOMY_NOT_FOUND: 404,
  BLOG_IMAGE_INVALID: 400,
}

export class BlogError extends BaseError {
  constructor(
    readonly code: BlogErrorCode,
    /** Field-level reasons (e.g. which image has no alt), for the admin form. */
    readonly details: Array<{ path: string; message: string }> = [],
  ) {
    super(code, STATUS[code])
    this.name = 'BlogError'
  }
}

/** PostgREST/Postgres codes for «the migration has not been run yet». */
export function isMissingSchema(error: { code?: string } | null | undefined): boolean {
  return ['42703', '42P01', '42883', 'PGRST202', 'PGRST204', 'PGRST205'].includes(error?.code ?? '')
}

export function isBlogLocale(value: string): value is BlogLocale {
  return (BLOG_LOCALES as readonly string[]).includes(value)
}

// ─── publication ────────────────────────────────────────────────────────────

/**
 * What to store for a requested status. A «published» post with a date in the
 * future is really a scheduled one; a «scheduled» post whose date has passed
 * is published. A draft keeps whatever date it had (history), and is never
 * public regardless.
 */
export function resolvePublication(
  requested: BlogPostStatus,
  requestedAt: string | null | undefined,
  now: Date,
  previousPublishedAt: string | null = null,
): { status: BlogPostStatus; publishedAt: string | null } {
  if (requested === 'draft') return { status: 'draft', publishedAt: previousPublishedAt }

  const at = requestedAt ? new Date(requestedAt) : null
  if (requested === 'published') {
    if (!at) return { status: 'published', publishedAt: previousPublishedAt ?? now.toISOString() }
    return at.getTime() > now.getTime()
      ? { status: 'scheduled', publishedAt: at.toISOString() }
      : { status: 'published', publishedAt: at.toISOString() }
  }
  // scheduled — the schema already refused a missing date.
  const when = at ?? now
  return when.getTime() > now.getTime()
    ? { status: 'scheduled', publishedAt: when.toISOString() }
    : { status: 'published', publishedAt: when.toISOString() }
}

/** Same predicate as `blog_post_is_public()` in the migration. */
export function isPubliclyVisible(status: string, publishedAt: string | null, now: Date): boolean {
  if (!publishedAt) return false
  if (status !== 'published' && status !== 'scheduled') return false
  return new Date(publishedAt).getTime() <= now.getTime()
}

// ─── reading time and excerpt ───────────────────────────────────────────────

/** 200 words a minute — an ordinary reading pace in all three languages. */
export function readingMinutes(html: string): number {
  return Math.max(1, Math.ceil(countWords(htmlToText(html)) / 200))
}

/** The stored excerpt, or the first ~160 characters of the article text. */
export function excerptOf(excerpt: string | null, html: string, max = 160): string {
  if (excerpt && excerpt.trim()) return excerpt.trim()
  const text = htmlToText(html)
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

// ─── headings and table of contents ─────────────────────────────────────────

export interface TocEntry {
  id: string
  text: string
  level: 2 | 3
}

/** A URL-fragment id from heading text; Persian letters are kept. */
export function headingSlug(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/‌/g, '-')
    .replace(/[^a-z0-9؀-ۿ]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return slug || 'section'
}

/**
 * Give every h2/h3/h4 a unique id (replacing any that came in — an id from the
 * editor could clobber a DOM name) and return the h2/h3 outline.
 */
export function withHeadingIds(html: string): { html: string; toc: TocEntry[] } {
  const used = new Map<string, number>()
  const toc: TocEntry[] = []
  const out = html.replace(
    /<h([234])((?:\s[^>]*)?)>([\s\S]*?)<\/h\1>/gi,
    (_match, level: string, attrs: string, inner: string) => {
      const text = htmlToText(inner)
      const base = headingSlug(text)
      const seen = used.get(base) ?? 0
      used.set(base, seen + 1)
      const id = seen === 0 ? base : `${base}-${seen + 1}`
      const cleanAttrs = attrs.replace(/\sid\s*=\s*"[^"]*"/gi, '')
      if (level === '2' || level === '3') toc.push({ id, text, level: Number(level) as 2 | 3 })
      return `<h${level} id="${id}"${cleanAttrs}>${inner}</h${level}>`
    },
  )
  return { html: out, toc }
}

/** The outline of already-stored HTML (ids were assigned when it was saved). */
export function tocOf(html: string): TocEntry[] {
  return [...html.matchAll(/<h([23])\s[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({
    id: m[2]!,
    text: htmlToText(m[3] ?? ''),
    level: Number(m[1]) as 2 | 3,
  }))
}

// ─── links ──────────────────────────────────────────────────────────────────

export interface LinkDecision {
  href: string
  rel: string | null
  target: string | null
  /** The locale prefix was missing and has been added (reported to the admin). */
  localeAdded: boolean
}

/**
 * Attributes for a link inside an article.
 *
 * - Internal paths always carry a locale prefix; a bare `/features/x` would be
 *   a 307 whose target is chosen by the reader's Accept-Language.
 * - A public section (home, blog, features, docs, about, contact, legal) is
 *   followed; the app itself, login and signup are `nofollow` (CLAUDE.md §8).
 * - External links open in a new tab with `noopener noreferrer`; they are
 *   followed, because citing an official source is the point.
 */
export function linkDecision(rawHref: string, locale: BlogLocale): LinkDecision {
  const href = rawHref.trim()
  if (!isInternalHref(href)) {
    const external = /^https?:\/\//i.test(href)
    return {
      href,
      rel: external ? 'noopener noreferrer' : null,
      target: external ? '_blank' : null,
      localeAdded: false,
    }
  }

  const url = new URL(href, 'https://hisabche.com')
  const segments = url.pathname.split('/').filter(Boolean)
  let localeAdded = false
  if (!segments[0] || !isBlogLocale(segments[0])) {
    segments.unshift(locale)
    localeAdded = true
  }
  const section = segments[1] ?? ''
  const followed = (BLOG_FOLLOWED_SECTIONS as readonly string[]).includes(section)
  const path = `/${segments.join('/')}${url.search}${url.hash}`
  const absolute = /^https:\/\//i.test(href)
  return {
    href: absolute ? `${url.origin}${path}` : path,
    rel: followed ? null : 'nofollow',
    target: null,
    localeAdded,
  }
}

// ─── comments ───────────────────────────────────────────────────────────────

/** The honeypot field: a person never sees it, a form-filling bot does. */
export function isHoneypotTripped(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

// ─── statistics ─────────────────────────────────────────────────────────────

export interface PostStats {
  likes: number
  dislikes: number
  ratingCount: number
  /** null when nobody has rated — never 0, which would read as «one star». */
  ratingAvg: number | null
  comments: number
  pendingComments: number
  views: number
}

export const EMPTY_STATS: PostStats = {
  likes: 0,
  dislikes: 0,
  ratingCount: 0,
  ratingAvg: null,
  comments: 0,
  pendingComments: 0,
  views: 0,
}

/** `blog_post_stats()` returns bigint and numeric as strings. */
export function statsFromRow(row: Record<string, unknown>): PostStats {
  const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v))
  return {
    likes: n(row.likes),
    dislikes: n(row.dislikes),
    ratingCount: n(row.rating_count),
    ratingAvg:
      row.rating_avg === null || row.rating_avg === undefined ? null : Number(row.rating_avg),
    comments: n(row.approved_comments),
    pendingComments: n(row.pending_comments),
    views: n(row.views),
  }
}

// ─── images ─────────────────────────────────────────────────────────────────

/**
 * The file's own first bytes, not the name or the type the browser claimed.
 * A file whose bytes are not the image type it says it is, is refused.
 */
export function sniffImageType(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'image/jpeg'
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'image/png'
  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'image/webp'
  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 4, 8) === 'ftyp' &&
    /^avi[fs]$/.test(bytes.toString('ascii', 8, 12))
  )
    return 'image/avif'
  return null
}

export const IMAGE_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}
