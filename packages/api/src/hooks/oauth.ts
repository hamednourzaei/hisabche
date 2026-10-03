// ============================================
// packages/api/src/hooks/oauth.ts
//
// OAuth apps and the marketplace (backend/src/routes/oauth.routes.ts,
// backend/src/routes/marketplace.routes.ts,
// docs/developer-platform-05-oauth-migration.sql and -07-marketplace-migration.sql).
//
// Publisher: the app's listing and DRAFT config, versions for review,
// screenshots, secrets (shown ONCE), analytics and health.
// Installer: the consent screen, installed apps, updates, uninstall.
// Everyone in a workspace: browse the marketplace, open a listing, rate an
// app the business used, report one.
//
// ⚠️ An installed app's token IS an API key (api_keys.app_id): uninstalling
// is revoking that key — there is no second token system.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ApiKeyScope,
  AppCategory,
  AppHealthLevel,
  AppPricing,
  AppReportInput,
  AppReviewInput,
  AppRiskFlag,
  AppScreenshotInput,
  AppVersionStatus,
  AppVersionSubmitInput,
  OAuthAppCreateInput,
  OAuthAppStatus,
  OAuthAppUpdateInput,
  PublisherProfileInput,
} from '@hisabche/validation'

import { apiClient } from '../lib/client'
import { asList } from '../lib/as-list'
import { getActiveWorkspaceId } from '../lib/active-workspace'
import { useAuthReady } from './useAuthReady'
import { developerKeys } from './developer'

/** The service's snake_case row (backend oauth.repository.ts AppRow). */
export interface OAuthAppRow {
  id: string
  owner_workspace_id: string
  name: string
  description: string
  homepage_url: string | null
  redirect_uris: string[]
  requested_scopes: ApiKeyScope[]
  webhook_url: string | null
  webhook_events: string[]
  api_version: string
  client_id: string
  status: OAuthAppStatus
  review_note: string | null
  slug: string | null
  tagline: string
  category: AppCategory | null
  icon_url: string | null
  privacy_url: string | null
  terms_url: string | null
  install_url: string | null
  pricing_model: 'free' | 'paid'
  price_minor: number | null
  price_currency: string | null
  price_interval: 'month' | 'year' | 'one_time' | null
  published_version_id: string | null
  created_at: string
  updated_at: string
}

export interface AppVersionRow {
  id: string
  app_id: string
  version: string
  changelog: string
  redirect_uris: string[]
  requested_scopes: ApiKeyScope[]
  webhook_url: string | null
  webhook_events: string[]
  api_version: string
  status: AppVersionStatus
  review_note: string | null
  created_at: string
  published_at: string | null
}

export interface AppScreenshot {
  id: string
  url: string
  caption: string
  position: number
}

export interface PublisherProfile {
  workspace_id: string
  display_name: string
  website_url: string | null
  support_email: string | null
  bio: string
  verified_at: string | null
}

export interface AppStats {
  days: number
  usage: Array<{
    day: string
    requests: number
    clientErrors: number
    serverErrors: number
    avgMs: number
  }>
  installs: { active: number; installedInPeriod: number; uninstalledInPeriod: number }
  lastRequestAt: string | null
  requests24h: number
  serverErrors24h: number
  deliveries24h: number
  failedDeliveries24h: number
  health: {
    level: AppHealthLevel
    serverErrorRate: number | null
    deliveryFailureRate: number | null
  }
}

export interface InstalledAppRow {
  installationId: string
  appId: string
  appName: string | null
  slug: string | null
  iconUrl: string | null
  homepageUrl: string | null
  /** null = the publisher's own test install of the draft. */
  version: string | null
  updateAvailable: boolean
  suspended: boolean
  scopes: ApiKeyScope[]
  receivesWebhooks: boolean
  installedAt: string
  lastUsedAt: string | null
}

