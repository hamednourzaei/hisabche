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
