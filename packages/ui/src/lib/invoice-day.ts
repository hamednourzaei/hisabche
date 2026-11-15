// ============================================
// packages/ui/src/lib/invoice-day.ts
//
// A document's date is a CALENDAR DAY. It travels as that day at UTC midnight
// (`YYYY-MM-DDT00:00:00.000Z`) so that `slice(0, 10)` anywhere reads the same day.
//
// The builder used to send the chosen day as LOCAL midnight; in Kabul that is 19:30Z the day
// before, and the server posted every such invoice to the previous day (browser journeys,
// 14 Nov 2026). The server now also reads instants in the business zone (documentDayOf).
// ============================================

import { toIsoDay } from '@hisabche/formatting'

const CALENDAR_DAY = /^(\d{4}-\d{2}-\d{2})(?:T00:00(?::00(?:\.0+)?)?(?:Z|\+00:00))?$/

/** 'YYYY-MM-DD' (from the date picker) → the value a document stores. */
export function dayToDocumentDate(day: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? `${day}T00:00:00.000Z` : null
}

/** A stored document date → 'YYYY-MM-DD' for the picker. Older instants read in this device's day. */
export function documentDateToDay(value: string | null | undefined): string {
  if (!value) return ''
  const day = CALENDAR_DAY.exec(value)
  if (day?.[1]) return day[1]
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : toIsoDay(parsed)
}

/** Today on this device, as a document date. */
export function todayDocumentDate(): string {
  return `${toIsoDay(new Date())}T00:00:00.000Z`
}
