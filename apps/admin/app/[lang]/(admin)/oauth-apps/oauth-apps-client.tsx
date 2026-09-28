'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiErrorMessage } from '@hisabche/api'
import { APP_HEALTH_LEVELS, APP_REPORT_REASONS, APP_RISK_FLAGS } from '@hisabche/validation'

import { Button, Input } from '@/components/ui'
import {
  EmptyState,
  ErrorState,
  FilterPill,
  ListSkeleton,
  Panel,
} from '@/components/admin-shell/admin-ui'
import {
  OAUTH_APP_STATUSES,
  useAdminAppReports,
  useAdminAppReviews,
  useAdminAppStats,
  useAdminAppVersions,
  useAdminOAuthApps,
  useAdminPublishers,
  useDecideAppVersion,
  useResolveAppReport,
  useSetAppStatus,
  useSetPublisherVerified,
  useSetReviewHidden,
  type AdminOAuthApp,
  type AdminReport,
  type AdminReview,
  type AdminVersion,
  type OAuthAppStatus,
} from '@/hooks/use-admin-oauth-apps'

/**
 * The marketplace, from the platform side: the review queue (with what a
 * reviewer must look at), the apps, publisher verification, abuse reports and
 * reviews. Every decision here is the server's to enforce; this screen only
 * asks for it and shows what came back.
 */

const TABS = ['versions', 'apps', 'publishers', 'reports', 'reviews'] as const
type Tab = (typeof TABS)[number]

/** A server value, worded only if it is on the closed list (t() throws otherwise). */
function closed(
  t: (key: string) => string,
  list: readonly string[],
  prefix: string,
  value: string,
) {
  return list.includes(value) ? t(`${prefix}.${value}`) : value
}

export function OAuthAppsClient() {
  const t = useTranslations()
  const [tab, setTab] = useState<Tab>('versions')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((option) => (
          <FilterPill key={option} selected={tab === option} onClick={() => setTab(option)}>
            {t(`admin.oauthApps.tabs.${option}`)}
          </FilterPill>
        ))}
      </div>
      {tab === 'versions' && <VersionsTab />}
      {tab === 'apps' && <AppsTab />}
      {tab === 'publishers' && <PublishersTab />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'reviews' && <ReviewsTab />}
    </div>
  )
}

// ─── versions in review ──────────────────────────────────────────────────────

function VersionsTab() {
  const t = useTranslations()
  const { data = [], isLoading, isError, refetch } = useAdminAppVersions()
  if (isError)
    return <ErrorState message={t('admin.error.generic')} onRetry={() => void refetch()} />
  if (isLoading) return <ListSkeleton />
  if (data.length === 0) return <EmptyState title={t('admin.oauthApps.noVersions')} />
  return (
    <ul className="space-y-2">
      {data.map((v) => (
        <VersionRow key={v.id} version={v} />
      ))}
    </ul>
  )
}

