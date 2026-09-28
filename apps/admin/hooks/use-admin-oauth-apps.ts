'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, asList, type OAuthAppRow } from '@hisabche/api'
import { OAUTH_APP_STATUSES, type OAuthAppStatus } from '@hisabche/validation'

/**
 * The OAuth app review queue.
 *
 * Endpoints (backend/src/routes/oauth.routes.ts, behind platformAdminGuard):
 *
 *   GET  /admin/oauth-apps?status=      -> { data: (AppRow & { publisher })[] }
 *   POST /admin/oauth-apps/:id/review   { decision: published|rejected|suspended, note? }
 *
 * Publishing makes an app installable by EVERY business; suspending one stops
 * new installs and token exchanges immediately (existing tokens are keys the
 * installers revoke).
 */

export { OAUTH_APP_STATUSES }
export type { OAuthAppStatus }
export type ReviewDecision = 'published' | 'rejected' | 'suspended'

export interface AdminOAuthApp extends OAuthAppRow {
  publisher: string | null
}

const keys = {
  all: ['admin', 'oauth-apps'] as const,
  list: (status: OAuthAppStatus) => [...keys.all, status] as const,
}

export function useAdminOAuthApps(status: OAuthAppStatus) {
  return useQuery({
    queryKey: keys.list(status),
    queryFn: async ({ signal }): Promise<AdminOAuthApp[]> => {
      const { data } = await apiClient.get('/admin/oauth-apps', { params: { status }, signal })
      return asList<AdminOAuthApp>((data as { data?: unknown } | null)?.data)
    },
  })
}

export function useReviewOAuthApp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; decision: ReviewDecision; note?: string }) => {
      const body: Record<string, unknown> = { decision: input.decision }
      if (input.note?.trim()) body.note = input.note.trim()
      return (await apiClient.post(`/admin/oauth-apps/${input.id}/review`, body))
        .data as OAuthAppRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}
