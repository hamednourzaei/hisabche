'use client'

// Create or edit one article. The server is the authority on everything it
// can check — slug uniqueness, alt text, sanitised HTML, the publication
// rule — and its answers land on the field they belong to.
import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { apiErrorFields, apiErrorMessage } from '@hisabche/api'
import {
  BLOG_LOCALES,
  type BlogFaqItem,
  type BlogLocale,
  type BlogPostStatus,
} from '@hisabche/validation'

import { Button, Input } from '@/components/ui'
import { ErrorState, ListSkeleton, Panel } from '@/components/admin-shell/admin-ui'
import {
  useAdminBlogPost,
  useBlogTaxonomy,
  useDeleteBlogPost,
  useSaveBlogPost,
  useUploadBlogImage,
  type AdminBlogPost,
  type BlogSaveResult,
} from '@/hooks/use-admin-blog'

import { AiArticleButton } from './ai-article-button'
import { BlogEditor } from './blog-editor'
import { SeoPanel, type SeoFields } from './seo-panel'

interface FormState extends SeoFields {
  locale: BlogLocale
  title: string
  excerpt: string
  html: string
  json: Record<string, unknown> | null
  faq: BlogFaqItem[]
  coverUrl: string
  coverAlt: string
  status: BlogPostStatus
  /** `datetime-local` value (the admin's clock). */
  publishedAt: string
  categoryId: string
  tagIds: string[]
  translationGroupId: string | null
}

const EMPTY: FormState = {
  locale: 'fa',
  title: '',
  excerpt: '',
  html: '',
  json: null,
  faq: [],
  coverUrl: '',
  coverAlt: '',
  status: 'draft',
  publishedAt: '',
  categoryId: '',
  tagIds: [],
  translationGroupId: null,
  focusKeyword: '',
  keywords: '',
  metaTitle: '',
  metaDescription: '',
  slug: '',
  canonicalUrl: '',
  ogImageUrl: '',
  noindex: false,
}

/** ISO → `YYYY-MM-DDTHH:mm` in the browser's zone, for datetime-local. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromPost(post: AdminBlogPost): FormState {
  return {
    locale: post.locale,
    title: post.title,
    excerpt: post.excerpt,
    html: post.contentHtml,
    json: post.contentJson,
    faq: post.faq,
    coverUrl: post.coverUrl ?? '',
    coverAlt: post.coverAlt ?? '',
    status: post.status,
    publishedAt: toLocalInput(post.publishedAt),
    categoryId: post.categoryId ?? '',
    tagIds: post.tagIds,
    translationGroupId: post.translationGroupId,
    focusKeyword: post.focusKeyword ?? '',
    keywords: post.keywords.join('، '),
    metaTitle: post.metaTitle ?? '',
    metaDescription: post.metaDescription ?? '',
    slug: post.slug,
    canonicalUrl: post.canonicalUrl ?? '',
    ogImageUrl: post.ogImageUrl ?? '',
    noindex: post.noindex,
  }
}

/** `blog.errors.imageAlt:2` → the translated sentence with its value. */
function useServerText() {
  const t = useTranslations()
  return (message: string) => {
    const [key, ...rest] = message.split(':')
    const value = rest.join(':')
    if (!key || !key.startsWith('blog.')) return message
    return t(key, { index: value, href: value, claim: value })
  }
}

