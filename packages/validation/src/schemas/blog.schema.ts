// ============================================
// Blog — the one vocabulary shared by the backend, the admin editor and the web.
//
// The editor's font and size menus and the server's HTML sanitiser read the
// SAME lists below: a value the editor can produce is exactly a value the
// sanitiser keeps. Two lists would drift, and the drift would show up as
// formatting that looks right in the editor and silently vanishes on publish.
// ============================================

import { z } from 'zod'

export const BLOG_LOCALES = ['fa', 'af', 'en'] as const
export type BlogLocale = (typeof BLOG_LOCALES)[number]

export const BLOG_POST_STATUSES = ['draft', 'scheduled', 'published'] as const
export type BlogPostStatus = (typeof BLOG_POST_STATUSES)[number]

export const BLOG_COMMENT_STATUSES = ['pending', 'approved', 'rejected', 'spam'] as const
export type BlogCommentStatus = (typeof BLOG_COMMENT_STATUSES)[number]

/**
 * The project's fonts only (apps/web layout: Vazirmatn as `--font-sans`), plus
 * a monospace for code. Keys are what the editor shows; values are the CSS the
 * sanitiser allows. No free-form font family, no colour.
 */
export const BLOG_FONT_FAMILIES = {
  sans: 'var(--font-sans)',
  mono: 'ui-monospace, monospace',
} as const
export type BlogFontFamilyKey = keyof typeof BLOG_FONT_FAMILIES

/** A fixed type scale. Anything else is removed by the sanitiser. */
export const BLOG_FONT_SIZES = ['0.875rem', '1rem', '1.125rem', '1.25rem', '1.5rem'] as const

/**
 * First path segment (after the locale) of public pages a post may link to
 * WITHOUT `rel="nofollow"`. Anything else under the site — the app itself,
 * login, signup — is private and gets nofollow (CLAUDE.md §8).
 */
export const BLOG_FOLLOWED_SECTIONS = [
  '',
  'blog',
  'features',
  'docs',
  'about',
  'contact',
  'legal',
] as const

/**
 * Latin lowercase, digits and Persian letters, joined by single hyphens.
 * Stable, readable, and no characters that need escaping in a path segment
 * other than the Persian letters themselves.
 */
export const BLOG_SLUG_PATTERN = /^[a-z0-9؀-ۿ]+(?:-[a-z0-9؀-ۿ]+)*$/

/**
 * Slugs that would collide with a route: `/api/blog/posts/:id/comments` (and
 * `me`, `view`, `reaction`, `rating`) on the API, `/blog/category/…`,
 * `/blog/tag/…` and `/blog/page/N` on the web. A post or taxonomy may not take these names.
 */
export const BLOG_RESERVED_SLUGS = [
  'comments',
  'me',
  'view',
  'reaction',
  'rating',
  'category',
  'tag',
  'page',
] as const

export const blogLocaleSchema = z.enum(BLOG_LOCALES)
export const blogSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(BLOG_SLUG_PATTERN, 'blog.errors.slug')
  .refine(
    (v) => !(BLOG_RESERVED_SLUGS as readonly string[]).includes(v),
    'blog.errors.slugReserved',
  )

export const blogFaqItemSchema = z.object({
  q: z.string().trim().min(3).max(300),
  a: z.string().trim().min(3).max(2000),
})
export type BlogFaqItem = z.infer<typeof blogFaqItemSchema>

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null))

const httpsUrl = z
  .string()
  .trim()
  .url()
  .refine((v) => v.startsWith('https://'), 'blog.errors.https')

/**
 * What the admin sends to create or update a post. `contentHtml` is the
 * editor's HTML; the server sanitises it and never stores it as sent.
 */
