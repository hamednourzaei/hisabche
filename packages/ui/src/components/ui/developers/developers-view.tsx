'use client'

// ============================================
// packages/ui/src/components/ui/developers/developers-view.tsx
//
// API keys and webhooks. Props only — every hook is in the container.
//
// Three things this screen must never blur (راهنمای سشن §۷٫۳، §۷٫۶):
//   · «not set up on the server yet» (503) is not «you have no keys»;
//   · «only the owner may do this» (403) is not «you have no keys»;
//   · a failed request is not an empty list.
// ============================================

import { memo, useState } from 'react'
import type { ApiKeyScope, WebhookEventType } from '@hisabche/validation'
import type { ApiKeyRow, ApiKeyUsage, WebhookDeliveryRow, WebhookEndpointRow } from '@hisabche/api'
import { Copy, KeyRound, Loader2, RefreshCw, Send, Trash2, Webhook } from 'lucide-react'

import { Badge } from '../badge'
import { Button } from '../button'
import { Card, CardContent } from '../card'
import { Input } from '../input'
import { CheckList } from './check-list'
import { KeyUsagePanel } from './key-usage-panel'
import { OAuthAppsPanel, type OAuthAppsPanelProps } from './oauth-apps-panel'
import { SandboxPanel, type SandboxPanelProps } from './sandbox-panel'
import { StorefrontPanel, type StorefrontPanelProps } from './storefront-panel'

type T = (key: string, fallback?: string) => string

/** Why a section has nothing to show — each says something different. */
export type SectionState = 'loading' | 'ready' | 'not-configured' | 'forbidden' | 'error'

export interface DevelopersViewProps {
  t: T
  formatDate: (iso: string) => string
  scopes: ApiKeyScope[]
  events: WebhookEventType[]

  keysState: SectionState
  keysError: string | null
  keys: ApiKeyRow[]
  onCreateKey: (input: {
    name: string
    scopes: ApiKeyScope[]
    expiresInDays?: number | undefined
  }) => void
  creatingKey: boolean
  onRevokeKey: (id: string) => void
  revokingKeyId: string | null
  /** The key whose usage is open, and what its usage read returned. */
  usageKeyId: string | null
  onToggleUsage: (id: string | null) => void
  usageState: SectionState
  usage: ApiKeyUsage | null

  endpointsState: SectionState
  endpointsError: string | null
  endpoints: WebhookEndpointRow[]
  onCreateEndpoint: (input: {
    url: string
    description?: string | undefined
    events: WebhookEventType[]
  }) => void
  creatingEndpoint: boolean
  onToggleEndpoint: (id: string, isActive: boolean) => void
  onDeleteEndpoint: (id: string) => void
  onRotateSecret: (id: string) => void
  onSendTest: (id: string) => void
  busyEndpointId: string | null

  selectedEndpointId: string | null
  onSelectEndpoint: (id: string | null) => void
  deliveriesState: SectionState
  deliveries: WebhookDeliveryRow[]
  onRetryDelivery: (id: string) => void
  /** Requeue the endpoint's finished deliveries of the last `days` days. */
  onReplay: (id: string, days: 1 | 7) => void

  /** Selling from the owner's own website (publishable keys, settings). */
  storefront: Omit<StorefrontPanelProps, 't'>
  /** OAuth apps: published by this business, installed in it, and the marketplace. */
  oauth: Omit<OAuthAppsPanelProps, 't'>
  /** A separate, empty workspace to test integrations in. */
  sandbox: Omit<SandboxPanelProps, 't'>
  /** A key or secret to show ONCE; null when there is none. */
  revealed: {
    kind: 'key' | 'secret' | 'client-secret' | 'app-webhook-secret'
    value: string
  } | null
  onDismissRevealed: () => void
  onCopy: (value: string) => void
  onRetry: () => void
}

const scopeKey = (scope: string) => `developer.scope.${scope.replace(':', '_')}`
const eventKey = (event: string) => `developer.event.${event.replace('.', '_')}`

