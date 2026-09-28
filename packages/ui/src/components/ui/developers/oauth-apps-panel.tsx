'use client'

// ============================================
// packages/ui/src/components/ui/developers/oauth-apps-panel.tsx
//
// OAuth apps, from both sides. Props only.
//
//   · Installed apps — which apps hold a token into THIS business, at which
//     version, and what each may do. An update is shown as what it changes
//     before anyone approves it. Uninstall = revoke that token.
//   · The marketplace is its own screen (marketplaceHref) — one place.
//   · Your apps — the publisher profile, the apps this business publishes,
//     and each app's management panel.
// ============================================

import { memo, useState } from 'react'
import type { ApiKeyScope, PublisherProfileInput, WebhookEventType } from '@hisabche/validation'
import type {
  AppUpdatePreview,
  InstalledAppRow,
  OAuthAppRow,
  PublisherProfile,
} from '@hisabche/api'
import { AppWindow, BadgeCheck, Copy, RefreshCw, Store, Trash2 } from 'lucide-react'

import { Badge } from '../badge'
import { Button } from '../button'
import { Card, CardContent } from '../card'
import { Input } from '../input'
import { oauthStatusLabel } from '../../../lib/oauth-labels'
import { AppManagePanel, type AppManagePanelProps } from './app-manage-panel'
import { CheckList } from './check-list'
import type { SectionState } from './developers-view'

type T = (key: string, fallback?: string) => string

export interface OAuthAppsPanelProps {
  t: T
  formatDate: (iso: string) => string
  scopes: ApiKeyScope[]
  events: WebhookEventType[]
  marketplaceHref: string
  listingHref: (slug: string) => string

  installedState: SectionState
  installed: InstalledAppRow[]
  uninstallingId: string | null
  onUninstall: (installationId: string) => void
  /** The installation whose update is being reviewed, and what it would change. */
  updateFor: string | null
  onReviewUpdate: (installationId: string | null) => void
  updateState: SectionState
  updatePreview: AppUpdatePreview | null
  applyingUpdate: boolean
  onApplyUpdate: (installationId: string) => void

  publisherState: SectionState
  publisher: PublisherProfile | null
  savingPublisher: boolean
  onSavePublisher: (input: PublisherProfileInput) => void

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
  onRotateAppSecret: (id: string) => void
  onDeleteApp: (id: string) => void
  managedAppId: string | null
  onManage: (id: string | null) => void
  manage: Omit<AppManagePanelProps, 't' | 'formatDate' | 'scopes' | 'events' | 'app'> | null

  /** Where an app sends a person to approve it (this site + /oauth/authorize). */
  authorizeUrl: string
  /** Where the app's server trades the code for a token. */
  tokenUrl: string
  onCopy: (value: string) => void
}

const scopeKey = (scope: string) => `developer.scope.${scope.replace(':', '_')}`
const eventKey = (event: string) => `developer.event.${event.replace('.', '_')}`

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

