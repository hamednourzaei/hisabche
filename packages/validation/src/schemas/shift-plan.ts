// ============================================
// packages/validation/src/schemas/shift-plan.ts
//
// Capability #101 — who is planned for which shift on which day.
//
// An assignment is a PLAN. What happened is the attendance sheet's, and the two
// are shown side by side without ever turning one into the other:
//
//   planned, and a day recorded as worked   → `worked` (or `open`)
//   planned, and a day recorded as absent   → `absent`
//   planned, and nothing recorded           → `unrecorded` — NOT «absent»
//
// These were rules inside the server's `shift-assignment.service`; they are
// pure functions here so the offline engine plans and reads the SAME way.
// ============================================

/** The most days one request may plan. */
export const MAX_ASSIGNMENT_DAYS = 31

/** What the attendance sheet says about a planned day. */
export type ActualState = 'worked' | 'open' | 'absent' | 'leave' | 'unrecorded'

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

export function summarizeDayPlan(date: string, assignments: PlannedShift[]): DayPlan {
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

/**
 * Two planned shifts of ONE person on ONE day overlap. The same comparison the
 * server's trigger makes (`other.starts_at < NEW.ends_at AND NEW.starts_at <
 * other.ends_at`, docs/shift-assignments-01-migration.sql) — a shop day is read
 * as `HH:MM` on a single calendar day, so a string comparison is exact.
 */
export function shiftAssignmentsOverlap(
  a: { startsAt: string; endsAt: string },
  b: { startsAt: string; endsAt: string },
): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt
}
