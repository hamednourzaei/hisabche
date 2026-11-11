import { describe, expect, it } from 'vitest'
import {
  freeSlots,
  overlaps,
  resourceBookingCreateSchema,
  utilization,
} from '../schemas/resource-capacity'
import { RESOURCE_KINDS } from '../schemas/salon'

describe('V60 Slice 7: Resource & Capacity shared domain rules', () => {
  it('supports generalized resource kinds across chairs, rooms, tables, vehicles, machines, equipment, courts', () => {
    expect(RESOURCE_KINDS).toEqual(
      expect.arrayContaining([
        'chair',
        'room',
        'bed',
        'station',
        'equipment',
        'table',
        'vehicle',
        'machine',
        'court',
      ]),
    )
  })

  it('overlaps follows half-open [start, end) semantics so back-to-back bookings never clash', () => {
    const first = { startAt: '2026-11-11T09:00:00Z', endAt: '2026-11-11T10:00:00Z' }
    const adjacent = { startAt: '2026-11-11T10:00:00Z', endAt: '2026-11-11T11:00:00Z' }
    const conflicting = { startAt: '2026-11-11T09:30:00Z', endAt: '2026-11-11T10:30:00Z' }

    expect(overlaps(first, adjacent)).toBe(false)
    expect(overlaps(adjacent, first)).toBe(false)
    expect(overlaps(first, conflicting)).toBe(true)
    expect(overlaps(conflicting, adjacent)).toBe(true)
  })

  it('freeSlots skips busy and maintenance intervals deterministically', () => {
    const window = { startAt: '2026-11-11T09:00:00.000Z', endAt: '2026-11-11T12:00:00.000Z' }
    const busy = [{ startAt: '2026-11-11T10:00:00.000Z', endAt: '2026-11-11T11:00:00.000Z' }]
    const slots = freeSlots(window, busy, 60)
    expect(slots).toEqual([
      { startAt: '2026-11-11T09:00:00.000Z', endAt: '2026-11-11T10:00:00.000Z' },
      { startAt: '2026-11-11T11:00:00.000Z', endAt: '2026-11-11T12:00:00.000Z' },
    ])
  })

  it('utilization merges overlapping busy intervals and returns null ratio on empty window', () => {
    const window = { startAt: '2026-11-11T08:00:00.000Z', endAt: '2026-11-11T12:00:00.000Z' }
    const stats = utilization(window, [
      { startAt: '2026-11-11T08:00:00.000Z', endAt: '2026-11-11T10:00:00.000Z' },
      { startAt: '2026-11-11T09:00:00.000Z', endAt: '2026-11-11T11:00:00.000Z' },
    ])
    expect(stats.bookedMinutes).toBe(180)
    expect(stats.totalMinutes).toBe(240)
    expect(stats.ratio).toBe(0.75)

    expect(
      utilization({ startAt: '2026-11-11T08:00:00Z', endAt: '2026-11-11T08:00:00Z' }, []).ratio,
    ).toBeNull()
  })

  it('validates booking request range and sourceType', () => {
    expect(() =>
      resourceBookingCreateSchema.parse({
        resourceId: '11111111-1111-4111-8111-111111111111',
        startAt: '2026-11-11T10:00:00Z',
        endAt: '2026-11-11T09:00:00Z',
      }),
    ).toThrow(/INVALID_BOOKING_RANGE/)
  })
})
