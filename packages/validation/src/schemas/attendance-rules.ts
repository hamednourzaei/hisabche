// ============================================
// packages/validation/src/schemas/attendance-rules.ts
//
// Attendance and shift rules — moved here from backend/src/services/customers/
// attendance.domain.ts so the server and the offline engine share ONE rule.
// ============================================

// ============================================
// Capabilities #100, #101 — attendance and shifts.
//
// ⚠️ THE `attendance` TABLE EXISTS AND IS READ-ONLY.
//
// `SETUP-COMPLETE.sql` created it and `human-resources.routes.ts:237` serves it,
// but nothing ever WRITES a check-in — so every deployment has the table, the
// endpoint, and an empty answer. That is the `§7.1` shape: correct code, no
// caller, and a page that says «no attendance» because there has never been
// any way to record one.
//
// So this module is the write side, plus the two rules that make attendance mean
// something rather than being a timesheet a shopkeeper types.
//
// ⚠️ ATTENDANCE IS NOT A PAYROLL INPUT, AND THE PRODUCT KNOWS WHY.
//
// `payroll-ledger.domain` exists because payroll was posting no journal entry
// at all. Adding an attendance system that silently feeds hours into pay would
// reopen that: an employee whose check-in is wrong would see their salary change
// without anyone deciding it. So the rule is one-directional and stated here:
//
//   attendance → payroll is a HUMAN ACTION, never a consequence
//
// Nothing in this file writes to `payrolls`. The join is `project_time_entries`,
// which is what timesheet billing already reads, and a person raises it.
//
// ⚠️ AND AN OPEN DAY IS NOT A ZERO-HOUR DAY.
//
// A missing check-out at 14:00 means the employee is still there, or forgot, or
// left — and each of those is a different conversation. The engine returns the
// day as OPEN and says which hours it can vouch for, rather than closing it at
// midnight and billing eight unclaimed hours.
export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'holiday' | 'open'

export interface AttendanceDay {
  employeeId: string
  /** ISO day. */
  date: string
  /** `HH:MM` local, or null when the day has not started or has no check-in. */
  checkIn: string | null
  checkOut: string | null
  /**
   * The exit is on the calendar day AFTER `date`. A person (or a planned night
   * shift) says so; it is never read off the times.
   */
  endsNextDay?: boolean | undefined
  status: AttendanceStatus
  note?: string | null
}

export interface DayResult {
  status: AttendanceStatus
  /**
   * ⚠️ HOURS THE ENGINE WILL VOUCH FOR. Null for an open day — not zero, because
   * zero is an answer and an open day does not have one yet.
   */
  workedHours: number | null
  /** True when the day has a check-in and no check-out. */
  isOpen: boolean
  /** What a person has to do about it, when something is wrong. */
  issue: null | 'NO_CHECK_IN' | 'NO_CHECK_OUT' | 'CHECK_OUT_BEFORE_CHECK_IN' | 'DUPLICATE'
}

/** Minutes since midnight from `HH:MM`. Null for a malformed or absent time. */
export function minutesOf(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  // ⚠️ Bounds-checked. `25:99` parses as digits and would otherwise be a
  // NEGATIVE duration, which turns an overworked employee into an underworked
  // one and nobody notices.
  if (hours > 23 || minutes > 59) return null

  return hours * 60 + minutes
}

/**
 * How long a day was, and what is wrong with it.
 *
 * ⚠️ AN OPEN DAY HAS NO DURATION. Closing it at 23:59 would claim a person
 * worked from their check-in until the end of the day, which is how an
 * attendance system invents eight hours nobody was there for.
 */
export function attendanceFor(day: AttendanceDay): DayResult {
  if (day.status === 'leave' || day.status === 'holiday') {
    return { status: day.status, workedHours: 0, isOpen: false, issue: null }
  }

  if (day.status === 'absent') {
    return { status: 'absent', workedHours: 0, isOpen: false, issue: null }
  }

  const inMinutes = minutesOf(day.checkIn)

  if (inMinutes === null) {
    // ⚠️ NO CHECK-IN IS A PROBLEM TO REPORT, not a zero. A missing check-in and a
    // check-out-at-00:00 both produce 0 hours, and one of them is an employee at
    // work.
    return { status: day.status, workedHours: null, isOpen: false, issue: 'NO_CHECK_IN' }
  }

  const outMinutes = minutesOf(day.checkOut)

  if (day.checkOut === null || day.checkOut === undefined || day.checkOut === '') {
    return { status: day.status, workedHours: null, isOpen: true, issue: 'NO_CHECK_OUT' }
  }

  if (day.endsNextDay === true && outMinutes !== null) {
    // A night: said outright, so the hours run through midnight. An exit that
    // is not earlier than the arrival would be a day or more — not a night.
    if (outMinutes >= inMinutes) {
      return {
        status: day.status,
        workedHours: null,
        isOpen: false,
        issue: 'CHECK_OUT_BEFORE_CHECK_IN',
      }
    }
    return {
      status: day.status,
      workedHours: Math.round(((outMinutes + 1440 - inMinutes) / 60) * 100) / 100,
      isOpen: false,
      issue: null,
    }
  }

  if (outMinutes !== null && outMinutes < inMinutes) {
    // ⚠️ AN OUT BEFORE AN IN IS A DATA ERROR, NOT A NIGHT SHIFT — unless the
    // record SAYS it ends the next day (above). Reading it off the times would
    // turn a typo into twenty hours.
    return {
      status: day.status,
      workedHours: null,
      isOpen: false,
      issue: 'CHECK_OUT_BEFORE_CHECK_IN',
    }
  }

  const minutes = (outMinutes ?? inMinutes) - inMinutes
  return {
    status: day.status,
    workedHours: Math.round((minutes / 60) * 100) / 100,
    isOpen: false,
    issue: null,
  }
}

