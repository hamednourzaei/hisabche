'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiClient } from '@hisabche/api'

/**
 * Platform user directory.
 *
 * Endpoint: `GET /admin/users-search?search=&limit=&offset=` →
 * `{ users, total, limit, offset }`. Verified against `admin.routes.ts:151`
 * and `AdminService.searchUsers()` — not assumed.
 *
 * ⚠️ THE SEARCH IS BY NAME ONLY, and the UI must say so. `searchUsers` runs
 * `ilike` on `profiles.full_name`; email lives in `auth.users`, which PostgREST
 * does not expose, so it is resolved for the matched page AFTERWARDS and can
 * never be part of the WHERE clause. A box labelled "search users" that
 * silently ignores a typed email would make an operator conclude the account
 * does not exist.
 *
 * Distinct from `GET /admin/users`, which pages Supabase Auth directly.
 */
export interface AdminUser {
  id: string
  full_name: string | null
  /** Resolved from auth for the matched page; null when there is no identity. */
  email: string | null
}

export interface AdminUserList {
  users: AdminUser[]
  total: number
  limit: number
  offset: number
}

export interface UserListParams {
  search?: string
  limit?: number
  offset?: number
}

export const adminUserKeys = {
  all: ['admin', 'users'] as const,
  list: (params: UserListParams) => [...adminUserKeys.all, 'list', params] as const,
}

export function useAdminUsers(params: UserListParams) {
  return useQuery<AdminUserList>({
    queryKey: adminUserKeys.list(params),
    queryFn: async () => {
      // `apiClient` already carries the `/api` prefix — repeating it here is
      // the mistake that produced '/api/api/admin/...'.
      const response = await apiClient.get('/admin/users-search', { params })
      return response.data
    },
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30,
    retry: false,
  })
}
