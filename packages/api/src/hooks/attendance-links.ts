// ============================================
// An employee's personal attendance link, and what they send through it
// (backend/src/routes/attendance-link.routes.ts).
//
//   GET    /attendance-links?employeeId=          → { link | null, workplace }
//   POST   /attendance-links                      → link (revokes the live one)
//   DELETE /attendance-links/:id
//   DELETE /attendance-links/phone/:employeeId     forget the registered phone
//   GET    /attendance-submissions?date=          → { configured, pending, fromLink, fromDevice }
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
  /** Each submission must be confirmed by the registered phone's own lock. */
  requireUnlock: boolean
}

/** The link, and whose clock it reads: the employee's branch, else the business. */
export interface AttendanceLinkStatus {
  link: AttendanceLink | null
  /** The employee's registered phone — when, never its key. Null = none. */
  phone: { registeredAt: string; lastUsedAt: string | null } | null
  /** A null zone = none has been set; no link can be made until one is. */
  workplace: { timeZone: string | null; source: 'branch' | 'workspace' | null }
}

export interface AttendanceSubmission {
  id: string
  employeeId: string
  date: string
  status: 'present' | 'absent' | 'leave'
  checkIn: string | null
  checkOut: string | null
  /** The exit is on the day after `date`. */
  endsNextDay: boolean
  /** The registered phone's lock confirmed it. */
  unlocked: boolean
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
  /** Employees whose record for this day was written by a terminal. */
  fromDevice: string[]
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
    queryFn: async (): Promise<AttendanceLinkStatus> => {
      const { data } = await apiClient.get<AttendanceLinkStatus>('/attendance-links', {
        params: { employeeId },
      })
      return {
        link: data?.link ?? null,
        phone: data?.phone ?? null,
        workplace: {
          timeZone: data?.workplace?.timeZone ?? null,
          source: data?.workplace?.source ?? null,
        },
      }
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
      requireUnlock: boolean
    }) => (await apiClient.post<AttendanceLink>('/attendance-links', input)).data,
    onSuccess: (link) =>
      queryClient.invalidateQueries({ queryKey: attendanceLinkKeys.employee(link.employeeId) }),
  })
}

export function useRevokeAttendanceLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; employeeId: string }) => {
      await apiClient.delete(`/attendance-links/${input.id}`)
    },
    onSuccess: (_void, input) =>
      queryClient.invalidateQueries({ queryKey: attendanceLinkKeys.employee(input.employeeId) }),
  })
}

/** Forget the employee's registered phone, so another can be registered through the link. */
export function useForgetAttendancePhone() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (employeeId: string) => {
      await apiClient.delete(`/attendance-links/phone/${employeeId}`)
    },
    onSettled: (_void, _error, employeeId) =>
      queryClient.invalidateQueries({ queryKey: attendanceLinkKeys.employee(employeeId) }),
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
        fromDevice: asList<string>(data?.fromDevice),
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
