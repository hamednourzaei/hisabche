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

import {
  Button,
  Card,
  DataTable,
  EmptyState,
  Input,
  PaginationBar,
  SelectField,
  Skeleton,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  type TableColumn,
} from '@/components/ui'
import { ErrorState, useAdminTableT } from '@/components/admin-shell/admin-ui'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminDateTime, adminNumber, UNKNOWN_VALUE } from '@/lib/admin-format'
import { cn } from '@/lib/utils'
import {
  useAdminBlogPosts,
  useBlogCommentQueue,
  useBlogTaxonomy,
  useDeleteBlogTaxonomy,
  useModerateBlogComment,
  useSaveBlogTaxonomy,
  type AdminBlogPostSummary,
  type AdminBlogTaxonomy,
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
  const displayLocale = useAdminLocale()
  const tableT = useAdminTableT()
  const columns: TableColumn<AdminBlogPostSummary>[] = [
    {
      id: 'title',
      labelKey: 'admin.blog.columns.title',
      labelFallback: 'عنوان',
      locked: true,
      render: (p) => (
        <div className="min-w-0">
          <Link
            href={`/${lang}/blog/${p.id}`}
            className="font-medium text-foreground hover:underline"
          >
            {p.title}
          </Link>
          <span className="block truncate font-mono text-xs text-muted-foreground" dir="ltr">
            /{p.locale}/blog/{p.slug}
          </span>
        </div>
      ),
      sortValue: (p) => p.title,
    },
    {
      id: 'locale',
      labelKey: 'admin.blog.columns.locale',
      labelFallback: 'زبان',
      showFrom: 'md',
      render: (p) => t(`admin.blog.locales.${p.locale}`),
      sortValue: (p) => p.locale,
    },
    {
      id: 'status',
      labelKey: 'admin.blog.columns.status',
      labelFallback: 'وضعیت',
      render: (p) => (
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_TONE[p.status])}
          />
          {t(`admin.blog.status.${p.status}`)}
          {p.noindex ? <span className="text-xs text-muted-foreground">noindex</span> : null}
        </span>
      ),
      sortValue: (p) => p.status,
    },
    {
      id: 'views',
      labelKey: 'admin.blog.stats.views',
      labelFallback: 'بازدید',
      align: 'end',
      showFrom: 'md',
      render: (p) => (
        <span className="tabular-nums">{adminNumber(p.stats.views, displayLocale)}</span>
      ),
      sortValue: (p) => p.stats.views,
    },
    {
      id: 'likes',
      labelKey: 'admin.blog.stats.likes',
      labelFallback: 'پسند',
      align: 'end',
      showFrom: 'lg',
      render: (p) => (
        <span className="tabular-nums">
          {adminNumber(p.stats.likes, displayLocale)} /{' '}
          {adminNumber(p.stats.dislikes, displayLocale)}
        </span>
      ),
      sortValue: (p) => p.stats.likes,
    },
    {
      id: 'rating',
      labelKey: 'admin.blog.stats.rating',
      labelFallback: 'امتیاز',
      align: 'end',
      showFrom: 'lg',
      render: (p) => (
        <span className="tabular-nums">
          {p.stats.ratingAvg === null
            ? UNKNOWN_VALUE
            : `${adminNumber(p.stats.ratingAvg, displayLocale, 1)} (${adminNumber(p.stats.ratingCount, displayLocale)})`}
        </span>
      ),
      sortValue: (p) => p.stats.ratingAvg,
    },
    {
      id: 'comments',
      labelKey: 'admin.blog.stats.comments',
      labelFallback: 'نظرها',
      align: 'end',
      render: (p) => (
        <span className="tabular-nums">
          {adminNumber(p.stats.comments, displayLocale)}
          {p.stats.pendingComments
            ? ` + ${adminNumber(p.stats.pendingComments, displayLocale)}`
            : ''}
        </span>
      ),
      sortValue: (p) => p.stats.comments,
    },
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SelectField
          className="h-11 w-full sm:w-44"
          value={locale ?? ''}
          onChange={(value) => {
            setLocale((value || undefined) as BlogLocale | undefined)
            setPage(0)
          }}
          options={[
            { value: '', label: t('admin.blog.filters.allLocales') },
            ...BLOG_LOCALES.map((l) => ({ value: l, label: t(`admin.blog.locales.${l}`) })),
          ]}
          aria-label={t('admin.blog.fields.locale')}
        />
        <SelectField
          className="h-11 w-full sm:w-44"
          value={status ?? ''}
          onChange={(value) => {
            setStatus((value || undefined) as BlogPostStatus | undefined)
            setPage(0)
          }}
          options={[
            { value: '', label: t('admin.blog.filters.allStatuses') },
            ...BLOG_POST_STATUSES.map((s) => ({
              value: s,
              label: t(`admin.blog.status.${s}`),
            })),
          ]}
          aria-label={t('admin.blog.filters.status')}
        />
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
        <DataTable
          tableId="admin-blog-posts"
          t={tableT}
          rows={posts.data?.posts ?? []}
          columns={columns}
          rowKey={(p) => p.id}
          paginate={false}
          minWidthClass="min-w-[900px]"
        />
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
  const dateLocale = useAdminLocale()
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
                  {adminDateTime(c.createdAt, dateLocale)}
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
  const [deleteTarget, setDeleteTarget] = useState<AdminBlogTaxonomy | null>(null)

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
                onClick={() => setDeleteTarget(item)}
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

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.blog.taxonomy.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.blog.taxonomy.deleteDesc', { name: deleteTarget?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const target = deleteTarget
                setDeleteTarget(null)
                if (target) removeItem.mutate(target.id)
              }}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
