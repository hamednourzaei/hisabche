// ============================================
// Daily attendance sheet (#100).
//
//   GET /attendance-sheet?date=YYYY-MM-DD
//   PUT /attendance-sheet   { employeeId, date, status, checkIn, checkOut, note }
//
// `record: null` = nothing recorded for that employee on that day — which is
// not «absent». `result.workedHours: null` = an open day; it has no hours yet.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'

export type AttendanceMarkStatus = 'present' | 'absent' | 'leave' | 'holiday'

export interface AttendanceRecord {
  id: string
  status: AttendanceMarkStatus | 'open'
  checkIn: string | null
  checkOut: string | null
  note: string | null
  result: {
    workedHours: number | null
    isOpen: boolean
    issue: null | 'NO_CHECK_IN' | 'NO_CHECK_OUT' | 'CHECK_OUT_BEFORE_CHECK_IN' | 'DUPLICATE'
  }
}

export interface AttendanceSheetRow {
  employeeId: string
  name: string
  position: string | null
  record: AttendanceRecord | null
}

export interface AttendanceSheet {
  date: string
  rows: AttendanceSheetRow[]
  summary: {
    employees: number
    recorded: number
    present: number
    absent: number
    leave: number
    open: number
  }
}

export interface AttendanceMarkInput {
  employeeId: string
  date: string
  status: AttendanceMarkStatus
  checkIn: string | null
  checkOut: string | null
  note: string | null
}

export const attendanceKeys = {
  all: ['attendance-sheet'] as const,
  day: (date: string) => [...attendanceKeys.all, date] as const,
}

export function useAttendanceSheet(date: string, enabled = true) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: attendanceKeys.day(date),
    queryFn: async (): Promise<AttendanceSheet> => {
      const { data } = await apiClient.get<AttendanceSheet>('/attendance-sheet', {
        params: { date },
      })
      return { ...data, rows: asList<AttendanceSheetRow>(data?.rows) }
    },
    enabled: ready && enabled && !!date,
    staleTime: 15_000,
  })
}

// ─── Shifts (#101): named working hours the sheet records a day by ──────────

export interface WorkShift {
  id: string
  name: string
  /** `HH:MM`, the shop's own local time. */
  startsAt: string
  endsAt: string
  breakMinutes: number
  isActive: boolean
  payableHours: number
}

export const shiftKeys = { all: ['work-shifts'] as const }

export function useWorkShifts(enabled = true) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: shiftKeys.all,
    queryFn: async (): Promise<WorkShift[]> => {
      const { data } = await apiClient.get<{ shifts: WorkShift[] }>('/shifts')
      return asList<WorkShift>(data?.shifts)
    },
    enabled: ready && enabled,
    staleTime: 60_000,
  })
}

export function useCreateWorkShift() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      name: string
      startsAt: string
      endsAt: string
      breakMinutes: number
    }) => (await apiClient.post<WorkShift>('/shifts', input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: shiftKeys.all }),
  })
}

export function useSetWorkShiftActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; isActive: boolean }) =>
      (await apiClient.patch<WorkShift>(`/shifts/${input.id}/active`, { isActive: input.isActive }))
        .data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: shiftKeys.all }),
  })
}

export function useMarkAttendance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: AttendanceMarkInput) =>
      (await apiClient.put<AttendanceRecord>('/attendance-sheet', input)).data,
    onSuccess: (_record, input) =>
      queryClient.invalidateQueries({ queryKey: attendanceKeys.day(input.date) }),
  })
}