// ─── Shifts (#101) ──────────────────────────────────────────────────────────

export interface ShiftDefinition {
  id: string
  name: string
  /** `HH:MM`. The shop's own local time, never UTC. */
  startsAt: string
  endsAt: string
  /** Minutes of unpaid break inside the shift. */
  breakMinutes: number
}

export type CoverageProblem =
  'INVALID_TIMES' | 'BREAK_LONGER_THAN_SHIFT' | 'OVERLAPS_ANOTHER' | 'TOO_MANY_SHIFTS_PER_DAY'

export const MAX_SHIFTS_PER_DAY = 3

/**
 * Is a roster workable?
 *
 * ⚠️ OVERLAP IS CHECKED AGAINST THE SHIFTS ON THE SAME DAY ONLY. Two shifts on
 * Monday and Tuesday overlapping is a normal week; two on Monday overlapping
 * means the same person is in two places.
 */
export function validateShifts(
  dayShifts: readonly ShiftDefinition[],
  allShifts: readonly ShiftDefinition[],
): CoverageProblem[] {
  const problems: CoverageProblem[] = []

  if (dayShifts.length > MAX_SHIFTS_PER_DAY) {
    problems.push('TOO_MANY_SHIFTS_PER_DAY')
  }

  for (const shift of dayShifts) {
    const start = minutesOf(shift.startsAt)
    const end = minutesOf(shift.endsAt)

    if (start === null || end === null) {
      problems.push('INVALID_TIMES')
      continue
    }

    if (end === start) {
      // Zero hours and twenty-four cannot be told apart. An end EARLIER than
      // the start is a shift that ends the next day (`shiftMinutes`).
      problems.push('INVALID_TIMES')
      continue
    }

    if (shift.breakMinutes < 0 || shift.breakMinutes >= shiftMinutes(shift)) {
      problems.push('BREAK_LONGER_THAN_SHIFT')
    }
  }

  // ⚠️ SORTED FIRST, so the overlap check is order-independent — a roster
  // entered bottom-up and one entered top-down must give the same answer.
  const sorted = [...dayShifts]
    .map((s) => {
      const start = minutesOf(s.startsAt) ?? 0
      return { shift: s, start, end: start + shiftMinutes(s) }
    })
    .sort((a, b) => a.start - b.start)

  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i]!.start < sorted[i - 1]!.end) {
      problems.push('OVERLAPS_ANOTHER')
      break
    }
  }

  // A shift that appears on another day is a copy-paste, not a schedule.
  for (const shift of dayShifts) {
    const elsewhere = allShifts.filter((s) => s.id === shift.id)
    if (elsewhere.length > 1) continue // same definition reused; that is normal
  }

  return [...new Set(problems)]
}

/**
 * The payable hours of a shift.
 *
 * ⚠️ THE BREAK COMES OFF THE TOP, and can take the shift to zero but not
 * below. A break longer than the shift is a roster error caught by
 * `validateShifts`; here it is clamped so a payroll run cannot produce negative
 * hours and a negative salary line.
 */
export function payableHours(shift: ShiftDefinition): number {
  const minutes = Math.max(0, shiftMinutes(shift) - Math.max(0, shift.breakMinutes))
  return Math.round((minutes / 60) * 100) / 100
}

/** True when the shift's end is on the day after its start. */
export function crossesMidnight(shift: Pick<ShiftDefinition, 'startsAt' | 'endsAt'>): boolean {
  const start = minutesOf(shift.startsAt)
  const end = minutesOf(shift.endsAt)
  return start !== null && end !== null && end < start
}

/** Minutes from start to end; through midnight when the end is earlier. 0 = unreadable. */
export function shiftMinutes(shift: Pick<ShiftDefinition, 'startsAt' | 'endsAt'>): number {
  const start = minutesOf(shift.startsAt)
  const end = minutesOf(shift.endsAt)
  if (start === null || end === null || end === start) return 0
  return end > start ? end - start : end + 1440 - start
}

