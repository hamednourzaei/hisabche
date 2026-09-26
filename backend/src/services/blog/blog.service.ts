// ============================================
// backend/src/services/blog/blog.service.ts
//
// Orchestration of the Blog Core: rules from blog.domain, HTML from
// blog.sanitize, storage from blog.repository. No formula lives here.
//
// ⚠️ PERSON-SCOPED, NOT WORKSPACE-SCOPED. The blog is platform content; a
// comment, a like and a rating belong to the PERSON who made them. `userId`
// here is always the verified token's user (routes pass `request.user.id`),
// never a value from the request body.
// ============================================

import {
  BLOG_IMAGE_MAX_BYTES,
  type BlogCommentInput,
  type BlogCommentStatus,
  type BlogLocale,
  type BlogPostInput,
  type BlogPostStatus,
  type BlogTaxonomyInput,
} from '@hisabche/validation'

import {
  BlogError,
  EMPTY_STATS,
  IMAGE_EXTENSION,
  excerptOf,
  isHoneypotTripped,
  readingMinutes,
  resolvePublication,
  sniffImageType,
  tocOf,
  type PostStats,
  type TocEntry,
} from './blog.domain'
import {
  BlogRepository,
  type CommentRow,
  type FullPostRow,
  type PostRow,
  type TaxonomyRow,
} from './blog.repository'
import { revalidateBlogPages, type RevalidateOutcome } from './blog.revalidate'
import { sanitizeArticleHtml } from './blog.sanitize'

export interface BlogTaxonomyRef {
  slug: string
  name: string
}

export interface BlogPostSummary {
  id: string
  locale: BlogLocale
  slug: string
  title: string
  excerpt: string
  coverUrl: string | null
  coverAlt: string | null
  publishedAt: string | null
  updatedAt: string
  readingMinutes: number
  category: BlogTaxonomyRef | null
  tags: BlogTaxonomyRef[]
}

export interface PublicStats {
  likes: number
  dislikes: number
  ratingCount: number
  ratingAvg: number | null
  comments: number
}

export interface BlogPostPublic extends BlogPostSummary {
  contentHtml: string
  toc: TocEntry[]
  faq: Array<{ q: string; a: string }>
  metaTitle: string | null
  metaDescription: string | null
  focusKeyword: string | null
  keywords: string[]
  canonicalUrl: string | null
  ogImageUrl: string | null
  noindex: boolean
  /** From the author's real profile; null when there is no name to show. */
  author: { name: string } | null
  translations: Array<{ locale: BlogLocale; slug: string }>
  related: BlogPostSummary[]
  stats: PublicStats
}

export interface BlogComment {
  id: string
  parentId: string | null
  body: string
  createdAt: string
  status: BlogCommentStatus
  /** null when the commenter has no profile name — shown as a generic label. */
  authorName: string | null
}

export interface AdminPostSummary extends BlogPostSummary {
  status: BlogPostStatus
  noindex: boolean
  translationGroupId: string
  stats: PostStats
}

export interface AdminPost extends AdminPostSummary {
  contentJson: Record<string, unknown>
  contentHtml: string
  faq: Array<{ q: string; a: string }>
  metaTitle: string | null
  metaDescription: string | null
  focusKeyword: string | null
  keywords: string[]
  canonicalUrl: string | null
  ogImageUrl: string | null
  categoryId: string | null
  tagIds: string[]
  authorName: string | null
  translations: Array<{
    id: string
    locale: BlogLocale
    slug: string
    title: string
    status: BlogPostStatus
  }>
}

export interface SaveResult {
  post: AdminPost
  warnings: Array<{ path: string; message: string }>
  revalidated: RevalidateOutcome
}

interface Logger {
  warn: (obj: unknown, msg?: string) => void
}

const ref = (row: TaxonomyRow | undefined | null): BlogTaxonomyRef | null =>
  row ? { slug: row.slug, name: row.name } : null

const publicStats = (s: PostStats): PublicStats => ({
  likes: s.likes,
  dislikes: s.dislikes,
  ratingCount: s.ratingCount,
  ratingAvg: s.ratingAvg,
  comments: s.comments,
})

export class BlogService {
  constructor(
    private readonly repo = new BlogRepository(),
    private readonly clock: () => Date = () => new Date(),
  ) {}

  // ─── public ────────────────────────────────────────────────────────────────

