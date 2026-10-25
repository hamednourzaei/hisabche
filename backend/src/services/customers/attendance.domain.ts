// ============================================
// backend/src/services/customers/attendance.domain.ts
//
// Attendance and shift rules (#100, #101) now live in `@hisabche/validation`
// (schemas/attendance-rules.ts) so the offline engine applies the SAME rule as
// the server instead of a copy of it. This file keeps the old import path
// working and still owns the internal-notes rules (#103).
// ============================================

export {
  MAX_SHIFTS_PER_DAY,
  attendanceFor,
  crossesMidnight,
  minutesOf,
  payableHours,
  shiftMinutes,
  validateShifts,
  type AttendanceDay,
  type AttendanceStatus,
  type CoverageProblem,
  type DayResult,
  type ShiftDefinition,
} from '@hisabche/validation'

// ─── Internal notes (#103) ───────────────────────────────────────────────────
// The rule moved to `@hisabche/validation` (schemas/note-rules.ts): the offline
// engine applies the SAME rule. Re-exported so the import path keeps working.

export {
  MAX_NOTE_LENGTH,
  NOTABLE_ENTITIES,
  validateNote,
  type NoteDraft,
  type NoteProblem,
} from '@hisabche/validation'
