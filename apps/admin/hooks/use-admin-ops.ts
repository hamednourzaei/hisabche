'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@hisabche/api'

export interface FeatureFlagItem {
  id: string
  key: string
  name: string
  description: string | null
  is_enabled: boolean
  rollout_percentage: number
  platforms: string[]
  countries: string[]
  is_beta: boolean
  created_at: string
  updated_at: string
}

export interface SystemHealthProbe {
  component: string
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'NO_PROBE'
  latencyMs: number | null
  details?: string | undefined
}

export interface BackgroundJobItem {
  id: string
  job_type: 'IMPORT' | 'EXPORT' | 'MIGRATION' | 'CLEANUP' | 'DUNNING'
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  workspace_id: string | null
  payload: Record<string, unknown>
  result: Record<string, unknown> | null
  error_message: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export interface AdminAnnouncementItem {
  id: string
  title: string
  message: string
  level: 'INFO' | 'WARNING' | 'CRITICAL' | 'MAINTENANCE'
  target_plans: string[]
  target_editions: string[]
  target_platforms: string[]
  target_locales: string[]
  is_active: boolean
  starts_at: string
  ends_at: string | null
  created_at: string
}

export function useAdminFeatureFlags() {
  return useQuery<{ flags: FeatureFlagItem[] }>({
    queryKey: ['admin', 'ops', 'flags'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/ops/flags')
      return res.data
    },
    staleTime: 30 * 1000,
  })
}

export function useUpsertFeatureFlag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      flag,
      stepUpTimestamp,
    }: {
      flag: Partial<FeatureFlagItem> & { key: string; name: string }
      stepUpTimestamp: string
    }) => {
      const payload = {
        key: flag.key,
        name: flag.name,
        description: flag.description ?? undefined,
        isEnabled: flag.is_enabled ?? undefined,
        rolloutPercentage: flag.rollout_percentage ?? undefined,
        platforms: flag.platforms ?? undefined,
        countries: flag.countries ?? undefined,
        isBeta: flag.is_beta ?? undefined,
      }
      const res = await apiClient.post('/admin/ops/flags', payload, {
        headers: {
          'X-Admin-Step-Up-Timestamp': stepUpTimestamp,
        },
      })
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ops', 'flags'] })
    },
  })
}

export function useAdminSystemHealth() {
  return useQuery<{ probes: SystemHealthProbe[] }>({
    queryKey: ['admin', 'ops', 'health'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/ops/health')
      return res.data
    },
    refetchInterval: 10 * 1000,
  })
}

export function useAdminBackgroundJobs() {
  return useQuery<{ jobs: BackgroundJobItem[] }>({
    queryKey: ['admin', 'ops', 'jobs'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/ops/jobs')
      return res.data
    },
    staleTime: 10 * 1000,
  })
}

export function useRetryBackgroundJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ jobId, stepUpTimestamp }: { jobId: string; stepUpTimestamp: string }) => {
      const res = await apiClient.post(
        `/admin/ops/jobs/${jobId}/retry`,
        {},
        {
          headers: {
            'X-Admin-Step-Up-Timestamp': stepUpTimestamp,
          },
        },
      )
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ops', 'jobs'] })
    },
  })
}

export function useAdminAnnouncements() {
  return useQuery<{ announcements: AdminAnnouncementItem[] }>({
    queryKey: ['admin', 'ops', 'announcements'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/ops/announcements')
      return res.data
    },
    staleTime: 30 * 1000,
  })
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      announcement,
      stepUpTimestamp,
    }: {
      announcement: Omit<AdminAnnouncementItem, 'id' | 'created_at'>
      stepUpTimestamp: string
    }) => {
      const res = await apiClient.post('/admin/ops/announcements', announcement, {
        headers: {
          'X-Admin-Step-Up-Timestamp': stepUpTimestamp,
        },
      })
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ops', 'announcements'] })
    },
  })
}

export function useExportAdminCsv() {
  return useMutation({
    mutationFn: async ({
      table,
      stepUpTimestamp,
    }: {
      table: 'audit_logs' | 'billing_ledger_entries' | 'admin_security_events' | 'offline_licenses'
      stepUpTimestamp: string
    }) => {
      const res = await apiClient.post(
        '/admin/ops/export-csv',
        { table },
        {
          headers: {
            'X-Admin-Step-Up-Timestamp': stepUpTimestamp,
          },
        },
      )
      return res.data
    },
  })
}

// ─── V100 CONTROL PLANE HOOKS ────────────────────────────────

export interface AdminSupportTicketItem {
  id: string
  workspace_id: string
  workspace_name: string | null
  ticket_code: string | null
  subject: string
  priority: string
  category: string
  status: string
  sla_hours: number | null
  response_due_at: string | null
  escalation_level: number
  assigned_to: string | null
  slaBreached: boolean
  created_at: string
  updated_at: string | null
}

export interface AdminGatewayEventItem {
  id: string
  workspace_id: string | null
  payment_id: string | null
  provider: string
  event_id: string | null
  event_type: string | null
  amount_minor: number | null
  currency: string | null
  signature_valid: boolean
  processing_status: string
  delivery_attempts: number
  last_error: string | null
  created_at: string
}

