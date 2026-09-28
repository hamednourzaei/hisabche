'use client'

// ============================================
// packages/ui/src/components/ui/marketplace/marketplace-view.tsx
//
// The app marketplace. Props only — every hook is in the container.
//
// What an installer must be able to see BEFORE installing, all from the
// server's real data (G1):
//   · who publishes it, and whether the platform verified that publisher;
//   · the version, when it was published, the API version it targets;
//   · every permission it asks for, marked read or write, and every event it
//     would receive;
//   · what it costs, as the publisher disclosed it;
//   · ratings from businesses that actually installed it — the count is said,
//     and «no reviews yet» is said as such.
// ============================================

import { memo, useState } from 'react'
import {
  APP_CATEGORIES,
  APP_REPORT_REASONS,
  type AppCategory,
  type AppReportReason,
} from '@hisabche/validation'
import type { MarketplaceAppDetail, MarketplaceAppRow } from '@hisabche/api'
import { BadgeCheck, ExternalLink, Search, Star, Store } from 'lucide-react'

import { Badge } from '../badge'
import { Button } from '../button'
import { Card, CardContent } from '../card'
import { Input } from '../input'
import { SelectField } from '../select-field'
import { appCategoryLabel, appPriceLabel } from '../../../lib/oauth-labels'

type T = (key: string, fallback?: string) => string
export type MarketplaceState = 'loading' | 'ready' | 'not-configured' | 'error' | 'not-found'

export interface MarketplaceViewProps {
  t: T
  lang: string
  formatDate: (iso: string) => string

  category: AppCategory | 'all'
  onCategory: (category: AppCategory | 'all') => void
  query: string
  onQuery: (q: string) => void
  listState: MarketplaceState
  apps: MarketplaceAppRow[]
  onOpen: (slugOrId: string) => void

  selected: string | null
  onBack: () => void
  detailState: MarketplaceState
  detail: MarketplaceAppDetail | null

  savingReview: boolean
  reviewError: string | null
  onSaveReview: (input: { rating: number; body: string }) => void
  onDeleteReview: () => void
  reporting: boolean
  reportDone: 'new' | 'duplicate' | null
  onReport: (input: { reason: AppReportReason; details: string }) => void
  onRetry: () => void
}

const scopeKey = (scope: string) => `developer.scope.${scope.replace(':', '_')}`
const eventKey = (event: string) => `developer.event.${event.replace('.', '_')}`

function Stars({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={
            i <= Math.round(value)
              ? 'size-4 fill-[hsl(var(--color-warning))] text-[hsl(var(--color-warning))]'
              : 'size-4 text-[hsl(var(--fg-tertiary))]'
          }
        />
      ))}
    </span>
  )
}

function StateLine({ state, t, onRetry }: { state: MarketplaceState; t: T; onRetry: () => void }) {
  if (state === 'ready') return null
  if (state === 'error') {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-[hsl(var(--color-destructive))]">{t('developer.loadError')}</p>
        <Button size="sm" variant="outline" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      </div>
    )
  }
  const key =
    state === 'loading'
      ? 'developer.loading'
      : state === 'not-configured'
        ? 'marketplace.notConfigured'
        : 'marketplace.notFound'
  return <p className="text-sm text-[hsl(var(--fg-secondary))]">{t(key)}</p>
}

function Icon({ url, name }: { url: string | null; name: string }) {
  return url ? (
    <img src={url} alt="" loading="lazy" className="size-12 shrink-0 rounded-xl object-cover" />
  ) : (
    <span
      aria-hidden="true"
      className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--surface-muted))] text-lg font-bold text-[hsl(var(--fg-secondary))]"
    >
      {name.slice(0, 1)}
    </span>
  )
}

function Publisher({ t, name, verified }: { t: T; name: string | null; verified: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--fg-secondary))]">
      {name ?? t('oauth.unknownPublisher')}
      {verified ? (
        <Badge variant="success">
          <BadgeCheck className="size-3.5" aria-hidden="true" />
          {t('oauth.verified')}
        </Badge>
      ) : (
        <Badge variant="secondary">{t('oauth.notVerified')}</Badge>
      )}
    </span>
  )
}

