// ============================================
// backend/src/services/blog/blog.repository.ts
//
// The only file of the Blog Core that knows table and column names.
//
// ⚠️ THIS CLIENT IS THE SERVICE ROLE, WHICH BYPASSES RLS. Every PUBLIC read
// below therefore applies the publication rule itself (`PUBLIC_STATUSES` + date) — the
// RLS policy protects direct clients, not this process.
// ============================================

import type { BlogCommentStatus, BlogLocale, BlogPostStatus } from '@hisabche/validation'

import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import {
  BlogError,
  EMPTY_STATS,
  isMissingSchema,
  statsFromRow,
  type PostStats,
} from './blog.domain'

const BUCKET = 'blog-images'

/**
 * The publication rule, applied by hand on every public read:
 * status ∈ (published, scheduled) AND published_at ≤ now. Same as
 * `blog_post_is_public()` in the migration; a `published` row always has a
 * past date because the domain turns a future one into `scheduled`.
 */
const PUBLIC_STATUSES = ['published', 'scheduled']

const SUMMARY_COLUMNS =
  'id, locale, slug, title, excerpt, content_html, cover_url, cover_alt, published_at, updated_at, reading_minutes, status, noindex, category_id, translation_group_id'
const FULL_COLUMNS = `${SUMMARY_COLUMNS}, content_json, faq, meta_title, meta_description, focus_keyword, keywords, canonical_url, og_image_url, author_id, created_at`

export interface PostRow {
  id: string
  locale: BlogLocale
  slug: string
  title: string
  excerpt: string | null
  content_html: string
  cover_url: string | null
  cover_alt: string | null
  published_at: string | null
  updated_at: string
  reading_minutes: number
  status: BlogPostStatus
  noindex: boolean
  category_id: string | null
  translation_group_id: string
}

export interface FullPostRow extends PostRow {
  content_json: Record<string, unknown>
  faq: Array<{ q: string; a: string }>
  meta_title: string | null
  meta_description: string | null
  focus_keyword: string | null
  keywords: string[]
  canonical_url: string | null
  og_image_url: string | null
  author_id: string | null
  created_at: string
}

export interface TaxonomyRow {
  id: string
  locale: BlogLocale
  slug: string
  name: string
  description?: string | null
  updated_at?: string
}

export interface CommentRow {
  id: string
  post_id: string
  user_id: string
  parent_id: string | null
  body: string
  status: BlogCommentStatus
  created_at: string
}

export interface PostWrite {
  locale: BlogLocale
  slug: string
  title: string
  excerpt: string | null
  content_json: Record<string, unknown>
  content_html: string
  faq: Array<{ q: string; a: string }>
  cover_url: string | null
  cover_alt: string | null
  meta_title: string | null
  meta_description: string | null
  focus_keyword: string | null
  keywords: string[]
  canonical_url: string | null
  og_image_url: string | null
  noindex: boolean
  status: BlogPostStatus
  published_at: string | null
  reading_minutes: number
  category_id: string | null
  translation_group_id?: string
  author_id?: string
}

type PgError = { code?: string; message?: string; details?: string } | null

/** Missing schema → 503 «not configured»; anything else → DatabaseError (500). */
function check(error: PgError, what: string): void {
  if (!error) return
  if (isMissingSchema(error)) throw new BlogError('BLOG_MIGRATION_PENDING')
  throw new DatabaseError(what, error)
}

/** Unique violations name the constraint; map the two the admin can cause. */
function uniqueViolation(error: PgError): BlogError | null {
  if (error?.code !== '23505') return null
  const text = `${error.message ?? ''} ${error.details ?? ''}`
  if (text.includes('translation_group_id')) return new BlogError('BLOG_TRANSLATION_TAKEN')
  return new BlogError('BLOG_SLUG_TAKEN', [{ path: 'slug', message: 'blog.errors.slugTaken' }])
}

export class BlogRepository {
  // ─── public reads ─────────────────────────────────────────────────────────

