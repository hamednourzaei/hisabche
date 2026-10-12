// ============================================
// backend/src/services/attendance-devices/attendance-device.service.ts
//
// Fingerprint / face / card terminals, whatever their brand
// (docs/attendance-devices-01-migration.sql).
//
// The registry, the mapping of «a number on a device» to an employee, and the
// one door events come in by. Every rule about what an event DOES — one
// delivery, one arrival per minute, earliest in and latest out, never over a
// day a person recorded — is in the database functions, so it holds for every
// sender. This file decides who may call them and what they are told.
//
// ⚠️ THE KEY IS SHOWN ONCE. Only its sha-256 is stored; a lost key is replaced
// with a new one, never read back.
// ⚠️ A BAD, REVOKED OR UNKNOWN KEY GETS THE SAME ANSWER. Which one it was is
// none of the sender's business.
// ⚠️ THE DEVICE'S CLOCK IS READ IN THE WORKPLACE'S ZONE: the device's own, else
// its branch's, else the business's (workplace-time-zone.ts). With none set,
// events are refused — a reading with no zone has no day.
// ⚠️ NOTHING HERE ENROLS ANYBODY ON A DEVICE, and no fingerprint or face data
// passes through: only «who, when».
// ============================================

import { randomBytes } from 'node:crypto'

import { supabase } from '../../db'
import { BaseError } from '../../errors/base.error'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { selectAllPages } from '../../utils/fetch-all-pages'
import { isMissingSchema } from '../blog/blog.domain'
import type { TenancyContext } from '../tenancy.service'
import { isKnownTimeZone, timeZoneForDevice } from '../workplace-time-zone'
import { adapterFor } from './device-adapters'
import {
  DEVICE_KEY_SHAPE,
  DEVICE_METHODS,
  DeviceEventError,
  deviceHealth,
  hashDeviceKey,
  wallClockIn,
  type DeviceHealth,
  type DeviceMethod,
} from './device-event.domain'

/** attendance-devices-01 has not been run. */
export class AttendanceDevicesNotConfiguredError extends BaseError {
  constructor() {
    super('ATTENDANCE_DEVICES_NOT_CONFIGURED', 503)
    this.name = 'AttendanceDevicesNotConfiguredError'
  }
}

interface DeviceRow {
  id: string
  workspace_id: string
  branch_id: string | null
  name: string
  vendor: string | null
  model: string | null
  capabilities: string[] | null
  time_zone: string | null
  key_prefix: string
  sync_cursor: string | null
  last_seen_at: string | null
  last_event_at: string | null
  created_by: string
  created_at: string
  revoked_at: string | null
}
// ⚠️ key_hash is deliberately not in this list: nothing reads it back.
const DEVICE_COLUMNS =
  'id, workspace_id, branch_id, name, vendor, model, capabilities, time_zone, key_prefix, sync_cursor, last_seen_at, last_event_at, created_by, created_at, revoked_at'

export interface AttendanceDevice {
  id: string
  name: string
  vendor: string | null
  model: string | null
  branchId: string | null
  capabilities: DeviceMethod[]
  /** The device's own zone; null = it inherits. */
  timeZone: string | null
  /** The zone its clock is actually read in, and where that came from. */
  effectiveTimeZone: string | null
  timeZoneSource: 'device' | 'branch' | 'workspace' | null
  keyPrefix: string
  state: 'active' | 'revoked'
  health: DeviceHealth
  lastSeenAt: string | null
  lastEventAt: string | null
  createdAt: string
  /** Readings of people nobody has mapped to an employee yet. */
  unmatched: number
  /** Readings kept back because a person had already recorded that day. */
  held: number
}

export interface DeviceInput {
  name: string
  vendor: string | null
  model: string | null
  branchId: string | null
  timeZone: string | null
  capabilities: string[]
}

/** One employee's working day that a terminal saw and a person had already recorded. */
export interface HeldDay {
  employeeId: string
  day: string
  readings: Array<{
    /** `HH:MM` on the terminal's own clock. */
    at: string
    /** The reading is on the calendar day after `day` (a night shift's end). */
    nextDay: boolean
    direction: 'in' | 'out' | 'unknown'
    deviceId: string
  }>
  /** What the day's record says now. Null = it has since been removed. */
  record: null | {
    status: string
    checkIn: string | null
    checkOut: string | null
    endsNextDay: boolean
    source: string | null
  }
}

