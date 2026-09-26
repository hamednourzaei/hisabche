'use client'

// The blog console: articles (with their statistics), the comment queue, and
// categories / tags per language.
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { apiErrorMessage } from '@hisabche/api'
import {
  BLOG_COMMENT_STATUSES,
  BLOG_LOCALES,
  BLOG_POST_STATUSES,
  type BlogCommentStatus,
  type BlogLocale,
  type BlogPostStatus,
} from '@hisabche/validation'

import { Button, Input } from '@/components/ui'
import {
  EmptyState,
  ErrorState,
  FilterPill,
  ListSkeleton,
  Pagination,
  Panel,
  StatusDot,
  type StatusTone,
} from '@/components/admin-shell/admin-ui'
import {
  useAdminBlogPosts,
  useBlogCommentQueue,
  useBlogTaxonomy,
  useDeleteBlogTaxonomy,
  useModerateBlogComment,
  useSaveBlogTaxonomy,
  type BlogTaxonomyKind,
} from '@/hooks/use-admin-blog'

type Tab = 'posts' | 'comments' | 'taxonomy'
const PAGE_SIZE = 20

const STATUS_TONE: Record<BlogPostStatus, StatusTone> = {
  draft: 'neutral',
  scheduled: 'attention',
  published: 'positive',
}

export function BlogAdminClient() {
  const t = useTranslations()
  const [tab, setTab] = useState<Tab>('posts')
  const { lang = 'fa' } = useParams<{ lang: string }>()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2" role="tablist">
          {(['posts', 'comments', 'taxonomy'] as const).map((key) => (
            <FilterPill key={key} selected={tab === key} onClick={() => setTab(key)}>
              {t(`admin.blog.tabs.${key}`)}
            </FilterPill>
          ))}
        </div>
        <Button asChild>
          <Link href={`/${lang}/blog/new`}>{t('admin.blog.newPost')}</Link>
        </Button>
      </div>
      {tab === 'posts' ? <PostsTab lang={lang} /> : null}
      {tab === 'comments' ? <CommentsTab lang={lang} /> : null}
      {tab === 'taxonomy' ? <TaxonomyTab /> : null}
    </div>
  )
}