  async listPublic(input: {
    locale: BlogLocale
    now: Date
    categoryId?: string | undefined
    postIds?: string[] | undefined
    offset: number
    limit: number
  }): Promise<{ rows: PostRow[]; total: number }> {
    let query = supabase
      .from('blog_posts')
      .select(SUMMARY_COLUMNS, { count: 'exact' })
      .eq('locale', input.locale)
      .in('status', PUBLIC_STATUSES)
      .lte('published_at', input.now.toISOString())
    if (input.categoryId) query = query.eq('category_id', input.categoryId)
    if (input.postIds)
      query = query.in(
        'id',
        input.postIds.length ? input.postIds : ['00000000-0000-0000-0000-000000000000'],
      )
    const { data, error, count } = await query
      .order('published_at', { ascending: false })
      .range(input.offset, input.offset + input.limit - 1)
    check(error, 'Failed to list blog posts')
    return { rows: (data ?? []) as PostRow[], total: count ?? 0 }
  }

  async findPublicBySlug(locale: BlogLocale, slug: string, now: Date): Promise<FullPostRow | null> {
    const { data, error } = await supabase
      .from('blog_posts')
      .select(FULL_COLUMNS)
      .eq('locale', locale)
      .eq('slug', slug)
      .in('status', PUBLIC_STATUSES)
      .lte('published_at', now.toISOString())
      .maybeSingle()
    check(error, 'Failed to fetch blog post')
    return (data as FullPostRow | null) ?? null
  }

  async isPublic(postId: string, now: Date): Promise<boolean> {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('id')
      .eq('id', postId)
      .in('status', PUBLIC_STATUSES)
      .lte('published_at', now.toISOString())
      .maybeSingle()
    check(error, 'Failed to fetch blog post')
    return data !== null
  }

  /** Public siblings in the same translation group (hreflang). */
  async publicTranslations(
    groupId: string,
    now: Date,
  ): Promise<Array<{ locale: BlogLocale; slug: string }>> {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('locale, slug')
      .eq('translation_group_id', groupId)
      .in('status', PUBLIC_STATUSES)
      .lte('published_at', now.toISOString())
    check(error, 'Failed to fetch translations')
    return (data ?? []) as Array<{ locale: BlogLocale; slug: string }>
  }

  /** Every public post, for the sitemap (no content). */
  async allPublic(
    now: Date,
  ): Promise<
    Array<
      Pick<
        PostRow,
        | 'id'
        | 'locale'
        | 'slug'
        | 'updated_at'
        | 'published_at'
        | 'noindex'
        | 'translation_group_id'
        | 'category_id'
      >
    >
  > {
    const rows: Array<
      Pick<
        PostRow,
        | 'id'
        | 'locale'
        | 'slug'
        | 'updated_at'
        | 'published_at'
        | 'noindex'
        | 'translation_group_id'
        | 'category_id'
      >
    > = []
    const page = 1000
    for (let offset = 0; ; offset += page) {
      const { data, error } = await supabase
        .from('blog_posts')
        .select(
          'id, locale, slug, updated_at, published_at, noindex, translation_group_id, category_id',
        )
        .in('status', PUBLIC_STATUSES)
        .lte('published_at', now.toISOString())
        .order('id')
        .range(offset, offset + page - 1)
      check(error, 'Failed to list blog posts for the sitemap')
      rows.push(...((data ?? []) as typeof rows))
      if (!data || data.length < page) return rows
    }
  }

  async tagsOfPosts(postIds: string[]): Promise<Map<string, TaxonomyRow[]>> {
    const byPost = new Map<string, TaxonomyRow[]>()
    if (postIds.length === 0) return byPost
    const { data, error } = await supabase
      .from('blog_post_tags')
      .select('post_id, blog_tags!inner(id, locale, slug, name)')
      .in('post_id', postIds)
    check(error, 'Failed to fetch post tags')
    for (const row of (data ?? []) as unknown as Array<{
      post_id: string
      blog_tags: TaxonomyRow
    }>) {
      const list = byPost.get(row.post_id) ?? []
      list.push(row.blog_tags)
      byPost.set(row.post_id, list)
    }
    return byPost
  }

