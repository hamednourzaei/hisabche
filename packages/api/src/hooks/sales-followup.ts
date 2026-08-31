// ============================================
// Sales Follow-up Hooks — TanStack Query
// ============================================

'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/client'
import { useAuthReady } from './useAuthReady'
import { useRealtime } from './useRealtime'

// ─── Keys ───────────────────────────────────────────────────

export const salesFollowupKeys = {
  all: ['sales_followups'] as const,
  list: (params: Record<string, unknown>) => [...salesFollowupKeys.all, 'list', params] as const,
  detail: (id: string) => [...salesFollowupKeys.all, 'detail', id] as const,
}

// ─── Types ───────────────────────────────────────────────────

/**
 * The shape `/api/interactions` actually returns.
 *
 * WHY THIS FILE TALKS TO `/interactions`
 *
 * It used to call `/sales-followups`, and that endpoint has never existed —
 * no route, no service, no table, and nothing in the live database. Every
 * request 404'd, so the page could not have worked on any day of its life.
 *
 * A follow-up and a CRM interaction are the same thing: a customer, a kind of
 * contact, a status, a date and someone responsible. Rather than build a
 * second table for the same concept, this maps onto the one that exists, has
 * data, and is already covered by RLS.
 */
interface InteractionRow {
  id: string
  customerId: string
  type: string
  subject: string
  content: string
  interactionDate: string
  createdAt: string
  status: string
  employeeId?: string | null
  employeeName?: string | null
  customers?: Array<{ id: string; name?: string; phone?: string; email?: string }>
}

/** Statuses the CRM uses, in the vocabulary this screen was written against. */
const STATUS_MAP: Record<string, FollowUp['status']> = {
  pending: 'pending',
  new: 'new',
  contacted: 'contacted',
  in_progress: 'contacted',
  scheduled: 'meeting_scheduled',
  meeting_scheduled: 'meeting_scheduled',
  completed: 'won',
  won: 'won',
  cancelled: 'lost',
  lost: 'lost',
}

function toFollowUp(row: InteractionRow): FollowUp {
  const customer = row.customers?.[0]

  return {
    id: row.id,
    customer_id: row.customerId,
    customer_name: customer?.name ?? '',
    ...(customer?.email ? { customer_email: customer.email } : {}),
    ...(customer?.phone ? { customer_phone: customer.phone } : {}),
    assigned_to_id: row.employeeId ?? '',
    assigned_to_name: row.employeeName ?? '',
    type: (['call', 'email', 'meeting', 'note'].includes(row.type)
      ? row.type
      : 'note') as FollowUp['type'],
    // An unrecognised status becomes `pending`, not `won`. A wrong guess here
    // marks a deal closed that nobody closed.
    status: STATUS_MAP[row.status] ?? 'pending',
    next_action_date: row.interactionDate,
    // `subject` and `content` are two fields on an interaction and one on a
    // follow-up. Joined rather than dropped: the subject is usually the only
    // line that says what the conversation was about.
    notes: [row.subject, row.content].filter(Boolean).join(' — '),
    created_at: row.createdAt,
    updated_at: row.createdAt,
  }
}

export interface FollowUp {
  id: string
  customer_id: string
  customer_name: string
  customer_email?: string
  customer_phone?: string
  assigned_to_id: string
  assigned_to_name: string
  type: 'call' | 'email' | 'meeting' | 'note'
  status: 'new' | 'contacted' | 'meeting_scheduled' | 'won' | 'lost' | 'pending'
  next_action_date: string
  notes: string
  created_at: string
  updated_at: string
  reminder?: boolean
  employee_id?: string
  workspace_id?: string
}

export interface CreateFollowUpInput {
  customer_id: string
  assigned_to_id: string
  type: FollowUp['type']
  status?: FollowUp['status']
  next_action_date?: string
  notes?: string
  reminder?: boolean
  employee_id?: string
  workspace_id?: string
}

export interface UpdateFollowUpInput {
  customer_id?: string
  assigned_to_id?: string
  type?: FollowUp['type']
  status?: FollowUp['status']
  next_action_date?: string
  notes?: string
  reminder?: boolean
  employee_id?: string
  workspace_id?: string
}