export const blogPostInputSchema = z
  .object({
    locale: blogLocaleSchema,
    slug: blogSlugSchema,
    title: z.string().trim().min(1).max(200),
    excerpt: optionalText(500),
    contentJson: z.record(z.unknown()),
    contentHtml: z.string().max(500_000),
    faq: z.array(blogFaqItemSchema).max(20).default([]),
    coverUrl: httpsUrl
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    coverAlt: optionalText(200),
    metaTitle: optionalText(120),
    metaDescription: optionalText(320),
    focusKeyword: optionalText(120),
    keywords: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
    canonicalUrl: httpsUrl
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    ogImageUrl: httpsUrl
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    noindex: z.boolean().default(false),
    status: z.enum(BLOG_POST_STATUSES).default('draft'),
    /** ISO timestamp. Required for 'scheduled'; defaults to now for 'published'. */
    publishedAt: z.string().datetime({ offset: true }).nullable().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    tagIds: z.array(z.string().uuid()).max(20).default([]),
    /** Link this post to the translations of another post (hreflang). */
    translationGroupId: z.string().uuid().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.coverUrl && !value.coverAlt) {
      ctx.addIssue({ code: 'custom', path: ['coverAlt'], message: 'blog.errors.coverAlt' })
    }
    if (value.status === 'scheduled' && !value.publishedAt) {
      ctx.addIssue({ code: 'custom', path: ['publishedAt'], message: 'blog.errors.scheduleDate' })
    }
  })
export type BlogPostInput = z.infer<typeof blogPostInputSchema>

export const blogCommentInputSchema = z.object({
  body: z.string().trim().min(2).max(2000),
  parentId: z.string().uuid().nullable().optional(),
  /**
   * Honeypot. Hidden from people with CSS and `aria-hidden`; a bot that fills
   * every field fills this one. Anything in it and the comment is dropped.
   */
  website: z.string().max(200).optional(),
})
export type BlogCommentInput = z.infer<typeof blogCommentInputSchema>

/** 1 like, -1 dislike, 0 = take my reaction back. */
export const blogReactionSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
})
export const blogRatingSchema = z.object({ stars: z.number().int().min(1).max(5) })

export const blogTaxonomyInputSchema = z.object({
  locale: blogLocaleSchema,
  slug: blogSlugSchema,
  name: z.string().trim().min(1).max(120),
  description: optionalText(500),
})
export type BlogTaxonomyInput = z.infer<typeof blogTaxonomyInputSchema>

export const BLOG_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const
/** Same limit as the `blog-images` bucket (docs/blog-migration.sql). */
export const BLOG_IMAGE_MAX_BYTES = 2 * 1024 * 1024

export const blogImageUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(BLOG_IMAGE_MIME_TYPES),
  contentBase64: z
    .string()
    .min(1)
    .max(Math.ceil((BLOG_IMAGE_MAX_BYTES * 4) / 3) + 8),
})

export const blogCommentModerationSchema = z.object({
  status: z.enum(['approved', 'rejected', 'spam']),
})

// ─── claims the product does not make ───────────────────────────────────────
//
// ONE list for the landing (landing-claims.test.ts) and the blog (checked on
// every save, shown to the author). Each entry is a capability that does not
// exist in this codebase, or a number nobody measures
// (.claude/POSITIONING-2026-09-15.md «NOT implemented — never claim»).
//
// For an article this is a WARNING, not a refusal: «what is two-factor login»
// is a legitimate topic. What it must not say is that Hisabche has it — the
// author reads the warning and checks the sentence.
/** Capabilities that do not exist anywhere in backend/ or apps/. */
export const CAPABILITIES_NOT_IN_PRODUCT = [
  'دو مرحله',
  'two-factor',
  '2FA',
  'وب‌هوک',
  'webhook',
  'بازیابی ۳۰ روزه',
  'کلیدش',
  'سامانه مودیان',
] as const

/** Numbers about users nobody counts (no counter, no rating source). */
export const UNSOURCED_METRICS = ['کسب‌وکار فعال', 'تراکنش روزانه', 'رضایت کاربران'] as const

export const CLAIMS_NOT_IN_PRODUCT = [...CAPABILITIES_NOT_IN_PRODUCT, ...UNSOURCED_METRICS] as const

/** The listed claims that appear in `text` (case-insensitive, ZWNJ-tolerant). */
export function claimsNotInProduct(text: string): string[] {
  const haystack = normalizeForMatch(text)
  return CLAIMS_NOT_IN_PRODUCT.filter((claim) => haystack.includes(normalizeForMatch(claim)))
}

