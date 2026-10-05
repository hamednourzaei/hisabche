// ============================================
// packages/api/src/hooks/payroll.ts
// پرداخت‌های حقوق (Salary Payments) — روی جدول payrolls موجود ساخته شده
// ============================================
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/client'
import { useAuthReady } from './useAuthReady'

// ─── Keys ───────────────────────────────────────────────────
export const payrollKeys = {
  all: ['payrolls'] as const,
  list: (employeeId?: string) => [...payrollKeys.all, 'list', employeeId ?? 'all'] as const,
  summary: () => [...payrollKeys.all, 'summary'] as const,
}

// ─── Hooks ──────────────────────────────────────────────────
export function usePayrolls(employeeId?: string) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: payrollKeys.list(employeeId),
    queryFn: async () => {
      const { data } = await apiClient.get('/payrolls', {
        params: employeeId ? { employeeId } : {},
      })
      return data
    },
    // ⚠️ `employeeId` FILTERS; it is not required.
    //
    // This read `authReady && !!employeeId`, so the workspace-wide call —
    // `usePayrolls()` with no argument, which is what the «حقوق» tab makes —
    // was NEVER enabled. The tab showed «هیچ سابقه حقوقی وجود ندارد» and the
    // «جمع حقوق پرداختی» card showed 0 no matter how many salaries had been
    // paid. An always-disabled query looks exactly like an empty table.
    enabled: authReady,
    staleTime: 30_000,
  })
}

export function usePayrollSummary() {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: payrollKeys.summary(),
    queryFn: async () => {
      const { data } = await apiClient.get('/payrolls/summary')
      return data as { total: number; byEmployee: Record<string, number> }
    },
    enabled: authReady,
    staleTime: 30_000,
  })
}

export function useCreatePayroll() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const { data } = await apiClient.post('/payrolls', values)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.all }),
  })
}

/**
 * Settle one salary: «پرداخت شد» (with the day it was paid) or «پرداخت نشد»
 * (with the reason, which the server requires).
 *
 * ⚠️ The route existed with no caller: a salary recorded as a draft had no
 * way, on any screen, to become paid.
 */
export function useSettlePayroll() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: {
      id: string
      status: 'paid' | 'cancelled'
      paymentDate?: string | undefined
      notes?: string | undefined
    }) => {
      const { data } = await apiClient.patch(`/payrolls/${values.id}`, values)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.all }),
  })
}