type DbError = { code?: string; message?: string } | null

function check(error: DbError, what: string): void {
  if (!error) return
  if (isMissingSchema(error)) throw new AttendanceDevicesNotConfiguredError()
  throw new DatabaseError(what, error)
}

const raised = (error: DbError, code: string) =>
  !!error && !isMissingSchema(error) && (error.message ?? '').includes(code)

const newKey = () => `hsd_${randomBytes(32).toString('hex')}`
/** Enough to tell two keys apart on screen; nothing that helps guess one. */
const prefixOf = (key: string) => key.slice(0, 12)

function cleanInput(input: DeviceInput) {
  const name = input.name.trim()
  if (name.length === 0 || name.length > 80)
    throw new ValidationError('ATTENDANCE_DEVICE_NAME_INVALID')
  if (input.timeZone !== null && !isKnownTimeZone(input.timeZone)) {
    throw new ValidationError('TIME_ZONE_INVALID')
  }
  const capabilities = [...new Set(input.capabilities.map((value) => value.trim().toUpperCase()))]
  if (capabilities.some((value) => !(DEVICE_METHODS as readonly string[]).includes(value))) {
    throw new ValidationError('ATTENDANCE_DEVICE_CAPABILITY_INVALID')
  }
  return {
    name,
    vendor: input.vendor?.trim() || null,
    model: input.model?.trim() || null,
    branch_id: input.branchId,
    time_zone: input.timeZone,
    capabilities,
  }
}

export class AttendanceDeviceService {
  constructor(private readonly clock: () => Date = () => new Date()) {}

  // ─── the registry ─────────────────────────────────────────────────────────

  private async countEvents(workspaceId: string, deviceId: string, state: string): Promise<number> {
    const { count, error } = await supabase
      .from('attendance_terminal_events')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('device_id', deviceId)
      .eq('state', state)
    check(error, 'Failed to count device events')
    return count ?? 0
  }

  private async describe(row: DeviceRow): Promise<AttendanceDevice> {
    const zone = await timeZoneForDevice(row.workspace_id, {
      timeZone: row.time_zone,
      branchId: row.branch_id,
    })
    const [unmatched, held] = await Promise.all([
      this.countEvents(row.workspace_id, row.id, 'unmatched'),
      this.countEvents(row.workspace_id, row.id, 'held'),
    ])
    return {
      id: row.id,
      name: row.name,
      vendor: row.vendor,
      model: row.model,
      branchId: row.branch_id,
      capabilities: (row.capabilities ?? []) as DeviceMethod[],
      timeZone: row.time_zone,
      effectiveTimeZone: zone.timeZone,
      timeZoneSource: zone.source,
      keyPrefix: row.key_prefix,
      state: row.revoked_at ? 'revoked' : 'active',
      health: deviceHealth(row.last_seen_at, this.clock()),
      lastSeenAt: row.last_seen_at,
      lastEventAt: row.last_event_at,
      createdAt: row.created_at,
      unmatched,
      held,
    }
  }

