'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@hisabche/api'

export interface PlanPriceItem {
  id: string
  plan: string
  amount_irr: number
  effective_from: string
  effective_until: string | null
  created_at: string
  created_by: string
}

export interface BillingLedgerItem {
  id: string
  workspace_id: string
  entry_type: 'CHARGE' | 'PAYMENT' | 'REFUND' | 'ADJUSTMENT' | 'CREDIT' | 'UPGRADE_CREDIT'
  amount_irr: number
  description: string
  actor_email: string
  idempotency_key: string | null
  created_at: string
}

export interface AdminActionRequestItem {
  id: string
  action_type: 'REFUND' | 'LEDGER_ADJUSTMENT' | 'PRICE_CHANGE' | 'DOWNGRADE' | 'LICENSE_TRANSFER'
  payload: Record<string, unknown>
  diff_preview: Record<string, unknown>
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  proposed_by: string
  approved_by: string | null
  rejection_reason: string | null
  created_at: string
  decided_at: string | null
}

export function useAdminPlanPrices() {
  return useQuery<{ prices: PlanPriceItem[] }>({
    queryKey: ['admin', 'billing', 'prices'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/billing/prices')
      return res.data
    },
    staleTime: 60 * 1000,
  })
}

export function useSetPlanPrice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      plan,
      amountIrr,
      effectiveFrom,
      effectiveUntil,
      stepUpTimestamp,
    }: {
      plan: string
      amountIrr: number
      effectiveFrom?: string
      effectiveUntil?: string | null
      stepUpTimestamp: string
    }) => {
      const res = await apiClient.post(
        '/admin/billing/prices',
        { plan, amountIrr, effectiveFrom, effectiveUntil },
        {
          headers: {
            'X-Admin-Step-Up-Timestamp': stepUpTimestamp,
          },
        },
      )
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'billing', 'prices'] })
    },
  })
}

export function useAdminBillingLedger(
  filters: {
    workspaceId?: string | undefined
    limit?: number | undefined
    offset?: number | undefined
  } = {},
) {
  return useQuery<{ entries: BillingLedgerItem[]; total: number }>({
    queryKey: ['admin', 'billing', 'ledger', filters],
    queryFn: async () => {
      const res = await apiClient.get('/admin/billing/ledger', { params: filters })
      return res.data
    },
    staleTime: 15 * 1000,
  })
}

export function useAdminActionRequests(status?: string) {
  return useQuery<{ requests: AdminActionRequestItem[] }>({
    queryKey: ['admin', 'billing', 'action-requests', status],
    queryFn: async () => {
      const res = await apiClient.get('/admin/billing/action-requests', { params: { status } })
      return res.data
    },
    staleTime: 15 * 1000,
  })
}

export function useDecideActionRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      approved,
      rejectionReason,
      stepUpTimestamp,
    }: {
      id: string
      approved: boolean
      rejectionReason?: string
      stepUpTimestamp: string
    }) => {
      const res = await apiClient.post(
        `/admin/billing/action-requests/${id}/decide`,
        { approved, rejectionReason },
        {
          headers: {
            'X-Admin-Step-Up-Timestamp': stepUpTimestamp,
          },
        },
      )
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'billing', 'action-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'billing', 'ledger'] })
    },
  })
}

export function useAdminDunningLogs(workspaceId?: string) {
  return useQuery<{ logs: Array<Record<string, unknown>> }>({
    queryKey: ['admin', 'billing', 'dunning-logs', workspaceId],
    queryFn: async () => {
      const res = await apiClient.get('/admin/billing/dunning-logs', { params: { workspaceId } })
      return res.data
    },
    staleTime: 30 * 1000,
  })
}
