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
  /** The exit is on the day after `date`. Only a person says so. */
  endsNextDay?: boolean | undefined
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
    endsNextDay: boolean
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
  /** attendance-02. Absent before it: every record then ends the same day. */
  ends_next_day?: boolean | null
}

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
    endsNextDay: row.ends_next_day === true,
    note: row.notes,
    result: attendanceFor({
      employeeId: row.employee_id,
      date: row.date,
      checkIn,
      checkOut,
      endsNextDay: row.ends_next_day === true,
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

    const endsNextDay = present && checkOut !== null && input.endsNextDay === true
    const verdict = attendanceFor({
      employeeId: input.employeeId,
      date: input.date,
      checkIn,
      checkOut,
      endsNextDay,
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