  /** `configured: false` before the migration — the attendance sheet reads this beside itself. */
  async list(ctx: TenancyContext): Promise<{ configured: boolean; devices: AttendanceDevice[] }> {
    const { data, error } = await supabase
      .from('attendance_terminals')
      .select(DEVICE_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .is('revoked_at', null)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
    if (error && isMissingSchema(error)) return { configured: false, devices: [] }
    if (error) throw new DatabaseError('Failed to read the devices', error)
    const devices: AttendanceDevice[] = []
    for (const row of (data ?? []) as DeviceRow[]) devices.push(await this.describe(row))
    return { configured: true, devices }
  }

  private async own(ctx: TenancyContext, deviceId: string): Promise<DeviceRow> {
    const { data, error } = await supabase
      .from('attendance_terminals')
      .select(DEVICE_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', deviceId)
      .is('revoked_at', null)
      .maybeSingle()
    check(error, 'Failed to read the device')
    if (!data) throw new NotFoundError('Device')
    return data as DeviceRow
  }

  private async assertBranch(ctx: TenancyContext, branchId: string | null): Promise<void> {
    if (branchId === null) return
    const { data, error } = await supabase
      .from('branches')
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', branchId)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to read the branch', error)
    // An id is not proof it is this business's branch.
    if (!data) throw new NotFoundError('Branch')
  }

  /** The device, and its key — the one and only time the key is given. */
  async create(
    ctx: TenancyContext,
    input: DeviceInput,
  ): Promise<{ device: AttendanceDevice; key: string }> {
    const values = cleanInput(input)
    await this.assertBranch(ctx, values.branch_id)
    const key = newKey()
    const { data, error } = await supabase
      .from('attendance_terminals')
      .insert({
        ...values,
        workspace_id: ctx.workspaceId,
        key_hash: hashDeviceKey(key),
        key_prefix: prefixOf(key),
        created_by: ctx.userId,
      })
      .select(DEVICE_COLUMNS)
      .single()
    check(error, 'Failed to register the device')
    return { device: await this.describe(data as DeviceRow), key }
  }

  /** A new key; the old one stops working with this write. */
  async rotateKey(
    ctx: TenancyContext,
    deviceId: string,
  ): Promise<{ key: string; keyPrefix: string }> {
    await this.own(ctx, deviceId)
    const key = newKey()
    const { data, error } = await supabase
      .from('attendance_terminals')
      .update({ key_hash: hashDeviceKey(key), key_prefix: prefixOf(key) })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', deviceId)
      .is('revoked_at', null)
      .select('id')
    check(error, 'Failed to replace the device key')
    if ((data ?? []).length === 0) throw new NotFoundError('Device')
    return { key, keyPrefix: prefixOf(key) }
  }

  /** The device stops being listened to. Its events and what they wrote stay. */
  async revoke(ctx: TenancyContext, deviceId: string): Promise<void> {
    const { data, error } = await supabase
      .from('attendance_terminals')
      .update({ revoked_at: this.clock().toISOString() })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', deviceId)
      .is('revoked_at', null)
      .select('id')
    check(error, 'Failed to revoke the device')
    if ((data ?? []).length === 0) throw new NotFoundError('Device')
  }

  // ─── who is who ───────────────────────────────────────────────────────────

  /** The numbers this device has reported that nobody has given a person. */
  async unmatched(
    ctx: TenancyContext,
    deviceId: string,
  ): Promise<Array<{ externalUserId: string; events: number; firstDay: string; lastDay: string }>> {
    await this.own(ctx, deviceId)
    const rows = await selectAllPages<
      { external_user_id: string; occurred_on: string },
      { message: string; code?: string }
    >((from, to) =>
      supabase
        .from('attendance_terminal_events')
        .select('external_user_id, occurred_on')
        .eq('workspace_id', ctx.workspaceId)
        .eq('device_id', deviceId)
        .eq('state', 'unmatched')
        .order('id', { ascending: true })
        .range(from, to),
    )
    check(rows.error, 'Failed to read unmatched events')
    const byUser = new Map<string, { events: number; firstDay: string; lastDay: string }>()
    for (const row of rows.data ?? []) {
      const day = String(row.occurred_on).slice(0, 10)
      const seen = byUser.get(row.external_user_id)
      if (!seen) byUser.set(row.external_user_id, { events: 1, firstDay: day, lastDay: day })
      else {
        seen.events += 1
        if (day < seen.firstDay) seen.firstDay = day
        if (day > seen.lastDay) seen.lastDay = day
      }
    }
    return [...byUser.entries()]
      .map(([externalUserId, seen]) => ({ externalUserId, ...seen }))
      .sort((a, b) => b.events - a.events || a.externalUserId.localeCompare(b.externalUserId))
  }

  // ─── kept back ────────────────────────────────────────────────────────────

  /**
   * Readings a terminal sent for a day a person had already recorded, beside
   * what that record says now. One entry per employee and working day.
   */
  async held(ctx: TenancyContext): Promise<HeldDay[]> {
    const rows = await selectAllPages<
      {
        employee_id: string | null
        device_id: string
        work_day: string
        occurred_on: string
        occurred_time: string
        direction: string
      },
      { message: string; code?: string }
    >((from, to) =>
      supabase
        .from('attendance_terminal_events')
        .select('employee_id, device_id, work_day, occurred_on, occurred_time, direction')
        .eq('workspace_id', ctx.workspaceId)
        .eq('state', 'held')
        .order('work_day', { ascending: false })
        .order('occurred_on', { ascending: true })
        .order('occurred_time', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    )
    check(rows.error, 'Failed to read held events')

    const days = new Map<string, HeldDay>()
    for (const row of rows.data ?? []) {
      if (!row.employee_id) continue
      const day = String(row.work_day).slice(0, 10)
      const key = `${row.employee_id}:${day}`
      let entry = days.get(key)
      if (!entry) {
        entry = { employeeId: row.employee_id, day, readings: [], record: null }
        days.set(key, entry)
      }
      entry.readings.push({
        at: String(row.occurred_time).slice(0, 5),
        nextDay: String(row.occurred_on).slice(0, 10) > day,
        direction: row.direction as HeldDay['readings'][number]['direction'],
        deviceId: row.device_id,
      })
    }
    if (days.size === 0) return []

    const wanted = [...new Set([...days.values()].map((entry) => entry.day))]
    const records = await selectAllPages<
      {
        employee_id: string
        date: string
        status: string | null
        check_in: string | null
        check_out: string | null
        ends_next_day: boolean | null
        source: string | null
      },
      { message: string; code?: string }
    >((from, to) =>
      supabase
        .from('attendance')
        .select('employee_id, date, status, check_in, check_out, ends_next_day, source')
        .eq('workspace_id', ctx.workspaceId)
        .in('date', wanted)
        .order('id', { ascending: true })
        .range(from, to),
    )
    check(records.error, 'Failed to read the recorded days')
    for (const row of records.data ?? []) {
      const entry = days.get(`${row.employee_id}:${String(row.date).slice(0, 10)}`)
      // The first by id, as the sheet shows it.
      if (!entry || entry.record) continue
      entry.record = {
        status: row.status ?? 'present',
        checkIn: row.check_in ? String(row.check_in).slice(0, 5) : null,
        checkOut: row.check_out ? String(row.check_out).slice(0, 5) : null,
        endsNextDay: row.ends_next_day === true,
        source: row.source,
      }
    }
    return [...days.values()]
  }

  /**
   * A manager's decision: the day becomes what the terminal saw. The record a
   * person wrote is replaced — which is why this is never automatic.
   */
  async acceptHeld(
    ctx: TenancyContext,
    input: { employeeId: string; day: string },
  ): Promise<{ accepted: number }> {
    const { data, error } = await supabase.rpc('attendance_device_accept_held', {
      p_workspace: ctx.workspaceId,
      p_employee: input.employeeId,
      p_day: input.day,
      p_actor: ctx.userId,
    })
    if (raised(error, 'ATTENDANCE_DEVICE_NOTHING_HELD')) {
      throw new ConflictError('ATTENDANCE_DEVICE_NOTHING_HELD')
    }
    check(error, 'Failed to accept the held readings')
    return data as { accepted: number }
  }

  async identities(
    ctx: TenancyContext,
    deviceId: string,
  ): Promise<Array<{ externalUserId: string; employeeId: string; everyDevice: boolean }>> {
    await this.own(ctx, deviceId)
    const rows = await selectAllPages<
      { external_user_id: string; employee_id: string; device_id: string | null },
      { message: string; code?: string }
    >((from, to) =>
      supabase
        .from('attendance_terminal_identities')
        .select('external_user_id, employee_id, device_id')
        .eq('workspace_id', ctx.workspaceId)
        .or(`device_id.eq.${deviceId},device_id.is.null`)
        .order('external_user_id', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    )
    check(rows.error, 'Failed to read the device identities')
    // This device's own mapping hides the business-wide one for the same number.
    const byUser = new Map<string, { employeeId: string; everyDevice: boolean }>()
    for (const row of rows.data ?? []) {
      const own = row.device_id !== null
      const seen = byUser.get(row.external_user_id)
      if (!seen || (own && seen.everyDevice)) {
        byUser.set(row.external_user_id, { employeeId: row.employee_id, everyDevice: !own })
      }
    }
    return [...byUser.entries()].map(([externalUserId, value]) => ({ externalUserId, ...value }))
  }

  /**
   * «This number on this device is this employee» — and whatever that number
   * had already sent is settled at once. `employeeId: null` removes the
   * mapping; the days it already wrote are history and stay.
   */
  async mapIdentity(
    ctx: TenancyContext,
    deviceId: string,
    input: { externalUserId: string; employeeId: string | null; everyDevice: boolean },
  ): Promise<{ matched: number; applied: number; held: number; duplicate: number }> {
    await this.own(ctx, deviceId)
    const externalUserId = input.externalUserId.trim()
    if (externalUserId.length === 0 || externalUserId.length > 64) {
      throw new ValidationError('ATTENDANCE_DEVICE_USER_INVALID')
    }
    const scope = input.everyDevice ? null : deviceId

    let removal = supabase
      .from('attendance_terminal_identities')
      .delete()
      .eq('workspace_id', ctx.workspaceId)
      .eq('external_user_id', externalUserId)
    removal = scope === null ? removal.is('device_id', null) : removal.eq('device_id', scope)

    if (input.employeeId === null) {
      const { error } = await removal
      check(error, 'Failed to remove the device identity')
      return { matched: 0, applied: 0, held: 0, duplicate: 0 }
    }

    const employee = await supabase
      .from('employees')
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', input.employeeId)
      .maybeSingle()
    if (employee.error) throw new DatabaseError('Failed to read the employee', employee.error)
    if (!employee.data) throw new NotFoundError('Employee')

    // Replace, not add: one number is one person. The unique index is what
    // makes that hold when two managers map the same number at once.
    const cleared = await removal
    check(cleared.error, 'Failed to replace the device identity')
    const { error } = await supabase.from('attendance_terminal_identities').insert({
      workspace_id: ctx.workspaceId,
      device_id: scope,
      external_user_id: externalUserId,
      employee_id: input.employeeId,
      created_by: ctx.userId,
    })
    if (error?.code === '23505') throw new ConflictError('ATTENDANCE_DEVICE_USER_TAKEN')
    check(error, 'Failed to save the device identity')

    const settled = await supabase.rpc('attendance_device_reprocess', {
      p_workspace: ctx.workspaceId,
      p_device: deviceId,
      p_user_id: externalUserId,
      p_actor: ctx.userId,
    })
    if (raised(settled.error, 'ATTENDANCE_DEVICE_NOT_FOUND')) throw new NotFoundError('Device')
    check(settled.error, 'Failed to settle the waiting events')
    return settled.data as { matched: number; applied: number; held: number; duplicate: number }
  }

  // ─── the one door events come in by ───────────────────────────────────────

  /**
   * A batch from a device. Null = the key opens nothing (unknown, malformed
   * or revoked — the caller answers one 401 for all three).
   */
  async ingest(
    key: string | undefined,
    body: { format?: string | undefined; events: unknown; cursor?: string | null | undefined },
  ): Promise<null | {
    received: number
    redelivered: number
    unmatched: number
    duplicate: number
    applied: number
    held: number
    timeZone: string
    serverTime: string
  }> {
    if (!key || !DEVICE_KEY_SHAPE.test(key)) return null
    const { data, error } = await supabase
      .from('attendance_terminals')
      .select(DEVICE_COLUMNS)
      .eq('key_hash', hashDeviceKey(key))
      .is('revoked_at', null)
      .maybeSingle()
    check(error, 'Failed to read the device')
    const device = data as DeviceRow | null
    if (!device) return null

    const adapter = adapterFor(body.format)
    if (!adapter) throw new ValidationError('DEVICE_FORMAT_UNSUPPORTED')

    const zone = await timeZoneForDevice(device.workspace_id, {
      timeZone: device.time_zone,
      branchId: device.branch_id,
    })
    // A reading with no zone has no day. Say so; do not pick one.
    if (!zone.timeZone) throw new ConflictError('DEVICE_TIME_ZONE_NOT_SET')

    const now = this.clock()
    let events
    try {
      events = adapter.normalize(body.events, { timeZone: zone.timeZone, now })
    } catch (problem) {
      if (problem instanceof DeviceEventError) {
        throw new ValidationError(
          problem.index === null ? problem.code : `${problem.code}:${problem.index}`,
        )
      }
      throw problem
    }

    const cursor = typeof body.cursor === 'string' ? body.cursor.slice(0, 500) : null
    const result = await supabase.rpc('attendance_device_ingest', {
      p_device: device.id,
      p_time_zone: zone.timeZone,
      p_events: events,
      p_cursor: cursor,
    })
    // Revoked between the read above and the write: the same answer as a bad key.
    if (raised(result.error, 'ATTENDANCE_DEVICE_NOT_FOUND')) return null
    check(result.error, 'Failed to record the device events')

    const counts = result.data as {
      received: number
      redelivered: number
      unmatched: number
      duplicate: number
      applied: number
      held: number
    }
    const clock = wallClockIn(zone.timeZone, now)
    return { ...counts, timeZone: zone.timeZone, serverTime: `${clock.day}T${clock.at}` }
  }
}

export const attendanceDeviceService = new AttendanceDeviceService()