  private async summaries(rows: PostRow[]): Promise<BlogPostSummary[]> {
    const ids = rows.map((r) => r.id)
    const [tags, categories] = await Promise.all([
      this.repo.tagsOfPosts(ids),
      this.repo.taxonomyByIds(
        'category',
        rows.map((r) => r.category_id).filter((id): id is string => !!id),
      ),
    ])
    return rows.map((row) => ({
      id: row.id,
      locale: row.locale,
      slug: row.slug,
      title: row.title,
      excerpt: excerptOf(row.excerpt, row.content_html),
      coverUrl: row.cover_url,
      coverAlt: row.cover_alt,
      publishedAt: row.published_at,
      updatedAt: row.updated_at,
      readingMinutes: row.reading_minutes,
      category: row.category_id ? ref(categories.get(row.category_id)) : null,
      tags: (tags.get(row.id) ?? []).map((t) => ({ slug: t.slug, name: t.name })),
    }))
  }

  async listPublic(input: {
    locale: BlogLocale
    category?: string | undefined
    tag?: string | undefined
    page: number
    pageSize: number
  }): Promise<{
    posts: BlogPostSummary[]
    total: number
    page: number
    pageSize: number
    category: (BlogTaxonomyRef & { description: string | null }) | null
    tag: BlogTaxonomyRef | null
  }> {
    const now = this.clock()
    const category = input.category
      ? await this.repo.findTaxonomy('category', input.locale, input.category)
      : null
    if (input.category && !category) throw new BlogError('BLOG_TAXONOMY_NOT_FOUND')
    const tag = input.tag ? await this.repo.findTaxonomy('tag', input.locale, input.tag) : null
    if (input.tag && !tag) throw new BlogError('BLOG_TAXONOMY_NOT_FOUND')

    const postIds = tag ? await this.repo.postIdsWithTag(tag.id) : undefined
    const { rows, total } = await this.repo.listPublic({
      locale: input.locale,
      now,
      categoryId: category?.id,
      postIds,
      offset: (input.page - 1) * input.pageSize,
      limit: input.pageSize,
    })
    return {
      posts: await this.summaries(rows),
      total,
      page: input.page,
      pageSize: input.pageSize,
      category: category
        ? { slug: category.slug, name: category.name, description: category.description ?? null }
        : null,
      tag: ref(tag),
    }
  }

  async getPublic(locale: BlogLocale, slug: string): Promise<BlogPostPublic> {
    const now = this.clock()
    const row = await this.repo.findPublicBySlug(locale, slug, now)
    if (!row) throw new BlogError('BLOG_POST_NOT_FOUND')

    const tagIds = await this.repo.tagIdsOf(row.id)
    const tagPostIds = (await Promise.all(tagIds.map((id) => this.repo.postIdsWithTag(id)))).flat()
    const [summary, translations, relatedRows, stats, authors] = await Promise.all([
      this.summaries([row]),
      this.repo.publicTranslations(row.translation_group_id, now),
      this.repo.relatedCandidates({
        locale,
        now,
        excludeId: row.id,
        categoryId: row.category_id,
        tagPostIds,
        limit: 3,
      }),
      this.repo.stats([row.id]),
      this.repo.authorNames(row.author_id ? [row.author_id] : []),
    ])
    const authorName = row.author_id ? authors.get(row.author_id) : undefined

    return {
      ...summary[0]!,
      contentHtml: row.content_html,
      toc: tocOf(row.content_html),
      faq: Array.isArray(row.faq) ? row.faq : [],
      metaTitle: row.meta_title,
      metaDescription: row.meta_description,
      focusKeyword: row.focus_keyword,
      keywords: row.keywords ?? [],
      canonicalUrl: row.canonical_url,
      ogImageUrl: row.og_image_url,
      noindex: row.noindex,
      author: authorName ? { name: authorName } : null,
      translations,
      related: await this.summaries(relatedRows),
      stats: publicStats(stats.get(row.id) ?? EMPTY_STATS),
    }
  }

