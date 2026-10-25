// ============================================
// packages/validation/src/schemas/attendance-bodies.ts
//
// The request bodies of the attendance sheet, the shift definitions and the
// shift plan — one definition for the server's routes and the offline engine's,
// so a body the server accepts is a body the device accepts, and the reverse.
// ============================================

import { z } from 'zod'
import { MARKABLE_STATUSES } from './attendance-rules'
import { MAX_ASSIGNMENT_DAYS } from './shift-plan'

export const attendanceIsoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** `HH:MM`, the shop's own local time. */
const clock = z.string().regex(/^[0-9]{1,2}:[0-9]{2}$/)
const optionalClock = z
  .string()
  .regex(/^\d{1,2}:\d{2}$/)
  .nullable()
  .default(null)

export const attendanceSheetQuerySchema = z.object({ date: attendanceIsoDay })

export const attendanceMarkBodySchema = z.object({
  employeeId: z.string().uuid(),
  date: attendanceIsoDay,
  status: z.enum(MARKABLE_STATUSES),
  checkIn: optionalClock,
  checkOut: optionalClock,
  endsNextDay: z.boolean().default(false),
  note: z.string().trim().max(500).nullable().default(null),
})

export const createShiftBodySchema = z.object({
  name: z.string().trim().min(1).max(60),
  startsAt: clock,
  endsAt: clock,
  breakMinutes: z.number().int().min(0).max(600).default(0),
})

export const setShiftActiveBodySchema = z.object({ isActive: z.boolean() })

export const assignShiftBodySchema = z.object({
  employeeId: z.string().uuid(),
  shiftId: z.string().uuid(),
  fromDate: attendanceIsoDay,
  days: z.number().int().min(1).max(MAX_ASSIGNMENT_DAYS).default(1),
})
