// ============================================
// backend/src/services/payroll/shift-assignment.service.ts
//
// Capability #101 — who is planned for which shift on which day.
//
// An assignment is a PLAN. What happened is the attendance sheet's, and this
// service shows the two side by side without ever turning one into the other:
//
//   planned, and a day recorded as worked   → `worked` (or `open`)
//   planned, and a day recorded as absent   → `absent`
//   planned, and nothing recorded           → `unrecorded` — NOT «absent»
//
// ⚠️ NOTHING HERE WRITES ATTENDANCE OR PAY.
//
// The database holds the rules that must survive two people planning at once
// (docs/shift-assignments-01-migration.sql): the hours are copied from the
// shift, a retired or foreign shift is refused, and one person is never planned
// for two overlapping shifts on a day. This file checks the employee belongs to
// the business, writes the rows in ONE statement, and reads the plan.
//
// ⚠️ SEVERAL DAYS ARE ONE INSERT: either every day is planned or none is. A
// range that hits an overlap on its fourth day plans nothing, and says so.
//
// An assignment is CANCELLED, never deleted.
// ============================================

import { supabase } from '../../db'
import { BaseError } from '../../errors/base.error'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { selectAllPages } from '../../utils/fetch-all-pages'
import type { TenancyContext } from '../tenancy.service'

const MISSING_SCHEMA = new Set(['42703', '42P01', 'PGRST204', 'PGRST205'])
const COLUMNS = 'id, employee_id, shift_id, work_date, shift_name, starts_at, ends_at'

/** The most days one request may plan. */
export const MAX_ASSIGNMENT_DAYS = 31

/** Refusals the database raises by name; each has a translation on the client. */
export const SHIFT_ASSIGNMENT_ERROR_CODES = [
  'SHIFT_ASSIGNMENT_OVERLAP',
  'SHIFT_ASSIGNMENT_SHIFT_NOT_FOUND',
  'SHIFT_ASSIGNMENT_SHIFT_RETIRED',
] as const

export class ShiftAssignmentsNotConfiguredError extends BaseError {
  constructor() {
    super('SHIFT_ASSIGNMENTS_MIGRATION_PENDING', 503)
    this.name = 'ShiftAssignmentsNotConfiguredError'
  }
}

type DbError = { code?: string; message: string }

function fail(error: DbError, what: string): never {
  if (MISSING_SCHEMA.has(error.code ?? '')) throw new ShiftAssignmentsNotConfiguredError()
  const code = SHIFT_ASSIGNMENT_ERROR_CODES.find((known) => (error.message ?? '').includes(known))
  if (code === 'SHIFT_ASSIGNMENT_OVERLAP') throw new ConflictError(code)
  if (code) throw new ValidationError(code)
  throw new DatabaseError(what, error)
}

/** What the attendance sheet says about a planned day. */
export type ActualState = 'worked' | 'open' | 'absent' | 'leave' | 'unrecorded'

export interface PlannedShift {
  id: string
  employeeId: string
  employeeName: string
  shiftId: string
  shiftName: string
  /** `HH:MM`, the shop's own local time — as the shift was when it was planned. */
  startsAt: string
  endsAt: string
  actual: ActualState
  checkIn: string | null
  checkOut: string | null
}

export interface DayPlan {
  date: string
  assignments: PlannedShift[]
  summary: { planned: number; worked: number; absent: number; unrecorded: number }
}

interface AssignmentRow {
  id: string
  employee_id: string
  shift_id: string
  work_date: string
  shift_name: string
  starts_at: string
  ends_at: string
}

const hhmm = (value: string | null | undefined) => (value ? String(value).slice(0, 5) : null)

/** `count` consecutive ISO days starting at `from`. Built from parts, never by string arithmetic. */
export function consecutiveDays(from: string, count: number): string[] {
  const [year, month, day] = from.split('-').map(Number)
  return Array.from({ length: count }, (_, index) =>
    new Date(Date.UTC(year!, month! - 1, day! + index)).toISOString().slice(0, 10),
  )
}

/**
 * What a recorded day means for a plan. No record is `unrecorded` — never
 * «absent»: an empty sheet is a sheet nobody filled in.
 */
export function actualOf(
  record: { status: string | null; check_in: string | null; check_out: string | null } | undefined,
): ActualState {
  if (!record) return 'unrecorded'
  if (record.status === 'absent') return 'absent'
  if (record.status === 'leave' || record.status === 'holiday') return 'leave'
  // Present (or a status this code does not know): the times decide.
  return record.check_in && !record.check_out ? 'open' : 'worked'
}

