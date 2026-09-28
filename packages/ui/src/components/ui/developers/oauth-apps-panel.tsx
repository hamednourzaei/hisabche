'use client'

// ============================================
// packages/ui/src/components/ui/developers/oauth-apps-panel.tsx
//
// OAuth apps, from both sides. Props only.
//
//   · Your apps — what this business publishes for OTHER businesses to
//     install. Private until a platform admin publishes it; the publisher can
//     test it on their own workspace meanwhile.
//   · Installed apps — which apps hold a token into THIS business, and what
//     each may do. Uninstall = revoke that token.
//   · Marketplace — published apps. Empty is said as empty, never padded.
// ============================================

import { memo, useState } from 'react'
import type { ApiKeyScope } from '@hisabche/validation'
import type { InstalledAppRow, MarketplaceAppRow, OAuthAppRow } from '@hisabche/api'
import { AppWindow, Copy, RefreshCw, Send, Trash2 } from 'lucide-react'

import { Badge } from '../badge'
import { Button } from '../button'
import { Card, CardContent } from '../card'
import { Input } from '../input'
import { oauthStatusLabel } from '../../../lib/oauth-labels'
import { CheckList } from './check-list'
import type { SectionState } from './developers-view'

type T = (key: string, fallback?: string) => string

export interface OAuthAppsPanelProps {
  t: T
  formatDate: (iso: string) => string
  scopes: ApiKeyScope[]

  appsState: SectionState
  apps: OAuthAppRow[]
  creatingApp: boolean
  onCreateApp: (input: {
    name: string
    description: string
    homepageUrl?: string | undefined
    redirectUris: string[]
    requestedScopes: ApiKeyScope[]
  }) => void
  busyAppId: string | null
  onSubmitApp: (id: string) => void
  onRotateAppSecret: (id: string) => void
  onDeleteApp: (id: string) => void

  installedState: SectionState
  installed: InstalledAppRow[]
  uninstallingKeyId: string | null
  onUninstall: (keyId: string) => void

  marketplaceState: SectionState
  marketplace: MarketplaceAppRow[]

  /** Where an app sends a person to approve it (this site + /<lang>/oauth/authorize). */
  authorizeUrl: string
  /** Where the app's server trades the code for a token. */
  tokenUrl: string
  onCopy: (value: string) => void
}

const scopeKey = (scope: string) => `developer.scope.${scope.replace(':', '_')}`

const STATUS_VARIANT: Record<
  OAuthAppRow['status'],
  'secondary' | 'success' | 'warning' | 'destructive'
> = {
  private: 'secondary',
  in_review: 'warning',
  published: 'success',
  rejected: 'destructive',
  suspended: 'destructive',
}

function SectionMessage({ state, t }: { state: SectionState; t: T }) {
  if (state === 'ready') return null
  const key =
    state === 'loading'
      ? 'developer.loading'
      : state === 'not-configured'
        ? 'oauth.notConfigured'
        : state === 'forbidden'
          ? 'developer.forbidden'
          : 'developer.loadError'
  return (
    <p
      className={
        state === 'error'
          ? 'text-sm text-[hsl(var(--color-destructive))]'
          : 'text-sm text-[hsl(var(--fg-secondary))]'
      }
    >
      {t(key)}
    </p>
  )
}

function ScopeBadges({ scopes, t }: { scopes: string[]; t: T }) {
  return (
    <div className="flex flex-wrap gap-1">
      {scopes.map((s) => (
        <Badge key={s} variant="outline">
          {t(scopeKey(s), s)}
        </Badge>
      ))}
    </div>
  )
}

