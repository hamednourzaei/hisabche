// ============================================
// packages/api/src/hooks/leaves.ts
//
// مرخصی — «چند روز، به چه دلیل، از چه تاریخی تا چه تاریخی» (request #99).
//
// The backend already had `GET/POST/PATCH /api/leaves` and a `leaves` table
// with branch resolution and an audit entry; nothing in the web app called
// them. These hooks are the missing wire, not a second model (G2).
// ============================================
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'

export type LeaveType =
  'annual' | 'sick' | 'maternity' | 'paternity' | 'unpaid' | 'bereavement' | 'other'

export interface Leave {
  id: string
  employee_id: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  total_days?: number
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  reason?: string | null
}

export interface CreateLeaveInput {
  employeeId: string
  leaveType: LeaveType
  startDate: string
  endDate: string
  totalDays: number
  reason?: string
}

export const leaveKeys = {
  all: ['leaves'] as const,
  list: (employeeId?: string) => [...leaveKeys.all, 'list', employeeId ?? 'all'] as const,
}

export function useLeaves(employeeId?: string) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: leaveKeys.list(employeeId),
    queryFn: async (): Promise<Leave[]> => {
      const { data } = await apiClient.get('/leaves', {
        params: employeeId ? { employeeId } : undefined,
      })
      // The route sends the rows themselves; a future envelope must not turn
      // into `rows.map is not a function` on the page (راهنمای سشن، §۷٫۲).
      return Array.isArray(data) ? data : ((data?.leaves ?? []) as Leave[])
    },
    enabled: authReady,
    staleTime: 30_000,
  })
}

export function useCreateLeave() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateLeaveInput): Promise<Leave> => {
      const { data } = await apiClient.post('/leaves', input)
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leaveKeys.all })
      // A leave moves the employee's status and their timeline.
      void qc.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

/**
 * Approve or reject a leave request.
 *
 * ⚠️ Every leave is created `pending` and `PATCH /api/leaves/:id` had no
 * caller, so every leave stayed «در انتظار» for ever.
 */
export function useDecideLeave() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: { id: string; status: 'approved' | 'rejected' }): Promise<Leave> => {
      const { data } = await apiClient.patch(`/leaves/${input.id}`, input)
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leaveKeys.all })
      void qc.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

// ─── V58: the one balance, the policies, the accrual run ────────────────────
//
// The entitlement is POLICY (`leave_policies`), the consumption is the APPROVED
// leave, and the accrual rows are the engine's — three things one screen used
// to say nothing about. The balance comes from `leave_balance` (backend/src/
// routes/human-resources.routes.ts), so this file only carries its shape.

export interface LeaveBalance {
  accrued: number
  consumed: number
  /** Shown, never silently subtracted — the server keeps them apart. */
  pending: number
  remaining: number
  availableAfterPending: number
  /** `null` = no active policy for this type (the engine has not granted any). */
  annualDays: number | null
}

export function useLeaveBalance(employeeId: string | null | undefined, leaveType: string) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: [...leaveKeys.all, 'balance', employeeId ?? '', leaveType] as const,
    queryFn: async (): Promise<LeaveBalance> => {
      const { data } = await apiClient.get<Partial<LeaveBalance>>('/leaves/balance', {
        params: { employeeId, leaveType },
      })
      return {
        accrued: Number(data?.accrued) || 0,
        consumed: Number(data?.consumed) || 0,
        pending: Number(data?.pending) || 0,
        remaining: Number(data?.remaining) || 0,
        availableAfterPending: Number(data?.availableAfterPending) || 0,
        annualDays: (data?.annualDays as number | null) ?? null,
      }
    },
    enabled: authReady && !!employeeId && !!leaveType,
    staleTime: 30_000,
  })
}

export interface LeavePolicy {
  id: string
  leaveType: LeaveType
  annualDays: number
  accrualMethod: 'monthly' | 'yearly' | 'upfront'
  accrualDay: number | null
  isPaid: boolean
  carryForwardMax: number | null
  isActive: boolean
}

export function useLeavePolicies() {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: [...leaveKeys.all, 'policies'] as const,
    queryFn: async (): Promise<LeavePolicy[]> => {
      const { data } = await apiClient.get('/leave-policies')
      return asList<LeavePolicy>(data)
    },
    enabled: authReady,
    staleTime: 60_000,
  })
}

export function useCreateLeavePolicy() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      leaveType: LeavePolicy['leaveType']
      annualDays: number
      accrualMethod: LeavePolicy['accrualMethod']
      accrualDay?: number | null | undefined
      isPaid?: boolean | undefined
      carryForwardMax?: number | null | undefined
      isActive?: boolean | undefined
    }): Promise<{ id: string }> => {
      const { data } = await apiClient.post('/leave-policies', input)
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...leaveKeys.all, 'policies'] })
    },
  })
}

export function useUpdateLeavePolicy() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: { id: string } & Partial<LeavePolicy>): Promise<{ id: string }> => {
      const { id, ...body } = input
      const { data } = await apiClient.patch(`/leave-policies/${id}`, body)
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...leaveKeys.all, 'policies'] })
    },
  })
}

/**
 * Run the accrual for ONE month. Idempotent on the server — a retried click
 * writes no second entitlement; the result says how many rows WROTE, not who
 * was looked at.
 */
export function useRunLeaveAccrual() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: { period: string }): Promise<{ period: string; accruedCount: number }> => {
      const { data } = await apiClient.post('/leaves/accrue', input)
      return data as { period: string; accruedCount: number }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leaveKeys.all })
    },
  })
}