function ReviewForm({
  t,
  initial,
  saving,
  error,
  onSave,
  onDelete,
}: {
  t: T
  initial: { rating: number; body: string; hidden: boolean } | null
  saving: boolean
  error: string | null
  onSave: (input: { rating: number; body: string }) => void
  onDelete: () => void
}) {
  const [rating, setRating] = useState(initial?.rating ?? 0)
  const [body, setBody] = useState(initial?.body ?? '')
  return (
    <form
      className="space-y-2 rounded-xl bg-[hsl(var(--surface-muted))] p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (rating < 1) return
        onSave({ rating, body: body.trim() })
      }}
    >
      <p className="text-sm font-medium">
        {initial ? t('marketplace.yourReview') : t('marketplace.writeReview')}
      </p>
      {initial?.hidden && (
        <p className="text-xs text-[hsl(var(--color-destructive))]">
          {t('marketplace.reviewHidden')}
        </p>
      )}
      <div
        className="flex gap-1"
        role="radiogroup"
        aria-label={t('marketplace.rating')}
        data-field="rating"
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={rating === i}
            aria-label={`${i}`}
            onClick={() => setRating(i)}
            className="rounded p-0.5"
          >
            <Star
              aria-hidden="true"
              className={
                i <= rating
                  ? 'size-6 fill-[hsl(var(--color-warning))] text-[hsl(var(--color-warning))]'
                  : 'size-6 text-[hsl(var(--fg-tertiary))]'
              }
            />
          </button>
        ))}
      </div>
      <textarea
        name="body"
        rows={3}
        maxLength={2000}
        value={body}
        placeholder={t('marketplace.reviewPlaceholder')}
        aria-label={t('marketplace.reviewPlaceholder')}
        onChange={(e) => setBody(e.target.value)}
        className="w-full rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 py-2 text-sm"
      />
      {error && <p className="text-sm text-[hsl(var(--color-destructive))]">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={saving} disabled={rating < 1}>
          {t('marketplace.saveReview')}
        </Button>
        {initial && (
          <Button type="button" size="sm" variant="outline" onClick={onDelete}>
            {t('marketplace.deleteReview')}
          </Button>
        )}
      </div>
    </form>
  )
}

function ReportForm({
  t,
  sending,
  done,
  onReport,
}: {
  t: T
  sending: boolean
  done: 'new' | 'duplicate' | null
  onReport: (input: { reason: AppReportReason; details: string }) => void
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<AppReportReason>('security')
  const [details, setDetails] = useState('')
  if (done) {
    return (
      <p className="text-sm text-[hsl(var(--fg-secondary))]">
        {done === 'new' ? t('marketplace.reportSent') : t('marketplace.reportAlreadyOpen')}
      </p>
    )
  }
  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        {t('marketplace.report')}
      </Button>
    )
  }
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        onReport({ reason, details: details.trim() })
      }}
    >
      <SelectField
        name="reason"
        value={reason}
        onChange={(v) => setReason(v as AppReportReason)}
        options={APP_REPORT_REASONS.map((r) => ({ value: r, label: t(`marketplace.reason.${r}`) }))}
      />
      <textarea
        name="details"
        rows={2}
        maxLength={2000}
        value={details}
        placeholder={t('marketplace.reportDetails')}
        aria-label={t('marketplace.reportDetails')}
        onChange={(e) => setDetails(e.target.value)}
        className="w-full rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 py-2 text-sm"
      />
      <Button type="submit" size="sm" variant="destructive" loading={sending}>
        {t('marketplace.sendReport')}
      </Button>
    </form>
  )
}