  /** Everything the sitemap lists. `noindex` posts and thin tags are left out. */
  async sitemap(): Promise<{
    posts: Array<{
      locale: BlogLocale
      slug: string
      updatedAt: string
      translations: Array<{ locale: BlogLocale; slug: string }>
    }>
    categories: Array<{ locale: BlogLocale; slug: string; updatedAt: string }>
    tags: Array<{ locale: BlogLocale; slug: string; postCount: number }>
  }> {
    const now = this.clock()
    const posts = await this.repo.allPublic(now)
    const indexable = posts.filter((p) => !p.noindex)
    const byGroup = new Map<string, Array<{ locale: BlogLocale; slug: string }>>()
    for (const p of indexable) {
      const list = byGroup.get(p.translation_group_id) ?? []
      list.push({ locale: p.locale, slug: p.slug })
      byGroup.set(p.translation_group_id, list)
    }
    const [categories, tags, tagCounts] = await Promise.all([
      this.repo.listTaxonomy('category'),
      this.repo.listTaxonomy('tag'),
      this.repo.publicPostCountPerTag(indexable.map((p) => p.id)),
    ])
    const usedCategories = new Set(indexable.map((p) => p.category_id).filter(Boolean))
    return {
      posts: indexable.map((p) => ({
        locale: p.locale,
        slug: p.slug,
        updatedAt: p.updated_at,
        translations: byGroup.get(p.translation_group_id) ?? [],
      })),
      categories: categories
        .filter((c) => usedCategories.has(c.id))
        .map((c) => ({
          locale: c.locale,
          slug: c.slug,
          updatedAt: c.updated_at ?? now.toISOString(),
        })),
      tags: tags
        .map((t) => ({ locale: t.locale, slug: t.slug, postCount: tagCounts.get(t.id) ?? 0 }))
        .filter((t) => t.postCount >= MIN_POSTS_FOR_INDEXED_TAG),
    }
  }

  private async commentsWithNames(rows: CommentRow[]): Promise<BlogComment[]> {
    const names = await this.repo.authorNames(rows.map((r) => r.user_id))
    return rows.map((r) => ({
      id: r.id,
      parentId: r.parent_id,
      body: r.body,
      createdAt: r.created_at,
      status: r.status,
      authorName: names.get(r.user_id) ?? null,
    }))
  }

  private async requirePublic(postId: string): Promise<void> {
    if (!(await this.repo.isPublic(postId, this.clock())))
      throw new BlogError('BLOG_POST_NOT_FOUND')
  }

  async comments(postId: string): Promise<BlogComment[]> {
    await this.requirePublic(postId)
    return this.commentsWithNames(await this.repo.approvedComments(postId))
  }

  async me(
    postId: string,
    userId: string,
  ): Promise<{ reaction: number; rating: number | null; pendingComments: BlogComment[] }> {
    await this.requirePublic(postId)
    const [votes, own] = await Promise.all([
      this.repo.myVotes(postId, userId),
      this.repo.ownComments(postId, userId),
    ])
    return { ...votes, pendingComments: await this.commentsWithNames(own) }
  }

  /**
   * A new comment waits for moderation. A tripped honeypot answers exactly
   * like a success without storing anything — telling a bot it was caught
   * only teaches it which field to skip.
   */
  async addComment(
    postId: string,
    userId: string,
    input: BlogCommentInput,
  ): Promise<{ comment: BlogComment | null }> {
    if (isHoneypotTripped(input.website)) return { comment: null }
    await this.requirePublic(postId)

    const parentId = input.parentId ?? null
    if (parentId) {
      const parent = await this.repo.findComment(parentId)
      // Only a visible, top-level comment on the same post can be answered.
      if (
        !parent ||
        parent.post_id !== postId ||
        parent.parent_id ||
        parent.status !== 'approved'
      ) {
        throw new BlogError('BLOG_COMMENT_REPLY_INVALID', [
          { path: 'parentId', message: 'blog.errors.replyInvalid' },
        ])
      }
    }
    const row = await this.repo.insertComment({ postId, userId, parentId, body: input.body })
    const [comment] = await this.commentsWithNames([row])
    return { comment: comment! }
  }

  async react(
    postId: string,
    userId: string,
    value: -1 | 0 | 1,
  ): Promise<{ value: number; stats: PublicStats }> {
    const stored = await this.repo.setReaction(postId, userId, value)
    const stats = await this.repo.stats([postId])
    return { value: stored, stats: publicStats(stats.get(postId) ?? EMPTY_STATS) }
  }

  async rate(
    postId: string,
    userId: string,
    stars: number,
  ): Promise<{ stars: number; stats: PublicStats }> {
    const stored = await this.repo.setRating(postId, userId, stars)
    const stats = await this.repo.stats([postId])
    return { stars: stored, stats: publicStats(stats.get(postId) ?? EMPTY_STATS) }
  }