function PostsTab({ lang }: { lang: string }) {
  const t = useTranslations()
  const [locale, setLocale] = useState<BlogLocale | undefined>(undefined)
  const [status, setStatus] = useState<BlogPostStatus | undefined>(undefined)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const posts = useAdminBlogPosts({
    locale,
    status,
    q: q.trim() || undefined,
    page,
    pageSize: PAGE_SIZE,
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
          value={locale ?? ''}
          aria-label={t('admin.blog.fields.locale')}
          onChange={(e) => {
            setLocale((e.target.value || undefined) as BlogLocale | undefined)
            setPage(0)
          }}
        >
          <option value="">{t('admin.blog.filters.allLocales')}</option>
          {BLOG_LOCALES.map((l) => (
            <option key={l} value={l}>
              {t(`admin.blog.locales.${l}`)}
            </option>
          ))}
        </select>
        <select
          className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
          value={status ?? ''}
          aria-label={t('admin.blog.filters.status')}
          onChange={(e) => {
            setStatus((e.target.value || undefined) as BlogPostStatus | undefined)
            setPage(0)
          }}
        >
          <option value="">{t('admin.blog.filters.allStatuses')}</option>
          {BLOG_POST_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`admin.blog.status.${s}`)}
            </option>
          ))}
        </select>
        <Input
          className="h-11 max-w-xs"
          value={q}
          placeholder={t('admin.blog.filters.search')}
          aria-label={t('admin.blog.filters.search')}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(0)
          }}
        />
      </div>

      {posts.isLoading ? (
        <ListSkeleton />
      ) : posts.isError ? (
        <ErrorState
          message={apiErrorMessage(posts.error, t('admin.blog.errors.load'))}
          onRetry={() => void posts.refetch()}
        />
      ) : (posts.data?.posts.length ?? 0) === 0 ? (
        <EmptyState title={t('admin.blog.emptyPosts')} hint={t('admin.blog.emptyPostsHint')} />
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="p-3 text-start font-medium">{t('admin.blog.columns.title')}</th>
                <th className="p-3 text-start font-medium">{t('admin.blog.columns.locale')}</th>
                <th className="p-3 text-start font-medium">{t('admin.blog.columns.status')}</th>
                <th className="p-3 text-end font-medium">{t('admin.blog.stats.views')}</th>
                <th className="p-3 text-end font-medium">{t('admin.blog.stats.likes')}</th>
                <th className="p-3 text-end font-medium">{t('admin.blog.stats.rating')}</th>
                <th className="p-3 text-end font-medium">{t('admin.blog.stats.comments')}</th>
              </tr>
            </thead>
            <tbody>
              {posts.data?.posts.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="p-3">
                    <Link href={`/${lang}/blog/${p.id}`} className="font-medium hover:underline">
                      {p.title}
                    </Link>
                    <span className="block text-xs text-muted-foreground" dir="ltr">
                      /{p.locale}/blog/{p.slug}
                    </span>
                  </td>
                  <td className="p-3">{t(`admin.blog.locales.${p.locale}`)}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-2">
                      <StatusDot tone={STATUS_TONE[p.status]} />
                      {t(`admin.blog.status.${p.status}`)}
                      {p.noindex ? (
                        <span className="text-xs text-muted-foreground">noindex</span>
                      ) : null}
                    </span>
                  </td>
                  <td className="p-3 text-end tabular-nums">{p.stats.views}</td>
                  <td className="p-3 text-end tabular-nums">
                    {p.stats.likes} / {p.stats.dislikes}
                  </td>
                  <td className="p-3 text-end tabular-nums">
                    {p.stats.ratingAvg === null
                      ? '—'
                      : `${p.stats.ratingAvg} (${p.stats.ratingCount})`}
                  </td>
                  <td className="p-3 text-end tabular-nums">
                    {p.stats.comments}
                    {p.stats.pendingComments ? ` + ${p.stats.pendingComments}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={posts.data?.total ?? 0}
        busy={posts.isFetching}
        onPage={setPage}
      />
    </div>
  )
}

function CommentsTab({ lang }: { lang: string }) {
  const t = useTranslations()
  const [status, setStatus] = useState<BlogCommentStatus>('pending')
  const [page, setPage] = useState(0)
  const queue = useBlogCommentQueue(status, page, PAGE_SIZE)
  const moderate = useModerateBlogComment()

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {BLOG_COMMENT_STATUSES.map((s) => (
          <FilterPill
            key={s}
            selected={status === s}
            onClick={() => {
              setStatus(s)
              setPage(0)
            }}
          >
            {t(`admin.blog.commentStatus.${s}`)}
          </FilterPill>
        ))}
      </div>
      {queue.isLoading ? (
        <ListSkeleton />
      ) : queue.isError ? (
        <ErrorState
          message={apiErrorMessage(queue.error, t('admin.blog.errors.load'))}
          onRetry={() => void queue.refetch()}
        />
      ) : (queue.data?.comments.length ?? 0) === 0 ? (
        <EmptyState title={t('admin.blog.emptyComments')} />
      ) : (
        <ul className="space-y-2">
          {queue.data?.comments.map((c) => (
            <Panel key={c.id} as="li" className="space-y-2 p-3 text-sm">
              <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {c.authorName ?? t('admin.blog.unknownAuthor')}
                </span>
                <time dateTime={c.createdAt} suppressHydrationWarning>
                  {new Date(c.createdAt).toLocaleString()}
                </time>
                {c.post ? (
                  <Link className="hover:underline" href={`/${lang}/blog/${c.post.id}`}>
                    {c.post.title}
                  </Link>
                ) : null}
                {c.parentId ? <span>{t('admin.blog.isReply')}</span> : null}
              </p>
              <p className="whitespace-pre-line">{c.body}</p>
              {status === 'pending' || status === 'spam' || status === 'rejected' ? (
                <div className="flex flex-wrap gap-2">
                  {(['approved', 'rejected', 'spam'] as const)
                    .filter((next) => next !== status)
                    .map((next) => (
                      <Button
                        key={next}
                        size="sm"
                        variant={next === 'approved' ? 'default' : 'outline'}
                        disabled={moderate.isPending}
                        onClick={() => moderate.mutate({ id: c.id, status: next })}
                      >
                        {t(`admin.blog.moderate.${next}`)}
                      </Button>
                    ))}
                </div>
              ) : null}
            </Panel>
          ))}
        </ul>
      )}
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={queue.data?.total ?? 0}
        busy={queue.isFetching}
        onPage={setPage}
      />
    </div>
  )
}

function TaxonomyTab() {
  const t = useTranslations()
  const [locale, setLocale] = useState<BlogLocale>('fa')
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {BLOG_LOCALES.map((l) => (
          <FilterPill key={l} selected={locale === l} onClick={() => setLocale(l)}>
            {t(`admin.blog.locales.${l}`)}
          </FilterPill>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <TaxonomyList kind="categories" locale={locale} />
        <TaxonomyList kind="tags" locale={locale} />
      </div>
    </div>
  )
}

function TaxonomyList({ kind, locale }: { kind: BlogTaxonomyKind; locale: BlogLocale }) {
  const t = useTranslations()
  const items = useBlogTaxonomy(kind, locale)
  const saveItem = useSaveBlogTaxonomy(kind)
  const removeItem = useDeleteBlogTaxonomy(kind)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <Panel className="space-y-3 p-4" as="section">
      <h2 className="text-sm font-semibold">{t(`admin.blog.taxonomy.${kind}`)}</h2>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          saveItem.mutate(
            {
              id: null,
              locale,
              slug: slug.trim(),
              name: name.trim(),
              description: description.trim() || null,
            },
            {
              onSuccess: () => {
                setName('')
                setSlug('')
                setDescription('')
              },
              onError: (err) => setError(apiErrorMessage(err, t('admin.blog.errors.save'))),
            },
          )
        }}
      >
        <Input
          name="name"
          required
          value={name}
          placeholder={t('admin.blog.taxonomy.name')}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          name="slug"
          required
          dir="ltr"
          value={slug}
          placeholder={t('admin.blog.taxonomy.slug')}
          onChange={(e) => setSlug(e.target.value)}
        />
        {kind === 'categories' ? (
          <textarea
            name="description"
            rows={2}
            value={description}
            placeholder={t('admin.blog.taxonomy.description')}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-border bg-background p-2 text-sm"
          />
        ) : null}
        <Button type="submit" size="sm" disabled={saveItem.isPending}>
          {t('admin.blog.taxonomy.add')}
        </Button>
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </form>
      {items.isError ? (
        <ErrorState
          message={apiErrorMessage(items.error, t('admin.blog.errors.load'))}
          onRetry={() => void items.refetch()}
        />
      ) : (
        <ul className="divide-y divide-border text-sm">
          {(items.data ?? []).map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 py-2">
              <span>
                {item.name}{' '}
                <span className="text-xs text-muted-foreground" dir="ltr">
                  {item.slug}
                </span>
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={removeItem.isPending}
                onClick={() => {
                  if (window.confirm(t('admin.blog.taxonomy.confirmDelete')))
                    removeItem.mutate(item.id)
                }}
              >
                {t('admin.blog.taxonomy.delete')}
              </Button>
            </li>
          ))}
          {(items.data ?? []).length === 0 && !items.isLoading ? (
            <li className="py-2 text-xs text-muted-foreground">{t('admin.blog.taxonomy.empty')}</li>
          ) : null}
        </ul>
      )}
    </Panel>
  )
}
