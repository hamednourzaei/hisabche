'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiClient } from '@hisabche/api'

/**
 * Admin workspace queries.
 *
 * ⚠️ These types mirror what the backend ACTUALLY returns, verified against
 * `AdminService.listWorkspaces()` and `getWorkspaceDetail()` — not what would
 * be convenient. Three gaps are load-bearing for the UI and are handled
 * explicitly rather than papered over:
 *
 *   1. The workspace list returns `owner_id` only — no owner name or email.
 *   2. Members return `user_id` only — `MEMBER_COLUMNS` is
 *      'workspace_id, user_id, role, has_access, suspended_at, joined_at'.
 *   3. Members carry no membership `id`, so there is no identifier a mutation
 *      could address even if a mutation endpoint existed.
 *
 * Resolving names would need one `/admin/users/:id` call per member, which is
 * the N+1 the performance rules forbid. The UI therefore shows identity as it
 * exists today and the gap is reported, not invented around.
 */

/* ── List ───────────────────────────────────────────────────────────────── */

export interface AdminWorkspace {
  id: string
  name: string
  slug: string
  description: string | null
  owner_id: string
  is_active: boolean
  created_at: string
  updated_at: string
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
  detail: (id: string) => [...adminWorkspaceKeys.all, 'detail', id] as const,
}

export function useAdminWorkspaces(params: WorkspaceListParams) {
  return useQuery<AdminWorkspaceList>({
    queryKey: adminWorkspaceKeys.list(params),
    queryFn: async () => {
      const response = await apiClient.get('/admin/workspaces', { params })
      return response.data
    },
    // Paging and searching keep the previous page on screen instead of
    // flashing a skeleton over a table the admin is reading.
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30,
    retry: false,
  })
}

/* ── Detail (members live here) ─────────────────────────────────────────── */

export type WorkspaceRole = 'owner' | 'manager' | 'seller'

export interface AdminWorkspaceMember {
  workspace_id: string
  user_id: string
  role: string | null
  has_access: boolean | null
  suspended_at: string | null
  joined_at: string | null
}

export interface AdminSubscription {
  id: string
  plan: string
  status: string
  is_trial: boolean | null
  period_end: string | null
}

export interface AdminWorkspaceDetail {
  workspace: AdminWorkspace
  members: AdminWorkspaceMember[]
  subscription: AdminSubscription | null
  usage: { invoices: number; transactions: number; members: number }
  limits: Record<string, number | null> | null
}

/**
 * Members for ONE workspace, fetched only when its row is expanded.
 *
 * `enabled` is what makes the lazy loading real: the initial page renders the
 * workspace list with zero member requests, and a row that is never opened
 * never costs a round-trip. Collapsing does not evict — TanStack keeps the
 * entry, so re-opening within `staleTime` serves from cache with no refetch.
 *
 * There is no dedicated `/workspaces/:id/members` route; the detail endpoint
 * is the real source and carries subscription and usage in the same response,
 * which the expanded row also shows.
 */
export function useAdminWorkspaceDetail(workspaceId: string, enabled: boolean) {
  return useQuery<AdminWorkspaceDetail>({
    queryKey: adminWorkspaceKeys.detail(workspaceId),
    queryFn: async () => {
      const response = await apiClient.get(`/admin/workspaces/${workspaceId}`)
      return response.data
    },
    enabled,
    staleTime: 1000 * 60,
    retry: false,
  })
}

/** Sorts owner first, then managers, then sellers — the hierarchy, in order. */
const ROLE_RANK: Record<string, number> = { owner: 0, manager: 1, seller: 2 }

export function sortMembers(members: AdminWorkspaceMember[]): AdminWorkspaceMember[] {
  return [...members].sort((a, b) => {
    const rank = (ROLE_RANK[a.role ?? ''] ?? 99) - (ROLE_RANK[b.role ?? ''] ?? 99)
    if (rank !== 0) return rank
    return (a.joined_at ?? '').localeCompare(b.joined_at ?? '')
  })
}

/** Active means: has access AND not suspended. Either alone is misleading. */
export function isActiveMember(member: AdminWorkspaceMember): boolean {
  return member.has_access === true && member.suspended_at === null
}
