// ============================================
// backend/src/services/workplace-time-zone.ts
//
// Where a business is — the zone «today» is read in for the people who work
// there (docs/attendance-self-01-migration.sql).
//
//     the branch an employee is posted to   branches.time_zone   (optional)
//  →  the business                          workspaces.time_zone
//  →  null
//
// ⚠️ THERE IS NO DEFAULT. A business that has not chosen a zone has none, and
// whatever needs one says so and stops. Answering «Asia/Tehran» for a shop in
// Kabul would put every late-evening entry on the wrong day, silently.
// ⚠️ A read that FAILS throws. «Could not read the zone» is not «no zone».
// ⚠️ A database that has not had the migration answers `configurable: false`
// and a null zone — never a 500 for the screen that only shows it.
//
// Imports no other service (a shared value taken from a service closes an
// import cycle that only shows on the live server).
// ============================================

import { supabase } from '../db'
import { DatabaseError, NotFoundError } from '../errors/database.error'
import { ValidationError } from '../errors/validation.error'

type DbError = { code?: string; message?: string }

const isMissingSchema = (error: DbError | null) =>
  ['42703', '42P01', 'PGRST204', 'PGRST205'].includes(error?.code ?? '')

/** A zone this runtime knows. An unknown one is refused, never replaced. */
export function isKnownTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

export interface WorkplaceTimeZones {
  /** Null = the owner has not chosen one. */
  timeZone: string | null
  /** False until the migration has run — nothing can be stored yet. */
  configurable: boolean
  /** Null `timeZone` = the branch is in the business's zone. */
  branches: Array<{ id: string; name: string; timeZone: string | null }>
}

export async function describeWorkplaceTimeZones(workspaceId: string): Promise<WorkplaceTimeZones> {
  const business = await supabase
    .from('workspaces')
    .select('time_zone')
    .eq('id', workspaceId)
    .maybeSingle()
  if (business.error) {
    if (isMissingSchema(business.error))
      return { timeZone: null, configurable: false, branches: [] }
    throw new DatabaseError('Failed to read the time zone', business.error)
  }

  const branches = await supabase
    .from('branches')
    .select('id, name, time_zone')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .order('id', { ascending: true })
  // A business may have no branches table at all; that costs the list, not the answer.
  if (branches.error && !isMissingSchema(branches.error)) {
    throw new DatabaseError('Failed to read the branches', branches.error)
  }

  const stored = (business.data as { time_zone?: string | null } | null)?.time_zone ?? null
  return {
    timeZone: stored && stored.trim() !== '' ? stored : null,
    configurable: true,
    branches: ((branches.error ? [] : (branches.data ?? [])) as Array<Record<string, unknown>>).map(
      (row) => ({
        id: String(row.id),
        name: String(row.name ?? ''),
        timeZone: (row.time_zone as string | null) || null,
      }),
    ),
  }
}

export async function setWorkspaceTimeZone(
  workspaceId: string,
  timeZone: string,
): Promise<{ timeZone: string }> {
  if (!isKnownTimeZone(timeZone)) throw new ValidationError('TIME_ZONE_INVALID')
  const { data, error } = await supabase
    .from('workspaces')
    .update({ time_zone: timeZone })
    .eq('id', workspaceId)
    .select('id')
    .maybeSingle()
  if (error) {
    if (isMissingSchema(error)) throw new ValidationError('TIME_ZONE_SCHEMA_REQUIRED')
    throw new DatabaseError('Failed to save the time zone', error)
  }
  if (!data) throw new NotFoundError('Workspace')
  return { timeZone }
}

