// ============================================
// Attendance terminals — fingerprint, face, card — whatever their brand
// (backend/src/routes/attendance-device.routes.ts).
//
//   GET    /attendance-devices                    → { configured, devices, formats }
//   POST   /attendance-devices                    → { device, key }   (key shown ONCE)
//   POST   /attendance-devices/:id/key            → { key, keyPrefix }
//   DELETE /attendance-devices/:id
//   GET    /attendance-devices/:id/unmatched      → { users }
//   GET    /attendance-devices/:id/identities     → { identities }
//   PUT    /attendance-devices/:id/identities     → { matched, applied, held, duplicate }
//   GET    /attendance-devices/held               → { days }
//   POST   /attendance-devices/held/accept        → { accepted }
//
// `health`, `state` and the zone a device's clock is read in all come from the
// server — the client compares no timestamps to decide whether a device is alive.
// `configured: false` = the migration has not been run.
// A key is never kept on this device: the queries that could carry one are
// mutations, and their results are not cached.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { getActiveWorkspaceId } from '../lib/active-workspace'
import { attendanceKeys } from './attendance'
import { useAuthReady } from './useAuthReady'

export type AttendanceDeviceMethod =
  'FINGERPRINT' | 'FACE' | 'CARD' | 'PIN' | 'QR' | 'PALM' | 'IRIS' | 'PASSWORD' | 'UNKNOWN'

export interface AttendanceDevice {
  id: string
  name: string
  vendor: string | null
  model: string | null
  branchId: string | null
  capabilities: AttendanceDeviceMethod[]
  /** The device's own zone; null = it inherits. */
  timeZone: string | null
  /** The zone its clock is read in. Null = none set anywhere: its events are refused. */
  effectiveTimeZone: string | null
  timeZoneSource: 'device' | 'branch' | 'workspace' | null
  keyPrefix: string
  state: 'active' | 'revoked'
  health: 'never' | 'online' | 'silent'
  lastSeenAt: string | null
  lastEventAt: string | null
  createdAt: string
  /** Readings of people nobody has mapped to an employee yet. */
  unmatched: number
  /** Readings kept back because a person had already recorded that day. */
  held: number
}

export interface AttendanceDeviceList {
  configured: boolean
  devices: AttendanceDevice[]
  /** What a sender may put in `format`. Only what has been proven. */
  formats: string[]
}

export interface AttendanceDeviceInput {
  name: string
  vendor: string | null
  model: string | null
  branchId: string | null
  timeZone: string | null
  capabilities: AttendanceDeviceMethod[]
}

export interface UnmatchedDeviceUser {
  externalUserId: string
  events: number
  firstDay: string
  lastDay: string
}

export interface DeviceIdentity {
  externalUserId: string
  employeeId: string
  everyDevice: boolean
}

export interface DeviceSettlement {
  matched: number
  applied: number
  held: number
  duplicate: number
}

/** A working day a terminal saw and a person had already recorded. */
export interface HeldDeviceDay {
  employeeId: string
  day: string
  readings: Array<{
    /** `HH:MM` on the terminal's own clock. */
    at: string
    /** On the calendar day after `day` (the end of a night shift). */
    nextDay: boolean
    direction: 'in' | 'out' | 'unknown'
    deviceId: string
  }>
  /** What the day's record says now. */
  record: null | {
    status: string
    checkIn: string | null
    checkOut: string | null
    endsNextDay: boolean
    source: string | null
  }
}

export const attendanceDeviceKeys = {
  all: ['attendance-devices'] as const,
  held: () => [...attendanceDeviceKeys.all, getActiveWorkspaceId() ?? '', 'held'] as const,
  list: () => [...attendanceDeviceKeys.all, getActiveWorkspaceId() ?? '', 'list'] as const,
  unmatched: (deviceId: string) =>
    [...attendanceDeviceKeys.all, getActiveWorkspaceId() ?? '', 'unmatched', deviceId] as const,
  identities: (deviceId: string) =>
    [...attendanceDeviceKeys.all, getActiveWorkspaceId() ?? '', 'identities', deviceId] as const,
}

