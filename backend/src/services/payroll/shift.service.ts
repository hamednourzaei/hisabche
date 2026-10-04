// ============================================
// backend/src/services/payroll/shift.service.ts
//
// Capability #101 — shift definitions.
//
// A shift is a named pair of times in the shop's own local day. The attendance
// sheet uses one to record a day in one click; nothing here assigns a person
// or touches pay.
//
// The rules are the domain's (`validateShifts`, `payableHours`): a shift ends
// after it starts, on the same day, and its break is shorter than the shift.
// A shift is RETIRED (`is_active = false`), never deleted.
// ============================================

import { supabase } from '../../db'
import { BaseError } from '../../errors/base.error'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { payableHours, validateShifts, type ShiftDefinition } from '../customers/attendance.domain'
import type { TenancyContext } from '../tenancy.service'

const MISSING_SCHEMA = new Set(['42703', '42P01', 'PGRST204', 'PGRST205'])
const COLUMNS = 'id, name, starts_at, ends_at, break_minutes, is_active'

export class ShiftsNotConfiguredError extends BaseError {
  constructor() {
    super('SHIFTS_MIGRATION_PENDING', 503)
    this.name = 'ShiftsNotConfiguredError'
  }
}

export interface WorkShift extends ShiftDefinition {
  isActive: boolean
  /** Hours between start and end, less the unpaid break. */
  payableHours: number
}

interface ShiftRow {
  id: string
  name: string
  starts_at: string
  ends_at: string
  break_minutes: number
  is_active: boolean
}

const hhmm = (value: string) => String(value).slice(0, 5)

function toShift(row: ShiftRow): WorkShift {
  const definition: ShiftDefinition = {
    id: row.id,
    name: row.name,
    startsAt: hhmm(row.starts_at),
    endsAt: hhmm(row.ends_at),
    breakMinutes: Number(row.break_minutes) || 0,
  }
  return { ...definition, isActive: row.is_active, payableHours: payableHours(definition) }
}

function fail(error: { code?: string; message: string }, what: string): never {
  if (MISSING_SCHEMA.has(error.code ?? '')) throw new ShiftsNotConfiguredError()
  if (error.code === '23505') throw new ConflictError('SHIFT_NAME_TAKEN')
  throw new DatabaseError(what, error)
}

export class ShiftService {
  /** Active shifts first, then retired ones; a workspace has a handful. */
  async list(ctx: TenancyContext): Promise<WorkShift[]> {
    const { data, error } = await supabase
      .from('work_shifts')
      .select(COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .order('is_active', { ascending: false })
      .order('starts_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(200)
    if (error) fail(error, 'Failed to read shifts')
    return ((data ?? []) as ShiftRow[]).map(toShift)
  }

  async create(
    ctx: TenancyContext,
    input: { name: string; startsAt: string; endsAt: string; breakMinutes: number },
  ): Promise<WorkShift> {
    const draft: ShiftDefinition = { id: 'new', ...input }
    const problems = validateShifts([draft], [draft])
    if (problems.length > 0) throw new ValidationError(`SHIFT_${problems[0]}`)

    const { data, error } = await supabase
      .from('work_shifts')
      .insert({
        workspace_id: ctx.workspaceId,
        created_by: ctx.userId,
        name: input.name.trim(),
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        break_minutes: input.breakMinutes,
      })
      .select(COLUMNS)
      .single()
    if (error) fail(error, 'Failed to save the shift')
    return toShift(data as ShiftRow)
  }

  /** Retire or bring back. Never a delete. */
  async setActive(ctx: TenancyContext, id: string, isActive: boolean): Promise<WorkShift> {
    const { data, error } = await supabase
      .from('work_shifts')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .select(COLUMNS)
      .maybeSingle()
    if (error) fail(error, 'Failed to update the shift')
    if (!data) throw new NotFoundError('Shift')
    return toShift(data as ShiftRow)
  }
}

export const shiftService = new ShiftService()