  async postIdsWithTag(tagId: string): Promise<string[]> {
    const ids: string[] = []
    const page = 1000
    for (let offset = 0; ; offset += page) {
      const { data, error } = await supabase
        .from('blog_post_tags')
        .select('post_id')
        .eq('tag_id', tagId)
        .order('post_id')
        .range(offset, offset + page - 1)
      check(error, 'Failed to fetch tagged posts')
      ids.push(...(data ?? []).map((r) => String(r.post_id)))
      if (!data || data.length < page) return ids
    }
  }

  async taxonomyByIds(kind: 'category' | 'tag', ids: string[]): Promise<Map<string, TaxonomyRow>> {
    const map = new Map<string, TaxonomyRow>()
    if (ids.length === 0) return map
    const table = kind === 'category' ? 'blog_categories' : 'blog_tags'
    const columns =
      kind === 'category'
        ? 'id, locale, slug, name, description, updated_at'
        : 'id, locale, slug, name, updated_at'
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .in('id', [...new Set(ids)])
    check(error, 'Failed to fetch taxonomy')
    for (const row of (data ?? []) as unknown as TaxonomyRow[]) map.set(row.id, row)
    return map
  }

  async findTaxonomy(
    kind: 'category' | 'tag',
    locale: BlogLocale,
    slug: string,
  ): Promise<TaxonomyRow | null> {
    const table = kind === 'category' ? 'blog_categories' : 'blog_tags'
    const columns =
      kind === 'category'
        ? 'id, locale, slug, name, description, updated_at'
        : 'id, locale, slug, name, updated_at'
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq('locale', locale)
      .eq('slug', slug)
      .maybeSingle()
    check(error, 'Failed to fetch taxonomy')
    return (data as TaxonomyRow | null) ?? null
  }

  async listTaxonomy(kind: 'category' | 'tag', locale?: BlogLocale): Promise<TaxonomyRow[]> {
    const table = kind === 'category' ? 'blog_categories' : 'blog_tags'
    const columns =
      kind === 'category'
        ? 'id, locale, slug, name, description, updated_at'
        : 'id, locale, slug, name, updated_at'
    let query = supabase.from(table).select(columns)
    if (locale) query = query.eq('locale', locale)
    const { data, error } = await query.order('name')
    check(error, 'Failed to list taxonomy')
    return (data ?? []) as unknown as TaxonomyRow[]
  }

  /** Public post counts per tag (exact), for the sitemap's thin-tag rule. */
  async publicPostCountPerTag(publicPostIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>()
    const chunk = 500
    for (let i = 0; i < publicPostIds.length; i += chunk) {
      const ids = publicPostIds.slice(i, i + chunk)
      const { data, error } = await supabase
        .from('blog_post_tags')
        .select('tag_id')
        .in('post_id', ids)
      check(error, 'Failed to count tagged posts')
      for (const row of data ?? [])
        counts.set(String(row.tag_id), (counts.get(String(row.tag_id)) ?? 0) + 1)
    }
    return counts
  }

  async relatedCandidates(input: {
    locale: BlogLocale
    now: Date
    excludeId: string
    categoryId: string | null
    tagPostIds: string[]
    limit: number
  }): Promise<PostRow[]> {
    const ids = [...new Set(input.tagPostIds)].filter((id) => id !== input.excludeId)
    const out: PostRow[] = []
    if (ids.length) {
      const { rows } = await this.listPublic({
        locale: input.locale,
        now: input.now,
        postIds: ids,
        offset: 0,
        limit: input.limit,
      })
      out.push(...rows)
    }
    if (out.length < input.limit && input.categoryId) {
      const { rows } = await this.listPublic({
        locale: input.locale,
        now: input.now,
        categoryId: input.categoryId,
        offset: 0,
        limit: input.limit + 1,
      })
      for (const row of rows)
        if (row.id !== input.excludeId && !out.some((r) => r.id === row.id)) out.push(row)
    }
    return out.slice(0, input.limit)
  }

