'use client'

// packages/ui/src/components/ui/blog/blog-post-actions.tsx
//
// The article's only client island: like / dislike, stars, comments, and the
// view beacon. Everything else on the article page is server-rendered HTML.
//
// Signed out (and in the prerendered HTML) every control is a link to sign in
// that brings the reader back to THIS article (`?redirect=`), never a button
// that silently does nothing.
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  apiErrorMessage,
  recordBlogView,
  useAddBlogComment,
  useBlogComments,
  useBlogMe,
  useSetBlogRating,
  useSetBlogReaction,
  type BlogComment,
  type BlogPublicStats,
} from '@hisabche/api'

import { useDateFormat } from '../../../hooks/use-date-format'
import { useSignedInAfterMount } from '../../../hooks/use-signed-in-after-mount'
import { cn } from '../../../lib/utils'

export interface BlogPostActionsProps {
  postId: string
  locale: string
  slug: string
  initialStats: BlogPublicStats
}

const STARS = [1, 2, 3, 4, 5] as const

export function BlogPostActions({ postId, locale, slug, initialStats }: BlogPostActionsProps) {
  const t = useTranslations('blog')
  const signedIn = useSignedInAfterMount()
  const { dateLong } = useDateFormat()
  const [stats, setStats] = useState(initialStats)
  const [actionError, setActionError] = useState<string | null>(null)

  const me = useBlogMe(postId, signedIn)
  const comments = useBlogComments(postId)
  const react = useSetBlogReaction(postId)
  const rate = useSetBlogRating(postId)

  const signInHref = `/${locale}/login?redirect=${encodeURIComponent(`/${locale}/blog/${slug}`)}`
  const number = useMemo(
    () => new Intl.NumberFormat(locale === 'en' ? 'en' : locale === 'af' ? 'fa-AF' : 'fa-IR'),
    [locale],
  )

  // One view per page load, once the browser is idle — never on the critical
  // path of the page's first paint.
  useEffect(() => {
    const send = () => recordBlogView(postId)
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(send, { timeout: 5000 })
      return () => window.cancelIdleCallback(handle)
    }
    const timer = window.setTimeout(send, 2000)
    return () => window.clearTimeout(timer)
  }, [postId])

  const myReaction = me.data?.reaction ?? 0
  const myRating = me.data?.rating ?? null

  const onReact = (value: 1 | -1) => {
    setActionError(null)
    // Pressing the same choice again takes it back.
    react.mutate(myReaction === value ? 0 : value, {
      onSuccess: (data) => setStats(data.stats),
      onError: (error) => setActionError(apiErrorMessage(error, t('actions.failed'))),
    })
  }
  const onRate = (stars: number) => {
    setActionError(null)
    rate.mutate(stars, {
      onSuccess: (data) => setStats(data.stats),
      onError: (error) => setActionError(apiErrorMessage(error, t('actions.failed'))),
    })
  }

  const reactionButton = (value: 1 | -1, label: string, count: number, symbol: string) => {
    const className = cn(
      'inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors motion-reduce:transition-none',
      myReaction === value
        ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--fg-primary))]'
        : 'border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]',
    )
    const content = (
      <>
        <span aria-hidden="true">{symbol}</span>
        <span>{label}</span>
        <span className="tabular-nums text-[hsl(var(--fg-tertiary))]">{number.format(count)}</span>
      </>
    )
    return signedIn ? (
      <button
        type="button"
        aria-pressed={myReaction === value}
        disabled={react.isPending}
        onClick={() => onReact(value)}
        className={className}
      >
        {content}
      </button>
    ) : (
      <Link href={signInHref} prefetch={false} rel="nofollow" className={className}>
        {content}
      </Link>
    )
  }

  return (
    <section aria-labelledby="blog-actions-title" className="mt-10 space-y-8">
      <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5">
        <h2
          id="blog-actions-title"
          className="mb-4 text-base font-bold text-[hsl(var(--fg-primary))]"
        >
          {t('actions.title')}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {reactionButton(1, t('actions.like'), stats.likes, '👍')}
          {reactionButton(-1, t('actions.dislike'), stats.dislikes, '👎')}
        </div>

        <div className="mt-5">
          <p className="mb-2 text-sm text-[hsl(var(--fg-secondary))]">{t('actions.ratingLabel')}</p>
          <div
            className="flex items-center gap-1"
            role="group"
            aria-label={t('actions.ratingLabel')}
          >
            {STARS.map((stars) => {
              const filled = (myRating ?? 0) >= stars
              const star = (
                <span
                  aria-hidden="true"
                  className={
                    filled ? 'text-[hsl(var(--color-warning))]' : 'text-[hsl(var(--fg-tertiary))]'
                  }
                >
                  {filled ? '★' : '☆'}
                </span>
              )
              const label = t('actions.star', { stars: number.format(stars) })
              return signedIn ? (
                <button
                  key={stars}
                  type="button"
                  aria-label={label}
                  aria-pressed={myRating === stars}
                  disabled={rate.isPending}
                  onClick={() => onRate(stars)}
                  className="flex size-10 items-center justify-center rounded-full text-2xl hover:bg-[hsl(var(--surface-muted))]"
                >
                  {star}
                </button>
              ) : (
                <Link
                  key={stars}
                  href={signInHref}
                  prefetch={false}
                  rel="nofollow"
                  aria-label={label}
                  className="flex size-10 items-center justify-center rounded-full text-2xl hover:bg-[hsl(var(--surface-muted))]"
                >
                  {star}
                </Link>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-[hsl(var(--fg-tertiary))]">
            {stats.ratingAvg !== null && stats.ratingCount > 0
              ? t('actions.ratingSummary', {
                  avg: number.format(stats.ratingAvg),
                  count: number.format(stats.ratingCount),
                })
              : t('actions.noRatings')}
          </p>
        </div>

        {!signedIn ? (
          <p className="mt-4 text-sm text-[hsl(var(--fg-secondary))]">
            {t('actions.signInPrompt')}{' '}
            <Link
              href={signInHref}
              prefetch={false}
              rel="nofollow"
              className="font-semibold text-[hsl(var(--color-primary))] hover:underline"
            >
              {t('actions.signIn')}
            </Link>
          </p>
        ) : null}
        {actionError ? (
          <p role="alert" className="mt-3 text-sm text-[hsl(var(--color-destructive))]">
            {actionError}
          </p>
        ) : null}
      </div>

      <BlogComments
        postId={postId}
        signedIn={signedIn}
        signInHref={signInHref}
        approved={comments.data ?? []}
        loadFailed={comments.isError}
        pending={me.data?.pendingComments ?? []}
        formatDate={dateLong}
        countLabel={t('comments.count', {
          count: number.format(comments.data?.length ?? stats.comments),
        })}
      />
    </section>
  )
}

function BlogComments({
  postId,
  signedIn,
  signInHref,
  approved,
  loadFailed,
  pending,
  formatDate,
  countLabel,
}: {
  postId: string
  signedIn: boolean
  signInHref: string
  approved: BlogComment[]
  loadFailed: boolean
  pending: BlogComment[]
  formatDate: (value: string) => string
  countLabel: string
}) {
  const t = useTranslations('blog')
  const add = useAddBlogComment(postId)
  const [body, setBody] = useState('')
  const [website, setWebsite] = useState('')
  const [replyTo, setReplyTo] = useState<BlogComment | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const topLevel = approved.filter((c) => !c.parentId)
  const repliesOf = (id: string) => approved.filter((c) => c.parentId === id)
  const nameOf = (c: BlogComment) => c.authorName ?? t('comments.unknownAuthor')

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)
    add.mutate(
      { body, parentId: replyTo?.id ?? null, website },
      {
        onSuccess: () => {
          setBody('')
          setReplyTo(null)
          setMessage({ kind: 'ok', text: t('comments.sent') })
        },
        onError: (error) =>
          setMessage({ kind: 'error', text: apiErrorMessage(error, t('actions.failed')) }),
      },
    )
  }

  const commentItem = (c: BlogComment, canReply: boolean) => (
    <div className="rounded-[var(--radius-md)] bg-[hsl(var(--surface-muted)/0.5)] p-3">
      <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--fg-tertiary))]">
        <span className="font-semibold text-[hsl(var(--fg-primary))]">{nameOf(c)}</span>
        <time dateTime={c.createdAt}>{formatDate(c.createdAt)}</time>
        {c.status === 'pending' ? (
          <span className="rounded-full bg-[hsl(var(--color-warning)/0.15)] px-2 py-0.5 text-[hsl(var(--fg-primary))]">
            {t('comments.pending')}
          </span>
        ) : null}
        {c.status === 'rejected' ? (
          <span className="rounded-full bg-[hsl(var(--color-destructive)/0.12)] px-2 py-0.5 text-[hsl(var(--fg-primary))]">
            {t('comments.rejected')}
          </span>
        ) : null}
      </p>
      <p className="whitespace-pre-line text-sm leading-relaxed text-[hsl(var(--fg-primary))]">
        {c.body}
      </p>
      {canReply && signedIn ? (
        <button
          type="button"
          onClick={() => setReplyTo(c)}
          className="mt-2 text-xs font-semibold text-[hsl(var(--color-primary))] hover:underline"
        >
          {t('comments.reply')}
        </button>
      ) : null}
    </div>
  )

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold text-[hsl(var(--fg-primary))]">
        {t('comments.title')}{' '}
        <span className="text-sm font-normal text-[hsl(var(--fg-tertiary))]">({countLabel})</span>
      </h2>

      {loadFailed ? (
        <p role="alert" className="mb-4 text-sm text-[hsl(var(--color-destructive))]">
          {t('comments.loadFailed')}
        </p>
      ) : null}

      {pending.length > 0 ? (
        <ul className="mb-4 space-y-3">
          {pending.map((c) => (
            <li key={c.id}>{commentItem(c, false)}</li>
          ))}
        </ul>
      ) : null}

      {topLevel.length === 0 && !loadFailed ? (
        <p className="mb-4 text-sm text-[hsl(var(--fg-secondary))]">{t('comments.empty')}</p>
      ) : (
        <ul className="mb-6 space-y-4">
          {topLevel.map((c) => (
            <li key={c.id} className="space-y-2">
              {commentItem(c, true)}
              {repliesOf(c.id).length > 0 ? (
                <ul className="space-y-2 border-s-2 border-[hsl(var(--border-default))] ps-4">
                  {repliesOf(c.id).map((r) => (
                    <li key={r.id}>{commentItem(r, false)}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {signedIn ? (
        <form onSubmit={submit} className="space-y-3">
          {replyTo ? (
            <p className="flex items-center gap-2 text-xs text-[hsl(var(--fg-secondary))]">
              {t('comments.replyingTo', { name: nameOf(replyTo) })}
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="font-semibold hover:underline"
              >
                {t('comments.cancelReply')}
              </button>
            </p>
          ) : null}
          <label
            className="block text-sm font-medium text-[hsl(var(--fg-primary))]"
            htmlFor={`comment-${postId}`}
          >
            {t('comments.label')}
          </label>
          <textarea
            id={`comment-${postId}`}
            name="body"
            required
            minLength={2}
            maxLength={2000}
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('comments.placeholder')}
            className="w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-3 text-sm text-[hsl(var(--fg-primary))] focus:border-[hsl(var(--color-primary))] focus:outline-none"
          />
          {/* Honeypot: invisible to people and screen readers, filled by bots. */}
          <div
            aria-hidden="true"
            className="absolute -m-px h-px w-px overflow-hidden p-0 opacity-0"
          >
            <label htmlFor={`website-${postId}`}>{t('comments.honeypot')}</label>
            <input
              id={`website-${postId}`}
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={add.isPending || body.trim().length < 2}
            className="btn-primary inline-flex min-h-10 items-center rounded-full px-5 text-sm font-bold disabled:opacity-60"
          >
            {add.isPending ? t('comments.sending') : t('comments.submit')}
          </button>
          {message ? (
            <p
              role={message.kind === 'error' ? 'alert' : 'status'}
              className={cn(
                'text-sm',
                message.kind === 'error'
                  ? 'text-[hsl(var(--color-destructive))]'
                  : 'text-[hsl(var(--color-success))]',
              )}
            >
              {message.text}
            </p>
          ) : null}
        </form>
      ) : (
        <Link
          href={signInHref}
          prefetch={false}
          rel="nofollow"
          className="btn-primary inline-flex min-h-10 items-center rounded-full px-5 text-sm font-bold"
        >
          {t('actions.signIn')}
        </Link>
      )}
    </div>
  )
}