export interface AppUpdatePreview {
  fromVersion: string | null
  toVersion: string
  changelog: string
  added: ApiKeyScope[]
  removed: ApiKeyScope[]
  refused: Array<{ scope: ApiKeyScope; missing: string }>
  events: string[]
}

export interface PermissionDisclosure {
  scopes: Array<{ scope: ApiKeyScope; access: 'read' | 'write' }>
  events: string[]
}

export interface MarketplaceAppRow {
  id: string
  slug: string | null
  name: string
  tagline: string
  category: AppCategory | null
  iconUrl: string | null
  publisher: string | null
  publisherVerified: boolean
  pricing: AppPricing
  rating: number | null
  reviews: number
  activeInstalls: number
  installed: boolean
}

export interface MarketplaceAppDetail {
  id: string
  slug: string | null
  name: string
  tagline: string
  description: string
  category: AppCategory | null
  iconUrl: string | null
  homepageUrl: string | null
  privacyUrl: string | null
  termsUrl: string | null
  installUrl: string | null
  status: OAuthAppStatus
  isOwner: boolean
  pricing: AppPricing
  publisher: {
    name: string | null
    verified: boolean
    websiteUrl: string | null
    supportEmail: string | null
    bio: string
  }
  screenshots: AppScreenshot[]
  version: { version: string; publishedAt: string | null; apiVersion: string } | null
  previewingDraft: boolean
  disclosure: PermissionDisclosure | null
  changelog: Array<{ version: string; changelog: string; publishedAt: string | null }>
  rating: { average: number | null; reviews: number; stars: number[] }
  activeInstalls: number
  reviews: Array<{
    id: string
    rating: number
    body: string
    createdAt: string
    updatedAt: string
    mine: boolean
  }>
  myReview: { rating: number; body: string; hidden: boolean } | null
  installed: boolean
  canReview: boolean
}

export interface OAuthConsent {
  app: {
    name: string
    description: string
    homepageUrl: string | null
    iconUrl: string | null
    privacyUrl: string | null
    termsUrl: string | null
    publisher: string | null
    publisherVerified: boolean
    reviewed: boolean
    version: string | null
    pricing: AppPricing
  }
  requested: ApiKeyScope[]
  granted: ApiKeyScope[]
  refused: Array<{ scope: ApiKeyScope; missing: string }>
  disclosure: PermissionDisclosure
}

export interface OAuthRequestParams {
  client_id: string
  redirect_uri: string
  scope: string
}

/** For the admin panel, which shares these shapes. */
export interface AppRiskFlagRow {
  flag: AppRiskFlag
  detail: string[]
}

const ws = () => getActiveWorkspaceId() ?? ''
const listOf = <T>(body: unknown) => asList<T>((body as { data?: unknown } | null)?.data)

export const oauthKeys = {
  all: ['oauth'] as const,
  apps: (w: string) => [...oauthKeys.all, w, 'apps'] as const,
  versions: (w: string, appId: string) => [...oauthKeys.all, w, 'versions', appId] as const,
  screenshots: (w: string, appId: string) => [...oauthKeys.all, w, 'screenshots', appId] as const,
  stats: (w: string, appId: string, days: number) =>
    [...oauthKeys.all, w, 'stats', appId, days] as const,
  publisher: (w: string) => [...oauthKeys.all, w, 'publisher'] as const,
  installed: (w: string) => [...oauthKeys.all, w, 'installed'] as const,
  update: (w: string, installationId: string) =>
    [...oauthKeys.all, w, 'update', installationId] as const,
  marketplace: (w: string, category: string, q: string) =>
    [...oauthKeys.all, w, 'marketplace', category, q] as const,
  listing: (w: string, slug: string) => [...oauthKeys.all, w, 'listing', slug] as const,
  consent: (w: string, p: OAuthRequestParams) =>
    [...oauthKeys.all, w, 'consent', p.client_id, p.redirect_uri, p.scope] as const,
}