// ─── SEO checklist ──────────────────────────────────────────────────────────
//
// GUIDANCE ONLY. It never blocks saving or publishing — an article that breaks
// a rule of thumb for a good reason is still the author's call.

export interface SeoChecklistInput {
  title: string
  metaTitle: string | null
  metaDescription: string | null
  focusKeyword: string | null
  /** The editor's HTML (unsanitised is fine: this only reads text and tags). */
  html: string
  locale: BlogLocale
}

export type SeoCheckId =
  | 'keywordInTitle'
  | 'keywordInFirstParagraph'
  | 'keywordInHeading'
  | 'length'
  | 'imageAlt'
  | 'internalLinks'
  | 'metaTitleLength'
  | 'metaDescriptionLength'
  | 'readability'

export interface SeoCheck {
  id: SeoCheckId
  pass: boolean
  /** The measured value the check used, for the panel to show. */
  value: number | null
}

export const SEO_MIN_WORDS = 600
export const SEO_MIN_INTERNAL_LINKS = 3
export const SEO_META_TITLE = { min: 30, max: 60 } as const
export const SEO_META_DESCRIPTION = { min: 70, max: 160 } as const
/** Average words per sentence above which a paragraph reads as heavy. */
export const SEO_MAX_AVG_SENTENCE_WORDS = 25

/** Persian/Arabic letter variants and the zero-width non-joiner, normalised. */
export function normalizeForMatch(text: string): string {
  return text
    .replace(/‌/g, ' ')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function countWords(text: string): number {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

export function seoChecklist(input: SeoChecklistInput): SeoCheck[] {
  const keyword = input.focusKeyword ? normalizeForMatch(input.focusKeyword) : ''
  const has = (text: string) => keyword !== '' && normalizeForMatch(text).includes(keyword)

  const text = htmlToText(input.html)
  const words = countWords(text)
  const firstParagraph = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(input.html)?.[1] ?? ''
  const headings = [...input.html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)].map((m) =>
    htmlToText(m[1] ?? ''),
  )
  const images = [...input.html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0])
  const imagesWithoutAlt = images.filter((tag) => !/\balt\s*=\s*"[^"]*\S[^"]*"/i.test(tag)).length
  const internalLinks = [...input.html.matchAll(/<a\b[^>]*href\s*=\s*"([^"]+)"/gi)].filter((m) =>
    isInternalHref(m[1] ?? ''),
  ).length
  const metaTitle = (input.metaTitle ?? input.title).trim()
  const metaDescription = (input.metaDescription ?? '').trim()
  const sentences = text.split(/[.!?؟。]+/).filter((s) => s.trim().length > 0)
  const avgSentence = sentences.length ? Math.round(words / sentences.length) : 0

  return [
    { id: 'keywordInTitle', pass: has(input.title), value: null },
    { id: 'keywordInFirstParagraph', pass: has(htmlToText(firstParagraph)), value: null },
    { id: 'keywordInHeading', pass: headings.some(has), value: null },
    { id: 'length', pass: words >= SEO_MIN_WORDS, value: words },
    { id: 'imageAlt', pass: imagesWithoutAlt === 0, value: imagesWithoutAlt },
    { id: 'internalLinks', pass: internalLinks >= SEO_MIN_INTERNAL_LINKS, value: internalLinks },
    {
      id: 'metaTitleLength',
      pass: metaTitle.length >= SEO_META_TITLE.min && metaTitle.length <= SEO_META_TITLE.max,
      value: metaTitle.length,
    },
    {
      id: 'metaDescriptionLength',
      pass:
        metaDescription.length >= SEO_META_DESCRIPTION.min &&
        metaDescription.length <= SEO_META_DESCRIPTION.max,
      value: metaDescription.length,
    },
    {
      id: 'readability',
      pass: words > 0 && avgSentence <= SEO_MAX_AVG_SENTENCE_WORDS,
      value: avgSentence,
    },
  ]
}

/** A root-relative path, or an absolute URL on the public site. */
export function isInternalHref(href: string): boolean {
  if (href.startsWith('/') && !href.startsWith('//')) return true
  return /^https:\/\/(www\.)?hisabche\.com(\/|$)/i.test(href)
}