export const OAuthAppsPanel = memo(function OAuthAppsPanel(props: OAuthAppsPanelProps) {
  const { t } = props
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [homepage, setHomepage] = useState('')
  const [redirects, setRedirects] = useState('')
  const [scopes, setScopes] = useState<ApiKeyScope[]>([])

  const redirectList = redirects
    .split(/\s+/)
    .map((r) => r.trim())
    .filter(Boolean)
  const canCreate =
    name.trim().length > 0 && redirectList.length > 0 && scopes.length > 0 && !props.creatingApp

  return (
    <Card>
      <CardContent className="space-y-5 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <AppWindow className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-[hsl(var(--fg-primary))]">
            {t('oauth.title')}
          </h2>
        </div>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('oauth.help')}</p>

        {/* ─── installed in this business ─────────────────────────────── */}
        <section className="space-y-2">
          <h3 className="font-medium text-[hsl(var(--fg-primary))]">{t('oauth.installedTitle')}</h3>
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('oauth.installedHelp')}</p>
          <SectionMessage state={props.installedState} t={t} />
          {props.installedState === 'ready' &&
            (props.installed.length === 0 ? (
              <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('oauth.noInstalled')}</p>
            ) : (
              <ul className="space-y-2">
                {props.installed.map((row) => (
                  <li
                    key={row.keyId}
                    className="space-y-2 rounded-xl bg-[hsl(var(--surface-muted))] p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{row.appName ?? t('oauth.unknownApp')}</span>
                      <Button
                        size="sm"
                        variant="destructive"
                        loading={props.uninstallingKeyId === row.keyId}
                        onClick={() => props.onUninstall(row.keyId)}
                      >
                        {t('oauth.uninstall')}
                      </Button>
                    </div>
                    <ScopeBadges scopes={row.scopes} t={t} />
                    <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                      {t('oauth.installedAt')}: {props.formatDate(row.installedAt)} ·{' '}
                      {t('developer.lastUsed')}:{' '}
                      {row.lastUsedAt ? props.formatDate(row.lastUsedAt) : t('developer.neverUsed')}
                    </p>
                  </li>
                ))}
              </ul>
            ))}
        </section>

        {/* ─── marketplace ────────────────────────────────────────────── */}
        <section className="space-y-2 border-t border-[hsl(var(--border-default))] pt-4">
          <h3 className="font-medium text-[hsl(var(--fg-primary))]">
            {t('oauth.marketplaceTitle')}
          </h3>
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('oauth.marketplaceHelp')}</p>
          <SectionMessage state={props.marketplaceState} t={t} />
          {props.marketplaceState === 'ready' &&
            (props.marketplace.length === 0 ? (
              <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('oauth.noMarketplace')}</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {props.marketplace.map((app) => (
                  <li
                    key={app.id}
                    className="space-y-2 rounded-xl bg-[hsl(var(--surface-muted))] p-3 text-sm"
                  >
                    <p className="font-medium">{app.name}</p>
                    <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                      {t('oauth.publisher')}: {app.publisher ?? t('oauth.unknownPublisher')}
                    </p>
                    {app.description && (
                      <p className="text-[hsl(var(--fg-secondary))]">{app.description}</p>
                    )}
                    <ScopeBadges scopes={app.scopes} t={t} />
                    {app.homepageUrl && (
                      <a
                        href={app.homepageUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-[hsl(var(--color-primary))] underline-offset-4 hover:underline"
                      >
                        {t('oauth.visit')}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ))}
        </section>

        {/* ─── apps this business publishes ───────────────────────────── */}
        <section className="space-y-3 border-t border-[hsl(var(--border-default))] pt-4">
          <h3 className="font-medium text-[hsl(var(--fg-primary))]">{t('oauth.appsTitle')}</h3>
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('oauth.appsHelp')}</p>
          <SectionMessage state={props.appsState} t={t} />
          {props.appsState === 'ready' && (
            <>
              {props.apps.length === 0 ? (
                <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('oauth.noApps')}</p>
              ) : (
                <ul className="space-y-3">
                  {props.apps.map((app) => {
                    const editable = app.status === 'private' || app.status === 'rejected'
                    const busy = props.busyAppId === app.id
                    return (
                      <li
                        key={app.id}
                        className="space-y-2 rounded-xl bg-[hsl(var(--surface-muted))] p-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{app.name}</span>
                          <Badge variant={STATUS_VARIANT[app.status] ?? 'secondary'}>
                            {oauthStatusLabel(t, app.status)}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                            {t('oauth.clientId')}
                          </span>
                          <code
                            dir="ltr"
                            className="break-all rounded bg-[hsl(var(--surface-elevated))] px-2 py-0.5 text-xs"
                          >
                            {app.client_id}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={t('developer.copy')}
                            onClick={() => props.onCopy(app.client_id)}
                          >
                            <Copy className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                        <ul
                          dir="ltr"
                          className="space-y-0.5 text-xs text-[hsl(var(--fg-secondary))]"
                        >
                          {app.redirect_uris.map((u) => (
                            <li key={u}>{u}</li>
                          ))}
                        </ul>
                        <ScopeBadges scopes={app.requested_scopes} t={t} />
                        {app.review_note && (
                          <p className="text-xs text-[hsl(var(--fg-secondary))]">
                            {t('oauth.reviewNote')}: {app.review_note}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {editable && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => props.onSubmitApp(app.id)}
                            >
                              <Send className="size-4" aria-hidden="true" />
                              {t('oauth.submit')}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => props.onRotateAppSecret(app.id)}
                          >
                            <RefreshCw className="size-4" aria-hidden="true" />
                            {t('oauth.rotateSecret')}
                          </Button>
                          {app.status !== 'published' && (
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={busy}
                              onClick={() => props.onDeleteApp(app.id)}
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                              {t('developer.delete')}
                            </Button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}

              <div className="space-y-1 rounded-xl border border-[hsl(var(--border-default))] p-3 text-xs">
                <p className="font-medium text-[hsl(var(--fg-primary))]">
                  {t('oauth.integrationTitle')}
                </p>
                <p className="text-[hsl(var(--fg-secondary))]">{t('oauth.integrationHelp')}</p>
                <p dir="ltr" className="break-all">
                  GET {props.authorizeUrl}
                  ?client_id=…&amp;redirect_uri=…&amp;scope=…&amp;state=…&amp;code_challenge=…&amp;code_challenge_method=S256
                </p>
                <p dir="ltr" className="break-all">
                  POST {props.tokenUrl} (application/x-www-form-urlencoded:
                  grant_type=authorization_code, code, redirect_uri, client_id, client_secret,
                  code_verifier)
                </p>
              </div>

              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!canCreate) return
                  props.onCreateApp({
                    name: name.trim(),
                    description: description.trim(),
                    homepageUrl: homepage.trim() || undefined,
                    redirectUris: redirectList,
                    requestedScopes: scopes,
                  })
                  setName('')
                  setDescription('')
                  setHomepage('')
                  setRedirects('')
                  setScopes([])
                }}
              >
                <p className="font-medium text-[hsl(var(--fg-primary))]">{t('oauth.newApp')}</p>
                <Input
                  name="name"
                  value={name}
                  maxLength={80}
                  placeholder={t('oauth.appNamePlaceholder')}
                  aria-label={t('oauth.appName')}
                  onChange={(e) => setName(e.target.value)}
                />
                <Input
                  name="description"
                  value={description}
                  maxLength={1000}
                  placeholder={t('oauth.appDescription')}
                  aria-label={t('oauth.appDescription')}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <Input
                  name="homepageUrl"
                  dir="ltr"
                  value={homepage}
                  placeholder="https://myapp.com"
                  aria-label={t('oauth.homepage')}
                  onChange={(e) => setHomepage(e.target.value)}
                />
                <textarea
                  name="redirectUris"
                  dir="ltr"
                  rows={2}
                  value={redirects}
                  placeholder="https://myapp.com/oauth/callback"
                  aria-label={t('oauth.redirectUris')}
                  onChange={(e) => setRedirects(e.target.value)}
                  className="w-full rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 py-2 text-sm"
                />
                <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                  {t('oauth.redirectUrisHelp')}
                </p>
                <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('oauth.scopes')}</p>
                <CheckList
                  name="requestedScopes"
                  values={props.scopes}
                  selected={scopes}
                  onChange={setScopes}
                  label={(s) => t(scopeKey(s), s)}
                />
                <Button type="submit" size="sm" disabled={!canCreate} loading={props.creatingApp}>
                  {t('oauth.createApp')}
                </Button>
              </form>
            </>
          )}
        </section>
      </CardContent>
    </Card>
  )
})

OAuthAppsPanel.displayName = 'OAuthAppsPanel'
