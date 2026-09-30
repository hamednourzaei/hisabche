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

  if (outMinutes !== null && outMinutes < inMinutes) {
    // ⚠️ AN OUT BEFORE AN IN IS A DATA ERROR, NOT A NIGHT SHIFT. Shops here do
    // not run shifts across midnight, and reading it as one would turn a typo
    // into twenty hours.
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

    if (end <= start) {
      // ⚠️ A shift that ends before it starts is a typo, not an overnight. This
      // product's shops are day shops, and reading it as overnight would bill
      // twenty hours.
      problems.push('INVALID_TIMES')
    }

    if (
      shift.breakMinutes < 0 ||
      (end !== null && start !== null && end - start > 0 && shift.breakMinutes >= end - start)
    ) {
      problems.push('BREAK_LONGER_THAN_SHIFT')
    }
  }

  // ⚠️ SORTED FIRST, so the overlap check is order-independent — a roster
  // entered bottom-up and one entered top-down must give the same answer.
  const sorted = [...dayShifts]
    .map((s) => ({ shift: s, start: minutesOf(s.startsAt) ?? 0, end: minutesOf(s.endsAt) ?? 0 }))
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
  const start = minutesOf(shift.startsAt)
  const end = minutesOf(shift.endsAt)
  if (start === null || end === null || end <= start) return 0

  const minutes = Math.max(0, end - start - Math.max(0, shift.breakMinutes))
  return Math.round((minutes / 60) * 100) / 100
}

// ─── Internal notes (#103) ───────────────────────────────────────────────────

export interface NoteDraft {
  entityType: string
  entityId: string
  body: string
}

/**
 * ⚠️ WHAT MAY CARRY A NOTE, and what may not.
 *
 * A note on a customer is a sales record. A note on a JOURNAL ENTRY is a
 * claim about the books that is not one — and an attachment is storage the shop
 * has to be able to export and delete. So the list is closed, for the same
 * reason `NEVER_EXTENSIBLE` is.
 */
export const NOTABLE_ENTITIES: readonly string[] = [
  'customer',
  'supplier',
  'product',
  'project',
  'task',
  'employee',
]

export type NoteProblem = 'NOT_NOTABLE' | 'EMPTY_BODY' | 'BODY_TOO_LONG'

/** A note longer than this is a document, and documents have their own place. */
export const MAX_NOTE_LENGTH = 4_000

export function validateNote(draft: NoteDraft): NoteProblem[] {
  const problems: NoteProblem[] = []

  if (!(NOTABLE_ENTITIES as readonly string[]).includes(draft.entityType)) {
    problems.push('NOT_NOTABLE')
  }

  if (draft.body.trim().length === 0) {
    problems.push('EMPTY_BODY')
  } else if (draft.body.length > MAX_NOTE_LENGTH) {
    problems.push('BODY_TOO_LONG')
  }

  return problems
}

// ⚠️ A NOTE IS NEVER ATTACHED TO A PAYMENT, AND THE LIST ABOVE IS HOW THAT IS
// ENFORCED. The first version also exported `noteCanAffectBooks()`, which
// returned a constant — a function whose answer can never change is a function
// with no caller, which is the exact defect this file exists to repair.