/** Fetched only while the panel is open. */
export function useAttendanceDevices(enabled = true) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: attendanceDeviceKeys.list(),
    queryFn: async (): Promise<AttendanceDeviceList> => {
      const { data } = await apiClient.get<AttendanceDeviceList>('/attendance-devices')
      return {
        configured: data?.configured === true,
        devices: asList<AttendanceDevice>(data?.devices),
        formats: asList<string>(data?.formats),
      }
    },
    enabled: ready && enabled,
    // «Online» is a statement about the last few minutes.
    staleTime: 30_000,
  })
}

export function useRegisterAttendanceDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: AttendanceDeviceInput) =>
      (
        await apiClient.post<{ device: AttendanceDevice; key: string }>(
          '/attendance-devices',
          input,
        )
      ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: attendanceDeviceKeys.list() }),
  })
}

export function useRotateAttendanceDeviceKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (deviceId: string) =>
      (
        await apiClient.post<{ key: string; keyPrefix: string }>(
          `/attendance-devices/${deviceId}/key`,
        )
      ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: attendanceDeviceKeys.list() }),
  })
}

export function useRevokeAttendanceDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (deviceId: string) => {
      await apiClient.delete(`/attendance-devices/${deviceId}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: attendanceDeviceKeys.list() }),
  })
}

export function useUnmatchedDeviceUsers(deviceId: string | null) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: attendanceDeviceKeys.unmatched(deviceId ?? ''),
    queryFn: async (): Promise<UnmatchedDeviceUser[]> => {
      const { data } = await apiClient.get<{ users: UnmatchedDeviceUser[] }>(
        `/attendance-devices/${deviceId}/unmatched`,
      )
      return asList<UnmatchedDeviceUser>(data?.users)
    },
    enabled: ready && !!deviceId,
  })
}

export function useDeviceIdentities(deviceId: string | null) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: attendanceDeviceKeys.identities(deviceId ?? ''),
    queryFn: async (): Promise<DeviceIdentity[]> => {
      const { data } = await apiClient.get<{ identities: DeviceIdentity[] }>(
        `/attendance-devices/${deviceId}/identities`,
      )
      return asList<DeviceIdentity>(data?.identities)
    },
    enabled: ready && !!deviceId,
  })
}

/** Readings kept back, beside the record that kept them back. Only while its dialog is open. */
export function useHeldDeviceDays(enabled: boolean) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: attendanceDeviceKeys.held(),
    queryFn: async (): Promise<HeldDeviceDay[]> => {
      const { data } = await apiClient.get<{ days: HeldDeviceDay[] }>('/attendance-devices/held')
      return asList<HeldDeviceDay>(data?.days).map((day) => ({
        ...day,
        readings: asList<HeldDeviceDay['readings'][number]>(day.readings),
      }))
    },
    enabled: ready && enabled,
    // A decision is made on this: never from a cache.
    staleTime: 0,
    gcTime: 0,
    meta: { persist: false },
  })
}

/** The day becomes what the terminal saw. A person's record is replaced. */
export function useAcceptHeldDeviceDay() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { employeeId: string; day: string }) =>
      (await apiClient.post<{ accepted: number }>('/attendance-devices/held/accept', input)).data,
    // Accepted or refused («somebody already did»): the list, the counts and
    // that day of the sheet are all stale.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: attendanceDeviceKeys.all })
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all })
    },
  })
}

/** Map (or, with `employeeId: null`, unmap) one number on a device. */
export function useMapDeviceIdentity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      deviceId: string
      externalUserId: string
      employeeId: string | null
      everyDevice: boolean
    }) =>
      (
        await apiClient.put<DeviceSettlement>(`/attendance-devices/${input.deviceId}/identities`, {
          externalUserId: input.externalUserId,
          employeeId: input.employeeId,
          everyDevice: input.everyDevice,
        })
      ).data,
    // Mapping settles what that number had already sent — onto whatever days
    // those were. Every day of the sheet may have changed.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceDeviceKeys.all })
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all })
    },
  })
}