function StateMessage({
  state,
  error,
  t,
  onRetry,
}: {
  state: SectionState
  error: string | null
  t: T
  onRetry: () => void
}) {
  if (state === 'loading') {
    return (
      <p className="flex items-center gap-2 text-sm text-[hsl(var(--fg-secondary))]">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        {t('developer.loading')}
      </p>
    )
  }
  if (state === 'not-configured') {
    return <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('developer.notConfigured')}</p>
  }
  if (state === 'forbidden') {
    return <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('developer.forbidden')}</p>
  }
  if (state === 'error') {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-[hsl(var(--color-destructive))]">
          {error ?? t('developer.loadError')}
        </p>
        <Button size="sm" variant="outline" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      </div>
    )
  }
  return null
}

const DELIVERY_VARIANT: Record<
  WebhookDeliveryRow['status'],
  'secondary' | 'success' | 'warning' | 'destructive'
> = {
  pending: 'secondary',
  delivering: 'warning',
  succeeded: 'success',
  failed: 'destructive',
}

export const DevelopersView = memo(function DevelopersView(props: DevelopersViewProps) {
  const { t } = props
  const [keyName, setKeyName] = useState('')
  const [keyScopes, setKeyScopes] = useState<ApiKeyScope[]>([])
  const [keyDays, setKeyDays] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [events, setEvents] = useState<WebhookEventType[]>([])

  const days = Number(keyDays)
  const canCreateKey = keyName.trim().length > 0 && keyScopes.length > 0 && !props.creatingKey
  const canCreateEndpoint =
    url.trim().startsWith('https://') && events.length > 0 && !props.creatingEndpoint

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header>
        <h1 className="mb-2 text-2xl font-bold text-[hsl(var(--fg-primary))]">
          {t('developer.title')}
        </h1>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('developer.description')}</p>
      </header>

      {props.revealed && (
        <Card className="border-[hsl(var(--color-warning)/0.4)]">
          <CardContent className="space-y-3 p-4">
            <p className="font-semibold text-[hsl(var(--fg-primary))]">
              {props.revealed.kind === 'key'
                ? t('developer.keyCreated')
                : props.revealed.kind === 'client-secret'
                  ? t('oauth.clientSecretCreated')
                  : props.revealed.kind === 'app-webhook-secret'
                    ? t('oauth.webhookSecretCreated')
                    : t('developer.secretCreated')}
            </p>
            <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('developer.shownOnce')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <code
                dir="ltr"
                className="min-w-0 flex-1 break-all rounded-lg bg-[hsl(var(--surface-muted))] px-3 py-2 text-xs"
              >
                {props.revealed.value}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => props.onCopy(props.revealed?.value ?? '')}
              >
                <Copy className="size-4" aria-hidden="true" />
                {t('developer.copy')}
              </Button>
              <Button size="sm" onClick={props.onDismissRevealed}>
                {t('developer.savedIt')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <SandboxPanel t={t} {...props.sandbox} />

      <StorefrontPanel t={t} {...props.storefront} />

      <OAuthAppsPanel t={t} {...props.oauth} />

      {/* ─── API keys ─────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <KeyRound className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-[hsl(var(--fg-primary))]">
              {t('developer.keysTitle')}
            </h2>
          </div>
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('developer.keysHelp')}</p>

          <StateMessage
            state={props.keysState}
            error={props.keysError}
            t={t}
            onRetry={props.onRetry}
          />

          {props.keysState === 'ready' && (
            <>
              {props.keys.length === 0 ? (
                <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('developer.noKeys')}</p>
              ) : (
                <ul className="divide-y divide-[hsl(var(--border-default))]">
                  {props.keys.map((key) => (
                    <li key={key.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-[hsl(var(--fg-primary))]">{key.name}</p>
                        <p className="text-xs text-[hsl(var(--fg-tertiary))]" dir="ltr">
                          {key.prefix}…
                        </p>
                        <p className="text-xs text-[hsl(var(--fg-secondary))]">
                          {key.scopes.map((s) => t(scopeKey(s))).join('، ')}
                        </p>
                        <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                          {key.last_used_at
                            ? `${t('developer.lastUsed')}: ${props.formatDate(key.last_used_at)}`
                            : t('developer.neverUsed')}
                          {key.expires_at
                            ? ` · ${t('developer.expires')}: ${props.formatDate(key.expires_at)}`
                            : ''}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          props.onToggleUsage(props.usageKeyId === key.id ? null : key.id)
                        }
                      >
                        {props.usageKeyId === key.id
                          ? t('developer.hideUsage')
                          : t('developer.showUsage')}
                      </Button>
                      {key.revoked_at ? (
                        <Badge variant="outline">{t('developer.revoked')}</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          loading={props.revokingKeyId === key.id}
                          onClick={() => props.onRevokeKey(key.id)}
                        >
                          {t('developer.revoke')}
                        </Button>
                      )}
                      {props.usageKeyId === key.id && (
                        <KeyUsagePanel
                          t={t}
                          formatDate={props.formatDate}
                          state={props.usageState}
                          usage={props.usage}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <form
                className="space-y-3 border-t border-[hsl(var(--border-default))] pt-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!canCreateKey) return
                  props.onCreateKey({
                    name: keyName.trim(),
                    scopes: keyScopes,
                    expiresInDays: Number.isInteger(days) && days > 0 ? days : undefined,
                  })
                  setKeyName('')
                  setKeyScopes([])
                  setKeyDays('')
                }}
              >
                <h3 className="font-medium text-[hsl(var(--fg-primary))]">
                  {t('developer.newKey')}
                </h3>
                <Input
                  name="name"
                  value={keyName}
                  maxLength={80}
                  placeholder={t('developer.keyNamePlaceholder')}
                  aria-label={t('developer.keyName')}
                  onChange={(e) => setKeyName(e.target.value)}
                />
                <CheckList
                  name="scopes"
                  values={props.scopes}
                  selected={keyScopes}
                  onChange={setKeyScopes}
                  label={(s) => t(scopeKey(s))}
                />
                <Input
                  name="expiresInDays"
                  type="number"
                  min={1}
                  max={3650}
                  value={keyDays}
                  placeholder={t('developer.expiresInDays')}
                  aria-label={t('developer.expiresInDays')}
                  onChange={(e) => setKeyDays(e.target.value)}
                />
                <Button type="submit" disabled={!canCreateKey} loading={props.creatingKey}>
                  {t('developer.createKey')}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── Webhooks ─────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Webhook className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-[hsl(var(--fg-primary))]">
              {t('developer.webhooksTitle')}
            </h2>
          </div>
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('developer.webhooksHelp')}</p>

          <StateMessage
            state={props.endpointsState}
            error={props.endpointsError}
            t={t}
            onRetry={props.onRetry}
          />

          {props.endpointsState === 'ready' && (
            <>
              {props.endpoints.length === 0 ? (
                <p className="text-sm text-[hsl(var(--fg-secondary))]">
                  {t('developer.noEndpoints')}
                </p>
              ) : (
                <ul className="divide-y divide-[hsl(var(--border-default))]">
                  {props.endpoints.map((ep) => {
                    const busy = props.busyEndpointId === ep.id
                    const open = props.selectedEndpointId === ep.id
                    return (
                      <li key={ep.id} className="space-y-2 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 flex-1 break-all text-sm font-medium" dir="ltr">
                            {ep.url}
                          </p>
                          <Badge variant={ep.is_active ? 'success' : 'outline'}>
                            {ep.is_active ? t('developer.active') : t('developer.inactive')}
                          </Badge>
                        </div>
                        {ep.description && (
                          <p className="text-sm text-[hsl(var(--fg-secondary))]">
                            {ep.description}
                          </p>
                        )}
                        {!ep.is_active && ep.disabled_reason === 'TOO_MANY_FAILURES' && (
                          <p className="text-sm text-[hsl(var(--color-destructive))]">
                            {t('developer.disabledFailures')}
                          </p>
                        )}
                        <p className="text-xs text-[hsl(var(--fg-secondary))]">
                          {ep.events.map((e) => t(eventKey(e))).join('، ')}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => props.onSendTest(ep.id)}
                          >
                            <Send className="size-4" aria-hidden="true" />
                            {t('developer.sendTest')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => props.onToggleEndpoint(ep.id, !ep.is_active)}
                          >
                            {ep.is_active ? t('developer.disable') : t('developer.enable')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => props.onRotateSecret(ep.id)}
                          >
                            <RefreshCw className="size-4" aria-hidden="true" />
                            {t('developer.rotateSecret')}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => props.onSelectEndpoint(open ? null : ep.id)}
                          >
                            {open ? t('developer.hideDeliveries') : t('developer.showDeliveries')}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => props.onReplay(ep.id, 1)}
                          >
                            {t('developer.replay1d')}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => props.onReplay(ep.id, 7)}
                          >
                            {t('developer.replay7d')}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={busy}
                            onClick={() => props.onDeleteEndpoint(ep.id)}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                            {t('developer.delete')}
                          </Button>
                        </div>

                        {open && (
                          <div className="rounded-xl bg-[hsl(var(--surface-muted))] p-3">
                            <StateMessage
                              state={props.deliveriesState}
                              error={null}
                              t={t}
                              onRetry={props.onRetry}
                            />
                            {props.deliveriesState === 'ready' &&
                              (props.deliveries.length === 0 ? (
                                <p className="text-sm text-[hsl(var(--fg-secondary))]">
                                  {t('developer.noDeliveries')}
                                </p>
                              ) : (
                                <ul className="space-y-2">
                                  {props.deliveries.map((d) => (
                                    <li
                                      key={d.id}
                                      className="flex flex-wrap items-center gap-2 text-xs"
                                    >
                                      <Badge variant={DELIVERY_VARIANT[d.status]}>
                                        {t(`developer.delivery.${d.status}`)}
                                      </Badge>
                                      <code dir="ltr">{d.event_type}</code>
                                      <span className="text-[hsl(var(--fg-tertiary))]">
                                        {props.formatDate(d.created_at)}
                                      </span>
                                      {d.last_status_code !== null && (
                                        <code dir="ltr">HTTP {d.last_status_code}</code>
                                      )}
                                      <span className="text-[hsl(var(--fg-tertiary))]">
                                        {t('developer.attempts')}: {d.attempts}/{d.max_attempts}
                                      </span>
                                      {d.last_error && (
                                        <span
                                          className="w-full break-all text-[hsl(var(--color-destructive))]"
                                          dir="ltr"
                                        >
                                          {d.last_error}
                                        </span>
                                      )}
                                      {(d.status === 'failed' || d.status === 'succeeded') && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => props.onRetryDelivery(d.id)}
                                        >
                                          {t('developer.redeliver')}
                                        </Button>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              ))}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}

              <form
                className="space-y-3 border-t border-[hsl(var(--border-default))] pt-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!canCreateEndpoint) return
                  props.onCreateEndpoint({
                    url: url.trim(),
                    description: description.trim() || undefined,
                    events,
                  })
                  setUrl('')
                  setDescription('')
                  setEvents([])
                }}
              >
                <h3 className="font-medium text-[hsl(var(--fg-primary))]">
                  {t('developer.newEndpoint')}
                </h3>
                <Input
                  name="url"
                  type="url"
                  dir="ltr"
                  value={url}
                  placeholder="https://"
                  aria-label={t('developer.endpointUrl')}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('developer.httpsOnly')}</p>
                <Input
                  name="description"
                  value={description}
                  maxLength={200}
                  placeholder={t('developer.endpointDescription')}
                  aria-label={t('developer.endpointDescription')}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <CheckList
                  name="events"
                  values={props.events}
                  selected={events}
                  onChange={setEvents}
                  label={(e) => t(eventKey(e))}
                />
                <Button
                  type="submit"
                  disabled={!canCreateEndpoint}
                  loading={props.creatingEndpoint}
                >
                  {t('developer.createEndpoint')}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-[hsl(var(--fg-primary))]">
            {t('developer.verifyTitle')}
          </h2>
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('developer.verifyHelp')}</p>
          <pre
            dir="ltr"
            className="overflow-x-auto rounded-lg bg-[hsl(var(--surface-muted))] p-3 text-xs"
          >
            {`import { verifyWebhookSignature } from '@hisabche/validation'

const result = await verifyWebhookSignature(
  process.env.HISABCHE_WEBHOOK_SECRET,
  rawBody,                                  // the body as received, unparsed
  request.headers['hisabche-signature'],
)
if (!result.valid) return reply.status(400).send()`}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
})

DevelopersView.displayName = 'DevelopersView'
