import { describe, expect, it } from 'vitest'

import { clampBackfillPage, planPackBackfill } from '../schemas/sync-backfill'

describe('planPackBackfill (V62 Slice 5)', () => {
  it('returns none when no new sync entities were added or shared cursor is 0', () => {
    expect(
      planPackBackfill({
        sharedCursor: 150,
        previousPacks: ['core'],
        nextPacks: ['core', 'approvals'],
      }).kind,
    ).toBe('none')

    expect(
      planPackBackfill({
        sharedCursor: 0,
        previousPacks: ['core'],
        nextPacks: ['core', 'workforce'],
      }).kind,
    ).toBe('none')
  })

  it('plans a delta_backfill from 0..C for only the newly added pack entities', () => {
    const plan = planPackBackfill({
      sharedCursor: 420,
      previousPacks: ['core'],
      nextPacks: ['core', 'workforce'],
    })
    expect(plan).toEqual({
      kind: 'delta_backfill',
      entityTypes: ['time_entry'],
      fromCursor: 0,
      upToCursor: 420,
      resumeWithTypes: expect.arrayContaining(['invoice', 'time_entry']),
    })
  })

  it('switches to snapshot_backfill when cursor 0 is behind the commit horizon', () => {
    const plan = planPackBackfill({
      sharedCursor: 9999,
      previousPacks: ['core'],
      nextPacks: ['core', 'operations'],
      horizonExceeded: true,
    })
    expect(plan.kind).toBe('snapshot_backfill')
    if (plan.kind === 'snapshot_backfill') {
      expect(plan.entityTypes).toEqual([
        'order_deposits',
        'order_deposit_applications',
        'order_deposit_refunds',
      ])
    }
  })

  it('clamps backfill pages at upToCursor', () => {
    const { rows, reachedTarget } = clampBackfillPage(
      [{ syncVersion: 90 }, { syncVersion: 100 }, { syncVersion: 110 }],
      100,
      true,
    )
    expect(rows.map((r) => r.syncVersion)).toEqual([90, 100])
    expect(reachedTarget).toBe(true)
  })
})
