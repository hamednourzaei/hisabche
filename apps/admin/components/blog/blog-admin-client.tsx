'use client'

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

import { Button, Card, EmptyState, Input, PaginationBar, Skeleton } from '@/components/ui'
import { ErrorState } from '@/components/admin-shell/admin-ui'
import { cn } from '@/lib/utils'
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

const STATUS_TONE: Record<BlogPostStatus, string> = {
  draft: 'bg-[hsl(var(--fg-tertiary))]',
  scheduled: 'bg-[hsl(var(--color-warning))]',
  published: 'bg-[hsl(var(--color-success))]',
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
            <Button
              key={key}
              size="sm"
              variant={tab === key ? 'default' : 'outline'}
              onClick={() => setTab(key)}
            >
              {t(`admin.blog.tabs.${key}`)}
            </Button>
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

  const total = posts.data?.total ?? 0
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, total)

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
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : posts.isError ? (
        <ErrorState
          message={apiErrorMessage(posts.error, t('admin.blog.errors.load'))}
          onRetry={() => void posts.refetch()}
        />
      ) : (posts.data?.posts.length ?? 0) === 0 ? (
        <EmptyState
          title={t('admin.blog.emptyPosts')}
          description={t('admin.blog.emptyPostsHint')}
        />
      ) : (
        <Card className="overflow-x-auto">
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
                      <span
                        aria-hidden="true"
                        className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_TONE[p.status])}
                      />
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
        </Card>
      )}
      <PaginationBar
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        busy={posts.isFetching}
        onPage={setPage}
        showingLabel={t('admin.pagination.showing', { from, to, total })}
        previousLabel={t('admin.pagination.previous')}
        nextLabel={t('admin.pagination.next')}
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

  const total = queue.data?.total ?? 0
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, total)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {BLOG_COMMENT_STATUSES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={status === s ? 'default' : 'outline'}
            onClick={() => {
              setStatus(s)
              setPage(0)
            }}
          >
            {t(`admin.blog.commentStatus.${s}`)}
          </Button>
        ))}
      </div>
      {queue.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
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
            <li
              key={c.id}
              className="space-y-2 rounded-2xl border border-border bg-card p-3 text-sm"
            >
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
            </li>
          ))}
        </ul>
      )}
      <PaginationBar
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        busy={queue.isFetching}
        onPage={setPage}
        showingLabel={t('admin.pagination.showing', { from, to, total })}
        previousLabel={t('admin.pagination.previous')}
        nextLabel={t('admin.pagination.next')}
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
          <Button
            key={l}
            size="sm"
            variant={locale === l ? 'default' : 'outline'}
            onClick={() => setLocale(l)}
          >
            {t(`admin.blog.locales.${l}`)}
          </Button>
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
    <Card className="space-y-3 p-4">
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
    </Card>
  )
}