function Detail({ props, d }: { props: MarketplaceViewProps; d: MarketplaceAppDetail }) {
  const { t } = props
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Icon url={d.iconUrl} name={d.name} />
            <div className="min-w-0 flex-1 space-y-1">
              <h1 className="text-xl font-bold text-[hsl(var(--fg-primary))]">{d.name}</h1>
              {d.tagline && <p className="text-sm text-[hsl(var(--fg-secondary))]">{d.tagline}</p>}
              <Publisher t={t} name={d.publisher.name} verified={d.publisher.verified} />
            </div>
          </div>
          {d.previewingDraft && (
            <p className="rounded-lg bg-[hsl(var(--color-warning)/0.1)] p-2 text-sm">
              {t('marketplace.previewDraft')}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {d.category && <Badge variant="outline">{appCategoryLabel(t, d.category)}</Badge>}
            <Badge variant="outline">{appPriceLabel(t, d.pricing, props.lang)}</Badge>
            {d.version && (
              <Badge variant="outline">
                <span dir="ltr">
                  {d.version.version} · API {d.version.apiVersion}
                </span>
              </Badge>
            )}
            <span className="text-xs text-[hsl(var(--fg-tertiary))]">
              {t('marketplace.activeInstalls')}: {d.activeInstalls}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {d.installed ? (
              <Badge variant="success">{t('marketplace.installed')}</Badge>
            ) : d.installUrl && !d.isOwner ? (
              <a
                href={d.installUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 rounded-xl bg-[hsl(var(--color-primary))] px-3 py-1.5 text-sm font-medium text-[hsl(var(--color-primary-fg))]"
              >
                <ExternalLink className="size-4" aria-hidden="true" />
                {t('marketplace.install')}
              </a>
            ) : (
              !d.isOwner && (
                <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                  {t('marketplace.noInstallUrl')}
                </p>
              )
            )}
            {d.homepageUrl && (
              <a
                href={d.homepageUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-sm text-[hsl(var(--color-primary))] underline-offset-4 hover:underline"
              >
                {t('oauth.visit')}
              </a>
            )}
          </div>
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('marketplace.installHelp')}</p>
          {d.pricing.model === 'paid' && (
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">
              {t('marketplace.billedByPublisher')}
            </p>
          )}
        </CardContent>
      </Card>

      {d.screenshots.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {d.screenshots.map((s) => (
            <figure key={s.id} className="w-72 shrink-0 space-y-1">
              <img
                src={s.url}
                alt={s.caption}
                loading="lazy"
                className="aspect-video w-full rounded-xl object-cover"
              />
              {s.caption && (
                <figcaption className="text-xs text-[hsl(var(--fg-secondary))]">
                  {s.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}

      {d.description && (
        <Card>
          <CardContent className="whitespace-pre-line p-4 text-sm text-[hsl(var(--fg-primary))]">
            {d.description}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-2 p-4">
          <h2 className="font-semibold">{t('marketplace.permissions')}</h2>
          {!d.disclosure ? (
            <p className="text-sm text-[hsl(var(--fg-secondary))]">
              {t('marketplace.noVersionYet')}
            </p>
          ) : (
            <>
              <ul className="space-y-1 text-sm">
                {d.disclosure.scopes.map((s) => (
                  <li key={s.scope} className="flex items-center gap-2">
                    <Badge variant={s.access === 'write' ? 'warning' : 'secondary'}>
                      {s.access === 'write' ? t('marketplace.canChange') : t('marketplace.canRead')}
                    </Badge>
                    {t(scopeKey(s.scope), s.scope)}
                  </li>
                ))}
              </ul>
              {d.disclosure.events.length > 0 && (
                <p className="text-xs text-[hsl(var(--fg-secondary))]">
                  {t('marketplace.receivesEvents')}:{' '}
                  {d.disclosure.events.map((e) => t(eventKey(e), e)).join('، ')}
                </p>
              )}
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t('marketplace.permissionsHelp')}
              </p>
            </>
          )}
          <div className="flex flex-wrap gap-3 text-xs">
            {d.privacyUrl && (
              <a
                href={d.privacyUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline-offset-4 hover:underline"
              >
                {t('marketplace.privacy')}
              </a>
            )}
            {d.termsUrl && (
              <a
                href={d.termsUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline-offset-4 hover:underline"
              >
                {t('marketplace.terms')}
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-4">
          <h2 className="font-semibold">{t('marketplace.publisher')}</h2>
          <Publisher t={t} name={d.publisher.name} verified={d.publisher.verified} />
          {d.publisher.bio && (
            <p className="text-sm text-[hsl(var(--fg-secondary))]">{d.publisher.bio}</p>
          )}
          <div className="flex flex-wrap gap-3 text-xs" dir="ltr">
            {d.publisher.websiteUrl && (
              <a
                href={d.publisher.websiteUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline-offset-4 hover:underline"
              >
                {d.publisher.websiteUrl}
              </a>
            )}
            {d.publisher.supportEmail && (
              <a href={`mailto:${d.publisher.supportEmail}`}>{d.publisher.supportEmail}</a>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-4">
          <h2 className="font-semibold">{t('marketplace.changelog')}</h2>
          {d.changelog.length === 0 ? (
            <p className="text-sm text-[hsl(var(--fg-secondary))]">
              {t('marketplace.noVersionYet')}
            </p>
          ) : (
            <ul className="space-y-2">
              {d.changelog.map((c) => (
                <li key={c.version} className="text-sm">
                  <p className="font-medium">
                    <span dir="ltr">{c.version}</span>
                    {c.publishedAt && (
                      <span className="ms-2 text-xs text-[hsl(var(--fg-tertiary))]">
                        {props.formatDate(c.publishedAt)}
                      </span>
                    )}
                  </p>
                  <p className="whitespace-pre-line text-xs text-[hsl(var(--fg-secondary))]">
                    {c.changelog}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <h2 className="font-semibold">{t('marketplace.reviews')}</h2>
          {d.rating.reviews === 0 ? (
            <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('marketplace.noReviews')}</p>
          ) : (
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <Stars value={d.rating.average ?? 0} label={String(d.rating.average ?? '')} />
                <span className="font-semibold tabular-nums">{d.rating.average?.toFixed(2)}</span>
                <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                  ({d.rating.reviews} {t('marketplace.reviewCount')})
                </span>
              </div>
              <ul className="space-y-0.5 text-xs">
                {[5, 4, 3, 2, 1].map((star) => (
                  <li key={star} className="flex items-center gap-2 tabular-nums">
                    <span className="w-4">{star}</span>
                    <span>{d.rating.stars[star - 1] ?? 0}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {d.canReview ? (
            <ReviewForm
              key={`${d.myReview?.rating ?? 0}|${d.myReview?.body ?? ''}`}
              t={t}
              initial={d.myReview}
              saving={props.savingReview}
              error={props.reviewError}
              onSave={props.onSaveReview}
              onDelete={props.onDeleteReview}
            />
          ) : (
            !d.isOwner && (
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t('marketplace.reviewOnlyInstalled')}
              </p>
            )
          )}
          <ul className="space-y-2">
            {d.reviews.map((r) => (
              <li
                key={r.id}
                className="space-y-1 rounded-lg bg-[hsl(var(--surface-muted))] p-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Stars value={r.rating} label={String(r.rating)} />
                  <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                    {props.formatDate(r.updatedAt)}
                  </span>
                  {r.mine && <Badge variant="outline">{t('marketplace.yours')}</Badge>}
                </div>
                {r.body && <p className="whitespace-pre-line">{r.body}</p>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {!d.isOwner && (
        <ReportForm
          t={t}
          sending={props.reporting}
          done={props.reportDone}
          onReport={props.onReport}
        />
      )}
    </div>
  )
}

export const MarketplaceView = memo(function MarketplaceView(props: MarketplaceViewProps) {
  const { t } = props

  if (props.selected) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
        <Button size="sm" variant="ghost" onClick={props.onBack}>
          {t('marketplace.back')}
        </Button>
        <StateLine state={props.detailState} t={t} onRetry={props.onRetry} />
        {props.detailState === 'ready' && props.detail && <Detail props={props} d={props.detail} />}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-8">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[hsl(var(--fg-primary))]">
          <Store className="size-6 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          {t('marketplace.title')}
        </h1>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('marketplace.description')}</p>
      </header>

      <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
        <label className="relative">
          <Search
            className="pointer-events-none absolute start-3 top-2.5 size-4 text-[hsl(var(--fg-tertiary))]"
            aria-hidden="true"
          />
          <Input
            name="q"
            value={props.query}
            maxLength={100}
            placeholder={t('marketplace.search')}
            aria-label={t('marketplace.search')}
            className="ps-9"
            onChange={(e) => props.onQuery(e.target.value)}
          />
        </label>
        <SelectField
          name="category"
          value={props.category}
          onChange={(v) => props.onCategory(v as AppCategory | 'all')}
          options={[
            { value: 'all', label: t('marketplace.allCategories') },
            ...APP_CATEGORIES.map((c) => ({ value: c, label: appCategoryLabel(t, c) })),
          ]}
        />
      </div>

      <StateLine state={props.listState} t={t} onRetry={props.onRetry} />
      {props.listState === 'ready' &&
        (props.apps.length === 0 ? (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">
            {props.query || props.category !== 'all'
              ? t('marketplace.noMatch')
              : t('marketplace.empty')}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {props.apps.map((app) => (
              <li key={app.id}>
                <button
                  type="button"
                  onClick={() => props.onOpen(app.slug ?? app.id)}
                  className="flex h-full w-full flex-col gap-2 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4 text-start transition hover:border-[hsl(var(--color-primary)/0.5)]"
                >
                  <div className="flex items-start gap-3">
                    <Icon url={app.iconUrl} name={app.name} />
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold text-[hsl(var(--fg-primary))]">{app.name}</p>
                      <Publisher t={t} name={app.publisher} verified={app.publisherVerified} />
                    </div>
                  </div>
                  {app.tagline && (
                    <p className="text-sm text-[hsl(var(--fg-secondary))]">{app.tagline}</p>
                  )}
                  <div className="mt-auto flex flex-wrap items-center gap-2 text-xs">
                    {app.rating !== null ? (
                      <span className="inline-flex items-center gap-1">
                        <Stars value={app.rating} label={String(app.rating)} />({app.reviews})
                      </span>
                    ) : (
                      <span className="text-[hsl(var(--fg-tertiary))]">
                        {t('marketplace.noReviews')}
                      </span>
                    )}
                    <Badge variant="outline">{appPriceLabel(t, app.pricing, props.lang)}</Badge>
                    {app.installed && <Badge variant="success">{t('marketplace.installed')}</Badge>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
})

MarketplaceView.displayName = 'MarketplaceView'
