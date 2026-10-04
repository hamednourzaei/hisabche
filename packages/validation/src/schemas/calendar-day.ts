// ============================================
// packages/validation/src/schemas/calendar-day.ts
//
// «The same day every month» — in WHICH calendar.
//
// A shop in Tehran or Kabul keeps its months in the solar Hijri calendar. «هر
// ماه، روز اول» means the 1st of Mehr, Aban, Azar — which fall on the 23rd, the
// 23rd and the 22nd of Gregorian months. A schedule that counted Gregorian days
// would issue that shop's rent invoice eight or nine days late, every month,
// and close its books across the middle of two of its own months.
//
// So a monthly rule names its calendar, and these three functions are the only
// place a calendar day is derived from an ISO day. Pure, no dependency: the
// server (when a slot is due) and the screen (which day an invoice falls on)
// both call them, so they cannot disagree.
//
// ⚠️ The ISO day is read AS A UTC DAY. It is a calendar date, not an instant;
// formatting it in a local zone would move it across midnight for half the
// world.
// ============================================

export const SCHEDULE_CALENDARS = ['gregory', 'persian'] as const
export type ScheduleCalendar = (typeof SCHEDULE_CALENDARS)[number]

export interface CalendarDay {
  year: number
  month: number
  day: number
}

const formatters = new Map<ScheduleCalendar, Intl.DateTimeFormat>()

function formatter(calendar: ScheduleCalendar): Intl.DateTimeFormat {
  let found = formatters.get(calendar)
  if (!found) {
    // Latin digits and a fixed locale: the output is parsed, never shown.
    found = new Intl.DateTimeFormat(`en-u-ca-${calendar}-nu-latn`, {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })
    formatters.set(calendar, found)
  }
  return found
}

function utcDate(isoDay: string): Date {
  const [year, month, day] = isoDay.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(year as number, (month as number) - 1, day as number))
}

/** `days` after an ISO day, as an ISO day. Built from a Date, never by string maths. */
export function addIsoDays(isoDay: string, days: number): string {
  const date = utcDate(isoDay)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** The year, month and day of an ISO day in the given calendar. */
export function calendarDay(isoDay: string, calendar: ScheduleCalendar): CalendarDay {
  if (calendar === 'gregory') {
    const [year, month, day] = isoDay.slice(0, 10).split('-').map(Number)
    return { year: year as number, month: month as number, day: day as number }
  }
  const parts = formatter(calendar).formatToParts(utcDate(isoDay))
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  return { year: read('year'), month: read('month'), day: read('day') }
}

/** True when the next day is the 1st of a month in that calendar. */
export function isLastDayOfMonth(isoDay: string, calendar: ScheduleCalendar): boolean {
  return calendarDay(addIsoDays(isoDay, 1), calendar).day === 1
}

/**
 * Is `isoDay` the monthly slot for «day N of every month» in that calendar?
 *
 * ⚠️ A SHORT MONTH CLAMPS, IT DOES NOT SKIP. «The 31st» is the last day of a
 * 30-day month — otherwise a month-end rule would silently miss several months
 * a year (and, in the solar Hijri calendar, every month of the second half).
 */
export function isMonthlySlot(
  isoDay: string,
  dayOfMonth: number,
  calendar: ScheduleCalendar,
): boolean {
  const { day } = calendarDay(isoDay, calendar)
  if (day === dayOfMonth) return true
  return dayOfMonth > day && isLastDayOfMonth(isoDay, calendar)
}

/**
 * The first and last ISO day of the calendar month that CONTAINS `isoDay`.
 * Walks at most 31 days each way, so it holds for any calendar `Intl` knows.
 */
export function monthBounds(
  isoDay: string,
  calendar: ScheduleCalendar,
): { from: string; to: string; month: number; year: number } {
  const { day, month, year } = calendarDay(isoDay, calendar)
  const from = addIsoDays(isoDay, -(day - 1))
  let to = isoDay.slice(0, 10)
  for (let guard = 0; guard < 31 && !isLastDayOfMonth(to, calendar); guard += 1) {
    to = addIsoDays(to, 1)
  }
  return { from, to, month, year }
}