export class ShiftAssignmentService {
  /** Everyone planned for `date`, beside what the attendance sheet recorded. */
  async day(ctx: TenancyContext, date: string): Promise<DayPlan> {
    const planned = await selectAllPages<AssignmentRow, DbError>((from, to) =>
      supabase
        .from('shift_assignments')
        .select(COLUMNS)
        .eq('workspace_id', ctx.workspaceId)
        .eq('work_date', date)
        .eq('is_cancelled', false)
        .order('starts_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    )
    if (planned.error) fail(planned.error, 'Failed to read the shift plan')
    const rows = planned.data ?? []
    if (rows.length === 0) {
      return { date, assignments: [], summary: { planned: 0, worked: 0, absent: 0, unrecorded: 0 } }
    }

    const employeeIds = [...new Set(rows.map((row) => row.employee_id))]
    const names = new Map<string, string>()
    type Attendance = {
      id: string
      employee_id: string
      status: string | null
      check_in: string | null
      check_out: string | null
    }
    const records = new Map<string, Attendance>()

    const CHUNK = 200
    for (let index = 0; index < employeeIds.length; index += CHUNK) {
      const ids = employeeIds.slice(index, index + CHUNK)
      const employees = await supabase
        .from('employees')
        .select('id, first_name, last_name')
        .eq('workspace_id', ctx.workspaceId)
        .in('id', ids)
      if (employees.error) throw new DatabaseError('Failed to read employees', employees.error)
      for (const employee of employees.data ?? []) {
        names.set(
          String(employee.id),
          [employee.first_name, employee.last_name].filter(Boolean).join(' '),
        )
      }

      const attendance = await supabase
        .from('attendance')
        .select('id, employee_id, status, check_in, check_out')
        .eq('workspace_id', ctx.workspaceId)
        .eq('date', date)
        .in('employee_id', ids)
        .order('id', { ascending: true })
      if (attendance.error) throw new DatabaseError('Failed to read attendance', attendance.error)
      // Two legacy rows for one day: the first by id, as the sheet itself shows.
      for (const record of (attendance.data ?? []) as Attendance[]) {
        if (!records.has(record.employee_id)) records.set(record.employee_id, record)
      }
    }

    const assignments: PlannedShift[] = rows.map((row) => {
      const record = records.get(row.employee_id)
      return {
        id: row.id,
        employeeId: row.employee_id,
        employeeName: names.get(row.employee_id) ?? '',
        shiftId: row.shift_id,
        shiftName: row.shift_name,
        startsAt: hhmm(row.starts_at) ?? '',
        endsAt: hhmm(row.ends_at) ?? '',
        actual: actualOf(record),
        checkIn: hhmm(record?.check_in),
        checkOut: hhmm(record?.check_out),
      }
    })

    const count = (...states: ActualState[]) =>
      assignments.filter((item) => states.includes(item.actual)).length
    return {
      date,
      assignments,
      summary: {
        planned: assignments.length,
        worked: count('worked', 'open'),
        absent: count('absent', 'leave'),
        unrecorded: count('unrecorded'),
      },
    }
  }

  /** Plan one employee for one shift on `days` consecutive days from `fromDate`. */
  async assign(
    ctx: TenancyContext,
    input: { employeeId: string; shiftId: string; fromDate: string; days: number },
  ): Promise<{ planned: string[] }> {
    if (!Number.isInteger(input.days) || input.days < 1 || input.days > MAX_ASSIGNMENT_DAYS) {
      throw new ValidationError('SHIFT_ASSIGNMENT_DAYS_INVALID')
    }

    const { data: employee, error } = await supabase
      .from('employees')
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', input.employeeId)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to read the employee', error)
    if (!employee) throw new NotFoundError('Employee')

    const dates = consecutiveDays(input.fromDate, input.days)
    // One statement: every day is planned, or none is.
    const inserted = await supabase.from('shift_assignments').insert(
      dates.map((date) => ({
        workspace_id: ctx.workspaceId,
        employee_id: input.employeeId,
        shift_id: input.shiftId,
        work_date: date,
        // Overwritten by the database with the shift's own name and hours.
        shift_name: '',
        starts_at: '00:00',
        ends_at: '00:00',
        assigned_by: ctx.userId,
      })),
    )
    if (inserted.error) fail(inserted.error, 'Failed to save the shift plan')
    return { planned: dates }
  }

  /** Cancel one assignment. The row stays. */
  async cancel(ctx: TenancyContext, id: string): Promise<{ id: string }> {
    const { data, error } = await supabase
      .from('shift_assignments')
      .update({
        is_cancelled: true,
        cancelled_by: ctx.userId,
        cancelled_at: new Date().toISOString(),
      })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .eq('is_cancelled', false)
      .select('id')
      .maybeSingle()
    if (error) fail(error, 'Failed to cancel the assignment')
    if (!data) throw new NotFoundError('Shift assignment')
    return { id }
  }
}

export const shiftAssignmentService = new ShiftAssignmentService()
