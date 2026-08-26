'use client'

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@hisabche/api'

/**
 * The shape `/api/admin/metrics` actually returns.
 *
 * ⚠️ This used to be declared as `{ status, timestamp, version }` — the shape
 * of `AdminService.getStatus()`, which has no route. The endpoint was right and
 * the type was wrong, so every field read off the response was `undefined` and
 * the dashboard rendered `?` in every card. A comment in this file even noted
 * that `status` never existed on the backend, while the interface below it kept
 * using it.
 *
 * Keep this in step with `AdminService.getMetrics()`.
 *
 * DELIBERATELY ABSENT: mrr, arr, revenue. There is no authoritative pricing
 * source — `PLANS` has no price and `checkout_sessions` has no amount — so any
 * revenue figure would be invented. Do not add one here without a real billing
 * ledger behind it.
 */
export interface AdminMetrics {
  workspaces: {
    total: number
    active: number
    newToday: number
    newThisMonth: number
  }
  members: {
    total: number
  }
  subscriptions: {
    total: number
    active: number
    expired: number
    expiringInSevenDays: number
    trial: number
    /** Keyed by plan id — free / pro / enterprise, from the PLANS config. */
    byPlan: Record<string, number>
    /**
     * Percentage of subscriptions carrying a workspace_id. Below 100 while
     * docs/subscription-workspace-migration.sql is mid-flight; the UI shows a
     * notice rather than presenting an incomplete plan mix as complete.
     */
    workspaceAttributedPercent: number
  }
  generatedAt: string
}

export function useAdminMetrics() {
  return useQuery<AdminMetrics>({
    queryKey: ['admin', 'metrics'],
    queryFn: async () => {
      // `apiClient` already carries the `/api` prefix in its baseURL, so the
      // path here must NOT repeat it — '/api/admin/...' produced
      // '.../api/api/admin/...'.
      const response = await apiClient.get('/admin/metrics')
      return response.data
    },
    retry: false,
    staleTime: 1000 * 60,
  })
}
