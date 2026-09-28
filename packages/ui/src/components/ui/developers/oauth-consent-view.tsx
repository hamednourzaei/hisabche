'use client'

// ============================================
// packages/ui/src/components/ui/developers/oauth-consent-view.tsx
//
// «This app wants access to your business» — the OAuth consent screen.
// Props only.
//
// What the person must see before saying yes, all of it on the screen:
//   · which business the app gets into (the active workspace);
//   · who publishes the app, and whether the platform reviewed it — an
//     unreviewed app is SAID to be unreviewed, not shown the same;
//   · what it will be able to do, and what it asked for but will NOT get
//     because this person does not hold it themselves.
// ============================================

import { memo } from 'react'
import type { OAuthConsent } from '@hisabche/api'
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  XCircle,
} from 'lucide-react'

import { Badge } from '../badge'
import { Button } from '../button'
import { Card, CardContent } from '../card'
import { appPriceLabel } from '../../../lib/oauth-labels'

type T = (key: string, fallback?: string) => string

export type ConsentState =
  | { kind: 'loading' }
  /** The request itself is malformed — nothing is looked up, nowhere is redirected. */
  | { kind: 'invalid' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; consent: OAuthConsent }

export interface OAuthConsentViewProps {
  t: T
  /** The reader's language, for the price. */
  lang: string
  state: ConsentState
  workspaceName: string
  approving: boolean
  approveError: string | null
  onApprove: () => void
  onDeny: () => void
}

const scopeKey = (scope: string) => `developer.scope.${scope.replace(':', '_')}`
const eventKey = (event: string) => `developer.event.${event.replace('.', '_')}`

export const OAuthConsentView = memo(function OAuthConsentView(props: OAuthConsentViewProps) {
  const { t, state } = props

  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="space-y-4 p-5">
        <h1 className="text-xl font-bold text-[hsl(var(--fg-primary))]">
          {t('oauth.consent.title')}
        </h1>

        {state.kind === 'loading' && (
          <p className="flex items-center gap-2 text-sm text-[hsl(var(--fg-secondary))]">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t('developer.loading')}
          </p>
        )}

        {state.kind === 'invalid' && (
          <p className="text-sm text-[hsl(var(--color-destructive))]">
            {t('oauth.consent.invalidRequest')}
          </p>
        )}

        {state.kind === 'error' && (
          <p className="text-sm text-[hsl(var(--color-destructive))]">{state.message}</p>
        )}

        {state.kind === 'ready' && (
          <>
            <div className="space-y-1">
              <p className="text-lg font-semibold text-[hsl(var(--fg-primary))]">
                {state.consent.app.name}
              </p>
              <p className="flex flex-wrap items-center gap-1 text-sm text-[hsl(var(--fg-secondary))]">
                {t('oauth.publisher')}: {state.consent.app.publisher ?? t('oauth.unknownPublisher')}
                {state.consent.app.publisherVerified ? (
                  <Badge variant="success">
                    <BadgeCheck className="size-3.5" aria-hidden="true" />
                    {t('oauth.verified')}
                  </Badge>
                ) : (
                  <Badge variant="secondary">{t('oauth.notVerified')}</Badge>
                )}
              </p>
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                {state.consent.app.version ? (
                  <span dir="ltr">{state.consent.app.version}</span>
                ) : (
                  t('oauth.draftInstall')
                )}
                {' · '}
                {appPriceLabel(t, state.consent.app.pricing, props.lang)}
              </p>
              {state.consent.app.reviewed ? (
                <Badge variant="success">
                  <ShieldCheck className="size-3.5" aria-hidden="true" />
                  {t('oauth.consent.reviewed')}
                </Badge>
              ) : (
                <p className="flex items-start gap-2 rounded-xl bg-[hsl(var(--color-warning)/0.1)] p-2 text-sm text-[hsl(var(--fg-primary))]">
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0 text-[hsl(var(--color-warning))]"
                    aria-hidden="true"
                  />
                  {t('oauth.consent.notReviewed')}
                </p>
              )}
              {state.consent.app.description && (
                <p className="text-sm text-[hsl(var(--fg-secondary))]">
                  {state.consent.app.description}
                </p>
              )}
              {state.consent.app.homepageUrl && (
                <a
                  href={state.consent.app.homepageUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  dir="ltr"
                  className="text-sm text-[hsl(var(--color-primary))] underline-offset-4 hover:underline"
                >
                  {state.consent.app.homepageUrl}
                </a>
              )}
            </div>

            <p className="text-sm text-[hsl(var(--fg-primary))]">
              {t('oauth.consent.intoWorkspace')}:{' '}
              <span className="font-semibold">
                {props.workspaceName || t('oauth.consent.activeWorkspace')}
              </span>
            </p>

            <div className="space-y-2">
              <p className="text-sm font-medium text-[hsl(var(--fg-primary))]">
                {t('oauth.consent.willGrant')}
              </p>
              {state.consent.granted.length === 0 ? (
                <p className="text-sm text-[hsl(var(--color-destructive))]">
                  {t('oauth.error.NO_SCOPE_GRANTED')}
                </p>
              ) : (
                <ul className="space-y-1">
                  {state.consent.granted.map((s) => (
                    <li key={s} className="flex items-center gap-2 text-sm">
                      <CheckCircle2
                        className="size-4 text-[hsl(var(--color-success))]"
                        aria-hidden="true"
                      />
                      {t(scopeKey(s), s)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {state.consent.refused.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-[hsl(var(--fg-primary))]">
                  {t('oauth.consent.willNotGrant')}
                </p>
                <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                  {t('oauth.consent.willNotGrantHelp')}
                </p>
                <ul className="space-y-1">
                  {state.consent.refused.map((r) => (
                    <li key={r.scope} className="flex items-center gap-2 text-sm">
                      <XCircle
                        className="size-4 text-[hsl(var(--color-destructive))]"
                        aria-hidden="true"
                      />
                      {t(scopeKey(r.scope), r.scope)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {state.consent.disclosure.events.length > 0 && (
              <p className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('marketplace.receivesEvents')}:{' '}
                {state.consent.disclosure.events.map((e) => t(eventKey(e), e)).join('، ')}
              </p>
            )}
            {state.consent.app.pricing.model === 'paid' && (
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t('marketplace.billedByPublisher')}
              </p>
            )}
            <div className="flex flex-wrap gap-3 text-xs">
              {state.consent.app.privacyUrl && (
                <a
                  href={state.consent.app.privacyUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="underline-offset-4 hover:underline"
                >
                  {t('marketplace.privacy')}
                </a>
              )}
              {state.consent.app.termsUrl && (
                <a
                  href={state.consent.app.termsUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="underline-offset-4 hover:underline"
                >
                  {t('marketplace.terms')}
                </a>
              )}
            </div>

            <p className="text-xs text-[hsl(var(--fg-tertiary))]">
              {t('oauth.consent.revokeHint')}
            </p>

            {props.approveError && (
              <p className="text-sm text-[hsl(var(--color-destructive))]">{props.approveError}</p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={props.onApprove}
                loading={props.approving}
                disabled={state.consent.granted.length === 0}
              >
                {t('oauth.consent.approve')}
              </Button>
              <Button variant="outline" onClick={props.onDeny} disabled={props.approving}>
                {t('oauth.consent.deny')}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
})

OAuthConsentView.displayName = 'OAuthConsentView'