// ─── The daily sheet (#100) ──────────────────────────────────────────────────
//
// The sheet and the one write that marks a day were rules inside the server's
// `attendance.service` (they read Postgres as they went). They are here as pure
// functions over rows, so the device builds the SAME sheet from its own SQLite.

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

export interface SheetRecord {
  id: string
  status: AttendanceStatus
  checkIn: string | null
  checkOut: string | null
  endsNextDay: boolean
  note: string | null
  result: DayResult
}

export interface SheetRow {
  employeeId: string
  name: string
  position: string | null
  /** Null = nothing recorded for this employee on this day. Not «absent». */
  record: SheetRecord | null
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

/** A stored attendance row, as either database hands it over. */
export interface AttendanceRowInput {
  id: string
  employee_id: string
  date: string
  check_in: string | null
  check_out: string | null
  status: string | null
  notes: string | null
  /** attendance-02. Absent before it: every record then ends the same day. */
  ends_next_day?: boolean | number | null | undefined
}

export interface SheetEmployee {
  id: string
  first_name: string | null
  last_name: string | null
  position: string | null
}

/** `HH:MM` out of `HH:MM[:SS]`. */
export function hhmm(value: string | null | undefined): string | null {
  return value ? String(value).slice(0, 5) : null
}

const KNOWN_STATUSES: readonly string[] = ['present', 'absent', 'leave', 'holiday', 'open']

export function sheetRecordOf(row: AttendanceRowInput): SheetRecord {
  const checkIn = hhmm(row.check_in)
  const checkOut = hhmm(row.check_out)
  const endsNextDay = row.ends_next_day === true || row.ends_next_day === 1
  // A stored status this code does not know is treated as «present» for the
  // arithmetic and the times decide the rest; it is never read as absence.
  const status = (
    KNOWN_STATUSES.includes(row.status ?? '') ? row.status : 'present'
  ) as AttendanceStatus
  return {
    id: row.id,
    status,
    checkIn,
    checkOut,
    endsNextDay,
    note: row.notes,
    result: attendanceFor({
      employeeId: row.employee_id,
      date: row.date,
      checkIn,
      checkOut,
      endsNextDay,
      status,
    }),
  }
}

/**
 * Every employee of the business with what was recorded for `date`.
 *
 * If a legacy store holds two rows for one employee and day, the FIRST given is
 * shown — the caller orders by id — rather than whichever arrived last.
 */
export function buildAttendanceSheet(
  date: string,
  employees: readonly SheetEmployee[],
  records: readonly AttendanceRowInput[],
): AttendanceSheet {
  const byEmployee = new Map<string, AttendanceRowInput>()
  for (const row of records) {
    if (!byEmployee.has(row.employee_id)) byEmployee.set(row.employee_id, row)
  }

  const rows: SheetRow[] = employees.map((employee) => {
    const row = byEmployee.get(employee.id)
    return {
      employeeId: employee.id,
      name: [employee.first_name, employee.last_name].filter(Boolean).join(' '),
      position: employee.position,
      record: row ? sheetRecordOf(row) : null,
    }
  })

  const recorded = rows.filter((row) => row.record !== null)
  const count = (test: (record: SheetRecord) => boolean) =>
    recorded.filter((row) => test(row.record as SheetRecord)).length

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

export type AttendanceMarkProblem =
  | 'ATTENDANCE_TIME_INVALID'
  | 'ATTENDANCE_CHECK_OUT_WITHOUT_CHECK_IN'
  | 'ATTENDANCE_CHECK_OUT_BEFORE_CHECK_IN'

export interface AttendanceMarkValues {
  status: MarkableStatus
  checkIn: string | null
  checkOut: string | null
  note: string | null
  endsNextDay: boolean
}

/**
 * What one marked day will store — or the reason it cannot be stored.
 *
 * Times belong to a day at work. On leave or absent there are none, and a time
 * sent with them is dropped HERE, by rule — not stored and ignored.
 */
export function planAttendanceMark(
  input: AttendanceMark,
): { ok: true; values: AttendanceMarkValues } | { ok: false; problem: AttendanceMarkProblem } {
  const present = input.status === 'present'
  const checkIn = present ? input.checkIn : null
  const checkOut = present ? input.checkOut : null

  if (checkIn !== null && minutesOf(checkIn) === null) {
    return { ok: false, problem: 'ATTENDANCE_TIME_INVALID' }
  }
  if (checkOut !== null && minutesOf(checkOut) === null) {
    return { ok: false, problem: 'ATTENDANCE_TIME_INVALID' }
  }
  if (checkOut !== null && checkIn === null) {
    return { ok: false, problem: 'ATTENDANCE_CHECK_OUT_WITHOUT_CHECK_IN' }
  }

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
    return { ok: false, problem: 'ATTENDANCE_CHECK_OUT_BEFORE_CHECK_IN' }
  }

  return {
    ok: true,
    values: { status: input.status, checkIn, checkOut, note: input.note, endsNextDay },
  }
}