// ─── publisher ───────────────────────────────────────────────────────────────

export function useOAuthApps() {
  const ready = useAuthReady()
  return useQuery({
    queryKey: oauthKeys.apps(ws()),
    queryFn: async () => listOf<OAuthAppRow>((await apiClient.get('/developer/apps')).data),
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

/** Returns the app's webhook secret ONCE, the first time a subscription is set up. */
export function useUpdateOAuthApp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; patch: OAuthAppUpdateInput }) =>
      (await apiClient.patch(`/developer/apps/${input.id}`, input.patch)).data as {
        app: OAuthAppRow
        webhookSecret: string | null
      },
    onSuccess: () => qc.invalidateQueries({ queryKey: oauthKeys.apps(ws()) }),
  })
}

export function useAppVersions(appId: string | null) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: oauthKeys.versions(ws(), appId ?? ''),
    queryFn: async () =>
      listOf<AppVersionRow>((await apiClient.get(`/developer/apps/${appId}/versions`)).data),
    enabled: ready && !!appId,
    retry: false,
  })
}

export function useSubmitAppVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { appId: string } & AppVersionSubmitInput) =>
      (
        await apiClient.post(`/developer/apps/${input.appId}/versions`, {
          version: input.version,
          changelog: input.changelog,
        })
      ).data as AppVersionRow,
    onSuccess: (_row, input) => {
      void qc.invalidateQueries({ queryKey: oauthKeys.versions(ws(), input.appId) })
      void qc.invalidateQueries({ queryKey: oauthKeys.apps(ws()) })
    },
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

/** The APP's webhook signing secret (not an endpoint's): shown once. */
export function useRotateAppWebhookSecret() {
  return useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.post(`/developer/apps/${id}/webhook-secret`)).data as {
        webhookSecret: string
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

export function useAppScreenshots(appId: string | null) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: oauthKeys.screenshots(ws(), appId ?? ''),
    queryFn: async () =>
      listOf<AppScreenshot>((await apiClient.get(`/developer/apps/${appId}/screenshots`)).data),
    enabled: ready && !!appId,
    retry: false,
  })
}

export function useAddAppScreenshot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { appId: string } & AppScreenshotInput) =>
      (
        await apiClient.post(`/developer/apps/${input.appId}/screenshots`, {
          url: input.url,
          caption: input.caption,
        })
      ).data as AppScreenshot,
    onSuccess: (_row, input) =>
      qc.invalidateQueries({ queryKey: oauthKeys.screenshots(ws(), input.appId) }),
  })
}

/**
 * Upload an icon or a screenshot (png, jpeg or webp, up to 1 MB) and get its
 * URL back; that URL is then saved through the icon or screenshot fields.
 */
export function useUploadAppImage() {
  return useMutation({
    mutationFn: async (input: { appId: string; base64: string }) =>
      (
        (await apiClient.post(`/developer/apps/${input.appId}/images`, { base64: input.base64 }))
          .data as { url: string }
      ).url,
  })
}

export function useRemoveAppScreenshot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { appId: string; screenshotId: string }) => {
      await apiClient.delete(`/developer/apps/${input.appId}/screenshots/${input.screenshotId}`)
    },
    onSuccess: (_row, input) =>
      qc.invalidateQueries({ queryKey: oauthKeys.screenshots(ws(), input.appId) }),
  })
}

export function useAppStats(appId: string | null, days = 7) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: oauthKeys.stats(ws(), appId ?? '', days),
    queryFn: async () =>
      (await apiClient.get(`/developer/apps/${appId}/stats`, { params: { days } }))
        .data as AppStats,
    enabled: ready && !!appId,
    retry: false,
  })
}

export function usePublisherProfile() {
  const ready = useAuthReady()
  return useQuery({
    queryKey: oauthKeys.publisher(ws()),
    queryFn: async () =>
      ((await apiClient.get('/developer/publisher')).data as { profile: PublisherProfile | null })
        ?.profile ?? null,
    enabled: ready,
    retry: false,
  })
}

