// WP-04, OFFLINE: a shop records a roll, sells part of it, cuts with waste,
// returns to the SAME roll and reads the roll-centric cost report — without a
// signal. A second simultaneous consume must not take the same meters twice.

import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, createTestEngine, type ClosableLocalDb } from './test-db'

let db: ClosableLocalDb
let engine: ReturnType<typeof createTestEngine>

async function roll(initial = 50, costMinor = 50_000) {
  const res = await engine.request<{ id: string }>({
    method: 'POST',
    path: '/local-rolls',
    body: { rollNumber: `R-${initial}`, initialLength: initial, costMinor, location: 'قفسه ۱' },
  })
  expect(res.status, JSON.stringify(res.data)).toBe(201)
  return res.data
}

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
})

describe('offline roll cutting (WP-04)', () => {
  it('selling 12.5 m from a 50 m roll leaves 37.5 m', async () => {
    const r = await roll()
    const res = await engine.request<{ consumedLength: number; newRemainingLength: number }>({
      method: 'POST',
      path: `/local-rolls/${r.id}/consume`,
      body: { length: 12.5 },
    })
    expect(res.status).toBe(200)
    expect(res.data.consumedLength).toBe(12.5)
    expect(res.data.newRemainingLength).toBe(37.5)
    expect(
      db.get<{ remaining_length: number }>(
        'SELECT remaining_length FROM local_rolls WHERE id = ?',
        [r.id],
      )?.remaining_length,
    ).toBe(37.5)
  })

  it('a cut splits into sellable length and waste', async () => {
    const r = await roll()
    const res = await engine.request<{
      sellableLength: number
      wasteLength: number
      newRemainingLength: number
    }>({
      method: 'POST',
      path: `/local-rolls/${r.id}/cut`,
      body: { cutLength: 20, wasteLength: 2 },
    })
    expect([res.data.sellableLength, res.data.wasteLength, res.data.newRemainingLength]).toEqual([
      18, 2, 30,
    ])
  })

  it('a return restores the same roll and cannot invent stock', async () => {
    const r = await roll()
    await engine.request({
      method: 'POST',
      path: `/local-rolls/${r.id}/consume`,
      body: { length: 12.5 },
    })
    const ok = await engine.request<{ newRemainingLength: number }>({
      method: 'POST',
      path: `/local-rolls/${r.id}/return`,
      body: { length: 12.5 },
    })
    expect(ok.data.newRemainingLength).toBe(50)
    const refused = await engine.request({
      method: 'POST',
      path: `/local-rolls/${r.id}/return`,
      body: { length: 1 },
    })
    expect(refused.status).toBe(400)
  })

  it('two simultaneous consumes cannot both succeed', async () => {
    const r = await roll(20)
    const [a, b] = await Promise.all([
      engine.request({
        method: 'POST',
        path: `/local-rolls/${r.id}/consume`,
        body: { length: 12 },
      }),
      engine.request({
        method: 'POST',
        path: `/local-rolls/${r.id}/consume`,
        body: { length: 12 },
      }),
    ])
    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual([200, 400])
    expect(
      db.get<{ remaining_length: number }>(
        'SELECT remaining_length FROM local_rolls WHERE id = ?',
        [r.id],
      )?.remaining_length,
    ).toBe(8)
  })

  it('the report shows meters and cost, never a free roll', async () => {
    const r = await roll()
    await engine.request({
      method: 'POST',
      path: `/local-rolls/${r.id}/consume`,
      body: { length: 12.5 },
    })
    const res = await engine.request<{
      data: Array<{
        consumedLength: number
        cost: { consumedCostMinor: number; remainingCostMinor: number }
      }>
    }>({
      method: 'GET',
      path: '/local-rolls/report',
    })
    const row = res.data.data[0]!
    expect(row.consumedLength).toBe(12.5)
    expect(row.cost).toEqual({ consumedCostMinor: 12_500, remainingCostMinor: 37_500 })
  })

  it('a viewer cannot cut stock', async () => {
    const r = await roll()
    db.run(`UPDATE local_user SET role = 'viewer'`)
    const denied = await engine.request({
      method: 'POST',
      path: `/local-rolls/${r.id}/cut`,
      body: { cutLength: 1 },
    })
    expect(denied.status).toBe(403)
  })
})
