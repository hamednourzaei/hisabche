// ============================================
// packages/validation/src/schemas/resource-capacity.ts
//
// V60 Slice 7 — Generalized Resource & Capacity rules (one engine for salon
// rooms/chairs, clinic slots, tables, rentals, vehicles, machines, courts).
// Shared across backend, local-engine and UI: no duplicated overlap math.
// ============================================

import { z } from 'zod'
import { RESOURCE_KINDS } from './salon'

export const BOOKING_SOURCE_TYPES = [
  'session',
  'appointment',
  'rental',
  'table',
  'maintenance',
] as const
export type BookingSourceType = (typeof BOOKING_SOURCE_TYPES)[number]

export const BOOKING_STATUSES = ['active', 'released', 'cancelled'] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]

export interface TimeRange {
  readonly startAt: string
  readonly endAt: string
}

export interface UtilizationMetrics {
  readonly bookedMinutes: number
  readonly totalMinutes: number
  /** Null when window duration <= 0 (unknown is never invented as zero). */
  readonly ratio: number | null
}

const toMs = (iso: string): number | null => {
  const n = Date.parse(iso)
  return Number.isFinite(n) ? n : null
}

/**
 * Half-open interval overlap check: [aStart, aEnd) ∩ [bStart, bEnd) !== ∅
 * Adjacent bookings (one ends exactly when the next begins) do NOT overlap.
 */
export function overlaps(a: TimeRange, b: TimeRange): boolean {
  const aStart = toMs(a.startAt)
  const aEnd = toMs(a.endAt)
  const bStart = toMs(b.startAt)
  const bEnd = toMs(b.endAt)
  if (aStart === null || aEnd === null || bStart === null || bEnd === null) return false
  if (aEnd <= aStart || bEnd <= bStart) return false
  return aStart < bEnd && bStart < aEnd
}

/** Generates non-overlapping free slots of `slotMinutes` within `window`. */
export function freeSlots(
  window: TimeRange,
  busyIntervals: readonly TimeRange[],
  slotMinutes: number,
  stepMinutes: number = slotMinutes,
): TimeRange[] {
  const winStart = toMs(window.startAt)
  const winEnd = toMs(window.endAt)
  if (
    winStart === null ||
    winEnd === null ||
    winEnd <= winStart ||
    !Number.isFinite(slotMinutes) ||
    slotMinutes <= 0 ||
    !Number.isFinite(stepMinutes) ||
    stepMinutes <= 0
  ) {
    return []
  }

  const slotMs = Math.round(slotMinutes * 60_000)
  const stepMs = Math.round(stepMinutes * 60_000)
  const slots: TimeRange[] = []

  for (let cursor = winStart; cursor + slotMs <= winEnd; cursor += stepMs) {
    const candidate: TimeRange = {
      startAt: new Date(cursor).toISOString(),
      endAt: new Date(cursor + slotMs).toISOString(),
    }
    if (!busyIntervals.some((busy) => overlaps(candidate, busy))) {
      slots.push(candidate)
    }
  }
  return slots
}

/** Computes booked minutes and utilization ratio across merged intervals within `window`. */
export function utilization(
  window: TimeRange,
  busyIntervals: readonly TimeRange[],
): UtilizationMetrics {
  const winStart = toMs(window.startAt)
  const winEnd = toMs(window.endAt)
  if (winStart === null || winEnd === null || winEnd <= winStart) {
    return { bookedMinutes: 0, totalMinutes: 0, ratio: null }
  }

  const clipped = busyIntervals
    .map((b) => {
      const s = toMs(b.startAt)
      const e = toMs(b.endAt)
      if (s === null || e === null) return null
      const cs = Math.max(winStart, s)
      const ce = Math.min(winEnd, e)
      return ce > cs ? ([cs, ce] as const) : null
    })
    .filter((pair): pair is readonly [number, number] => pair !== null)
    .sort((a, b) => a[0] - b[0])

  let bookedMs = 0
  let curStart: number | null = null
  let curEnd: number | null = null

  for (const [s, e] of clipped) {
    if (curStart === null || curEnd === null) {
      curStart = s
      curEnd = e
    } else if (s <= curEnd) {
      curEnd = Math.max(curEnd, e)
    } else {
      bookedMs += curEnd - curStart
      curStart = s
      curEnd = e
    }
  }
  if (curStart !== null && curEnd !== null) {
    bookedMs += curEnd - curStart
  }

  const totalMinutes = (winEnd - winStart) / 60_000
  const bookedMinutes = bookedMs / 60_000
  return {
    bookedMinutes,
    totalMinutes,
    ratio: totalMinutes > 0 ? bookedMinutes / totalMinutes : null,
  }
}

export const resourceBookingCreateSchema = z
  .object({
    resourceId: z.string().uuid(),
    startAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
    endAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
    sourceType: z.enum(BOOKING_SOURCE_TYPES).default('session'),
    sourceId: z.string().uuid().optional(),
    notes: z.string().trim().max(300).optional(),
  })
  .strict()
  .refine(
    (v) => {
      const s = Date.parse(v.startAt)
      const e = Date.parse(v.endAt)
      return Number.isFinite(s) && Number.isFinite(e) && e > s
    },
    { message: 'INVALID_BOOKING_RANGE', path: ['endAt'] },
  )

export type ResourceBookingCreateInput = z.infer<typeof resourceBookingCreateSchema>

export const generalizedResourceKindEnum = z.enum(RESOURCE_KINDS)
