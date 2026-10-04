// ============================================
// backend/src/services/payroll/attendance.service.ts
//
// Capability #100 — the daily attendance sheet.
//
// The `attendance` table and a per-employee read existed; nothing in the
// product ever recorded a day. This is the sheet: every employee of the
// workspace for one day, and one write that marks one employee's day.
//
// ⚠️ ONE RECORD PER EMPLOYEE PER DAY. `mark` reads before it writes and updates
// the existing row; the unique index of attendance-01 makes that hold when two
// people mark at once (the loser of the race becomes an update).
//
// ⚠️ THE EMPLOYEE IS CHECKED AGAINST THE WORKSPACE BEFORE ANYTHING IS WRITTEN.
// An id is not proof of membership.
//
// ⚠️ ATTENDANCE DOES NOT FEED PAYROLL. Nothing here writes to `payrolls`; hours
// are shown, and a person decides what to do with them.
//
// Hours and problems are the domain's (`attendanceFor`): an open day has NO
// hours (null), never zero and never «until midnight».
// ============================================

import { supabase } from '../../db'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { selectAllPages } from '../../utils/fetch-all-pages'
import {
  attendanceFor,
  minutesOf,
  type AttendanceStatus,
  type DayResult,
} from '../customers/attendance.domain'
import type { TenancyContext } from '../tenancy.service'

/** What a person may record. `open` is not one: it is what a day with no check-out IS. */
export const MARKABLE_STATUSES = ['present', 'absent', 'leave', 'holiday'] as const
export type MarkableStatus = (typeof MARKABLE_STATUSES)[number]

export interface AttendanceMark {
  employeeId: string
  date: string
  status: MarkableStatus
  /** `HH:MM`, the shop's own local time. Null = not recorded. */
  checkIn: string | null
  checkOut: string | null
  note: string | null
}

export interface SheetRow {
  employeeId: string
  name: string
  position: string | null
  /** Null = nothing recorded for this employee on this day. Not «absent». */
  record: null | {
    id: string
    status: AttendanceStatus
    checkIn: string | null
    checkOut: string | null
    note: string | null
    result: DayResult
  }
}

export interface AttendanceSheet {
  date: string
  rows: SheetRow[]
  /** Counted from records, so «not recorded» is its own number. */
  summary: {
    employees: number
    recorded: number
    present: number
    absent: number
    leave: number
    open: number
  }
}

interface AttendanceRow {
  id: string
  employee_id: string
  date: string
  check_in: string | null
  check_out: string | null
  status: string | null
  notes: string | null
}

const hhmm = (value: string | null | undefined) => (value ? String(value).slice(0, 5) : null)
const KNOWN: readonly string[] = ['present', 'absent', 'leave', 'holiday', 'open']

function toRecord(row: AttendanceRow): NonNullable<SheetRow['record']> {
  const checkIn = hhmm(row.check_in)
  const checkOut = hhmm(row.check_out)
  // A stored status this code does not know is treated as «present» for the
  // arithmetic and the times decide the rest; it is never read as absence.
  const status = (KNOWN.includes(row.status ?? '') ? row.status : 'present') as AttendanceStatus
  return {
    id: row.id,
    status,
    checkIn,
    checkOut,
    note: row.notes,
    result: attendanceFor({
      employeeId: row.employee_id,
      date: row.date,
      checkIn,
      checkOut,
      status,
    }),
  }
}

