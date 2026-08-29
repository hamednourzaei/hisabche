'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@hisabche/api'

/**
 * Admin subscription management.
 *
 * Endpoints (verified against backend/src/routes/admin.routes.ts and
 * AdminService — not assumed):
 *
 *   GET   /admin/subscriptions?plan=&status=&limit=&offset=
 *         -> { subscriptions, total, limit, offset }
 *   PATCH /admin/subscriptions/:id/plan    { plan, reason? }
 *   PATCH /admin/subscriptions/:id/status  { status, reason? }
 *
 * Both mutations are audited server-side with before/after snapshots and the
 * acting admin. There is no client-side write of any kind.
 *
 * ⚠️ NOT IMPLEMENTED HERE: date-bucketed expiry ("expires in 3 days / 7 days /
 * 30 days"). `listPastDueSubscriptions` filters on `status = 'past_due'`, not
 * on `period_end`, and `listSubscriptions` has no date filter. Bucketing a
 * paged list client-side would only bucket the page in front of you and would
 * quietly under-report — so it is absent rather than wrong. It needs a backend
 * date-range filter first.
 */

/** The real enums from packages/validation — a closed vocabulary, not strings. */
export const PLANS = ['free', 'pro', 'enterprise'] as const
export const STATUSES = ['active', 'trial', 'expired', 'cancelled', 'past_due'] as const

export type Plan = (typeof PLANS)[number]
export type SubscriptionStatus = (typeof STATUSES)[number]

export interface AdminSubscription {
  id: string
  user_id: string | null
  workspace_id: string | null
  plan: string
  status: string
  is_trial: boolean | null
  trial_used: boolean | null
  trial_started_at: string | null
  trial_ends_at: string | null
  period_start: string | null
  period_end: string | null
  cancel_at_period_end: boolean | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created_at: string
  updated_at: string
}

export interface SubscriptionListParams {
  plan?: Plan
  status?: SubscriptionStatus
  limit?: number
  offset?: number
}

export interface AdminSubscriptionList {
  subscriptions: AdminSubscription[]
  total: number
  limit: number
  offset: number
}

export const adminSubscriptionKeys = {
  all: ['admin', 'subscriptions'] as const,
  list: (params: SubscriptionListParams) => [...adminSubscriptionKeys.all, 'list', params] as const,
}

export function useAdminSubscriptions(params: SubscriptionListParams) {
  return useQuery<AdminSubscriptionList>({
    queryKey: adminSubscriptionKeys.list(params),
    queryFn: async () => {
      const response = await apiClient.get('/admin/subscriptions', { params })
      return response.data
    },
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30,
    retry: false,
  })
}

/**
 * Change a subscription's plan.
 *
 * `reason` is carried into the audit record's new_data. It is optional in the
 * schema but the UI asks for it, because "who changed this and why" is the
 * question an audit log exists to answer.
 */
export function useUpdateSubscriptionPlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      subscriptionId,
      plan,
      reason,
    }: {
      subscriptionId: string
      plan: Plan
      reason?: string
    }) => {
      const response = await apiClient.patch(`/admin/subscriptions/${subscriptionId}/plan`, {
        plan,
        ...(reason ? { reason } : {}),
      })
      return response.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminSubscriptionKeys.all })
      // The workspace list shows each workspace's plan.
      void queryClient.invalidateQueries({ queryKey: ['admin', 'workspaces'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'metrics'] })
    },
  })
}

export function useUpdateSubscriptionStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      subscriptionId,
      status,
      reason,
    }: {
      subscriptionId: string
      status: SubscriptionStatus
      reason?: string
    }) => {
      const response = await apiClient.patch(`/admin/subscriptions/${subscriptionId}/status`, {
        status,
        ...(reason ? { reason } : {}),
      })
      return response.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminSubscriptionKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'workspaces'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'metrics'] })
    },
  })
}

/**
 * Days until `period_end`, or null when there is no period.
 *
 * Negative means already expired. Used only to colour a row that is ALREADY on
 * screen — never to filter, because filtering client-side over a paged list
 * would silently miss every subscription on another page.
 */
export function daysUntilExpiry(periodEnd: string | null): number | null {
  if (!periodEnd) return null
  const end = new Date(periodEnd).getTime()
  if (Number.isNaN(end)) return null
  return Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24))
}
