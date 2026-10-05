// ============================================
// The automatic month-end at a chosen day and time.
//
// What can go wrong: a timed automation running BEFORE its time; running in
// both the daily and the five-minute pass; the «checked» day moving backwards;
// a run on the 15th closing the month that is still open; an unknown time zone
// never running; a start date in the past closing months on creation.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  evaluationDay,
  isTimed,
  localClock,
  type ScheduleCadence,
} from '../services/automation/schedule.domain'

const SRC = join(__dirname, '..')
const code = (path: string) =>
  readFileSync(join(SRC, path), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n')

// 18:30 in Kabul (UTC+4:30, no DST) is 14:00 UTC.
const timed: ScheduleCadence = {
  kind: 'monthly',
  dayOfMonth: 5,
  from: '2026-10-01',
  atMinute: 18 * 60 + 30,
  timeZone: 'Asia/Kabul',
}
const daily: ScheduleCadence = { kind: 'monthly', dayOfMonth: 1, from: '2026-10-01' }

describe('the day a cadence is evaluated for', () => {
  it('a cadence with no time is evaluated for the UTC day, as always', () => {
    expect(isTimed(daily)).toBe(false)
    expect(evaluationDay(daily, '2026-10-05', new Date('2026-10-05T00:30:00Z'))).toBe('2026-10-05')
  })

  it('before its minute, «today» has not happened yet', () => {
    expect(isTimed(timed)).toBe(true)
    // 13:59 UTC = 18:29 in Kabul on the 5th.
    expect(evaluationDay(timed, '2026-10-05', new Date('2026-10-05T13:59:00Z'))).toBe('2026-10-04')
  })

  it('from its minute on, it is today — exactly on the minute counts', () => {
    expect(evaluationDay(timed, '2026-10-05', new Date('2026-10-05T14:00:00Z'))).toBe('2026-10-05')
    expect(evaluationDay(timed, '2026-10-05', new Date('2026-10-05T19:00:00Z'))).toBe('2026-10-05')
  })

  it('uses the LOCAL day, which can be ahead of the UTC day', () => {
    // 20:00 UTC on the 4th is 00:30 on the 5th in Kabul — before 18:30 there.
    expect(evaluationDay(timed, '2026-10-04', new Date('2026-10-04T20:00:00Z'))).toBe('2026-10-04')
    expect(localClock('Asia/Kabul', new Date('2026-10-04T20:00:00Z'))).toEqual({
      day: '2026-10-05',
      minute: 30,
    })
  })

  it('an unknown zone falls back to the UTC day rather than never running', () => {
    const lost: ScheduleCadence = { ...timed, timeZone: 'Nowhere/Nothing' }
    expect(localClock('Nowhere/Nothing', new Date())).toBeNull()
    expect(evaluationDay(lost, '2026-10-05', new Date('2026-10-05T00:30:00Z'))).toBe('2026-10-05')
  })
})

describe('the two passes', () => {
  const service = code('services/automation/automation.service.ts')
  const scheduler = code('scheduler/index.ts')

  it('are disjoint: an automation is in exactly one of them', () => {
    expect(service).toContain('if (isTimed(cadence) !== (options.timed ?? false)) continue')
    expect(scheduler).toContain('timed: true,')
    expect(scheduler).toContain(
      "runScheduledOnce('automation-timed', slotOf(TIMED_AUTOMATION_SECONDS, now)",
    )
    expect(scheduler).toContain("'*/5 * * * *'")
  })

  it('the «checked» day never moves backwards', () => {
    expect(service).toContain('if (!row.last_checked_on || day > row.last_checked_on) {')
    expect(service).toContain('.update({ last_checked_on: day })')
  })

  it('closes the month BEFORE the slot’s month, whatever day it runs on', () => {
    expect(service).toContain(
      'monthBounds(addIsoDays(monthBounds(slot, calendar).from, -1), calendar)',
    )
  })

  it('never starts in the past, and stores a time only with a zone', () => {
    expect(service).toContain(
      'input.from && input.from.slice(0, 10) > tomorrow ? input.from.slice(0, 10) : tomorrow',
    )
    expect(service).toContain('...(input.atMinute !== undefined && input.timeZone')
    const routes = code('routes/automation.routes.ts')
    expect(routes).toContain('? { timeZone: resolveTimeZone(input.timeZone) }')
    expect(routes).toContain('atMinute: z.number().int().min(0).max(1439).optional(),')
  })
})
