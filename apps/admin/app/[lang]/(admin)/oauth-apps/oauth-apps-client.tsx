'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiErrorMessage } from '@hisabche/api'

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
  useAdminOAuthApps,
  useReviewOAuthApp,
  type AdminOAuthApp,
  type OAuthAppStatus,
  type ReviewDecision,
} from '@/hooks/use-admin-oauth-apps'

/** Which decisions make sense from each state — the server accepts any, the screen offers the sensible ones. */
const DECISIONS: Record<OAuthAppStatus, ReviewDecision[]> = {
  private: [],
  in_review: ['published', 'rejected'],
  published: ['suspended'],
  rejected: [],
  suspended: ['published'],
}

export function OAuthAppsClient() {
  const t = useTranslations()
  const [status, setStatus] = useState<OAuthAppStatus>('in_review')
  const { data: apps = [], isLoading, isError, refetch } = useAdminOAuthApps(status)

  return (
    <div className="space-y-4">
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
      ) : apps.length === 0 ? (
        <EmptyState title={t('admin.oauthApps.empty')} />
      ) : (
        <ul className="space-y-2">
          {apps.map((app) => (
            <AppRow key={app.id} app={app} />
          ))}
        </ul>
      )}
    </div>
  )
}

function AppRow({ app }: { app: AdminOAuthApp }) {
  const t = useTranslations()
  const review = useReviewOAuthApp()
  const [note, setNote] = useState('')
  const decisions = DECISIONS[app.status] ?? []

  return (
    <Panel as="li" className="space-y-2 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">{app.name}</span>
        <span className="text-muted-foreground">
          {t('oauth.publisher')}: {app.publisher ?? t('oauth.unknownPublisher')}
        </span>
        <code dir="ltr" className="select-all font-mono text-xs">
          {app.client_id}
        </code>
      </div>
      {app.description ? <p className="text-muted-foreground">{app.description}</p> : null}
      {app.homepage_url ? (
        <a
          href={app.homepage_url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          dir="ltr"
          className="text-xs underline-offset-4 hover:underline"
        >
          {app.homepage_url}
        </a>
      ) : null}
      <div className="text-xs">
        <span className="text-muted-foreground">{t('oauth.redirectUris')}: </span>
        <span dir="ltr">{app.redirect_uris.join(' · ')}</span>
      </div>
      <div className="text-xs">
        <span className="text-muted-foreground">{t('oauth.scopes')}: </span>
        <code dir="ltr">{app.requested_scopes.join(' ')}</code>
      </div>
      {app.review_note ? (
        <p className="text-xs text-muted-foreground">
          {t('oauth.reviewNote')}: {app.review_note}
        </p>
      ) : null}

      {decisions.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[200px] flex-1 space-y-1">
            <span className="block text-[11px] text-muted-foreground">{t('oauth.reviewNote')}</span>
            <Input
              value={note}
              maxLength={1000}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          {decisions.map((decision) => (
            <Button
              key={decision}
              variant={decision === 'published' ? 'default' : 'outline'}
              disabled={review.isPending}
              onClick={() => review.mutate({ id: app.id, decision, note })}
            >
              {t(`admin.oauthApps.decide.${decision}`)}
            </Button>
          ))}
        </div>
      ) : null}

      {review.isError ? (
        <p role="alert" className="text-xs text-destructive">
          {apiErrorMessage(review.error, t('admin.error.generic'))}
        </p>
      ) : null}
    </Panel>
  )
}