export interface AdminChangeOrderItem {
  id: string
  workspace_id: string
  workspace_name: string | null
  project_id: string
  project_name: string | null
  project_currency: string | null
  project_version: number
  title: string
  delta_budget: number
  status: 'pending_approval' | 'approved' | 'rejected'
  reason: string | null
  decided_at: string | null
  created_at: string
}

export interface AdminWorkspaceReconcileReport {
  workspaceId: string
  checkedAt: string
  status: 'balanced' | 'unbalanced'
  balanced: boolean
  debits: number
  credits: number
  missingPostings: number
  duplicatePostings: number
  reversalMismatch: number
  advanceLiabilityMismatch: number
  currencyMismatch: number
  roundingDifference: number
  exceptions: Array<{
    code: string
    severity: 'error' | 'warning'
    currency: string | null
    entityType: string
    entityId: string
    amountMinor: number
    message: string
  }>
  perCurrency: Array<{
    currency: string
    invoicePaidMinor: number
    allocatedToInvoicesMinor: number
    paymentsTotalMinor: number
    unallocatedAdvancesMinor: number
  }>
}

export interface AdminCapabilitiesSnapshot {
  industryCount: number
  engineCount: number
  statusCounts: { available: number; partial: number; planned: number }
  engines: Array<{
    key: string
    pack: string
    offlineStatus: string
    offline: string
    structure: string
    hasLocalEngine: boolean
    hasClientHook: boolean
    hasUiHost: boolean
  }>
  capabilities: Array<{
    key: string
    status: 'available' | 'partial' | 'planned'
    limitations: string[]
    requires: string[]
  }>
}

export function useAdminSupportTickets(
  filters: {
    workspaceId?: string
    status?: string
    priority?: string
  } = {},
) {
  return useQuery<{ tickets: AdminSupportTicketItem[] }>({
    queryKey: ['admin', 'ops', 'support-tickets', filters],
    queryFn: async () => {
      const res = await apiClient.get('/admin/ops/support-tickets', { params: filters })
      return res.data
    },
    staleTime: 15 * 1000,
  })
}

export function useTransitionAdminSupportTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      ticketId: string
      status: 'acknowledged' | 'escalated' | 'resolved' | 'closed'
      note?: string
      stepUpTimestamp: string
    }) => {
      const res = await apiClient.patch(
        `/admin/ops/support-tickets/${input.ticketId}/status`,
        { status: input.status, ...(input.note ? { note: input.note } : {}) },
        { headers: { 'X-Admin-Step-Up-Timestamp': input.stepUpTimestamp } },
      )
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ops', 'support-tickets'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'metrics'] })
    },
  })
}

export function useEvaluateAdminSupportSla() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { workspaceId?: string; stepUpTimestamp: string }) => {
      const res = await apiClient.post(
        '/admin/ops/support-tickets/evaluate-sla',
        input.workspaceId ? { workspaceId: input.workspaceId } : {},
        { headers: { 'X-Admin-Step-Up-Timestamp': input.stepUpTimestamp } },
      )
      return res.data as {
        evaluatedCount: number
        escalatedTicketIds: string[]
        notificationFailures: number
        checkedAt: string
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ops', 'support-tickets'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'metrics'] })
    },
  })
}

export function useAdminGatewayEvents(
  filters: {
    workspaceId?: string
    provider?: string
    status?: string
  } = {},
) {
  return useQuery<{ events: AdminGatewayEventItem[] }>({
    queryKey: ['admin', 'ops', 'gateway-events', filters],
    queryFn: async () => {
      const res = await apiClient.get('/admin/ops/gateway-events', { params: filters })
      return res.data
    },
    staleTime: 15 * 1000,
  })
}

export function useRunAdminWorkspaceReconcile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { workspaceId: string; stepUpTimestamp: string }) => {
      const res = await apiClient.post(
        '/admin/ops/reconcile-workspace',
        { workspaceId: input.workspaceId },
        { headers: { 'X-Admin-Step-Up-Timestamp': input.stepUpTimestamp } },
      )
      return res.data as { data: AdminWorkspaceReconcileReport }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] })
    },
  })
}

export function useAdminChangeOrders(
  filters: {
    workspaceId?: string
    status?: string
  } = {},
) {
  return useQuery<{ orders: AdminChangeOrderItem[] }>({
    queryKey: ['admin', 'ops', 'change-orders', filters],
    queryFn: async () => {
      const res = await apiClient.get('/admin/ops/change-orders', { params: filters })
      return res.data
    },
    staleTime: 15 * 1000,
  })
}

export function useDecideAdminChangeOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      orderId: string
      decision: 'approved' | 'rejected'
      reason?: string
      expectedVersion?: number
      stepUpTimestamp: string
    }) => {
      const res = await apiClient.post(
        `/admin/ops/change-orders/${input.orderId}/decide`,
        {
          decision: input.decision,
          ...(input.reason ? { reason: input.reason } : {}),
          ...(input.expectedVersion ? { expectedVersion: input.expectedVersion } : {}),
        },
        { headers: { 'X-Admin-Step-Up-Timestamp': input.stepUpTimestamp } },
      )
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ops', 'change-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'metrics'] })
    },
  })
}

export function useAdminCapabilitiesSnapshot() {
  return useQuery<AdminCapabilitiesSnapshot>({
    queryKey: ['admin', 'ops', 'capabilities'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/ops/capabilities')
      return res.data
    },
    staleTime: 60 * 1000,
  })
}
