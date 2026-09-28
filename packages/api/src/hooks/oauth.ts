// ============================================
// packages/api/src/hooks/oauth.ts
//
// OAuth apps and the marketplace (backend/src/routes/oauth.routes.ts,
// docs/developer-platform-05-oauth-migration.sql).
//
// Publisher: register an app, see its client_id, get its secret ONCE.
// Installer: the consent screen, and the list of apps holding a token.
// ⚠️ An installed app's token IS an API key (api_keys.app_id): uninstalling
// is revoking that key — there is no second token system.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApiKeyScope, OAuthAppCreateInput, OAuthAppStatus } from '@hisabche/validation'

import { apiClient } from '../lib/client'
import { asList } from '../lib/as-list'
import { getActiveWorkspaceId } from '../lib/active-workspace'
import { useAuthReady } from './useAuthReady'
import { developerKeys } from './developer'

/** The service's snake_case row (backend oauth.service.ts AppRow). */
export interface OAuthAppRow {
  id: string
  owner_workspace_id: string
  name: string
  description: string
  homepage_url: string | null
  redirect_uris: string[]
  requested_scopes: ApiKeyScope[]
  client_id: string
  status: OAuthAppStatus
  review_note: string | null
  created_at: string
  updated_at: string
}

export interface InstalledAppRow {
  keyId: string
  appName: string | null
  homepageUrl: string | null
  scopes: ApiKeyScope[]
  installedAt: string
  lastUsedAt: string | null
}

export interface MarketplaceAppRow {
  id: string
  clientId: string
  name: string
  description: string
  homepageUrl: string | null
  publisher: string | null
  scopes: ApiKeyScope[]
}

export interface OAuthConsent {
  app: {
    name: string
    description: string
    homepageUrl: string | null
    publisher: string | null
    reviewed: boolean
  }
  requested: ApiKeyScope[]
  granted: ApiKeyScope[]
  refused: Array<{ scope: ApiKeyScope; missing: string }>
}

export interface OAuthRequestParams {
  client_id: string
  redirect_uri: string
  scope: string
}

const ws = () => getActiveWorkspaceId() ?? ''

export const oauthKeys = {
  all: ['oauth'] as const,
  apps: (w: string) => [...oauthKeys.all, w, 'apps'] as const,
  installed: (w: string) => [...oauthKeys.all, w, 'installed'] as const,
  marketplace: () => [...oauthKeys.all, 'marketplace'] as const,
  consent: (w: string, p: OAuthRequestParams) =>
    [...oauthKeys.all, w, 'consent', p.client_id, p.redirect_uri, p.scope] as const,
}

// ─── publisher ───────────────────────────────────────────────────────────────

export function useOAuthApps() {
  const ready = useAuthReady()
  return useQuery({
    queryKey: oauthKeys.apps(ws()),
    queryFn: async () =>
      asList<OAuthAppRow>(
        ((await apiClient.get('/developer/apps')).data as { data?: unknown } | null)?.data,
      ),
    enabled: ready,
    retry: false,
  })
}

export function useCreateOAuthApp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: OAuthAppCreateInput) =>
      (await apiClient.post('/developer/apps', input)).data as {
        app: OAuthAppRow
        clientSecret: string
      },
    onSuccess: () => qc.invalidateQueries({ queryKey: oauthKeys.apps(ws()) }),
  })
}

export function useSubmitOAuthApp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.post(`/developer/apps/${id}/submit`)).data as OAuthAppRow,
    onSuccess: () => qc.invalidateQueries({ queryKey: oauthKeys.apps(ws()) }),
  })
}

export function useRotateOAuthSecret() {
  return useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.post(`/developer/apps/${id}/rotate-secret`)).data as {
        clientSecret: string
      },
  })
}

export function useDeleteOAuthApp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/developer/apps/${id}`)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: oauthKeys.all })
      // Deleting an app removes every token issued to it (ON DELETE CASCADE).
      void qc.invalidateQueries({ queryKey: developerKeys.all })
    },
  })
}

// ─── installer ───────────────────────────────────────────────────────────────

export function useInstalledApps() {
  const ready = useAuthReady()
  return useQuery({
    queryKey: oauthKeys.installed(ws()),
    queryFn: async () =>
      asList<InstalledAppRow>(
        ((await apiClient.get('/developer/installed-apps')).data as { data?: unknown } | null)
          ?.data,
      ),
    enabled: ready,
    retry: false,
  })
}

/** Uninstall = revoke the app's API key. */
export function useUninstallApp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (keyId: string) => {
      await apiClient.delete(`/developer/keys/${keyId}`)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: oauthKeys.installed(ws()) })
      void qc.invalidateQueries({ queryKey: developerKeys.all })
    },
  })
}

export function useMarketplaceApps() {
  const ready = useAuthReady()
  return useQuery({
    queryKey: oauthKeys.marketplace(),
    queryFn: async () =>
      asList<MarketplaceAppRow>(
        ((await apiClient.get('/marketplace/apps')).data as { data?: unknown } | null)?.data,
      ),
    enabled: ready,
    retry: false,
  })
}

export function useOAuthConsent(params: OAuthRequestParams | null, enabled: boolean) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: oauthKeys.consent(ws(), params ?? { client_id: '', redirect_uri: '', scope: '' }),
    queryFn: async () => {
      const body = (await apiClient.get('/oauth/authorize', { params })).data as OAuthConsent
      return {
        ...body,
        requested: asList<ApiKeyScope>(body?.requested),
        granted: asList<ApiKeyScope>(body?.granted),
        refused: asList<{ scope: ApiKeyScope; missing: string }>(body?.refused),
      }
    },
    enabled: ready && enabled && !!params,
    retry: false,
  })
}

export function useApproveOAuth() {
  return useMutation({
    mutationFn: async (
      input: OAuthRequestParams & {
        state?: string | undefined
        code_challenge: string
        code_challenge_method: 'S256'
      },
    ) => (await apiClient.post('/oauth/authorize', input)).data as { redirectTo: string },
  })
}
