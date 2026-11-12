// V54 5.5 (7 Nov 2026) — the one rule for «حاضر شد» / «نیامد», shared by the
// server (service-delivery.service.ts) and the device (local-engine route).
import { describe, expect, it } from 'vitest'
import {
  planSessionStatusMove,
  sessionStatusMoveSources,
  SESSION_STATUS_MOVES,
  type ServiceDeliverySession,
} from '../schemas/universal-core/service-delivery.domain'

const base: ServiceDeliverySession = {
  id: 's1',
  workspaceId: 'w1',
  customerId: 'c1',
  serviceOfferingId: 'p1',
  sessionDate: '2026-11-08',
  startTime: '10:00',
  endTime: '11:00',
  durationMinutes: 60,
  status: 'scheduled',
  settlementMethod: 'complementary',
  createdAt: '2026-11-07T00:00:00.000Z',
  updatedAt: '2026-11-07T00:00:00.000Z',
}

describe('planSessionStatusMove', () => {
  it('the closed list carries no money: never delivered or cancelled', () => {
    expect([...SESSION_STATUS_MOVES]).toEqual(['checked_in', 'in_progress', 'no_show'])
  })

  it('check-in and start from a booking', () => {
    const c = planSessionStatusMove({ session: base, to: 'checked_in', now: 'T0' })
    expect(c.replayed).toBe(false)
    expect(c.session.status).toBe('checked_in')
    expect(c.session.updatedAt).toBe('T0')

    const r = planSessionStatusMove({ session: c.session, to: 'in_progress', now: 'T' })
    expect(r.replayed).toBe(false)
    expect(r.session.status).toBe('in_progress')
    expect(r.session.updatedAt).toBe('T')
  })

  it('no-show from a booking', () => {
    expect(planSessionStatusMove({ session: base, to: 'no_show' }).session.status).toBe('no_show')
  })

  it('the same move again is a replay and changes nothing', () => {
    const r = planSessionStatusMove({ session: { ...base, status: 'no_show' }, to: 'no_show' })
    expect(r.replayed).toBe(true)
    expect(r.session.updatedAt).toBe(base.updatedAt)
  })

  it.each(['delivered', 'cancelled', 'scheduled', '', 'IN_PROGRESS'])('«%s» is refused', (to) => {
    expect(() => planSessionStatusMove({ session: base, to })).toThrow(
      'SESSION_STATUS_MOVE_NOT_ALLOWED',
    )
  })

  it.each([
    ['delivered', 'no_show'],
    ['cancelled', 'in_progress'],
    ['no_show', 'in_progress'],
  ] as const)('%s → %s is refused by the transition table', (from, to) => {
    expect(() => planSessionStatusMove({ session: { ...base, status: from }, to })).toThrow(
      `INVALID_STATUS_TRANSITION:${from}->${to}`,
    )
  })

  it('the WHERE of the server update names exactly the legal sources', () => {
    expect([...sessionStatusMoveSources('checked_in')]).toEqual(['scheduled'])
    expect([...sessionStatusMoveSources('in_progress')]).toEqual(['scheduled', 'checked_in'])
    expect([...sessionStatusMoveSources('no_show')].sort()).toEqual(['in_progress', 'scheduled'])
  })
})