function VersionRow({ version: v }: { version: AdminVersion }) {
  const t = useTranslations()
  const decide = useDecideAppVersion()
  const [note, setNote] = useState('')
  const blocked = v.flags.some((f) => f.flag === 'LOCALHOST_REDIRECT')
  return (
    <Panel as="li" className="space-y-2 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">{v.appName}</span>
        <span dir="ltr" className="font-mono">
          {v.previousVersion ? `${v.previousVersion} → ` : ''}
          {v.version}
        </span>
        <span className="text-muted-foreground">
          {t('oauth.publisher')}: {v.publisher ?? t('oauth.unknownPublisher')}{' '}
          {v.publisherVerified ? `· ${t('oauth.verified')}` : ''}
        </span>
      </div>
      <p className="whitespace-pre-line text-xs">{v.changelog}</p>
      <div className="text-xs">
        <span className="text-muted-foreground">{t('oauth.redirectUris')}: </span>
        <span dir="ltr">{v.redirect_uris.join(' · ')}</span>
      </div>
      <div className="text-xs">
        <span className="text-muted-foreground">{t('oauth.scopes')}: </span>
        <code dir="ltr">{v.requested_scopes.join(' ')}</code>
      </div>
      {v.webhook_url ? (
        <div className="text-xs">
          <span className="text-muted-foreground">{t('oauth.manage.webhookUrl')}: </span>
          <code dir="ltr">
            {v.webhook_url} ({v.webhook_events.join(', ')})
          </code>
        </div>
      ) : null}
      {v.flags.length > 0 ? (
        <ul className="space-y-1 rounded-lg border border-border p-2 text-xs" data-risk-flags="">
          {v.flags.map((f) => (
            <li key={f.flag}>
              ⚠ {closed(t, APP_RISK_FLAGS, 'oauth.risk', f.flag)}
              {f.detail.length > 0 ? (
                <code dir="ltr" className="ms-2">
                  {f.detail.join(' ')}
                </code>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{t('admin.oauthApps.noFlags')}</p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[200px] flex-1 space-y-1">
          <span className="block text-[11px] text-muted-foreground">{t('oauth.reviewNote')}</span>
          <Input value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} />
        </label>
        <Button
          disabled={decide.isPending || blocked}
          onClick={() => decide.mutate({ id: v.id, decision: 'publish', note })}
        >
          {t('admin.oauthApps.publish')}
        </Button>
        <Button
          variant="outline"
          disabled={decide.isPending}
          onClick={() => decide.mutate({ id: v.id, decision: 'reject', note })}
        >
          {t('admin.oauthApps.reject')}
        </Button>
      </div>
      {blocked ? (
        <p className="text-xs text-destructive">{t('oauth.error.VERSION_HAS_LOCALHOST')}</p>
      ) : null}
      {decide.isError ? (
        <p role="alert" className="text-xs text-destructive">
          {apiErrorMessage(decide.error, t('admin.error.generic'))}
        </p>
      ) : null}
    </Panel>
  )
}

// ─── apps ────────────────────────────────────────────────────────────────────

function AppsTab() {
  const t = useTranslations()
  const [status, setStatus] = useState<OAuthAppStatus>('published')
  const { data = [], isLoading, isError, refetch } = useAdminOAuthApps(status)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {OAUTH_APP_STATUSES.map((option) => (
          <FilterPill key={option} selected={status === option} onClick={() => setStatus(option)}>
            {t(`oauth.status.${option}`)}
          </FilterPill>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t('admin.oauthApps.hint')}</p>
      {isError ? (
        <ErrorState message={t('admin.error.generic')} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <ListSkeleton />
      ) : data.length === 0 ? (
        <EmptyState title={t('admin.oauthApps.empty')} />
      ) : (
        <ul className="space-y-2">
          {data.map((app) => (
            <AppRow key={app.id} app={app} />
          ))}
        </ul>
      )}
    </div>
  )
}

function AppRow({ app }: { app: AdminOAuthApp }) {
  const t = useTranslations()
  const setStatus = useSetAppStatus()
  const [note, setNote] = useState('')
  const [revoke, setRevoke] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const stats = useAdminAppStats(showStats ? app.id : null)

  return (
    <Panel as="li" className="space-y-2 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">{app.name}</span>
        <span className="text-muted-foreground">
          {t('oauth.publisher')}: {app.publisher ?? t('oauth.unknownPublisher')}{' '}
          {app.publisherVerified ? `· ${t('oauth.verified')}` : ''}
        </span>
        <code dir="ltr" className="select-all font-mono text-xs">
          {app.client_id}
        </code>
      </div>
      {app.review_note ? (
        <p className="text-xs text-muted-foreground">
          {t('oauth.reviewNote')}: {app.review_note}
        </p>
      ) : null}
      <Button variant="outline" onClick={() => setShowStats(!showStats)}>
        {t('oauth.manage.analytics')}
      </Button>
      {showStats && stats.data ? (
        <p className="text-xs" data-app-stats="">
          {t('oauth.manage.health')}:{' '}
          {closed(t, APP_HEALTH_LEVELS, 'oauth.health', stats.data.health.level)} ·{' '}
          {t('oauth.manage.activeInstalls')}: {stats.data.installs.active} ·{' '}
          {t('oauth.manage.requests24h')}: {stats.data.requests24h} ·{' '}
          {t('oauth.manage.serverErrors24h')}: {stats.data.serverErrors24h} ·{' '}
          {t('oauth.manage.failedDeliveries24h')}: {stats.data.failedDeliveries24h}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[200px] flex-1 space-y-1">
          <span className="block text-[11px] text-muted-foreground">{t('oauth.reviewNote')}</span>
          <Input value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} />
        </label>
        {app.status === 'suspended' ? (
          <Button
            disabled={setStatus.isPending}
            onClick={() =>
              setStatus.mutate({
                id: app.id,
                action: 'reinstate',
                revokeInstallations: false,
                note,
              })
            }
          >
            {t('admin.oauthApps.reinstate')}
          </Button>
        ) : (
          <>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={revoke}
                onChange={(e) => setRevoke(e.target.checked)}
              />
              {t('admin.oauthApps.revokeInstallations')}
            </label>
            <Button
              variant="outline"
              disabled={setStatus.isPending}
              onClick={() =>
                setStatus.mutate({
                  id: app.id,
                  action: 'suspend',
                  revokeInstallations: revoke,
                  note,
                })
              }
            >
              {t('admin.oauthApps.suspend')}
            </Button>
          </>
        )}
      </div>
      {setStatus.isError ? (
        <p role="alert" className="text-xs text-destructive">
          {apiErrorMessage(setStatus.error, t('admin.error.generic'))}
        </p>
      ) : null}
    </Panel>
  )
}

// ─── publishers ──────────────────────────────────────────────────────────────

function PublishersTab() {
  const t = useTranslations()
  const { data = [], isLoading, isError, refetch } = useAdminPublishers()
  const verify = useSetPublisherVerified()
  if (isError)
    return <ErrorState message={t('admin.error.generic')} onRetry={() => void refetch()} />
  if (isLoading) return <ListSkeleton />
  if (data.length === 0) return <EmptyState title={t('admin.oauthApps.noPublishers')} />
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{t('admin.oauthApps.verifyHint')}</p>
      <ul className="space-y-2">
        {data.map((p) => (
          <Panel
            as="li"
            key={p.workspace_id}
            className="flex flex-wrap items-center gap-3 p-4 text-sm"
          >
            <span className="font-medium">{p.display_name}</span>
            <span className="text-muted-foreground">{p.workspaceName}</span>
            {p.website_url ? (
              <a
                href={p.website_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                dir="ltr"
                className="text-xs underline-offset-4 hover:underline"
              >
                {p.website_url}
              </a>
            ) : null}
            <span className="ms-auto text-xs">
              {p.verified_at ? t('oauth.verified') : t('oauth.notVerified')}
            </span>
            <Button
              variant={p.verified_at ? 'outline' : 'default'}
              disabled={verify.isPending}
              onClick={() =>
                verify.mutate({ workspaceId: p.workspace_id, verified: !p.verified_at })
              }
            >
              {p.verified_at ? t('admin.oauthApps.unverify') : t('admin.oauthApps.verify')}
            </Button>
          </Panel>
        ))}
      </ul>
    </div>
  )
}

// ─── reports ─────────────────────────────────────────────────────────────────

function ReportsTab() {
  const t = useTranslations()
  const [status, setStatus] = useState<'open' | 'resolved' | 'dismissed'>('open')
  const { data = [], isLoading, isError, refetch } = useAdminAppReports(status)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(['open', 'resolved', 'dismissed'] as const).map((option) => (
          <FilterPill key={option} selected={status === option} onClick={() => setStatus(option)}>
            {t(`admin.oauthApps.reportStatus.${option}`)}
          </FilterPill>
        ))}
      </div>
      {isError ? (
        <ErrorState message={t('admin.error.generic')} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <ListSkeleton />
      ) : data.length === 0 ? (
        <EmptyState title={t('admin.oauthApps.noReports')} />
      ) : (
        <ul className="space-y-2">
          {data.map((r) => (
            <ReportRow key={r.id} report={r} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ReportRow({ report: r }: { report: AdminReport }) {
  const t = useTranslations()
  const resolve = useResolveAppReport()
  const [note, setNote] = useState('')
  return (
    <Panel as="li" className="space-y-2 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">{r.appName}</span>
        <span>{closed(t, APP_REPORT_REASONS, 'marketplace.reason', r.reason)}</span>
        <span className="text-muted-foreground">{r.reporter}</span>
        <time
          className="text-xs text-muted-foreground"
          dateTime={r.created_at}
          suppressHydrationWarning
        >
          {new Date(r.created_at).toLocaleString()}
        </time>
      </div>
      {r.details ? <p className="whitespace-pre-line text-xs">{r.details}</p> : null}
      {r.status === 'open' ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[200px] flex-1 space-y-1">
            <span className="block text-[11px] text-muted-foreground">
              {t('admin.oauthApps.resolutionNote')}
            </span>
            <Input
              value={note}
              maxLength={1000}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <Button
            disabled={resolve.isPending}
            onClick={() => resolve.mutate({ id: r.id, status: 'resolved', note })}
          >
            {t('admin.oauthApps.resolve')}
          </Button>
          <Button
            variant="outline"
            disabled={resolve.isPending}
            onClick={() => resolve.mutate({ id: r.id, status: 'dismissed', note })}
          >
            {t('admin.oauthApps.dismiss')}
          </Button>
        </div>
      ) : r.resolution_note ? (
        <p className="text-xs text-muted-foreground">{r.resolution_note}</p>
      ) : null}
      <p className="text-xs text-muted-foreground">{t('admin.oauthApps.reportHint')}</p>
      {resolve.isError ? (
        <p role="alert" className="text-xs text-destructive">
          {apiErrorMessage(resolve.error, t('admin.error.generic'))}
        </p>
      ) : null}
    </Panel>
  )
}

// ─── reviews ─────────────────────────────────────────────────────────────────

function ReviewsTab() {
  const t = useTranslations()
  const [hidden, setHidden] = useState(false)
  const { data = [], isLoading, isError, refetch } = useAdminAppReviews(hidden)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <FilterPill selected={!hidden} onClick={() => setHidden(false)}>
          {t('admin.oauthApps.visibleReviews')}
        </FilterPill>
        <FilterPill selected={hidden} onClick={() => setHidden(true)}>
          {t('admin.oauthApps.hiddenReviews')}
        </FilterPill>
      </div>
      {isError ? (
        <ErrorState message={t('admin.error.generic')} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <ListSkeleton />
      ) : data.length === 0 ? (
        <EmptyState title={t('admin.oauthApps.noReviews')} />
      ) : (
        <ul className="space-y-2">
          {data.map((r) => (
            <ReviewRow key={r.id} review={r} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ReviewRow({ review: r }: { review: AdminReview }) {
  const t = useTranslations()
  const setHidden = useSetReviewHidden()
  const [reason, setReason] = useState('')
  return (
    <Panel as="li" className="space-y-2 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">{r.appName}</span>
        <span className="tabular-nums">{'★'.repeat(r.rating)}</span>
        <span className="text-muted-foreground">{r.reviewer}</span>
      </div>
      {r.body ? <p className="whitespace-pre-line text-xs">{r.body}</p> : null}
      {r.hidden_reason ? <p className="text-xs text-muted-foreground">{r.hidden_reason}</p> : null}
      <div className="flex flex-wrap items-end gap-2">
        {!r.hidden_at ? (
          <label className="min-w-[200px] flex-1 space-y-1">
            <span className="block text-[11px] text-muted-foreground">
              {t('admin.oauthApps.hideReason')}
            </span>
            <Input
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        ) : null}
        <Button
          variant="outline"
          disabled={setHidden.isPending}
          onClick={() => setHidden.mutate({ id: r.id, hidden: !r.hidden_at, reason })}
        >
          {r.hidden_at ? t('admin.oauthApps.unhide') : t('admin.oauthApps.hide')}
        </Button>
      </div>
      {setHidden.isError ? (
        <p role="alert" className="text-xs text-destructive">
          {apiErrorMessage(setHidden.error, t('admin.error.generic'))}
        </p>
      ) : null}
    </Panel>
  )
}
