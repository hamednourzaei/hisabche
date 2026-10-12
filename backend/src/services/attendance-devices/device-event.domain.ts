// ============================================
// backend/src/services/attendance-devices/device-event.domain.ts
//
// What a terminal (or the small program beside it) sends, turned into the one
// shape the database function takes. Pure: no clock of its own, no I/O.
//
// THE WIRE — the «generic» format, the only one there is until a brand's own
// format has been proven against a real device:
//
//   POST /api/public/attendance-devices/events        X-Device-Key: hsd_…
//   { "cursor": "…optional, opaque…",
//     "events": [ { "id": "184467",            ← the device's own id, if it has one
//                   "userId": "182",            ← the number of the person ON THE DEVICE
//                   "at": "2026-10-12T08:03:10",← wall clock where the device is…
//                   "direction": "in",          ← in | out | (absent = unknown)
//                   "method": "FINGERPRINT" } ] }
//   An empty `events` is a heartbeat.
//
// ⚠️ `at` WITHOUT AN OFFSET IS THE DEVICE'S OWN WALL CLOCK. Most terminals keep
// local time and say nothing about a zone; that reading is taken as written,
// in the zone the business set for the device. With an offset or `Z` it is an
// instant, and is converted to that zone. Nothing is ever read in the
// server's zone.
// ⚠️ NO BIOMETRIC DATA, EVER. An event that carries a template, an image or
// anything like one is refused whole — «who, when» is all this system keeps.
// ⚠️ A number we cannot read is refused, not rounded: 25:00, the 31st of
// February and a time with a 61st second are errors in the sender.
// ============================================

import { createHash } from 'node:crypto'

export const DEVICE_METHODS = [
  'FINGERPRINT',
  'FACE',
  'CARD',
  'PIN',
  'QR',
  'PALM',
  'IRIS',
  'PASSWORD',
  'UNKNOWN',
] as const
export type DeviceMethod = (typeof DEVICE_METHODS)[number]

export const DEVICE_DIRECTIONS = ['in', 'out', 'unknown'] as const
export type DeviceDirection = (typeof DEVICE_DIRECTIONS)[number]

/** One request. A terminal that has been offline for a week sends several. */
export const MAX_EVENTS_PER_BATCH = 500
/** The whole event, as JSON. Anything larger is not «who, when». */
export const MAX_EVENT_BYTES = 2_000
/** How far ahead of the workplace's «today» a reading may claim to be. */
export const MAX_DAYS_AHEAD = 1

export type DeviceEventProblem =
  | 'DEVICE_EVENTS_NOT_A_LIST'
  | 'DEVICE_EVENTS_TOO_MANY'
  | 'DEVICE_EVENT_NOT_AN_OBJECT'
  | 'DEVICE_EVENT_TOO_LARGE'
  | 'DEVICE_BIOMETRIC_DATA_REFUSED'
  | 'DEVICE_EVENT_USER_MISSING'
  | 'DEVICE_EVENT_TIME_INVALID'
  | 'DEVICE_EVENT_IN_FUTURE'
  | 'DEVICE_EVENT_DIRECTION_INVALID'
  | 'DEVICE_EVENT_METHOD_INVALID'
  | 'DEVICE_EVENT_ID_INVALID'

export class DeviceEventError extends Error {
  constructor(
    readonly code: DeviceEventProblem,
    /** Which event of the batch, counted from 0. Null = the batch itself. */
    readonly index: number | null,
  ) {
    super(code)
    this.name = 'DeviceEventError'
  }
}

/** The row `attendance_device_ingest` reads with jsonb_to_recordset. */
export interface NormalizedDeviceEvent {
  raw_id: string
  user_id: string
  day: string
  at: string
  direction: DeviceDirection
  method: DeviceMethod
  payload: Record<string, unknown>
}

// A key that names what is never kept. Matched on the key, at any depth.
const BIOMETRIC_KEY =
  /(template|biometric|fingerprint_?data|face_?data|iris_?data|palm_?data|minutiae|image|photo|picture|snapshot)/i

function carriesBiometricData(value: unknown, depth = 0): boolean {
  if (depth > 6 || value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.some((item) => carriesBiometricData(item, depth + 1))
  return Object.entries(value as Record<string, unknown>).some(
    ([key, inner]) => BIOMETRIC_KEY.test(key) || carriesBiometricData(inner, depth + 1),
  )
}

const pad = (value: number) => String(value).padStart(2, '0')

/** A real calendar day and a real time of day, or null. */
function wallClock(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): { day: string; at: string } | null {
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  if (hour > 23 || minute > 59 || second > 59) return null
  return {
    day: `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`,
    at: `${pad(hour)}:${pad(minute)}:${pad(second)}`,
  }
}

/** The calendar day and clock time it is in `timeZone` at `instant`. */
export function wallClockIn(timeZone: string, instant: Date): { day: string; at: string } {
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
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return {
    day: `${read('year')}-${read('month')}-${read('day')}`,
    at: `${read('hour')}:${read('minute')}:${read('second')}`,
  }
}

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d{1,6})?$/
const INSTANT =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d{1,6})?(Z|[+-]\d{2}:?\d{2})$/

/**
 * `at` as a day and a time in the device's zone. A reading with no offset is
 * the device's own wall clock; one with an offset is an instant.
 */
