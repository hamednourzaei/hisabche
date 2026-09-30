// ============================================
// Capabilities #100, #101, #103 — attendance, shifts, internal notes.
//
// ⚠️ THE TABLE ALREADY EXISTED AND WAS READ-ONLY.
//
// `SETUP-COMPLETE.sql` created `attendance` and `human-resources.routes.ts`
// serves it, but nothing ever wrote a check-in — so every deployment has the
// table, the endpoint and an empty answer, and a page that says «no attendance»
// because there has never been a way to record one. `§7.1`, exactly.
//
// So this file is about the RULES that make attendance mean something, and every
// one of them is a way the naive version invents money:
//
//   * AN OPEN DAY HAS NO DURATION. Closing it at 23:59 claims a person worked
//     from their check-in until midnight — eight hours nobody was there for.
//   * A CHECK-OUT BEFORE A CHECK-IN IS A TYPO, NOT A NIGHT SHIFT. These are day
//     shops; reading it as overnight bills twenty hours.
//   * `25:99` PARSES AS DIGITS. Without a bounds check it is a negative
//     duration, and an overworked employee becomes an underworked one.
//   * A BREAK LONGER THAN THE SHIFT CLAMPS TO ZERO, so a roster typo cannot
//     produce a negative salary line.
//   * ATTENDANCE NEVER FEEDS PAYROLL. `payroll-ledger.domain` exists because
//     payroll posted no journal entry at all; a silent hours→salary link reopens
//     it.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  MAX_SHIFTS_PER_DAY,
  MAX_NOTE_LENGTH,
  NOTABLE_ENTITIES,
  attendanceFor,
  minutesOf,
  payableHours,
  validateNote,
  validateShifts,
  type ShiftDefinition,
} from '../services/customers/attendance.domain'

const day = (over: Partial<Parameters<typeof attendanceFor>[0]> = {}) => ({
  employeeId: 'e1',
  date: '2026-09-30',
  checkIn: '09:00',
  checkOut: '17:00',
  status: 'present' as const,
  ...over,
})

describe('#100 — an open day has NO duration', () => {
  it('a complete day has hours', () => {
    expect(attendanceFor(day())).toEqual({
      status: 'present',
      workedHours: 8,
      isOpen: false,
      issue: null,
    })
  })

  it('a check-in with no check-out is OPEN and vouches for nothing', () => {
    // ⚠️ THE failure this file is mostly about. Closing it at midnight would
    // claim a person worked until the end of the day.
    const result = attendanceFor(day({ checkOut: null }))

    expect(result.isOpen).toBe(true)
    expect(result.workedHours).toBeNull()
    expect(result.issue).toBe('NO_CHECK_OUT')
  })

  it('a day with NO check-in is a problem to report, not zero hours', () => {
    // ⚠️ Zero is an answer. A missing check-in and a check-out at 00:00 both
    // produce zero, and one of them is an employee at work.
    const result = attendanceFor(day({ checkIn: null }))

    expect(result.workedHours).toBeNull()
    expect(result.issue).toBe('NO_CHECK_IN')
  })

  it('a check-out BEFORE the check-in is a typo, not a night shift', () => {
    const result = attendanceFor(day({ checkIn: '17:00', checkOut: '09:00' }))

    expect(result.workedHours).toBeNull()
    expect(result.issue).toBe('CHECK_OUT_BEFORE_CHECK_IN')
  })
})

describe('#100 — a time that parses is not necessarily a time', () => {
  it('reads a valid time', () => {
    expect(minutesOf('09:30')).toBe(570)
    expect(minutesOf('00:00')).toBe(0)
  })

  it('rejects an out-of-range hour or minute', () => {
    // ⚠️ `25:99` matches the pattern. Without a bounds check it becomes
    // -1501 minutes, i.e. a NEGATIVE duration, and an overworked employee
    // becomes an underworked one with nothing in the log.
    expect(minutesOf('25:99')).toBeNull()
    expect(minutesOf('24:00')).toBeNull()
    expect(minutesOf('12:75')).toBeNull()
  })

  it('rejects nonsense', () => {
    expect(minutesOf(null)).toBeNull()
    expect(minutesOf('')).toBeNull()
    expect(minutesOf('nine')).toBeNull()
    expect(minutesOf('09')).toBeNull()
  })

  it('a day with a malformed check-in does not silently become zero', () => {
    expect(attendanceFor(day({ checkIn: '25:99' })).issue).toBe('NO_CHECK_IN')
  })
})

describe('#100 — leave and absence are answers, not missing data', () => {
  it('leave is zero hours with no issue', () => {
    expect(attendanceFor(day({ status: 'leave', checkIn: null, checkOut: null }))).toEqual({
      status: 'leave',
      workedHours: 0,
      isOpen: false,
      issue: null,
    })
  })

  it('absence is zero hours with no issue', () => {
    expect(
      attendanceFor(day({ status: 'absent', checkIn: null, checkOut: null })).workedHours,
    ).toBe(0)
  })

  it('an explicitly absent day with a check-in is still just present', () => {
    // ⚠️ The status wins. A row marked absent with times on it is a data
    // problem, and quietly preferring the times would make a manager's
    // correction invisible.
    expect(attendanceFor(day({ status: 'absent' })).status).toBe('absent')
  })
})

