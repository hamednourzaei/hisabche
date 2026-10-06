// ============================================
// packages/api/src/hooks/permission-matrix.ts
//
// G3 — the Permission Matrix, from the client side.
//
// ⚠️ The module map and the access ladder are NOT duplicated here. They come
// down with the matrix, from `PERMISSION_MODULES` in the backend's
// authorization domain — the same constant the route guards are built on. A
// second copy in the client is how a screen starts describing permissions the
// server does not have.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { asList } from '../lib/as-list'
import { apiClient } from '../lib/client'
import { useAuthReady } from './useAuthReady'

export type AccessLevel = 'none' | 'read' | 'write' | 'full'

export interface MatrixModule {
  key: string
  label: string
  /** Only the rungs this module actually offers. */
  levels: AccessLevel[]
}

export interface MatrixRole {
  id: string
  code: string
  name: string
  description: string | null
  isSystem: boolean
  /**
   * owner / manager / seller. Their capabilities come from the enforced static
   * table, so their cells are shown and not edited.
   */
  isEnforcedBase: boolean
  workspaceId: string | null
  /** A role this business made: its holder gets exactly what its column says. */
  isCustom?: boolean | undefined
  /** A shared starting point for a new role — read-only, never assigned. */
  isTemplate?: boolean | undefined
}

export interface MatrixCell {
  roleId: string
  moduleKey: string
  baseLevel: AccessLevel
  grantedLevel: AccessLevel
  effectiveLevel: AccessLevel
  editable: boolean
}

export interface PermissionMatrix {
  modules: MatrixModule[]
  roles: MatrixRole[]
  cells: MatrixCell[]
}

export interface RoleMember {
  userId: string
  name: string | null
  position: string | null
}

export const permissionMatrixKeys = {
  all: ['permission-matrix'] as const,
  matrix: () => [...permissionMatrixKeys.all, 'matrix'] as const,
  members: (roleId?: string) => [...permissionMatrixKeys.all, 'members', roleId] as const,
}

const unwrap = <T>(response: unknown): T => {
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as { data: T }).data
  }
  return response as T
}

export function usePermissionMatrix() {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: permissionMatrixKeys.matrix(),
    queryFn: async () => unwrap<PermissionMatrix>(await apiClient.get('/permissions/matrix')),
    enabled: authReady,
    staleTime: 1000 * 30,
  })
}

/** Set one cell. The server returns the whole matrix back, already recomputed. */
export function useSetPermissionCell() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { roleId: string; moduleKey: string; level: AccessLevel }) =>
      unwrap<PermissionMatrix>(await apiClient.put('/permissions/matrix/cell', input)),

    onSuccess: (matrix) => {
      // Seeded from the response rather than refetched: the server just
      // computed the authoritative matrix, and a refetch would show the old one
      // for a moment.
      queryClient.setQueryData(permissionMatrixKeys.matrix(), matrix)
      // A grant change moves what every member may do, so anything that cached
      // a permission answer is now stale.
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
    },
  })
}

/** The server answers every role change with the whole matrix, recomputed. */
function useMatrixMutation<TInput>(run: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: TInput) => unwrap<PermissionMatrix>(await run(input)),
    onSuccess: (matrix) => {
      queryClient.setQueryData(permissionMatrixKeys.matrix(), matrix)
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
    },
  })
}

/** Make a role for this business, optionally starting from another role's grants. */
export function useCreateCustomRole() {
  return useMatrixMutation((input: { name: string; templateRoleId?: string | undefined }) =>
    apiClient.post('/permissions/roles', input),
  )
}

export function useRenameCustomRole() {
  return useMatrixMutation((input: { roleId: string; name: string }) =>
    apiClient.patch(`/permissions/roles/${input.roleId}`, { name: input.name }),
  )
}

/** Delete a role nobody holds (the server refuses one that is in use). */
export function useDeleteCustomRole() {
  return useMatrixMutation((roleId: string) => apiClient.delete(`/permissions/roles/${roleId}`))
}

/** Give a person a profile. Takes a USER id — see the server for why. */
export function useAssignProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { userId: string; roleId: string; replaceExisting?: boolean }) =>
      unwrap<{ success: boolean }>(await apiClient.post('/permissions/profiles/assign', input)),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permissionMatrixKeys.all })
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
    },
  })
}

/** Who holds this role — the matrix's column drill-down. */
export function useRoleMembers(roleId?: string) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: permissionMatrixKeys.members(roleId),
    queryFn: async () => {
      const body = unwrap<{ members: RoleMember[] }>(
        await apiClient.get(`/permissions/roles/${roleId}/members`),
      )
      return asList<RoleMember>(body?.members, '/permissions/roles/members')
    },
    enabled: authReady && !!roleId,
  })
}
