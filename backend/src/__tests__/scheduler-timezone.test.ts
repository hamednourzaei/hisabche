// ============================================
// The scheduler's time semantics are UTC and do not depend on the host's TZ.
//
// Two instances on machines with different local timezones must (a) fire the
// cron at the same real moment and (b) compute the same run-once slot for it —
// otherwise each would claim a DIFFERENT slot and both would run the task.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

const schedule = vi.fn()
vi.mock('node-cron', () => ({ default: { schedule: (...a: unknown[]) => schedule(...a) } }))

const claimed: Array<{ task: string; slot: string }> = []
vi.mock('../services/distributed-work', async (orig) => {
  const real = await orig<typeof import('../services/distributed-work')>()
  return {
    ...real,
    runScheduledOnce: async (task: string, slot: string, run: () => Promise<void>) => {
      claimed.push({ task, slot })
      await run()
      return true
    },
  }
})
vi.mock('../workers/trial-expiration.worker', () => ({
  TrialExpirationWorker: class {
    async run() {}
  },
}))
vi.mock('../services/event.service', () => ({
  eventService: { processPending: async () => ({ processed: 0, failed: 0 }) },
}))

const { SCHEDULER_TIMEZONE, startScheduler, runTrialExpirationTick, runEventRecoveryTick } =
  await import('../scheduler/index')
const { slotOf } = await import('../services/distributed-work')

beforeEach(() => {
  schedule.mockReset()
  claimed.length = 0
})

describe('normal execution', () => {
  it('every cron is registered with the explicit UTC timezone', () => {
    startScheduler()
    expect(SCHEDULER_TIMEZONE).toBe('UTC')
    expect(schedule.mock.calls.length).toBeGreaterThan(0)
    for (const call of schedule.mock.calls) {
      expect(call[2]).toMatchObject({ timezone: 'UTC' })
    }
  })

  it('a tick runs its task through the run-once slot', async () => {
    const now = new Date('2026-09-26T00:00:03Z')
    await runTrialExpirationTick(now)
    await runEventRecoveryTick(now)
    expect(claimed).toEqual([
      { task: 'trial-expiration', slot: slotOf(86_400, now) },
      { task: 'event-log-recovery', slot: slotOf(180, now) },
    ])
  })
})

describe('UTC day boundary', () => {
  it('the last second of a UTC day and the first of the next are different slots', () => {
    expect(slotOf(86_400, new Date('2026-09-26T23:59:59.999Z'))).not.toBe(
      slotOf(86_400, new Date('2026-09-27T00:00:00Z')),
    )
  })

  it('a late tick (fired a few seconds after midnight) still lands in that day', () => {
    expect(slotOf(86_400, new Date('2026-09-27T00:00:00Z'))).toBe(
      slotOf(86_400, new Date('2026-09-27T00:00:09Z')),
    )
  })

  it('local midnight in Kabul (19:30 UTC) is NOT a slot boundary', () => {
    // 2026-09-26 23:59 and 2026-09-27 00:01 in Kabul are the same UTC day.
    expect(slotOf(86_400, new Date('2026-09-26T19:29:00Z'))).toBe(
      slotOf(86_400, new Date('2026-09-26T19:31:00Z')),
    )
  })

  it('3-minute recovery slots split exactly on the UTC minute grid', () => {
    expect(slotOf(180, new Date('2026-09-26T10:02:59Z'))).not.toBe(
      slotOf(180, new Date('2026-09-26T10:03:00Z')),
    )
  })
})

describe('DST-safe, and independent of the host timezone', () => {
  const originalTz = process.env.TZ

  it.each(['UTC', 'Asia/Kabul', 'Asia/Tehran', 'America/New_York', 'Europe/Berlin'])(
    'the slot for one instant is the same with TZ=%s',
    (tz) => {
      process.env.TZ = tz
      try {
        // The instant a US DST change happens (2026-03-08 07:00 UTC) and the
        // hour after it: an hour of local wall-clock time disappears, the
        // epoch-derived slot does not care.
        expect(slotOf(86_400, new Date('2026-03-08T07:00:00Z'))).toBe(
          String(Date.UTC(2026, 2, 8) / 86_400_000),
        )
        expect(slotOf(86_400, new Date('2026-03-08T08:30:00Z'))).toBe(
          String(Date.UTC(2026, 2, 8) / 86_400_000),
        )
        // Europe's autumn change (2026-10-25 01:00 UTC): the repeated local hour
        // does not produce a second slot.
        expect(slotOf(86_400, new Date('2026-10-25T00:30:00Z'))).toBe(
          slotOf(86_400, new Date('2026-10-25T01:30:00Z')),
        )
      } finally {
        if (originalTz === undefined) delete process.env.TZ
        else process.env.TZ = originalTz
      }
    },
  )

  it('UTC has no DST: consecutive days are consecutive slots, across the EU spring change', () => {
    const a = Number(slotOf(86_400, new Date('2026-03-29T12:00:00Z')))
    const b = Number(slotOf(86_400, new Date('2026-03-30T12:00:00Z')))
    // Slot n covers [n*24h, (n+1)*24h) from the epoch — consecutive days differ by one.
    expect(b - a).toBe(1)
  })
})