export class AttendanceService {
  /** Every employee of the workspace, with what was recorded for `date`. */
  async sheet(ctx: TenancyContext, date: string): Promise<AttendanceSheet> {
    const employees = await selectAllPages<
      { id: string; first_name: string | null; last_name: string | null; position: string | null },
      { message: string; code?: string }
    >((from, to) =>
      supabase
        .from('employees')
        .select('id, first_name, last_name, position')
        .eq('workspace_id', ctx.workspaceId)
        .order('first_name', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    )
    if (employees.error) throw new DatabaseError('Failed to read employees', employees.error)

    const records = await selectAllPages<AttendanceRow, { message: string; code?: string }>(
      (from, to) =>
        supabase
          .from('attendance')
          .select('id, employee_id, date, check_in, check_out, status, notes')
          .eq('workspace_id', ctx.workspaceId)
          .eq('date', date)
          .order('id', { ascending: true })
          .range(from, to),
    )
    if (records.error) throw new DatabaseError('Failed to read attendance', records.error)

    // If a legacy database holds two rows for one employee and day, the FIRST
    // by id is shown — deterministically — rather than whichever arrived last.
    const byEmployee = new Map<string, AttendanceRow>()
    for (const row of records.data ?? []) {
      if (!byEmployee.has(row.employee_id)) byEmployee.set(row.employee_id, row)
    }

    const rows: SheetRow[] = (employees.data ?? []).map((employee) => {
      const row = byEmployee.get(employee.id)
      return {
        employeeId: employee.id,
        name: [employee.first_name, employee.last_name].filter(Boolean).join(' '),
        position: employee.position,
        record: row ? toRecord(row) : null,
      }
    })

    const recorded = rows.filter((row) => row.record !== null)
    const count = (test: (record: NonNullable<SheetRow['record']>) => boolean) =>
      recorded.filter((row) => test(row.record as NonNullable<SheetRow['record']>)).length

    return {
      date,
      rows,
      summary: {
        employees: rows.length,
        recorded: recorded.length,
        present: count((record) => record.status === 'present' || record.status === 'open'),
        absent: count((record) => record.status === 'absent'),
        leave: count((record) => record.status === 'leave' || record.status === 'holiday'),
        open: count((record) => record.result.isOpen),
      },
    }
  }

  /** Record (or correct) one employee's day. */
  async mark(ctx: TenancyContext, input: AttendanceMark): Promise<NonNullable<SheetRow['record']>> {
    const present = input.status === 'present'
    // Times belong to a day at work. On leave or absent there are none, and a
    // time sent with them is dropped HERE, by rule — not stored and ignored.
    const checkIn = present ? input.checkIn : null
    const checkOut = present ? input.checkOut : null

    if (checkIn !== null && minutesOf(checkIn) === null)
      throw new ValidationError('ATTENDANCE_TIME_INVALID')
    if (checkOut !== null && minutesOf(checkOut) === null)
      throw new ValidationError('ATTENDANCE_TIME_INVALID')
    if (checkOut !== null && checkIn === null)
      throw new ValidationError('ATTENDANCE_CHECK_OUT_WITHOUT_CHECK_IN')

    const verdict = attendanceFor({
      employeeId: input.employeeId,
      date: input.date,
      checkIn,
      checkOut,
      status: input.status,
    })
    if (verdict.issue === 'CHECK_OUT_BEFORE_CHECK_IN') {
      throw new ValidationError('ATTENDANCE_CHECK_OUT_BEFORE_CHECK_IN')
    }

    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', input.employeeId)
      .maybeSingle()
    if (employeeError) throw new DatabaseError('Failed to read the employee', employeeError)
    if (!employee) throw new NotFoundError('Employee')

    const values = {
      status: input.status,
      check_in: checkIn,
      check_out: checkOut,
      notes: input.note,
    }

    const existing = await this.find(ctx.workspaceId, input.employeeId, input.date)
    if (existing) return this.update(ctx.workspaceId, existing.id, values)

    const { data, error } = await supabase
      .from('attendance')
      .insert({
        ...values,
        employee_id: input.employeeId,
        date: input.date,
        workspace_id: ctx.workspaceId,
        user_id: ctx.userId,
      })
      .select('id, employee_id, date, check_in, check_out, status, notes')
      .single()

    if (error) {
      // Somebody else recorded the same day a moment ago: theirs is the row,
      // and this write becomes a correction of it.
      if (error.code === '23505') {
        const winner = await this.find(ctx.workspaceId, input.employeeId, input.date)
        if (winner) return this.update(ctx.workspaceId, winner.id, values)
      }
      throw new DatabaseError('Failed to record attendance', error)
    }
    return toRecord(data as AttendanceRow)
  }

  private async find(workspaceId: string, employeeId: string, date: string) {
    const { data, error } = await supabase
      .from('attendance')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('employee_id', employeeId)
      .eq('date', date)
      .order('id', { ascending: true })
      .limit(1)
    if (error) throw new DatabaseError('Failed to read attendance', error)
    return ((data ?? []) as Array<{ id: string }>)[0] ?? null
  }

  private async update(workspaceId: string, id: string, values: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('attendance')
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .select('id, employee_id, date, check_in, check_out, status, notes')
      .single()
    if (error) throw new DatabaseError('Failed to update attendance', error)
    return toRecord(data as AttendanceRow)
  }
}

export const attendanceService = new AttendanceService()