function PublisherForm({
  t,
  profile,
  saving,
  onSave,
}: {
  t: T
  profile: PublisherProfile | null
  saving: boolean
  onSave: (input: PublisherProfileInput) => void
}) {
  const [name, setName] = useState(profile?.display_name ?? '')
  const [website, setWebsite] = useState(profile?.website_url ?? '')
  const [email, setEmail] = useState(profile?.support_email ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')

  return (
    <form
      className="space-y-2 rounded-xl bg-[hsl(var(--surface-muted))] p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        onSave({
          displayName: name.trim(),
          websiteUrl: website.trim() || null,
          supportEmail: email.trim() || null,
          bio: bio.trim(),
        })
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-[hsl(var(--fg-primary))]">
          {t('oauth.publisherProfile.title')}
        </p>
        {profile?.verified_at ? (
          <Badge variant="success">
            <BadgeCheck className="size-3.5" aria-hidden="true" />
            {t('oauth.verified')}
          </Badge>
        ) : (
          profile && <Badge variant="secondary">{t('oauth.notVerified')}</Badge>
        )}
      </div>
      <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('oauth.publisherProfile.help')}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          name="displayName"
          value={name}
          maxLength={80}
          placeholder={t('oauth.publisherProfile.name')}
          aria-label={t('oauth.publisherProfile.name')}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          name="websiteUrl"
          dir="ltr"
          value={website}
          placeholder="https://"
          aria-label={t('oauth.publisherProfile.website')}
          onChange={(e) => setWebsite(e.target.value)}
        />
        <Input
          name="supportEmail"
          dir="ltr"
          type="email"
          value={email}
          placeholder="support@"
          aria-label={t('oauth.publisherProfile.email')}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <textarea
        name="bio"
        rows={2}
        maxLength={1000}
        value={bio}
        placeholder={t('oauth.publisherProfile.bio')}
        aria-label={t('oauth.publisherProfile.bio')}
        onChange={(e) => setBio(e.target.value)}
        className="w-full rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 py-2 text-sm"
      />
      <Button type="submit" size="sm" loading={saving} disabled={!name.trim()}>
        {t('oauth.publisherProfile.save')}
      </Button>
    </form>
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AppWindow className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-[hsl(var(--fg-primary))]">
              {t('oauth.title')}
            </h2>
          </div>
          <a
            href={props.marketplaceHref}
            className="inline-flex items-center gap-1 text-sm text-[hsl(var(--color-primary))] underline-offset-4 hover:underline"
          >
            <Store className="size-4" aria-hidden="true" />
            {t('oauth.openMarketplace')}
          </a>
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
                    key={row.installationId}
                    className="space-y-2 rounded-xl bg-[hsl(var(--surface-muted))] p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {row.slug ? (
                          <a
                            href={props.listingHref(row.slug)}
                            className="font-medium underline-offset-4 hover:underline"
                          >
                            {row.appName ?? t('oauth.unknownApp')}
                          </a>
                        ) : (
                          <span className="font-medium">
                            {row.appName ?? t('oauth.unknownApp')}
                          </span>
                        )}
                        <Badge variant="outline">
                          <span dir="ltr">{row.version ?? t('oauth.draftInstall')}</span>
                        </Badge>
                        {row.suspended && (
                          <Badge variant="destructive">{t('oauth.status.suspended')}</Badge>
                        )}
                        {row.updateAvailable && (
                          <Badge variant="warning">{t('oauth.update.available')}</Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {row.updateAvailable && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              props.onReviewUpdate(
                                props.updateFor === row.installationId ? null : row.installationId,
                              )
                            }
                          >
                            <RefreshCw className="size-4" aria-hidden="true" />
                            {t('oauth.update.review')}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          loading={props.uninstallingId === row.installationId}
                          onClick={() => props.onUninstall(row.installationId)}
                        >
                          {t('oauth.uninstall')}
                        </Button>
                      </div>
                    </div>
                    <ScopeBadges scopes={row.scopes} t={t} />
                    <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                      {t('oauth.installedAt')}: {props.formatDate(row.installedAt)} ·{' '}
                      {t('developer.lastUsed')}:{' '}
                      {row.lastUsedAt ? props.formatDate(row.lastUsedAt) : t('developer.neverUsed')}
                      {row.receivesWebhooks ? ` · ${t('oauth.receivesWebhooks')}` : ''}
                    </p>

                    {props.updateFor === row.installationId && (
                      <div className="space-y-2 rounded-lg border border-[hsl(var(--border-default))] p-2">
                        {props.updateState !== 'ready' || !props.updatePreview ? (
                          <SectionMessage
                            state={props.updateState === 'ready' ? 'loading' : props.updateState}
                            t={t}
                          />
                        ) : (
                          <>
                            <p className="font-medium" dir="ltr">
                              {props.updatePreview.fromVersion ?? '—'} →{' '}
                              {props.updatePreview.toVersion}
                            </p>
                            <p className="whitespace-pre-line text-xs text-[hsl(var(--fg-secondary))]">
                              {props.updatePreview.changelog}
                            </p>
                            {props.updatePreview.added.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-xs font-medium">{t('oauth.update.adds')}</p>
                                <ScopeBadges scopes={props.updatePreview.added} t={t} />
                              </div>
                            )}
                            {props.updatePreview.removed.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-xs font-medium">{t('oauth.update.removes')}</p>
                                <ScopeBadges scopes={props.updatePreview.removed} t={t} />
                              </div>
                            )}
                            {props.updatePreview.refused.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-xs font-medium">
                                  {t('oauth.consent.willNotGrant')}
                                </p>
                                <ScopeBadges
                                  scopes={props.updatePreview.refused.map((r) => r.scope)}
                                  t={t}
                                />
                              </div>
                            )}
                            {props.updatePreview.added.length === 0 &&
                              props.updatePreview.removed.length === 0 && (
                                <p className="text-xs text-[hsl(var(--fg-secondary))]">
                                  {t('oauth.update.noPermissionChange')}
                                </p>
                              )}
                            {props.updatePreview.events.length > 0 && (
                              <p className="text-xs text-[hsl(var(--fg-secondary))]">
                                {t('oauth.update.events')}:{' '}
                                {props.updatePreview.events
                                  .map((e) => t(eventKey(e), e))
                                  .join('، ')}
                              </p>
                            )}
                            <Button
                              size="sm"
                              loading={props.applyingUpdate}
                              onClick={() => props.onApplyUpdate(row.installationId)}
                            >
                              {t('oauth.update.apply')}
                            </Button>
                          </>
                        )}
                      </div>
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
          <SectionMessage state={props.publisherState} t={t} />
          {props.publisherState === 'ready' && (
            <PublisherForm
              key={`${props.publisher?.display_name ?? ''}|${props.publisher?.verified_at ?? ''}|${props.publisher?.website_url ?? ''}`}
              t={t}
              profile={props.publisher}
              saving={props.savingPublisher}
              onSave={props.onSavePublisher}
            />
          )}
          <SectionMessage state={props.appsState} t={t} />
          {props.appsState === 'ready' && (
            <>
              {props.apps.length === 0 ? (
                <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('oauth.noApps')}</p>
              ) : (
                <ul className="space-y-3">
                  {props.apps.map((app) => {
                    const busy = props.busyAppId === app.id
                    const open = props.managedAppId === app.id
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
                        {app.review_note && (
                          <p className="text-xs text-[hsl(var(--fg-secondary))]">
                            {t('oauth.reviewNote')}: {app.review_note}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant={open ? 'default' : 'outline'}
                            onClick={() => props.onManage(open ? null : app.id)}
                          >
                            {t('oauth.manage.open')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => props.onRotateAppSecret(app.id)}
                          >
                            <RefreshCw className="size-4" aria-hidden="true" />
                            {t('oauth.rotateSecret')}
                          </Button>
                          {!app.published_version_id && (
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
                        {open && props.manage && (
                          <AppManagePanel
                            key={`${app.id}|${app.updated_at}`}
                            t={t}
                            formatDate={props.formatDate}
                            scopes={props.scopes}
                            events={props.events}
                            app={app}
                            {...props.manage}
                          />
                        )}
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
                  ?response_type=code&amp;client_id=…&amp;redirect_uri=…&amp;scope=…&amp;state=…&amp;code_challenge=…&amp;code_challenge_method=S256
                </p>
                <p dir="ltr" className="break-all">
                  POST {props.tokenUrl} (application/x-www-form-urlencoded:
                  grant_type=authorization_code, code, redirect_uri, client_id, client_secret,
                  code_verifier)
                </p>
                <p className="text-[hsl(var(--fg-secondary))]">{t('oauth.integrationWebhooks')}</p>
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