describe('#101 — a shift roster that cannot be worked', () => {
  const shift = (over: Partial<ShiftDefinition> = {}): ShiftDefinition => ({
    id: 's1',
    name: 'Morning',
    startsAt: '08:00',
    endsAt: '16:00',
    breakMinutes: 60,
    ...over,
  })

  it('a workable day is valid', () => {
    expect(validateShifts([shift()], [shift()])).toEqual([])
  })

  it('a shift ending before it starts is invalid', () => {
    expect(validateShifts([shift({ startsAt: '16:00', endsAt: '08:00' })], [])).toContain(
      'INVALID_TIMES',
    )
  })

  it('an overnight shift is NOT accepted', () => {
    // ⚠️ These shops are day shops. Reading 16:00→08:00 as overnight would bill
    // sixteen hours for one shift.
    expect(validateShifts([shift({ startsAt: '16:00', endsAt: '08:00' })], [])).toContain(
      'INVALID_TIMES',
    )
  })

  it('a break longer than the shift is refused', () => {
    expect(validateShifts([shift({ breakMinutes: 600 })], [])).toContain('BREAK_LONGER_THAN_SHIFT')
  })

  it('two shifts in the same place are refused', () => {
    const problems = validateShifts(
      [shift({ id: 'a' }), shift({ id: 'b', startsAt: '09:00', endsAt: '17:00' })],
      [],
    )

    expect(problems).toContain('OVERLAPS_ANOTHER')
  })

  it('overlap is order-INDEPENDENT', () => {
    // ⚠️ A roster typed bottom-up must give the same answer as one typed
    // top-down, or the check is not a check.
    const forwards = validateShifts(
      [
        shift({ id: 'a', startsAt: '08:00', endsAt: '12:00' }),
        shift({ id: 'b', startsAt: '11:00', endsAt: '15:00' }),
      ],
      [],
    )
    const backwards = validateShifts(
      [
        shift({ id: 'b', startsAt: '11:00', endsAt: '15:00' }),
        shift({ id: 'a', startsAt: '08:00', endsAt: '12:00' }),
      ],
      [],
    )

    expect(backwards).toEqual(forwards)
  })

  it('back-to-back shifts do not overlap', () => {
    expect(
      validateShifts(
        [
          shift({ id: 'a', startsAt: '08:00', endsAt: '12:00' }),
          shift({ id: 'b', startsAt: '12:00', endsAt: '16:00' }),
        ],
        [],
      ),
    ).toEqual([])
  })

  it('too many shifts in one day is a data dump, not a roster', () => {
    const many = Array.from({ length: MAX_SHIFTS_PER_DAY + 1 }, (_, i) =>
      shift({ id: `s${i}`, startsAt: '08:00', endsAt: '09:00' }),
    )

    expect(validateShifts(many, [])).toContain('TOO_MANY_SHIFTS_PER_DAY')
  })
})

describe('#101 — a break comes off the top and cannot go negative', () => {
  it('takes the break off the shift', () => {
    expect(
      payableHours({ id: 's', name: 'S', startsAt: '09:00', endsAt: '17:00', breakMinutes: 60 }),
    ).toBe(7)
  })

  it('a break longer than the shift CLAMPS to zero', () => {
    // ⚠️ A roster typo must not produce a NEGATIVE salary line, which is a
    // credit to the employee and an unexplained debit to the shop.
    const hours = payableHours({
      id: 's',
      name: 'S',
      startsAt: '09:00',
      endsAt: '10:00',
      breakMinutes: 600,
    })

    expect(hours).toBe(0)
  })

  it('an invalid shift pays nothing rather than guessing', () => {
    expect(
      payableHours({ id: 's', name: 'S', startsAt: '17:00', endsAt: '09:00', breakMinutes: 0 }),
    ).toBe(0)
  })
})

describe('#103 — a note is prose, and only on things that have prose', () => {
  it('accepts a note on a customer', () => {
    expect(
      validateNote({ entityType: 'customer', entityId: 'c1', body: 'prefers delivery on Fridays' }),
    ).toEqual([])
  })

  it('refuses a note on anything financial', () => {
    // ⚠️ THE list is the enforcement. A note on a payment reads as a reason the
    // payment was made — by an amount, by a customer, by a cashier — and that
    // is a financial claim in a field the audit trail treats as prose.
    for (const entity of ['payment', 'invoice', 'journal_entry', 'account']) {
      expect(
        validateNote({ entityType: entity, entityId: 'x', body: 'because' }),
        entity,
      ).toContain('NOT_NOTABLE')
      expect(NOTABLE_ENTITIES, entity).not.toContain(entity)
    }
  })

  it('an empty note is not a note', () => {
    expect(validateNote({ entityType: 'customer', entityId: 'c1', body: '   ' })).toContain(
      'EMPTY_BODY',
    )
  })

  it('a note longer than the limit is a document, and documents have their own place', () => {
    const problems = validateNote({
      entityType: 'customer',
      entityId: 'c1',
      body: 'a'.repeat(MAX_NOTE_LENGTH + 1),
    })

    expect(problems).toContain('BODY_TOO_LONG')
  })
})