  async view(postId: string): Promise<void> {
    await this.repo.recordView(postId)
  }

  // ─── admin ─────────────────────────────────────────────────────────────────

  private async toAdmin(row: FullPostRow): Promise<AdminPost> {
    const [summary, tagIds, stats, translations, authors] = await Promise.all([
      this.summaries([row]),
      this.repo.tagIdsOf(row.id),
      this.repo.stats([row.id]),
      this.repo.translationsOf(row.translation_group_id),
      this.repo.authorNames(row.author_id ? [row.author_id] : []),
    ])
    return {
      ...summary[0]!,
      status: row.status,
      noindex: row.noindex,
      translationGroupId: row.translation_group_id,
      stats: stats.get(row.id) ?? { ...EMPTY_STATS },
      contentJson: row.content_json,
      contentHtml: row.content_html,
      faq: Array.isArray(row.faq) ? row.faq : [],
      metaTitle: row.meta_title,
      metaDescription: row.meta_description,
      focusKeyword: row.focus_keyword,
      keywords: row.keywords ?? [],
      canonicalUrl: row.canonical_url,
      ogImageUrl: row.og_image_url,
      categoryId: row.category_id,
      tagIds,
      authorName: row.author_id ? (authors.get(row.author_id) ?? null) : null,
      translations: translations.filter((t) => t.id !== row.id),
    }
  }

  async adminList(input: {
    locale?: BlogLocale | undefined
    status?: BlogPostStatus | undefined
    q?: string | undefined
    page: number
    pageSize: number
  }): Promise<{ posts: AdminPostSummary[]; total: number; page: number; pageSize: number }> {
    const { rows, total } = await this.repo.adminList({
      locale: input.locale,
      status: input.status,
      q: input.q,
      offset: (input.page - 1) * input.pageSize,
      limit: input.pageSize,
    })
    const [summaries, stats] = await Promise.all([
      this.summaries(rows),
      this.repo.stats(rows.map((r) => r.id)),
    ])
    return {
      posts: summaries.map((s, i) => ({
        ...s,
        status: rows[i]!.status,
        noindex: rows[i]!.noindex,
        translationGroupId: rows[i]!.translation_group_id,
        stats: stats.get(s.id) ?? { ...EMPTY_STATS },
      })),
      total,
      page: input.page,
      pageSize: input.pageSize,
    }
  }

  async adminGet(id: string): Promise<AdminPost> {
    const row = await this.repo.findById(id)
    if (!row) throw new BlogError('BLOG_POST_NOT_FOUND')
    return this.toAdmin(row)
  }

  /** The category and every tag must exist and be in the post's language. */
  private async checkTaxonomy(input: BlogPostInput): Promise<void> {
    const details: Array<{ path: string; message: string }> = []
    if (input.categoryId) {
      const found = (await this.repo.taxonomyByIds('category', [input.categoryId])).get(
        input.categoryId,
      )
      if (!found || found.locale !== input.locale) {
        details.push({ path: 'categoryId', message: 'blog.errors.taxonomyLocale' })
      }
    }
    if (input.tagIds.length) {
      const tags = await this.repo.taxonomyByIds('tag', input.tagIds)
      if (input.tagIds.some((id) => tags.get(id)?.locale !== input.locale)) {
        details.push({ path: 'tagIds', message: 'blog.errors.taxonomyLocale' })
      }
    }
    if (details.length) throw new BlogError('BLOG_TAXONOMY_NOT_FOUND', details)
  }

  async save(
    id: string | null,
    input: BlogPostInput,
    adminId: string,
    log: Logger,
  ): Promise<SaveResult> {
    const previous = id ? await this.repo.findById(id) : null
    if (id && !previous) throw new BlogError('BLOG_POST_NOT_FOUND')

    const sanitized = sanitizeArticleHtml(input.contentHtml, input.locale)
    if (sanitized.errors.length) throw new BlogError('BLOG_CONTENT_INVALID', sanitized.errors)
    await this.checkTaxonomy(input)

    const publication = resolvePublication(
      input.status,
      input.publishedAt,
      this.clock(),
      previous?.published_at ?? null,
    )

    const fields = {
      locale: input.locale,
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt,
      content_json: input.contentJson,
      content_html: sanitized.html,
      faq: input.faq,
      cover_url: input.coverUrl,
      cover_alt: input.coverAlt,
      meta_title: input.metaTitle,
      meta_description: input.metaDescription,
      focus_keyword: input.focusKeyword,
      keywords: input.keywords,
      canonical_url: input.canonicalUrl,
      og_image_url: input.ogImageUrl,
      noindex: input.noindex,
      status: publication.status,
      published_at: publication.publishedAt,
      reading_minutes: readingMinutes(sanitized.html),
      category_id: input.categoryId ?? null,
      ...(input.translationGroupId ? { translation_group_id: input.translationGroupId } : {}),
      // The author is whoever creates it — never chosen, never changed later.
      ...(id ? {} : { author_id: adminId }),
    }
    const savedId = await this.repo.savePost(id, fields, input.tagIds)
    const post = await this.adminGet(savedId)
    const revalidated = await revalidateBlogPages(log)
    return { post, warnings: sanitized.warnings, revalidated }
  }

