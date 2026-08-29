'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@hisabche/api'

import { adminWorkspaceKeys } from './use-admin-workspaces'

/**
 * Workspace membership — the real backend contract.
 *
 * Endpoints (verified against backend/src/routes/admin.routes.ts):
 *
 *   GET    /admin/workspaces/:workspaceId/members  -> { members: AdminMember[] }
 *   PATCH  /admin/memberships/:membershipId        -> AdminMember
 *   DELETE /admin/memberships/:membershipId        -> { removed, membershipId }
 *
 * `apiClient` already carries the `/api` prefix, so paths here must not repeat
 * it — '/api/admin/...' produced '.../api/api/admin/...'.
 *
 * The server issues exactly two queries per listing (memberships, then one
 * batched identity lookup), so expanding a workspace costs one request and the
 * backend costs two round-trips regardless of member count.
 */

export type MemberRole = 'owner' | 'manager' | 'seller'
export type MemberStatus = 'active' | 'suspended' | 'no-access'

export interface AdminMember {
  /** Membership primary key — what mutations address. NOT the user id. */
  id: string
  userId: string
  /** Null when the membership has no matching profile row — still a member. */
  name: string | null
  email: string | null
  role: string
  status: MemberStatus
  joinedAt: string | null
}

export const adminMemberKeys = {
  all: ['admin', 'members'] as const,
  ofWorkspace: (workspaceId: string) => [...adminMemberKeys.all, workspaceId] as const,
}

/**
 * Members of ONE workspace, fetched only when its row is expanded.
 *
 * `enabled` is what makes the laziness real: the initial page renders the
 * workspace list with zero member requests, and a row never opened never costs
 * a round-trip. Collapsing does not evict the entry, so re-opening inside
 * `staleTime` serves from cache with no refetch.
 */
export function useWorkspaceMembers(workspaceId: string, enabled: boolean) {
  return useQuery<AdminMember[]>({
    queryKey: adminMemberKeys.ofWorkspace(workspaceId),
    queryFn: async () => {
      const response = await apiClient.get(`/admin/workspaces/${workspaceId}/members`)
      return response.data?.members ?? []
    },
    enabled,
    staleTime: 1000 * 60,
    retry: false,
  })
}

/**
 * Change a member's role.
 *
 * Invalidates ONLY the affected workspace's member list — not the whole admin
 * cache. The workspace stays expanded because its row's open state lives in
 * component state, untouched by a query invalidation.
 */
export function useUpdateMemberRole(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ membershipId, role }: { membershipId: string; role: MemberRole }) => {
      const response = await apiClient.patch(`/admin/memberships/${membershipId}`, { role })
      return response.data as AdminMember
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminMemberKeys.ofWorkspace(workspaceId) })
      // The workspace list shows the owner, which a role change can move.
      void queryClient.invalidateQueries({ queryKey: adminWorkspaceKeys.all })
    },
  })
}

/**
 * Remove a membership.
 *
 * Removes the MEMBERSHIP only. The backend never touches the user account —
 * that separation is enforced server-side and asserted by
 * `admin-membership.test.ts`; the dialog says so because the admin cannot see
 * the server to know it.
 *
 * No optimistic update: on failure the member must still be there, and the
 * simplest way to guarantee that is not to remove them until the server says
 * it happened.
 */
export function useRemoveMember(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (membershipId: string) => {
      await apiClient.delete(`/admin/memberships/${membershipId}`)
      return membershipId
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminMemberKeys.ofWorkspace(workspaceId) })
      void queryClient.invalidateQueries({ queryKey: adminWorkspaceKeys.all })
    },
  })
}

/** Sorts owner first, then managers, then sellers — the hierarchy, in order. */
const ROLE_RANK: Record<string, number> = { owner: 0, manager: 1, seller: 2 }

export function sortMembers(members: AdminMember[]): AdminMember[] {
  return [...members].sort((a, b) => {
    const rank = (ROLE_RANK[a.role] ?? 99) - (ROLE_RANK[b.role] ?? 99)
    if (rank !== 0) return rank
    return (a.joinedAt ?? '').localeCompare(b.joinedAt ?? '')
  })
}

/**
 * Whether `owner` may be offered for this member.
 *
 * Mirrors the server rule so the UI does not invite a click it knows will be
 * refused — but the server remains the authority. It rejects a second owner
 * with a conflict, and `workspace_single_owner_idx` rejects it again at the
 * database. This is the third layer, and the only optional one.
 */
export function canPromoteToOwner(members: AdminMember[], membershipId: string): boolean {
  const existingOwner = members.find((m) => m.role === 'owner')
  return !existingOwner || existingOwner.id === membershipId
}
