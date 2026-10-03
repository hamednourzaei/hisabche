// ============================================
// backend/src/utils/local-day.ts
//
// Where «today» starts — in the place the business is, not on the server.
//
// The server runs in UTC. «Today's sales» was cut at UTC midnight, which is
// 03:30 in Tehran and 04:30 in Kabul: a sale made at 01:00 at night was
// counted as YESTERDAY's, and the dashboard showed 3,000,000 for a day that
// had 128,000,000 (reported 27 Sep 2026, BUG-087).
//
// The zone comes from the person's device (an IANA name) and is VALIDATED
// here; an absent or unknown one falls back to an explicit default rather
// than to the server's zone (G4: every setting has a stated default).
// ============================================

/** The default when the caller names no zone, or one this runtime does not know. */
export const DEFAULT_BUSINESS_TIME_ZONE = 'Asia/Tehran'

/** A zone the runtime knows, or the default. Never throws. */
export function resolveTimeZone(input: unknown): string {
  if (typeof input !== 'string' || input.length === 0 || input.length > 64) {
    return DEFAULT_BUSINESS_TIME_ZONE
  }
  try {
    // Throws RangeError for an unknown zone.
    new Intl.DateTimeFormat('en-US', { timeZone: input })
    return input
  } catch {
    return DEFAULT_BUSINESS_TIME_ZONE
  }
}

/** The calendar date (y, m, d) and clock time it is in `timeZone` at `instant`. */
function partsIn(timeZone: string, instant: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    calendar: 'gregory',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  }
}

/** How far `timeZone` is ahead of UTC at `instant`, in milliseconds. */
function offsetMs(timeZone: string, instant: Date): number {
  const p = partsIn(timeZone, instant)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/**
 * The instant the current day began in `timeZone`, as an ISO string in UTC.
 * At 01:00 in Tehran on the 27th this is the 26th at 20:30Z.
 */
export function startOfLocalDayISO(timeZone: string, now: Date = new Date()): string {
  const today = partsIn(timeZone, now)
  const midnightAsUtc = Date.UTC(today.year, today.month - 1, today.day)
  // The offset at midnight may differ from the offset now (a DST change
  // during the day); one correction settles it.
  const guess = new Date(midnightAsUtc - offsetMs(timeZone, now))
  return new Date(midnightAsUtc - offsetMs(timeZone, guess)).toISOString()
}