export function PostEditorClient({ id }: { id: string | null }) {
  const t = useTranslations()
  const router = useRouter()
  const params = useParams<{ lang: string }>()
  const search = useSearchParams()
  const lang = params.lang ?? 'fa'
  const text = useServerText()

  const post = useAdminBlogPost(id)
  const save = useSaveBlogPost()
  const remove = useDeleteBlogPost()
  const uploadCover = useUploadBlogImage()

  const [form, setForm] = useState<FormState>(() => {
    const locale = search.get('locale')
    return {
      ...EMPTY,
      locale: (BLOG_LOCALES as readonly string[]).includes(locale ?? '')
        ? (locale as BlogLocale)
        : 'fa',
      translationGroupId: search.get('group'),
    }
  })
  const [loadedId, setLoadedId] = useState<string | null>(null)
  // Bumped when a generated article is applied: the editor reads its content
  // once, at mount, so new content needs a new mount.
  const [aiVersion, setAiVersion] = useState(0)
  const [result, setResult] = useState<BlogSaveResult | null>(null)
  const [error, setError] = useState<unknown>(null)

  // Fill the form once per loaded post (not on every refetch — that would
  // throw away what the admin is typing).
  useEffect(() => {
    if (post.data && post.data.id !== loadedId) {
      setForm(fromPost(post.data))
      setLoadedId(post.data.id)
    }
  }, [post.data, loadedId])

  const categories = useBlogTaxonomy('categories', form.locale)
  const tags = useBlogTaxonomy('tags', form.locale)

  const fieldErrors = useMemo(() => apiErrorFields(error), [error])
  const errorFor = (field: string) => {
    const hit = fieldErrors.find((f) => f.field === field)
    return hit ? text(hit.message) : null
  }
  const generalError =
    error && fieldErrors.length === 0 ? apiErrorMessage(error, t('admin.blog.errors.save')) : null

  const patch = (p: Partial<FormState>) => setForm((prev) => ({ ...prev, ...p }))

  if (id && post.isLoading) return <ListSkeleton rows={4} height="h-32" />
  if (id && post.isError) {
    return (
      <ErrorState
        message={apiErrorMessage(post.error, t('admin.blog.errors.load'))}
        onRetry={() => void post.refetch()}
      />
    )
  }

  const submit = (status: BlogPostStatus) => {
    setError(null)
    setResult(null)
    save.mutate(
      {
        id,
        input: {
          locale: form.locale,
          slug: form.slug.trim(),
          title: form.title.trim(),
          excerpt: form.excerpt.trim() || null,
          contentJson: form.json ?? { type: 'doc', content: [] },
          contentHtml: form.html,
          faq: form.faq.filter((f) => f.q.trim() && f.a.trim()),
          coverUrl: form.coverUrl.trim() || null,
          coverAlt: form.coverAlt.trim() || null,
          metaTitle: form.metaTitle.trim() || null,
          metaDescription: form.metaDescription.trim() || null,
          focusKeyword: form.focusKeyword.trim() || null,
          keywords: form.keywords
            .split(/[,،]/)
            .map((k) => k.trim())
            .filter(Boolean),
          canonicalUrl: form.canonicalUrl.trim() || null,
          ogImageUrl: form.ogImageUrl.trim() || null,
          noindex: form.noindex,
          status,
          publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
          categoryId: form.categoryId || null,
          tagIds: form.tagIds,
          translationGroupId: form.translationGroupId,
        },
      },
      {
        onSuccess: (data) => {
          setResult(data)
          setForm((prev) => ({
            ...prev,
            status: data.post.status,
            publishedAt: toLocalInput(data.post.publishedAt),
          }))
          if (!id) router.replace(`/${lang}/blog/${data.post.id}`)
        },
        onError: (err) => setError(err),
      },
    )
  }

  const current = post.data

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <Panel className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">{t('admin.blog.fields.locale')}</span>
              <select
                name="locale"
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                value={form.locale}
                disabled={Boolean(id)}
                onChange={(e) =>
                  patch({ locale: e.target.value as BlogLocale, categoryId: '', tagIds: [] })
                }
              >
                {BLOG_LOCALES.map((l) => (
                  <option key={l} value={l}>
                    {t(`admin.blog.locales.${l}`)}
                  </option>
                ))}
              </select>
            </label>
            {current?.authorName ? (
              <span className="text-xs text-muted-foreground">
                {t('admin.blog.fields.author')}: {current.authorName}
              </span>
            ) : null}
            <span className="ms-auto">
              <AiArticleButton
                locale={form.locale}
                topic={form.title}
                onApply={(article) => {
                  // ⚠️ `status` and `publishedAt` are NOT touched: a generated
                  // article stays whatever the form was (a draft, for a new
                  // post) until a person saves or publishes it.
                  const category = (categories.data ?? []).find(
                    (item) => item.name === article.categoryName,
                  )
                  patch({
                    title: article.title,
                    excerpt: article.excerpt,
                    html: article.html,
                    json: article.json,
                    faq: article.faq,
                    metaTitle: article.metaTitle,
                    metaDescription: article.metaDescription,
                    focusKeyword: article.focusKeyword,
                    keywords: article.keywords.join('، '),
                    // An existing post keeps its slug: changing it would break its URL.
                    ...(id ? {} : { slug: article.slug }),
                    ...(category ? { categoryId: category.id } : {}),
                  })
                  setAiVersion((value) => value + 1)
                }}
              />
            </span>
          </div>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">{t('admin.blog.fields.title')}</span>
            <Input
              name="title"
              value={form.title}
              className="h-11 text-lg font-semibold"
              onChange={(e) => patch({ title: e.target.value })}
            />
            {errorFor('title') ? (
              <span className="text-xs text-destructive">{errorFor('title')}</span>
            ) : null}
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">{t('admin.blog.fields.excerpt')}</span>
            <textarea
              name="excerpt"
              rows={2}
              maxLength={500}
              value={form.excerpt}
              onChange={(e) => patch({ excerpt: e.target.value })}
              className="w-full rounded-lg border border-border bg-background p-2 text-sm"
            />
          </label>
        </Panel>

        <div data-field="contentHtml">
          <BlogEditor
            key={`${loadedId ?? 'new'}:${aiVersion}`}
            locale={form.locale}
            initialContent={form.json}
            onChange={({ html, json }) => patch({ html, json })}
          />
          {errorFor('contentHtml') ? (
            <p className="mt-1 text-xs text-destructive">{errorFor('contentHtml')}</p>
          ) : null}
        </div>

        <FaqEditor faq={form.faq} onChange={(faq) => patch({ faq })} />
      </div>

      <aside className="space-y-4">
        <Panel className="space-y-3 p-4" as="section">
          <h2 className="text-sm font-semibold">{t('admin.blog.publish.title')}</h2>
          <p className="text-xs text-muted-foreground">
            {t('admin.blog.publish.current')}: {t(`admin.blog.status.${form.status}`)}
          </p>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">{t('admin.blog.publish.date')}</span>
            <Input
              type="datetime-local"
              name="publishedAt"
              dir="ltr"
              value={form.publishedAt}
              onChange={(e) => patch({ publishedAt: e.target.value })}
            />
            <span className="block text-[11px] text-muted-foreground">
              {t('admin.blog.publish.dateHint')}
            </span>
            {errorFor('publishedAt') ? (
              <span className="text-xs text-destructive">{errorFor('publishedAt')}</span>
            ) : null}
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={save.isPending}
              onClick={() => submit('draft')}
            >
              {t('admin.blog.publish.saveDraft')}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={save.isPending || !form.publishedAt}
              onClick={() => submit('scheduled')}
            >
              {t('admin.blog.publish.schedule')}
            </Button>
            <Button type="button" disabled={save.isPending} onClick={() => submit('published')}>
              {t('admin.blog.publish.publish')}
            </Button>
          </div>
          {current && current.status !== 'draft' ? (
            <a
              href={`https://hisabche.com/${current.locale}/blog/${current.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-[hsl(var(--color-primary))] hover:underline"
            >
              {t('admin.blog.publish.view')}
            </a>
          ) : null}
          {generalError ? (
            <p role="alert" className="text-xs text-destructive">
              {generalError}
            </p>
          ) : null}
          {result ? (
            <div role="status" className="space-y-1 text-xs">
              <p className="text-success">{t('admin.blog.publish.saved')}</p>
              {result.revalidated === 'failed' ? (
                <p className="text-warning">{t('admin.blog.publish.revalidateFailed')}</p>
              ) : null}
              {result.revalidated === 'disabled' ? (
                <p className="text-muted-foreground">
                  {t('admin.blog.publish.revalidateDisabled')}
                </p>
              ) : null}
              {result.warnings.map((w, i) => (
                <p key={`${w.message}-${i}`} className="text-warning">
                  {text(w.message)}
                </p>
              ))}
            </div>
          ) : null}
          {id ? (
            <Button
              type="button"
              variant="outline"
              className="text-destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (!window.confirm(t('admin.blog.publish.confirmDelete'))) return
                remove.mutate(id, { onSuccess: () => router.replace(`/${lang}/blog`) })
              }}
            >
              {t('admin.blog.publish.delete')}
            </Button>
          ) : null}
        </Panel>

        <Panel className="space-y-3 p-4" as="section">
          <h2 className="text-sm font-semibold">{t('admin.blog.fields.organise')}</h2>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">{t('admin.blog.fields.category')}</span>
            <select
              name="categoryId"
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
              value={form.categoryId}
              onChange={(e) => patch({ categoryId: e.target.value })}
            >
              <option value="">{t('admin.blog.fields.none')}</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errorFor('categoryId') ? (
              <span className="text-xs text-destructive">{errorFor('categoryId')}</span>
            ) : null}
          </label>
          <fieldset className="space-y-1" data-field="tagIds">
            <legend className="text-xs text-muted-foreground">{t('admin.blog.fields.tags')}</legend>
            <div className="flex flex-wrap gap-1.5">
              {(tags.data ?? []).map((tag) => {
                const on = form.tagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      patch({
                        tagIds: on
                          ? form.tagIds.filter((x) => x !== tag.id)
                          : [...form.tagIds, tag.id],
                      })
                    }
                    className={
                      on
                        ? 'rounded-full bg-accent px-2.5 py-1 text-xs font-medium'
                        : 'rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground'
                    }
                  >
                    {tag.name}
                  </button>
                )
              })}
              {(tags.data ?? []).length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  {t('admin.blog.fields.noTags')}
                </span>
              ) : null}
            </div>
            {errorFor('tagIds') ? (
              <span className="text-xs text-destructive">{errorFor('tagIds')}</span>
            ) : null}
          </fieldset>
        </Panel>

        <Panel className="space-y-3 p-4" as="section">
          <h2 className="text-sm font-semibold">{t('admin.blog.fields.cover')}</h2>
          {form.coverUrl ? (
            // eslint-plugin-next prefers next/image; the admin preview is a
            // thumbnail of an arbitrary upload, not a page's LCP.
            <img
              src={form.coverUrl}
              alt={form.coverAlt}
              className="aspect-[1200/630] w-full rounded-lg object-cover"
            />
          ) : null}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            aria-label={t('admin.blog.fields.coverUpload')}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file)
                uploadCover.mutate(file, {
                  onSuccess: (url) => patch({ coverUrl: url }),
                  onError: (err) => setError(err),
                })
            }}
          />
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">{t('admin.blog.fields.coverAlt')}</span>
            <Input
              name="coverAlt"
              value={form.coverAlt}
              onChange={(e) => patch({ coverAlt: e.target.value })}
            />
            {errorFor('coverAlt') ? (
              <span className="text-xs text-destructive">{errorFor('coverAlt')}</span>
            ) : null}
          </label>
        </Panel>

        <SeoPanel
          locale={form.locale}
          title={form.title}
          html={form.html}
          fields={form}
          onChange={(p) => patch(p)}
          errorFor={errorFor}
        />

        {current ? (
          <Panel className="space-y-2 p-4 text-xs" as="section">
            <h2 className="text-sm font-semibold">{t('admin.blog.translations.title')}</h2>
            {BLOG_LOCALES.filter((l) => l !== current.locale).map((l) => {
              const existing = current.translations.find((tr) => tr.locale === l)
              return (
                <p key={l} className="flex items-center justify-between gap-2">
                  <span>{t(`admin.blog.locales.${l}`)}</span>
                  {existing ? (
                    <Link
                      className="text-[hsl(var(--color-primary))] hover:underline"
                      href={`/${lang}/blog/${existing.id}`}
                    >
                      {existing.title} ({t(`admin.blog.status.${existing.status}`)})
                    </Link>
                  ) : (
                    <Link
                      className="text-[hsl(var(--color-primary))] hover:underline"
                      href={`/${lang}/blog/new?locale=${l}&group=${current.translationGroupId}`}
                    >
                      {t('admin.blog.translations.create')}
                    </Link>
                  )}
                </p>
              )
            })}
          </Panel>
        ) : null}

        {current ? (
          <Panel className="grid grid-cols-2 gap-2 p-4 text-xs" as="section">
            <h2 className="col-span-2 text-sm font-semibold">{t('admin.blog.stats.title')}</h2>
            <span>{t('admin.blog.stats.views')}</span>
            <span className="tabular-nums">{current.stats.views}</span>
            <span>{t('admin.blog.stats.likes')}</span>
            <span className="tabular-nums">
              {current.stats.likes} / {current.stats.dislikes}
            </span>
            <span>{t('admin.blog.stats.rating')}</span>
            <span className="tabular-nums">
              {current.stats.ratingAvg === null
                ? '—'
                : `${current.stats.ratingAvg} (${current.stats.ratingCount})`}
            </span>
            <span>{t('admin.blog.stats.comments')}</span>
            <span className="tabular-nums">
              {current.stats.comments} + {current.stats.pendingComments}
            </span>
          </Panel>
        ) : null}
      </aside>
    </div>
  )
}

function FaqEditor({
  faq,
  onChange,
}: {
  faq: BlogFaqItem[]
  onChange: (faq: BlogFaqItem[]) => void
}) {
  const t = useTranslations()
  return (
    <Panel className="space-y-3 p-4" as="section">
      <h2 className="text-sm font-semibold">{t('admin.blog.faq.title')}</h2>
      <p className="text-xs text-muted-foreground">{t('admin.blog.faq.hint')}</p>
      {faq.map((item, index) => (
        <div key={index} className="space-y-2 rounded-xl border border-border p-3">
          <Input
            value={item.q}
            placeholder={t('admin.blog.faq.question')}
            aria-label={t('admin.blog.faq.question')}
            onChange={(e) =>
              onChange(faq.map((f, i) => (i === index ? { ...f, q: e.target.value } : f)))
            }
          />
          <textarea
            rows={2}
            value={item.a}
            placeholder={t('admin.blog.faq.answer')}
            aria-label={t('admin.blog.faq.answer')}
            onChange={(e) =>
              onChange(faq.map((f, i) => (i === index ? { ...f, a: e.target.value } : f)))
            }
            className="w-full rounded-lg border border-border bg-background p-2 text-sm"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChange(faq.filter((_, i) => i !== index))}
          >
            {t('admin.blog.faq.remove')}
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange([...faq, { q: '', a: '' }])}
      >
        {t('admin.blog.faq.add')}
      </Button>
    </Panel>
  )
}