  async remove(id: string, log: Logger): Promise<{ revalidated: RevalidateOutcome }> {
    const deleted = await this.repo.deletePost(id)
    if (!deleted) throw new BlogError('BLOG_POST_NOT_FOUND')
    return { revalidated: await revalidateBlogPages(log) }
  }

  async listTaxonomy(kind: 'category' | 'tag', locale?: BlogLocale): Promise<TaxonomyRow[]> {
    return this.repo.listTaxonomy(kind, locale)
  }

  async saveTaxonomy(
    kind: 'category' | 'tag',
    id: string | null,
    input: BlogTaxonomyInput,
    log: Logger,
  ): Promise<{ item: TaxonomyRow; revalidated: RevalidateOutcome }> {
    const row = {
      locale: input.locale,
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
    }
    const item = id
      ? await this.repo.updateTaxonomy(kind, id, row)
      : await this.repo.insertTaxonomy(kind, row)
    if (!item) throw new BlogError('BLOG_TAXONOMY_NOT_FOUND')
    return { item, revalidated: await revalidateBlogPages(log) }
  }

  async removeTaxonomy(
    kind: 'category' | 'tag',
    id: string,
    log: Logger,
  ): Promise<{ revalidated: RevalidateOutcome }> {
    if (!(await this.repo.deleteTaxonomy(kind, id))) throw new BlogError('BLOG_TAXONOMY_NOT_FOUND')
    return { revalidated: await revalidateBlogPages(log) }
  }

  async moderationQueue(input: {
    status: BlogCommentStatus
    page: number
    pageSize: number
  }): Promise<{
    comments: Array<
      BlogComment & { post: { id: string; title: string; locale: BlogLocale; slug: string } | null }
    >
    total: number
    page: number
    pageSize: number
  }> {
    const { rows, total } = await this.repo.moderationQueue({
      status: input.status,
      offset: (input.page - 1) * input.pageSize,
      limit: input.pageSize,
    })
    const named = await this.commentsWithNames(rows)
    return {
      comments: named.map((c, i) => ({ ...c, post: rows[i]!.post })),
      total,
      page: input.page,
      pageSize: input.pageSize,
    }
  }

  async moderate(
    commentId: string,
    status: 'approved' | 'rejected' | 'spam',
    adminId: string,
  ): Promise<BlogComment> {
    const row = await this.repo.moderateComment(commentId, status, adminId)
    if (!row) throw new BlogError('BLOG_COMMENT_NOT_FOUND')
    const [comment] = await this.commentsWithNames([row])
    return comment!
  }

  async uploadImage(input: {
    fileName: string
    mimeType: string
    contentBase64: string
  }): Promise<{ url: string }> {
    const bytes = Buffer.from(input.contentBase64, 'base64')
    const actual = sniffImageType(bytes)
    if (!actual || actual !== input.mimeType) {
      throw new BlogError('BLOG_IMAGE_INVALID', [
        { path: 'file', message: 'blog.errors.imageType' },
      ])
    }
    if (bytes.length > BLOG_IMAGE_MAX_BYTES) {
      throw new BlogError('BLOG_IMAGE_INVALID', [
        { path: 'file', message: 'blog.errors.imageSize' },
      ])
    }
    const now = this.clock()
    const path = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${IMAGE_EXTENSION[actual]}`
    return { url: await this.repo.uploadImage(path, bytes, actual) }
  }
}

/** Fewer public posts than this and a tag page is thin: noindex, not in the sitemap. */
export const MIN_POSTS_FOR_INDEXED_TAG = 3