  async authorNames(userIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    const ids = [...new Set(userIds)]
    if (ids.length === 0) return map
    const { data, error } = await supabase.from('profiles').select('id, full_name').in('id', ids)
    if (error) throw new DatabaseError('Failed to fetch author names', error)
    for (const row of data ?? []) if (row.full_name) map.set(String(row.id), String(row.full_name))
    return map
  }

  async stats(postIds: string[]): Promise<Map<string, PostStats>> {
    const map = new Map<string, PostStats>()
    if (postIds.length === 0) return map
    const { data, error } = await supabase.rpc('blog_post_stats', { p_post_ids: postIds })
    check(error, 'Failed to read blog statistics')
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      map.set(String(row.post_id), statsFromRow(row))
    }
    for (const id of postIds) if (!map.has(id)) map.set(id, { ...EMPTY_STATS })
    return map
  }

  // ─── comments ─────────────────────────────────────────────────────────────

  async approvedComments(postId: string): Promise<CommentRow[]> {
    const rows: CommentRow[] = []
    const page = 500
    for (let offset = 0; ; offset += page) {
      const { data, error } = await supabase
        .from('blog_comments')
        .select('id, post_id, user_id, parent_id, body, status, created_at')
        .eq('post_id', postId)
        .eq('status', 'approved')
        .order('created_at', { ascending: true })
        .range(offset, offset + page - 1)
      check(error, 'Failed to fetch comments')
      rows.push(...((data ?? []) as CommentRow[]))
      if (!data || data.length < page) return rows
    }
  }

  async ownComments(postId: string, userId: string): Promise<CommentRow[]> {
    const { data, error } = await supabase
      .from('blog_comments')
      .select('id, post_id, user_id, parent_id, body, status, created_at')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .in('status', ['pending', 'rejected'])
      .order('created_at', { ascending: true })
    check(error, 'Failed to fetch comments')
    return (data ?? []) as CommentRow[]
  }

  async findComment(id: string): Promise<CommentRow | null> {
    const { data, error } = await supabase
      .from('blog_comments')
      .select('id, post_id, user_id, parent_id, body, status, created_at')
      .eq('id', id)
      .maybeSingle()
    check(error, 'Failed to fetch comment')
    return (data as CommentRow | null) ?? null
  }

  async insertComment(input: {
    postId: string
    userId: string
    parentId: string | null
    body: string
  }): Promise<CommentRow> {
    const { data, error } = await supabase
      .from('blog_comments')
      .insert({
        post_id: input.postId,
        user_id: input.userId,
        parent_id: input.parentId,
        body: input.body,
      })
      .select('id, post_id, user_id, parent_id, body, status, created_at')
      .single()
    if (error?.message?.includes('BLOG_COMMENT_REPLY_DEPTH'))
      throw new BlogError('BLOG_COMMENT_REPLY_INVALID')
    check(error, 'Failed to save comment')
    return data as CommentRow
  }

  async moderationQueue(input: {
    status: BlogCommentStatus
    offset: number
    limit: number
  }): Promise<{
    rows: Array<
      CommentRow & { post: { id: string; title: string; locale: BlogLocale; slug: string } | null }
    >
    total: number
  }> {
    const { data, error, count } = await supabase
      .from('blog_comments')
      .select(
        'id, post_id, user_id, parent_id, body, status, created_at, post:blog_posts(id, title, locale, slug)',
        { count: 'exact' },
      )
      .eq('status', input.status)
      .order('created_at', { ascending: input.status === 'pending' })
      .range(input.offset, input.offset + input.limit - 1)
    check(error, 'Failed to list comments')
    return {
      rows: (data ?? []) as unknown as Array<
        CommentRow & {
          post: { id: string; title: string; locale: BlogLocale; slug: string } | null
        }
      >,
      total: count ?? 0,
    }
  }

  async moderateComment(
    id: string,
    status: BlogCommentStatus,
    adminId: string,
  ): Promise<CommentRow | null> {
    const { data, error } = await supabase
      .from('blog_comments')
      .update({ status, moderated_by: adminId, moderated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, post_id, user_id, parent_id, body, status, created_at')
      .maybeSingle()
    check(error, 'Failed to moderate comment')
    return (data as CommentRow | null) ?? null
  }

  // ─── reactions, ratings, views ────────────────────────────────────────────

  async setReaction(postId: string, userId: string, value: -1 | 0 | 1): Promise<number> {
    const { data, error } = await supabase.rpc('blog_set_reaction', {
      p_post_id: postId,
      p_user_id: userId,
      p_value: value,
    })
    if (error?.message?.includes('BLOG_POST_NOT_PUBLIC')) throw new BlogError('BLOG_POST_NOT_FOUND')
    check(error, 'Failed to save reaction')
    return Number(data ?? 0)
  }

  async setRating(postId: string, userId: string, stars: number): Promise<number> {
    const { data, error } = await supabase.rpc('blog_set_rating', {
      p_post_id: postId,
      p_user_id: userId,
      p_stars: stars,
    })
    if (error?.message?.includes('BLOG_POST_NOT_PUBLIC')) throw new BlogError('BLOG_POST_NOT_FOUND')
    check(error, 'Failed to save rating')
    return Number(data ?? stars)
  }

  async recordView(postId: string): Promise<void> {
    const { error } = await supabase.rpc('blog_record_view', { p_post_id: postId })
    check(error, 'Failed to record view')
  }

  async myVotes(
    postId: string,
    userId: string,
  ): Promise<{ reaction: number; rating: number | null }> {
    const [reaction, rating] = await Promise.all([
      supabase
        .from('blog_reactions')
        .select('value')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('blog_ratings')
        .select('stars')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle(),
    ])
    check(reaction.error, 'Failed to read reaction')
    check(rating.error, 'Failed to read rating')
    return {
      reaction: reaction.data ? Number(reaction.data.value) : 0,
      rating: rating.data ? Number(rating.data.stars) : null,
    }
  }

  // ─── admin writes ─────────────────────────────────────────────────────────

  async adminList(input: {
    locale?: BlogLocale | undefined
    status?: BlogPostStatus | undefined
    q?: string | undefined
    offset: number
    limit: number
  }): Promise<{ rows: PostRow[]; total: number }> {
    let query = supabase.from('blog_posts').select(SUMMARY_COLUMNS, { count: 'exact' })
    if (input.locale) query = query.eq('locale', input.locale)
    if (input.status) query = query.eq('status', input.status)
    if (input.q) {
      const needle = input.q.replace(/[%,()]/g, ' ').trim()
      if (needle) query = query.or(`title.ilike.%${needle}%,slug.ilike.%${needle}%`)
    }
    const { data, error, count } = await query
      .order('updated_at', { ascending: false })
      .range(input.offset, input.offset + input.limit - 1)
    check(error, 'Failed to list blog posts')
    return { rows: (data ?? []) as PostRow[], total: count ?? 0 }
  }

  async findById(id: string): Promise<FullPostRow | null> {
    const { data, error } = await supabase
      .from('blog_posts')
      .select(FULL_COLUMNS)
      .eq('id', id)
      .maybeSingle()
    check(error, 'Failed to fetch blog post')
    return (data as FullPostRow | null) ?? null
  }

  async translationsOf(
    groupId: string,
  ): Promise<
    Array<{ id: string; locale: BlogLocale; slug: string; title: string; status: BlogPostStatus }>
  > {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('id, locale, slug, title, status')
      .eq('translation_group_id', groupId)
    check(error, 'Failed to fetch translations')
    return (data ?? []) as Array<{
      id: string
      locale: BlogLocale
      slug: string
      title: string
      status: BlogPostStatus
    }>
  }

  /**
   * Create (id = null) or update a post AND set its tags, atomically — one call
   * to `blog_save_post()` (supabase-js has no transactions). `tagIds` null
   * leaves the tags as they are.
   */
  async savePost(
    id: string | null,
    row: Partial<PostWrite>,
    tagIds: string[] | null,
  ): Promise<string> {
    const { data, error } = await supabase.rpc('blog_save_post', {
      p_post_id: id,
      p_fields: row,
      p_tag_ids: tagIds,
    })
    const conflict = uniqueViolation(error)
    if (conflict) throw conflict
    if (error?.message?.includes('BLOG_POST_NOT_FOUND')) throw new BlogError('BLOG_POST_NOT_FOUND')
    if (error?.code === '23503') {
      throw new BlogError('BLOG_TAXONOMY_NOT_FOUND', [
        { path: 'tagIds', message: 'blog.errors.taxonomyMissing' },
      ])
    }
    check(error, 'Failed to save blog post')
    return String(data)
  }

  async deletePost(id: string): Promise<FullPostRow | null> {
    const { data, error } = await supabase
      .from('blog_posts')
      .delete()
      .eq('id', id)
      .select(FULL_COLUMNS)
      .maybeSingle()
    check(error, 'Failed to delete blog post')
    return (data as FullPostRow | null) ?? null
  }

  async tagIdsOf(postId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('blog_post_tags')
      .select('tag_id')
      .eq('post_id', postId)
    check(error, 'Failed to fetch post tags')
    return (data ?? []).map((r) => String(r.tag_id))
  }

  async insertTaxonomy(
    kind: 'category' | 'tag',
    row: { locale: BlogLocale; slug: string; name: string; description: string | null },
  ): Promise<TaxonomyRow> {
    const table = kind === 'category' ? 'blog_categories' : 'blog_tags'
    const payload =
      kind === 'category' ? row : { locale: row.locale, slug: row.slug, name: row.name }
    const { data, error } = await supabase.from(table).insert(payload).select('*').single()
    if (error?.code === '23505')
      throw new BlogError('BLOG_TAXONOMY_TAKEN', [
        { path: 'slug', message: 'blog.errors.slugTaken' },
      ])
    check(error, 'Failed to create taxonomy')
    return data as TaxonomyRow
  }

  async updateTaxonomy(
    kind: 'category' | 'tag',
    id: string,
    row: { locale: BlogLocale; slug: string; name: string; description: string | null },
  ): Promise<TaxonomyRow | null> {
    const table = kind === 'category' ? 'blog_categories' : 'blog_tags'
    const payload =
      kind === 'category' ? row : { locale: row.locale, slug: row.slug, name: row.name }
    const { data, error } = await supabase
      .from(table)
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle()
    if (error?.code === '23505')
      throw new BlogError('BLOG_TAXONOMY_TAKEN', [
        { path: 'slug', message: 'blog.errors.slugTaken' },
      ])
    check(error, 'Failed to update taxonomy')
    return (data as TaxonomyRow | null) ?? null
  }

  async deleteTaxonomy(kind: 'category' | 'tag', id: string): Promise<boolean> {
    const table = kind === 'category' ? 'blog_categories' : 'blog_tags'
    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle()
    check(error, 'Failed to delete taxonomy')
    return data !== null
  }

  async uploadImage(path: string, content: Buffer, mimeType: string): Promise<string> {
    const upload = await supabase.storage.from(BUCKET).upload(path, content, {
      contentType: mimeType,
      upsert: false,
      cacheControl: '31536000',
    })
    if (upload.error) {
      if (/bucket not found/i.test(upload.error.message))
        throw new BlogError('BLOG_MIGRATION_PENDING')
      throw new DatabaseError('Failed to store blog image', upload.error)
    }
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  }
}
