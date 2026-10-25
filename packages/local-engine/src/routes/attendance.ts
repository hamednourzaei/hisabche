// ============================================
// packages/local-engine/src/routes/attendance.ts
//
// The daily attendance sheet (#100), the shift definitions and the shift plan
// (#101), offline.
//
// ⚠️ NO SECOND ENGINE. Hours and problems are `attendanceFor`; the sheet and its
// counts are `buildAttendanceSheet`; what one marked day stores is
// `planAttendanceMark`; the plan beside the sheet is `actualOf` /
// `summarizeDayPlan`; a shift's hours are `validateShifts` / `payableHours`; a
// range of days is `consecutiveDays`. Bodies are parsed with the SAME zod
// schemas the server's route uses (attendance-bodies.ts).
//
// ⚠️ ATTENDANCE DOES NOT FEED PAYROLL, here or on the server. An open day has NO
// hours (null) — never zero and never «until midnight» — and a day nobody
// recorded is «not recorded», never «absent».
//
// What does NOT run on the device: employee attendance LINKS (a public page an
// employee opens on their own phone) and attendance TERMINALS (devices that push
// events to a server). A device that is offline is neither reachable by a phone
// nor by a terminal, so they stay cloud-only; see the endpoint matrix.
// ============================================

import {
  assignShiftBodySchema,
  attendanceMarkBodySchema,
  attendanceSheetQuerySchema,
  buildAttendanceSheet,
  consecutiveDays,
  createShiftBodySchema,
  hhmm,
  payableHours,
  planAttendanceMark,
  actualOf,
  setShiftActiveBodySchema,
  shiftAssignmentsOverlap,
  sheetRecordOf,
  summarizeDayPlan,
  validateShifts,
  type AttendanceRowInput,
  type PlannedShift,
  type ShiftDefinition,
} from '@hisabche/validation'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import type { LocalDb } from '../db'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'
import { bodyOf, newId, nowIso, parseWith, requireEmployee } from './people-common'