/** `null` puts the branch back in its business's zone. */
export async function setBranchTimeZone(
  workspaceId: string,
  branchId: string,
  timeZone: string | null,
): Promise<{ id: string; timeZone: string | null }> {
  if (timeZone !== null && !isKnownTimeZone(timeZone))
    throw new ValidationError('TIME_ZONE_INVALID')
  const { data, error } = await supabase
    .from('branches')
    .update({ time_zone: timeZone })
    .eq('workspace_id', workspaceId)
    .eq('id', branchId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()
  if (error) {
    if (isMissingSchema(error)) throw new ValidationError('TIME_ZONE_SCHEMA_REQUIRED')
    throw new DatabaseError('Failed to save the branch time zone', error)
  }
  if (!data) throw new NotFoundError('Branch')
  return { id: branchId, timeZone }
}

export interface EmployeeTimeZone {
  timeZone: string | null
  /** Where it came from — shown to the manager, so a surprise can be traced. */
  source: 'branch' | 'workspace' | null
}

/**
 * The zone an employee's day is read in: their current primary branch's own
 * zone, else the business's. Null when neither has been set.
 */
export async function timeZoneForEmployee(
  workspaceId: string,
  employeeId: string,
): Promise<EmployeeTimeZone> {
  const posting = await supabase
    .from('employee_branch_assignments')
    .select('branch_id')
    .eq('workspace_id', workspaceId)
    .eq('employee_id', employeeId)
    .eq('is_primary', true)
    .is('ends_at', null)
    .limit(1)
  // No assignments table = no branches to speak of; the business decides.
  if (posting.error && !isMissingSchema(posting.error)) {
    throw new DatabaseError('Failed to read the branch assignment', posting.error)
  }
  const branchId = posting.error
    ? null
    : (((posting.data ?? []) as Array<{ branch_id: string }>)[0]?.branch_id ?? null)

  if (branchId) {
    const branch = await supabase
      .from('branches')
      .select('time_zone')
      .eq('workspace_id', workspaceId)
      .eq('id', branchId)
      .maybeSingle()
    if (branch.error && !isMissingSchema(branch.error)) {
      throw new DatabaseError('Failed to read the branch time zone', branch.error)
    }
    const own = branch.error
      ? null
      : ((branch.data as { time_zone?: string | null } | null)?.time_zone ?? null)
    // A stored name this runtime no longer knows is not used to judge a day.
    if (own && isKnownTimeZone(own)) return { timeZone: own, source: 'branch' }
  }

  const business = await supabase
    .from('workspaces')
    .select('time_zone')
    .eq('id', workspaceId)
    .maybeSingle()
  if (business.error) {
    if (isMissingSchema(business.error)) return { timeZone: null, source: null }
    throw new DatabaseError('Failed to read the time zone', business.error)
  }
  const stored = (business.data as { time_zone?: string | null } | null)?.time_zone ?? null
  return stored && isKnownTimeZone(stored)
    ? { timeZone: stored, source: 'workspace' }
    : { timeZone: null, source: null }
}

/**
 * The zone a terminal's wall clock is read in: its own, else its branch's,
 * else the business's. Null when none of the three has been set — and then
 * the device's events cannot be given a day.
 */
export async function timeZoneForDevice(
  workspaceId: string,
  device: { timeZone: string | null; branchId: string | null },
): Promise<{ timeZone: string | null; source: 'device' | 'branch' | 'workspace' | null }> {
  if (device.timeZone && isKnownTimeZone(device.timeZone)) {
    return { timeZone: device.timeZone, source: 'device' }
  }

  if (device.branchId) {
    const branch = await supabase
      .from('branches')
      .select('time_zone')
      .eq('workspace_id', workspaceId)
      .eq('id', device.branchId)
      .maybeSingle()
    if (branch.error && !isMissingSchema(branch.error)) {
      throw new DatabaseError('Failed to read the branch time zone', branch.error)
    }
    const own = branch.error
      ? null
      : ((branch.data as { time_zone?: string | null } | null)?.time_zone ?? null)
    if (own && isKnownTimeZone(own)) return { timeZone: own, source: 'branch' }
  }

  const business = await supabase
    .from('workspaces')
    .select('time_zone')
    .eq('id', workspaceId)
    .maybeSingle()
  if (business.error) {
    if (isMissingSchema(business.error)) return { timeZone: null, source: null }
    throw new DatabaseError('Failed to read the time zone', business.error)
  }
  const stored = (business.data as { time_zone?: string | null } | null)?.time_zone ?? null
  return stored && isKnownTimeZone(stored)
    ? { timeZone: stored, source: 'workspace' }
    : { timeZone: null, source: null }
}