export function readEventTime(
  value: unknown,
  timeZone: string,
): { day: string; at: string } | null {
  if (typeof value !== 'string') return null
  const text = value.trim()

  const local = LOCAL.exec(text)
  if (local) {
    return wallClock(
      Number(local[1]),
      Number(local[2]),
      Number(local[3]),
      Number(local[4]),
      Number(local[5]),
      Number(local[6] ?? 0),
    )
  }

  const instant = INSTANT.exec(text)
  if (!instant) return null
  // The written parts must be a real moment before the offset is applied.
  if (
    !wallClock(
      Number(instant[1]),
      Number(instant[2]),
      Number(instant[3]),
      Number(instant[4]),
      Number(instant[5]),
      Number(instant[6] ?? 0),
    )
  ) {
    return null
  }
  const offset = instant[7] === 'Z' ? 'Z' : `${instant[7]!.slice(0, 3)}:${instant[7]!.slice(-2)}`
  const millis = Date.parse(
    `${instant[1]}-${instant[2]}-${instant[3]}T${instant[4]}:${instant[5]}:${instant[6] ?? '00'}${offset}`,
  )
  return Number.isNaN(millis) ? null : wallClockIn(timeZone, new Date(millis))
}

const addDays = (isoDay: string, days: number) => {
  const [year, month, day] = isoDay.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/**
 * The whole batch, or the first thing wrong with it. One bad event refuses the
 * batch: a sender that is told «event 37 has no user» can fix itself; a sender
 * whose event 37 silently vanished cannot.
 */
export function normalizeGenericBatch(
  events: unknown,
  context: { timeZone: string; now: Date },
): NormalizedDeviceEvent[] {
  if (!Array.isArray(events)) throw new DeviceEventError('DEVICE_EVENTS_NOT_A_LIST', null)
  if (events.length > MAX_EVENTS_PER_BATCH)
    throw new DeviceEventError('DEVICE_EVENTS_TOO_MANY', null)

  const latestDay = addDays(wallClockIn(context.timeZone, context.now).day, MAX_DAYS_AHEAD)

  return events.map((raw, index) => {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new DeviceEventError('DEVICE_EVENT_NOT_AN_OBJECT', index)
    }
    const event = raw as Record<string, unknown>
    if (JSON.stringify(event).length > MAX_EVENT_BYTES) {
      throw new DeviceEventError('DEVICE_EVENT_TOO_LARGE', index)
    }
    if (carriesBiometricData(event)) {
      throw new DeviceEventError('DEVICE_BIOMETRIC_DATA_REFUSED', index)
    }

    // Numbers are accepted for the id fields: many terminals send them so.
    const userId =
      typeof event.userId === 'number' && Number.isFinite(event.userId)
        ? String(event.userId)
        : typeof event.userId === 'string'
          ? event.userId.trim()
          : ''
    if (userId.length === 0 || userId.length > 64) {
      throw new DeviceEventError('DEVICE_EVENT_USER_MISSING', index)
    }

    const when = readEventTime(event.at, context.timeZone)
    if (!when) throw new DeviceEventError('DEVICE_EVENT_TIME_INVALID', index)
    // A terminal whose clock is set to next year would fill days that have not
    // happened. Its clock is the thing to fix.
    if (when.day > latestDay) throw new DeviceEventError('DEVICE_EVENT_IN_FUTURE', index)

    const direction =
      event.direction === undefined || event.direction === null ? 'unknown' : event.direction
    if (!(DEVICE_DIRECTIONS as readonly unknown[]).includes(direction)) {
      throw new DeviceEventError('DEVICE_EVENT_DIRECTION_INVALID', index)
    }

    const method =
      event.method === undefined || event.method === null
        ? 'UNKNOWN'
        : typeof event.method === 'string'
          ? event.method.trim().toUpperCase()
          : event.method
    if (!(DEVICE_METHODS as readonly unknown[]).includes(method)) {
      throw new DeviceEventError('DEVICE_EVENT_METHOD_INVALID', index)
    }

    let rawId: string
    if (event.id === undefined || event.id === null || event.id === '') {
      // No id of its own: the event IS its content. Sent again, it is the same.
      rawId = `h:${createHash('sha256')
        .update(`${userId}|${when.day}|${when.at}|${String(direction)}`)
        .digest('hex')}`
    } else if (typeof event.id === 'number' && Number.isFinite(event.id)) {
      rawId = String(event.id)
    } else if (typeof event.id === 'string' && event.id.trim().length > 0) {
      rawId = event.id.trim()
    } else {
      throw new DeviceEventError('DEVICE_EVENT_ID_INVALID', index)
    }
    if (rawId.length > 128) throw new DeviceEventError('DEVICE_EVENT_ID_INVALID', index)

    return {
      raw_id: rawId,
      user_id: userId,
      day: when.day,
      at: when.at,
      direction: direction as DeviceDirection,
      method: method as DeviceMethod,
      payload: event,
    }
  })
}

/** A device key: `hsd_` and 256 random bits, hex. Stored only as its hash. */
export const DEVICE_KEY_SHAPE = /^hsd_[0-9a-f]{64}$/
export const hashDeviceKey = (key: string) => createHash('sha256').update(key).digest('hex')

export type DeviceHealth = 'never' | 'online' | 'silent'
/** Longer than this without a word and the device is «silent». */
export const DEVICE_SILENT_AFTER_MS = 15 * 60_000

export function deviceHealth(lastSeenAt: string | null, now: Date): DeviceHealth {
  if (!lastSeenAt) return 'never'
  return now.getTime() - new Date(lastSeenAt).getTime() <= DEVICE_SILENT_AFTER_MS
    ? 'online'
    : 'silent'
}
