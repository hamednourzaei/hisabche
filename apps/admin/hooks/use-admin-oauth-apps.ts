'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  apiClient,
  asList,
  type AppRiskFlagRow,
  type AppStats,
  type AppVersionRow,
  type OAuthAppRow,
  type PublisherProfile,
} from '@hisabche/api'
import { OAUTH_APP_STATUSES, type OAuthAppStatus } from '@hisabche/validation'

/**
 * The app marketplace, from the platform side.
 *
 * Endpoints (backend/src/routes/oauth.routes.ts and marketplace.routes.ts,
 * all behind platformAdminGuard):
 *
 *   GET  /admin/app-versions                   versions in review, with risk flags
 *   POST /admin/app-versions/:id/decision      { decision: publish|reject, note? }
 *   GET  /admin/oauth-apps?status=             apps by status
 *   POST /admin/oauth-apps/:id/status          { action: suspend|reinstate, revokeInstallations, note? }
 *   GET  /admin/oauth-apps/:id/stats?days=     exact usage, installs, health
 *   GET  /admin/app-publishers                 publisher profiles
 *   POST /admin/app-publishers/:ws/verification { verified }
 *   GET  /admin/app-reports?status=            abuse / security reports
 *   POST /admin/app-reports/:id/resolution     { status: resolved|dismissed, note? }
 *   GET  /admin/app-reviews?hidden=            recent reviews
 *   POST /admin/app-reviews/:id/visibility     { hidden, reason? }
 */

export { OAUTH_APP_STATUSES }
export type { OAuthAppStatus }

export interface AdminOAuthApp extends OAuthAppRow {
  publisher: string | null
  publisherVerified: boolean
}

export interface AdminVersion extends AppVersionRow {
  appName: string
  appSlug: string | null
  appStatus: OAuthAppStatus
  publisher: string | null
  publisherVerified: boolean
  previousVersion: string | null
  flags: AppRiskFlagRow[]
}

export interface AdminPublisher extends PublisherProfile {
  workspaceName: string | null
}

export interface AdminReport {
  id: string
  app_id: string
  reason: string
  details: string
  status: 'open' | 'resolved' | 'dismissed'
  resolution_note: string | null
  created_at: string
  appName: string | null
  appStatus: string | null
  reporter: string | null
}

export interface AdminReview {
  id: string
  app_id: string
  rating: number
  body: string
  hidden_at: string | null
  hidden_reason: string | null
  updated_at: string
  appName: string | null
  reviewer: string | null
}

const keys = {
  all: ['admin', 'marketplace'] as const,
  apps: (status: OAuthAppStatus) => [...keys.all, 'apps', status] as const,
  versions: () => [...keys.all, 'versions'] as const,
  stats: (id: string) => [...keys.all, 'stats', id] as const,
  publishers: () => [...keys.all, 'publishers'] as const,
  reports: (status: string) => [...keys.all, 'reports', status] as const,
  reviews: (hidden: boolean) => [...keys.all, 'reviews', hidden] as const,
}

const listOf = <T>(data: unknown) => asList<T>((data as { data?: unknown } | null)?.data)

export function useAdminOAuthApps(status: OAuthAppStatus) {
  return useQuery({
    queryKey: keys.apps(status),
    queryFn: async ({ signal }) =>
      listOf<AdminOAuthApp>(
        (await apiClient.get('/admin/oauth-apps', { params: { status }, signal })).data,
      ),
  })
}

export function useSetAppStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      action: 'suspend' | 'reinstate'
      revokeInstallations: boolean
      note?: string
    }) => {
      const body: Record<string, unknown> = {
        action: input.action,
        revokeInstallations: input.revokeInstallations,
      }
      if (input.note?.trim()) body.note = input.note.trim()
      return (await apiClient.post(`/admin/oauth-apps/${input.id}/status`, body))
        .data as OAuthAppRow
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useAdminAppStats(id: string | null) {
  return useQuery({
    queryKey: keys.stats(id ?? ''),
    queryFn: async ({ signal }) =>
      (await apiClient.get(`/admin/oauth-apps/${id}/stats`, { params: { days: 7 }, signal }))
        .data as AppStats,
    enabled: !!id,
  })
}

export function useAdminAppVersions() {
  return useQuery({
    queryKey: keys.versions(),
    queryFn: async ({ signal }) =>
      listOf<AdminVersion>((await apiClient.get('/admin/app-versions', { signal })).data),
  })
}

export function useDecideAppVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; decision: 'publish' | 'reject'; note?: string }) => {
      const body: Record<string, unknown> = { decision: input.decision }
      if (input.note?.trim()) body.note = input.note.trim()
      return (await apiClient.post(`/admin/app-versions/${input.id}/decision`, body))
        .data as AppVersionRow
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useAdminPublishers() {
  return useQuery({
    queryKey: keys.publishers(),
    queryFn: async ({ signal }) =>
      listOf<AdminPublisher>((await apiClient.get('/admin/app-publishers', { signal })).data),
  })
}

export function useSetPublisherVerified() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { workspaceId: string; verified: boolean }) =>
      (
        await apiClient.post(`/admin/app-publishers/${input.workspaceId}/verification`, {
          verified: input.verified,
        })
      ).data as PublisherProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useAdminAppReports(status: 'open' | 'resolved' | 'dismissed') {
  return useQuery({
    queryKey: keys.reports(status),
    queryFn: async ({ signal }) =>
      listOf<AdminReport>(
        (await apiClient.get('/admin/app-reports', { params: { status }, signal })).data,
      ),
  })
}

export function useResolveAppReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; status: 'resolved' | 'dismissed'; note?: string }) => {
      const body: Record<string, unknown> = { status: input.status }
      if (input.note?.trim()) body.note = input.note.trim()
      return (await apiClient.post(`/admin/app-reports/${input.id}/resolution`, body)).data as {
        id: string
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useAdminAppReviews(hidden: boolean) {
  return useQuery({
    queryKey: keys.reviews(hidden),
    queryFn: async ({ signal }) =>
      listOf<AdminReview>(
        (await apiClient.get('/admin/app-reviews', { params: { hidden: String(hidden) }, signal }))
          .data,
      ),
  })
}

export function useSetReviewHidden() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; hidden: boolean; reason?: string }) => {
      const body: Record<string, unknown> = { hidden: input.hidden }
      if (input.reason?.trim()) body.reason = input.reason.trim()
      return (await apiClient.post(`/admin/app-reviews/${input.id}/visibility`, body)).data as {
        id: string
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  })
}
