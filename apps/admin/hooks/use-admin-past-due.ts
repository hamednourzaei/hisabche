'use client'

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@hisabche/api'
import type { AdminSubscription } from './use-admin-subscriptions'

/**
 * Subscriptions sitting in `past_due` — the platform's real alert queue.
 *
 * This is what backs the header bell. The shared `NotificationBell` from
 * `@hisabche/ui` is deliberately NOT used: it calls `useNotifications()`, a
 * WORKSPACE-scoped endpoint. A platform admin is not a member of any customer
 * workspace (see lesson 11), so that bell can only ever 403 here — it would be
 * a permanently empty ornament. Failed payments are a real thing a platform
 * operator must act on, and `GET /admin/subscriptions/past-due` really
 * returns them.
 *
 * Verified against `admin.routes.ts:293` → `listPastDueSubscriptions`, which
 * returns `{ subscriptions }` and no total.
 */
export interface PastDueList {
  subscriptions: AdminSubscription[]
}

export function useAdminPastDue() {
  return useQuery<PastDueList>({
    queryKey: ['admin', 'subscriptions', 'past-due'],
    queryFn: async () => {
      const response = await apiClient.get('/admin/subscriptions/past-due', {
        params: { limit: 50 },
      })
      return response.data
    },
    // A stale alert count is worse than a slightly costly refetch, but this
    // still must not poll: the admin console has one operator, not a crowd.
    staleTime: 1000 * 60,
    retry: false,
  })
}