interface ShiftRow {
  id: string
  name: string
  starts_at: string
  ends_at: string
  break_minutes: number
  is_active: number
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

function toShift(row: ShiftRow) {
  const definition: ShiftDefinition = {
    id: row.id,
    name: row.name,
    startsAt: hhmm(row.starts_at) ?? '',
    endsAt: hhmm(row.ends_at) ?? '',
    breakMinutes: Number(row.break_minutes) || 0,
  }
  return {
    ...definition,
    isActive: Boolean(row.is_active),
    payableHours: payableHours(definition),
  }
}

function attendanceRowsOn(db: LocalDb, workspaceId: string, date: string): AttendanceRowInput[] {
  return db.all<AttendanceRowInput>(
    'SELECT id, employee_id, date, check_in, check_out, status, notes, ends_next_day FROM attendance WHERE workspace_id = ? AND date = ? ORDER BY id',
    [workspaceId, date],
  )
}

export function registerAttendanceRoutes(router: Router): void {
  // ─── The daily sheet ────────────────────────────────────────
  router.get('/attendance-sheet', (c: RouteHandlerContext) => {
    const { db, ctx, query } = c
    const { date } = parseWith(attendanceSheetQuerySchema, query)
    const employees = db.all<{
      id: string
      first_name: string | null
      last_name: string | null
      full_name: string
      position: string | null
    }>(
      `SELECT id, first_name, last_name, full_name, position FROM employee
        WHERE workspace_id = ? AND deleted_at IS NULL
        ORDER BY COALESCE(first_name, full_name), id`,
      [ctx.workspaceId],
    )
    return buildAttendanceSheet(
      date,
      employees.map((employee) => ({
        id: employee.id,
        // A row cached before v5 has only a full name; it is shown as it is.
        first_name: employee.first_name ?? employee.full_name,
        last_name: employee.last_name,
        position: employee.position,
      })),
      attendanceRowsOn(db, ctx.workspaceId, date),
    )
  })

  router.put('/attendance-sheet', (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    const input = parseWith(attendanceMarkBodySchema, bodyOf(body))
    const plan = planAttendanceMark(input)
    if (!plan.ok) throw new ValidationError(plan.problem)
    requireEmployee(db, ctx.workspaceId, input.employeeId)

    const { values } = plan
    const now = nowIso()
    return db.transaction(() => {
      // ONE record per employee per day: an existing one is corrected.
      const existing = db.get<{ id: string }>(
        'SELECT id FROM attendance WHERE workspace_id = ? AND employee_id = ? AND date = ? ORDER BY id LIMIT 1',
        [ctx.workspaceId, input.employeeId, input.date],
      )
      let id: string
      if (existing) {
        id = existing.id
        db.run(
          `UPDATE attendance SET status = ?, check_in = ?, check_out = ?, notes = ?, ends_next_day = ?, updated_at = ?
            WHERE id = ? AND workspace_id = ?`,
          [
            values.status,
            values.checkIn,
            values.checkOut,
            values.note,
            values.endsNextDay ? 1 : 0,
            now,
            id,
            ctx.workspaceId,
          ],
        )
      } else {
        id = newId()
        db.run(
          `INSERT INTO attendance (
             id, workspace_id, employee_id, date, check_in, check_out, status, notes,
             ends_next_day, created_at, updated_at, origin, sync_state
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
          [
            id,
            ctx.workspaceId,
            input.employeeId,
            input.date,
            values.checkIn,
            values.checkOut,
            values.status,
            values.note,
            values.endsNextDay ? 1 : 0,
            now,
            now,
          ],
        )
      }
      const saved = db.get<AttendanceRowInput>(
        'SELECT id, employee_id, date, check_in, check_out, status, notes, ends_next_day FROM attendance WHERE id = ?',
        [id],
      )!
      return sheetRecordOf(saved)
    })
  })

  // ─── Shifts ─────────────────────────────────────────────────
  router.get('/shifts', (c: RouteHandlerContext) => {
    const { db, ctx } = c
    const rows = db.all<ShiftRow>(
      'SELECT id, name, starts_at, ends_at, break_minutes, is_active FROM work_shift WHERE workspace_id = ? ORDER BY is_active DESC, starts_at, id LIMIT 200',
      [ctx.workspaceId],
    )
    return { shifts: rows.map(toShift) }
  })

  router.post('/shifts', (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    const input = parseWith(createShiftBodySchema, bodyOf(body))
    const draft: ShiftDefinition = { id: 'new', ...input }
    const problems = validateShifts([draft], [draft])
    if (problems.length > 0) throw new ValidationError(`SHIFT_${problems[0]}`)

    const name = input.name.trim()
    const taken = db.get<{ id: string }>(
      'SELECT id FROM work_shift WHERE workspace_id = ? AND name = ?',
      [ctx.workspaceId, name],
    )
    if (taken) throw new ConflictError('SHIFT_NAME_TAKEN')

    const id = newId()
    const now = nowIso()
    db.run(
      `INSERT INTO work_shift (
         id, workspace_id, name, starts_at, ends_at, break_minutes, is_active,
         created_at, updated_at, origin, sync_state
       ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 'local', 'local_only')`,
      [id, ctx.workspaceId, name, input.startsAt, input.endsAt, input.breakMinutes, now, now],
    )
    return toShift(
      db.get<ShiftRow>(
        'SELECT id, name, starts_at, ends_at, break_minutes, is_active FROM work_shift WHERE id = ?',
        [id],
      )!,
    )
  })

  // Retire or bring back. Never a delete.
  router.patch('/shifts/:id/active', (c: RouteHandlerContext) => {
    const { db, ctx, params, body } = c
    const { isActive } = parseWith(setShiftActiveBodySchema, bodyOf(body))
    const result = db.run(
      'UPDATE work_shift SET is_active = ?, updated_at = ? WHERE id = ? AND workspace_id = ?',
      [isActive ? 1 : 0, nowIso(), params.id ?? '', ctx.workspaceId],
    )
    if (result.changes === 0) throw new NotFoundError('Shift')
    return toShift(
      db.get<ShiftRow>(
        'SELECT id, name, starts_at, ends_at, break_minutes, is_active FROM work_shift WHERE id = ?',
        [params.id ?? ''],
      )!,
    )
  })

  // ─── The shift plan ─────────────────────────────────────────
  router.get('/shift-assignments', (c: RouteHandlerContext) => {
    const { db, ctx, query } = c
    const { date } = parseWith(attendanceSheetQuerySchema, query)
    const rows = db.all<AssignmentRow>(
      `SELECT id, employee_id, shift_id, work_date, shift_name, starts_at, ends_at
         FROM shift_assignment
        WHERE workspace_id = ? AND work_date = ? AND is_cancelled = 0
        ORDER BY starts_at, id`,
      [ctx.workspaceId, date],
    )
    if (rows.length === 0) return summarizeDayPlan(date, [])

    const names = new Map(
      db
        .all<{
          id: string
          first_name: string | null
          last_name: string | null
          full_name: string
        }>('SELECT id, first_name, last_name, full_name FROM employee WHERE workspace_id = ?', [
          ctx.workspaceId,
        ])
        .map((row) => [
          row.id,
          [row.first_name ?? row.full_name, row.last_name].filter(Boolean).join(' '),
        ]),
    )
    // Two legacy rows for one day: the first by id, as the sheet itself shows.
    const records = new Map<string, AttendanceRowInput>()
    for (const record of attendanceRowsOn(db, ctx.workspaceId, date)) {
      if (!records.has(record.employee_id)) records.set(record.employee_id, record)
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
    return summarizeDayPlan(date, assignments)
  })

  router.post('/shift-assignments', (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    const input = parseWith(assignShiftBodySchema, bodyOf(body))
    requireEmployee(db, ctx.workspaceId, input.employeeId)

    const shift = db.get<ShiftRow>(
      'SELECT id, name, starts_at, ends_at, break_minutes, is_active FROM work_shift WHERE id = ? AND workspace_id = ?',
      [input.shiftId, ctx.workspaceId],
    )
    if (!shift) throw new ValidationError('SHIFT_ASSIGNMENT_SHIFT_NOT_FOUND')
    if (!shift.is_active) throw new ValidationError('SHIFT_ASSIGNMENT_SHIFT_RETIRED')

    const dates = consecutiveDays(input.fromDate, input.days)
    const startsAt = hhmm(shift.starts_at) ?? ''
    const endsAt = hhmm(shift.ends_at) ?? ''
    const now = nowIso()

    // Either every day is planned or none is: a range that hits an overlap on
    // its fourth day plans nothing, and says so.
    db.transaction(() => {
      for (const date of dates) {
        const others = db.all<{ starts_at: string; ends_at: string }>(
          `SELECT starts_at, ends_at FROM shift_assignment
            WHERE workspace_id = ? AND employee_id = ? AND work_date = ? AND is_cancelled = 0`,
          [ctx.workspaceId, input.employeeId, date],
        )
        const clash = others.some((other) =>
          shiftAssignmentsOverlap(
            { startsAt: hhmm(other.starts_at) ?? '', endsAt: hhmm(other.ends_at) ?? '' },
            { startsAt, endsAt },
          ),
        )
        if (clash) throw new ConflictError('SHIFT_ASSIGNMENT_OVERLAP')

        // The hours are the shift's, whatever the caller sent.
        db.run(
          `INSERT INTO shift_assignment (
             id, workspace_id, employee_id, shift_id, work_date, shift_name, starts_at, ends_at,
             created_at, updated_at, origin, sync_state
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
          [
            newId(),
            ctx.workspaceId,
            input.employeeId,
            shift.id,
            date,
            shift.name,
            shift.starts_at,
            shift.ends_at,
            now,
            now,
          ],
        )
      }
    })
    return { planned: dates }
  })

  // Cancel one assignment. The row stays.
  router.post('/shift-assignments/:id/cancel', (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const id = params.id ?? ''
    const result = db.run(
      'UPDATE shift_assignment SET is_cancelled = 1, cancelled_at = ?, updated_at = ? WHERE id = ? AND workspace_id = ? AND is_cancelled = 0',
      [nowIso(), nowIso(), id, ctx.workspaceId],
    )
    if (result.changes === 0) throw new NotFoundError('Shift assignment')
    return { id }
  })
}