export interface FollowUpFilters {
  status?: FollowUp['status']
  customer_id?: string
  assigned_to_id?: string
  type?: FollowUp['type']
  employee_id?: string
  workspace_id?: string
  page?: number
  limit?: number
  search?: string
}

// ─── Hooks ──────────────────────────────────────────────────

export function useSalesFollowups(filters: FollowUpFilters = {}) {
  const authReady = useAuthReady()

  // ✅ Realtime subscription for sales_followups table
  useRealtime({
    table: 'interactions',
    queryKey: salesFollowupKeys.all as unknown as string[],
  })

  return useQuery({
    queryKey: salesFollowupKeys.list(filters as unknown as Record<string, unknown>),
    queryFn: async () => {
      const { data } = await apiClient.get<InteractionRow[]>('/interactions', {
        params: filters?.customer_id ? { customerId: filters.customer_id } : {},
      })

      const all = (data ?? []).map(toFollowUp)

      // Filtered here rather than on the server: `/api/interactions` takes
      // only `customerId`, and inventing query parameters it does not
      // implement would 400 in production while looking correct in review.
      const rows = filters?.status ? all.filter((row) => row.status === filters.status) : all

      return { data: rows, total: rows.length }
    },
    enabled: authReady,
    staleTime: 30_000,
  })
}

export function useFollowup(id: string | undefined) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: salesFollowupKeys.detail(id!),
    queryFn: async () => {
      // There is no per-interaction GET. The list is small, workspace-scoped
      // and already cached, so the row is taken from it rather than adding an
      // endpoint the server does not have.
      const { data } = await apiClient.get<InteractionRow[]>('/interactions')
      const found = (data ?? []).map(toFollowUp).find((row) => row.id === id)

      if (!found) throw new Error('FOLLOWUP_NOT_FOUND')
      return found
    },
    enabled: authReady && !!id,
    staleTime: 30_000,
  })
}

export function useCreateFollowup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: CreateFollowUpInput) => {
      const { data } = await apiClient.post<InteractionRow>('/interactions', {
        customerId: values.customer_id,
        type: values.type,
        subject: values.notes ?? '',
        content: values.notes ?? '',
        interactionDate: values.next_action_date ?? new Date().toISOString(),
        ...(values.assigned_to_id ? { employeeId: values.assigned_to_id } : {}),
      })

      return toFollowUp(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salesFollowupKeys.all })
    },
  })
}

export function useUpdateFollowup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...values }: { id: string } & UpdateFollowUpInput) => {
      // The server exposes exactly one mutation on an existing interaction:
      // its status. Anything else in `values` has nowhere to go, and pretending
      // otherwise would report success for an edit that was never saved.
      if (!values.status) throw new Error('FOLLOWUP_ONLY_STATUS_IS_EDITABLE')

      const { data } = await apiClient.patch<InteractionRow>(`/interactions/${id}/status`, {
        status: values.status,
      })

      return toFollowUp(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salesFollowupKeys.all })
    },
  })
}

export function useDeleteFollowup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      // No delete endpoint exists, and that is deliberate on the server side:
      // a customer conversation that happened is a record, not a draft. It is
      // closed by moving it to a terminal status.
      await apiClient.patch(`/interactions/${id}/status`, { status: 'cancelled' })
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salesFollowupKeys.all })
    },
  })
}

export function useEmployees() {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: ['employees'] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<{ employees: { id: string; name: string }[] }>(
        '/employees',
      )
      return data
    },
    enabled: authReady,
    staleTime: 30_000,
  })
}

export function useCustomers() {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: ['customers'] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<{
        customers: { id: string; name: string; email?: string; phone?: string }[]
      }>('/customers')
      return data
    },
    enabled: authReady,
    staleTime: 30_000,
  })
}

export function useWorkspaces() {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: ['workspaces'] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<{ workspaces: { id: string; name: string }[] }>(
        '/workspaces',
      )
      return data
    },
    enabled: authReady,
    staleTime: 30_000,
  })
}
