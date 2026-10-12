// ============================================
// An employee's personal attendance link, and what they send through it
// (backend/src/routes/attendance-link.routes.ts).
//
//   GET    /attendance-links?employeeId=          → { link | null }
//   POST   /attendance-links                      → link (revokes the live one)
//   DELETE /attendance-links/:id
//   GET    /attendance-submissions?date=          → { configured, pending, fromLink }
//   POST   /attendance-submissions/:id/decision   → { id, state, employeeId, date }
//
// `link.state` comes from the server (active / expired / revoked) — the client
// never compares dates to decide whether a link works.
// `configured: false` = the migration has not been run; the sheet works without it.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { getActiveWorkspaceId } from '../lib/active-workspace'
import { attendanceKeys } from './attendance'
import { useAuthReady } from './useAuthReady'

export interface AttendanceLink {
  id: string
  employeeId: string
  token: string
  state: 'active' | 'expired' | 'revoked'
  createdAt: string
  expiresAt: string | null
  lastUsedAt: string | null
  /** How many days before today the employee may pick. 0 = today only. */
  daysBack: number
  /** A day nobody has recorded is written at once; otherwise a manager decides. */
  autoApply: boolean
  timeZone: string
}

export interface AttendanceSubmission {
  id: string
  employeeId: string
  date: string
  status: 'present' | 'absent' | 'leave'
  checkIn: string | null
  checkOut: string | null
  note: string | null
  /** The server's clock when it arrived. */
  receivedAt: string
  state: 'pending' | 'applied' | 'approved' | 'rejected'
  decisionNote: string | null
}

export interface AttendanceDaySubmissions {
  configured: boolean
  pending: AttendanceSubmission[]
  /** Employees whose record for this day came from their link. */
  fromLink: string[]
}

export const attendanceLinkKeys = {
  all: ['attendance-links'] as const,
  employee: (employeeId: string) =>
    [...attendanceLinkKeys.all, getActiveWorkspaceId() ?? '', employeeId] as const,
  day: (date: string) =>
    [...attendanceLinkKeys.all, getActiveWorkspaceId() ?? '', 'day', date] as const,
}

/** The employee's link. Fetched only while its dialog is open. */
export function useAttendanceLink(employeeId: string | null) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: attendanceLinkKeys.employee(employeeId ?? ''),
    queryFn: async (): Promise<AttendanceLink | null> => {
      const { data } = await apiClient.get<{ link: AttendanceLink | null }>('/attendance-links', {
        params: { employeeId },
      })
      return data?.link ?? null
    },
    enabled: ready && !!employeeId,
    retry: false,
    // A token: not something to keep on the device after the dialog closes.
    gcTime: 0,
    meta: { persist: false },
  })
}

export function useCreateAttendanceLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      employeeId: string
      expiresOn: string | null
      daysBack: number
      autoApply: boolean
      timeZone: string
    }) => (await apiClient.post<AttendanceLink>('/attendance-links', input)).data,
    onSuccess: (link) =>
      queryClient.setQueryData(attendanceLinkKeys.employee(link.employeeId), link),
  })
}

export function useRevokeAttendanceLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; employeeId: string }) => {
      await apiClient.delete(`/attendance-links/${input.id}`)
    },
    onSuccess: (_void, input) =>
      queryClient.setQueryData(attendanceLinkKeys.employee(input.employeeId), null),
  })
}

/** What employees sent for `date` and nobody has decided yet. Read beside the sheet. */
export function useAttendanceSubmissions(date: string, enabled = true) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: attendanceLinkKeys.day(date),
    queryFn: async (): Promise<AttendanceDaySubmissions> => {
      const { data } = await apiClient.get<AttendanceDaySubmissions>('/attendance-submissions', {
        params: { date },
      })
      return {
        configured: data?.configured === true,
        pending: asList<AttendanceSubmission>(data?.pending),
        fromLink: asList<string>(data?.fromLink),
      }
    },
    enabled: ready && enabled && !!date,
    staleTime: 15_000,
  })
}

export function useDecideAttendanceSubmission() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      date: string
      decision: 'approve' | 'reject'
      note: string | null
    }) =>
      (
        await apiClient.post<{ id: string; state: 'approved' | 'rejected' }>(
          `/attendance-submissions/${input.id}/decision`,
          { decision: input.decision, note: input.note },
        )
      ).data,
    // Decided or refused («somebody else already did»), what is on screen is
    // stale either way: the day's submissions and the sheet itself.
    onSettled: (_data, _error, input) => {
      queryClient.invalidateQueries({ queryKey: attendanceLinkKeys.day(input.date) })
      queryClient.invalidateQueries({ queryKey: attendanceKeys.day(input.date) })
    },
  })
}
