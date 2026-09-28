'use client'

// ============================================
// packages/ui/src/components/ui/developers/containers/oauth-consent-container.tsx
//
// The page an app sends a person to (RFC 6749 §4.1.1 + RFC 7636). Every
// hook of the consent screen lives here; the view takes props only.
//
// ⚠️ Nobody is redirected anywhere until the SERVER has said the
// redirect_uri is registered to that app (the preview succeeded). A malformed
// or unknown request shows an error here — redirecting to an unchecked
// redirect_uri is an open redirect.
// ============================================

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useApproveOAuth, useOAuthConsent, type OAuthRequestParams } from '@hisabche/api'
import { useAuthStore, useWorkspaceStore } from '@hisabche/store'
import { localizePath } from '@hisabche/ui-contract'

import { useLocaleReplace, useRouteLang } from '../../../../hooks/use-locale-push'
import { oauthErrorMessage } from '../../../../lib/oauth-labels'
import { OAuthConsentView, type ConsentState } from '../oauth-consent-view'

export type OAuthAuthorizeQuery = Partial<
  Record<
    | 'response_type'
    | 'client_id'
    | 'redirect_uri'
    | 'scope'
    | 'state'
    | 'code_challenge'
    | 'code_challenge_method',
    string | undefined
  >
>

/** The request, or null if it cannot be a valid authorization-code + PKCE request. */
export function parseAuthorizeQuery(
  q: OAuthAuthorizeQuery,
): (OAuthRequestParams & { state?: string | undefined; code_challenge: string }) | null {
  if (q.response_type !== undefined && q.response_type !== 'code') return null
  if (!q.client_id || !q.redirect_uri || !q.scope || !q.code_challenge) return null
  // S256 only: a «plain» challenge is the verifier itself.
  if (q.code_challenge_method !== 'S256') return null
  return {
    client_id: q.client_id,
    redirect_uri: q.redirect_uri,
    scope: q.scope,
    state: q.state,
    code_challenge: q.code_challenge,
  }
}

export const OAuthConsentContainer = memo(function OAuthConsentContainer({
  query,
}: {
  query: OAuthAuthorizeQuery
}) {
  const tOriginal = useTranslations()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const value = tOriginal(key as Parameters<typeof tOriginal>[0])
      return value && value !== key ? value : (fallback ?? key)
    },
    [tOriginal],
  )
  const lang = useRouteLang()
  const replace = useLocaleReplace()
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const workspaceName = useWorkspaceStore((s) => s.workspaceName)

  const request = useMemo(() => parseAuthorizeQuery(query), [query])
  const params = useMemo<OAuthRequestParams | null>(
    () =>
      request
        ? { client_id: request.client_id, redirect_uri: request.redirect_uri, scope: request.scope }
        : null,
    [request],
  )

  // Not signed in: to the login page, and back here — with the whole query —
  // afterwards (AuthContainer honours ?redirect=).
  useEffect(() => {
    if (!hasHydrated || isAuthenticated) return
    const search = new URLSearchParams(
      Object.entries(query).filter((e): e is [string, string] => typeof e[1] === 'string'),
    ).toString()
    const back = `${localizePath('/oauth/authorize', lang)}?${search}`
    replace(`/login?redirect=${encodeURIComponent(back)}`)
  }, [hasHydrated, isAuthenticated, query, lang, replace])

  const consent = useOAuthConsent(params, hasHydrated && isAuthenticated && !!request)
  const approve = useApproveOAuth()
  const [approveError, setApproveError] = useState<string | null>(null)

  const state: ConsentState = !request
    ? { kind: 'invalid' }
    : consent.error
      ? { kind: 'error', message: oauthErrorMessage(t, consent.error, t('developer.loadError')) }
      : consent.data
        ? { kind: 'ready', consent: consent.data }
        : { kind: 'loading' }

  return (
    <OAuthConsentView
      t={t}
      state={state}
      workspaceName={workspaceName}
      approving={approve.isPending}
      approveError={approveError}
      onApprove={() => {
        if (!request) return
        setApproveError(null)
        approve.mutate(
          { ...request, code_challenge_method: 'S256' },
          {
            onSuccess: (out) => window.location.assign(out.redirectTo),
            onError: (err) =>
              setApproveError(oauthErrorMessage(t, err, t('developer.actionFailed'))),
          },
        )
      }}
      onDeny={() => {
        // Only reachable once the preview succeeded — i.e. the server has
        // confirmed this redirect_uri is registered to the app.
        if (!request || state.kind !== 'ready') return
        const target = new URL(request.redirect_uri)
        target.searchParams.set('error', 'access_denied')
        if (request.state) target.searchParams.set('state', request.state)
        window.location.assign(target.toString())
      }}
    />
  )
})

OAuthConsentContainer.displayName = 'OAuthConsentContainer'
