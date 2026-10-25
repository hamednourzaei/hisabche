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
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { selectAllPages } from '../../utils/fetch-all-pages'
import {
  MARKABLE_STATUSES,
  buildAttendanceSheet,
  hhmm,
  planAttendanceMark,
  sheetRecordOf,
  type AttendanceMark,
  type AttendanceRowInput,
  type AttendanceSheet,
  type MarkableStatus,
  type SheetRecord,
  type SheetRow,
} from '@hisabche/validation'
import type { TenancyContext } from '../tenancy.service'

export { MARKABLE_STATUSES }
export type { AttendanceMark, AttendanceSheet, MarkableStatus, SheetRow }

type AttendanceRow = AttendanceRowInput

const DAY_COLUMNS = 'id, employee_id, date, check_in, check_out, status, notes'
const NIGHT_COLUMNS = `${DAY_COLUMNS}, ends_next_day`

/** The one optional column is missing — and nothing else is wrong. */
function nightMissing(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return (
    (error.code === '42703' || error.code === 'PGRST204') &&
    (error.message ?? '').includes('ends_next_day')
  )
}

interface MarkValues {
  status: string
  check_in: string | null
  check_out: string | null
  notes: string | null
  ends_next_day: boolean
}
const withoutNight = ({ ends_next_day: _night, ...rest }: MarkValues) => rest

const toRecord = (row: AttendanceRow): SheetRecord => sheetRecordOf(row)

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

    const read = (columns: string) =>
      selectAllPages<AttendanceRow, { message: string; code?: string }>(
        (from, to) =>
          supabase
            .from('attendance')
            .select(columns)
            .eq('workspace_id', ctx.workspaceId)
            .eq('date', date)
            .order('id', { ascending: true })
            .range(from, to) as unknown as PromiseLike<{
            data: AttendanceRow[] | null
            error: { message: string; code?: string } | null
          }>,
      )
    let records = await read(NIGHT_COLUMNS)
    // Before attendance-02 the column is not there, and no record is a night.
    if (nightMissing(records.error)) records = await read(DAY_COLUMNS)
    if (records.error) throw new DatabaseError('Failed to read attendance', records.error)

    return buildAttendanceSheet(date, employees.data ?? [], records.data ?? [])
  }

  /** Record (or correct) one employee's day. */
  async mark(ctx: TenancyContext, input: AttendanceMark): Promise<NonNullable<SheetRow['record']>> {
    const plan = planAttendanceMark(input)
    if (!plan.ok) throw new ValidationError(plan.problem)
    const { checkIn, checkOut, endsNextDay } = plan.values

    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', input.employeeId)
      .maybeSingle()
    if (employeeError) throw new DatabaseError('Failed to read the employee', employeeError)
    if (!employee) throw new NotFoundError('Employee')

    const values: MarkValues = {
      status: input.status,
      check_in: checkIn,
      check_out: checkOut,
      notes: input.note,
      ends_next_day: endsNextDay,
    }

    const existing = await this.find(ctx.workspaceId, input.employeeId, input.date)
    if (existing) return this.update(ctx.workspaceId, existing.id, values)

    const insert = (night: boolean) =>
      supabase
        .from('attendance')
        .insert({
          ...(night ? values : withoutNight(values)),
          employee_id: input.employeeId,
          date: input.date,
          workspace_id: ctx.workspaceId,
          user_id: ctx.userId,
        })
        .select(night ? NIGHT_COLUMNS : DAY_COLUMNS)
        .single()

    let { data, error } = await insert(true)
    if (nightMissing(error)) {
      // attendance-02 has not been run. A day that ends the same day is
      // written as before; a night cannot be, and is not written as a day.
      if (values.ends_next_day) throw new ConflictError('ATTENDANCE_NIGHT_NOT_CONFIGURED')
      ;({ data, error } = await insert(false))
    }

    if (error) {
      // Somebody else recorded the same day a moment ago: theirs is the row,
      // and this write becomes a correction of it.
      if (error.code === '23505') {
        const winner = await this.find(ctx.workspaceId, input.employeeId, input.date)
        if (winner) return this.update(ctx.workspaceId, winner.id, values)
      }
      throw new DatabaseError('Failed to record attendance', error)
    }
    return toRecord(data as unknown as AttendanceRow)
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

  private async update(workspaceId: string, id: string, values: MarkValues) {
    const write = (night: boolean) =>
      supabase
        .from('attendance')
        .update({
          ...(night ? values : withoutNight(values)),
          updated_at: new Date().toISOString(),
        })
        .eq('workspace_id', workspaceId)
        .eq('id', id)
        .select(night ? NIGHT_COLUMNS : DAY_COLUMNS)
        .single()

    let { data, error } = await write(true)
    if (nightMissing(error)) {
      if (values.ends_next_day) throw new ConflictError('ATTENDANCE_NIGHT_NOT_CONFIGURED')
      ;({ data, error } = await write(false))
    }
    if (error) throw new DatabaseError('Failed to update attendance', error)
    return toRecord(data as unknown as AttendanceRow)
  }
}

export const attendanceService = new AttendanceService()