export function useSavePublisherProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: PublisherProfileInput) =>
      (await apiClient.put('/developer/publisher', input)).data as PublisherProfile,
    onSuccess: (saved) => qc.setQueryData(oauthKeys.publisher(ws()), saved),
  })
}

// ─── installer ───────────────────────────────────────────────────────────────

export function useInstalledApps() {
  const ready = useAuthReady()
  return useQuery({
    queryKey: oauthKeys.installed(ws()),
    queryFn: async () =>
      listOf<InstalledAppRow>((await apiClient.get('/developer/installed-apps')).data),
    enabled: ready,
    retry: false,
  })
}

/** Uninstall = revoke the app's API key; the server ends the installation and its webhooks. */
export function useUninstallApp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (installationId: string) => {
      await apiClient.post(`/developer/installed-apps/${installationId}/uninstall`)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: oauthKeys.all })
      void qc.invalidateQueries({ queryKey: developerKeys.all })
    },
  })
}

export function useAppUpdatePreview(installationId: string | null) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: oauthKeys.update(ws(), installationId ?? ''),
    queryFn: async () =>
      (await apiClient.get(`/developer/installed-apps/${installationId}/update`))
        .data as AppUpdatePreview,
    enabled: ready && !!installationId,
    retry: false,
  })
}

export function useApplyAppUpdate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (installationId: string) =>
      (await apiClient.post(`/developer/installed-apps/${installationId}/update`))
        .data as AppUpdatePreview,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: oauthKeys.all })
      // Scopes and webhook endpoints changed.
      void qc.invalidateQueries({ queryKey: developerKeys.all })
    },
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
        disclosure: {
          scopes: asList<PermissionDisclosure['scopes'][number]>(body?.disclosure?.scopes),
          events: asList<string>(body?.disclosure?.events),
        },
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

// ─── marketplace ─────────────────────────────────────────────────────────────

export function useMarketplaceApps(filter: { category: AppCategory | 'all'; q: string }) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: oauthKeys.marketplace(ws(), filter.category, filter.q),
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (filter.category !== 'all') params.category = filter.category
      if (filter.q.trim()) params.q = filter.q.trim()
      return listOf<MarketplaceAppRow>((await apiClient.get('/marketplace/apps', { params })).data)
    },
    enabled: ready,
    retry: false,
  })
}

export function useMarketplaceApp(slug: string | null) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: oauthKeys.listing(ws(), slug ?? ''),
    queryFn: async () => {
      const app = encodeURIComponent(slug ?? '')
      const body = (await apiClient.get(`/marketplace/apps/${app}`)).data as MarketplaceAppDetail
      return {
        ...body,
        screenshots: asList<AppScreenshot>(body?.screenshots),
        changelog: asList<MarketplaceAppDetail['changelog'][number]>(body?.changelog),
        reviews: asList<MarketplaceAppDetail['reviews'][number]>(body?.reviews),
      }
    },
    enabled: ready && !!slug,
    retry: false,
  })
}

export function useSaveAppReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { appId: string } & AppReviewInput) =>
      (
        await apiClient.put(`/marketplace/apps/${input.appId}/review`, {
          rating: input.rating,
          body: input.body,
        })
      ).data as { id: string },
    onSuccess: () => qc.invalidateQueries({ queryKey: oauthKeys.all }),
  })
}

export function useDeleteAppReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (appId: string) => {
      await apiClient.delete(`/marketplace/apps/${appId}/review`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: oauthKeys.all }),
  })
}

export function useReportApp() {
  return useMutation({
    mutationFn: async (input: { appId: string } & AppReportInput) =>
      (
        await apiClient.post(`/marketplace/apps/${input.appId}/report`, {
          reason: input.reason,
          details: input.details,
        })
      ).data as { id: string; duplicate: boolean },
  })
}
