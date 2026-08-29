'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiClient } from '@hisabche/api'

/**
 * Admin workspace listing.
 *
 * Types mirror what `AdminService.listWorkspaces()` actually returns, verified
 * against the service — not what would be convenient.
 *
 * Member queries live in `use-admin-members.ts`. They are deliberately NOT
 * here: members load per-workspace on expand, and mixing them into the list
 * hook is how a "just fetch it with the row" refactor turns one request into
 * one-per-workspace.
 */

export interface AdminWorkspace {
  id: string
  name: string
  slug: string
  description: string | null
  owner_id: string
  is_active: boolean
  created_at: string
  updated_at: string

  /**
   * Enrichment resolved server-side in batched queries — four for the whole
   * page, not 1 + 3N. See `AdminService.listWorkspaces()`.
   *
   * Every field is nullable and means it: null owner identity is a workspace
   * whose owner has no profile row; null plan is a workspace with no
   * subscription. The UI renders those as "no owner" / "no subscription" and
   * never substitutes a placeholder or a truncated uuid, which would look like
   * data while asserting nothing.
   */
  ownerName: string | null
  ownerEmail: string | null
  plan: string | null
  subscriptionStatus: string | null
  subscriptionPeriodEnd: string | null
  /** Active seats only — suspended and access-revoked rows are excluded. */
  memberCount: number
}

export interface AdminWorkspaceList {
  workspaces: AdminWorkspace[]
  total: number
  limit: number
  offset: number
}

export interface WorkspaceListParams {
  search?: string
  limit?: number
  offset?: number
}

export const adminWorkspaceKeys = {
  all: ['admin', 'workspaces'] as const,
  list: (params: WorkspaceListParams) => [...adminWorkspaceKeys.all, 'list', params] as const,
}

export function useAdminWorkspaces(params: WorkspaceListParams) {
  return useQuery<AdminWorkspaceList>({
    queryKey: adminWorkspaceKeys.list(params),
    queryFn: async () => {
      // `apiClient` already carries the `/api` prefix in its baseURL, so the
      // path must not repeat it — '/api/admin/...' produced '/api/api/admin/...'.
      const response = await apiClient.get('/admin/workspaces', { params })
      return response.data
    },
    // Paging and searching keep the current page on screen instead of flashing
    // a skeleton over a table the admin is reading.
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30,
    retry: false,
  })
}
