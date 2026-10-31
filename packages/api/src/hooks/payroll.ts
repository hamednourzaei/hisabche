// ============================================
// packages/api/src/hooks/payroll.ts
// پرداخت‌های حقوق (Salary Payments) — روی جدول payrolls موجود ساخته شده
// ============================================
'use client'

import { useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/client'
import { isDefinitiveRefusal } from '../lib/intent-key'
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

/** A fresh UUID for one intent, or undefined where the runtime cannot make one. */
function newRequestId(): string | undefined {
  return (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.()
}

export function useCreatePayroll() {
  const qc = useQueryClient()
  // ⚠️ ONE KEY PER SALARY, KEPT ACROSS RETRIES. A lost response or a second click
  // used to record the salary twice — two rows and two journal entries. The
  // server returns the first row for the same key; the key is dropped only once
  // the server has given a final answer.
  const requestId = useRef<string | null>(null)
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      requestId.current ??= newRequestId() ?? null
      const clientRequestId = requestId.current
      const { data } = await apiClient.post(
        '/payrolls',
        clientRequestId ? { ...values, clientRequestId } : values,
      )
      return data
    },
    onError: (error) => {
      if (isDefinitiveRefusal(error)) requestId.current = null
    },
    onSuccess: () => {
      requestId.current = null
      return qc.invalidateQueries({ queryKey: payrollKeys.all })
    },
  })
}

export interface PayrollBooking {
  bookingStatus: { booked: boolean; reason?: string }
}

/**
 * Book a PAID salary into the ledger again. Idempotent on the server — a salary
 * that is already booked answers booked, one whose accounts were missing is
 * booked now — so it is safe to press twice. Without it a salary recorded as
 * paid while the chart of accounts could not express it stayed out of the books
 * for good (a paid salary is final and cannot be settled again).
 */
export function useBookPayroll() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/payrolls/${id}/book`, {})
      return data as PayrollBooking
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: payrollKeys.all })
      void qc.invalidateQueries({ queryKey: ['ledger'] })
    },
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
