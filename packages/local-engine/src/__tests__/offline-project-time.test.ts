// WP-15, OFFLINE: a project manager records time without signal and sees the
// real cost / milestone readiness on the device. Only APPROVED time may be
// billed; the invoice itself stays with the server.

import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, createTestEngine, type ClosableLocalDb } from './test-db'

let db: ClosableLocalDb
let engine: ReturnType<typeof createTestEngine>

async function project() {
  const res = await engine.request<{ id: string }>({
    method: 'POST',
    path: '/local-projects',
    body: { name: 'پروژه آفلاین', currency: 'AFN', budgetMinor: 50_000 },
  })
  expect(res.status, JSON.stringify(res.data)).toBe(201)
  return res.data
}

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
})

describe('offline project time (WP-15)', () => {
  it('creates a project and refuses a viewer write', async () => {
    const p = await project()
    expect(
      db.get<{ status: string }>('SELECT status FROM local_projects WHERE id = ?', [p.id])?.status,
    ).toBe('active')
    db.run(`UPDATE local_user SET role = 'viewer'`)
    const denied = await engine.request({
      method: 'POST',
      path: '/local-projects',
      body: { name: 'x', currency: 'AFN' },
    })
    expect(denied.status).toBe(403)
  })

  it('unapproved hours never count as billable', async () => {
    const p = await project()
    await engine.request({
      method: 'POST',
      path: `/local-projects/${p.id}/time-entries`,
      body: { hours: 8, rateMinor: 2_000, workDate: '2026-01-01' },
    })
    const res = await engine.request<{
      time: { approvedHours: number; billableHours: number; amountMinor: number }
    }>({
      method: 'GET',
      path: `/local-projects/${p.id}/billing`,
    })
    expect(res.data.time.approvedHours).toBe(0)
    expect(res.data.time.amountMinor).toBe(0)
  })

  it('approved hours become billable and unlock a milestone', async () => {
    const p = await project()
    const entry = await engine.request<{ id: string }>({
      method: 'POST',
      path: `/local-projects/${p.id}/time-entries`,
      body: { hours: 10, rateMinor: 2_000, workDate: '2026-01-01' },
    })
    const approved = await engine.request({
      method: 'POST',
      path: `/local-projects/time-entries/${entry.data.id}/approve`,
    })
    expect(approved.status).toBe(200)
    await engine.request({
      method: 'POST',
      path: `/local-projects/${p.id}/milestones`,
      body: { title: 'فاز اول', requiredHours: 8, amountMinor: 20_000 },
    })
    const res = await engine.request<{ milestones: Array<{ readiness: { ready: boolean } }> }>({
      method: 'GET',
      path: `/local-projects/${p.id}/billing`,
    })
    expect(res.data.milestones[0]!.readiness.ready).toBe(true)
  })

  it('cost comes from the shared rule and never invents overhead', async () => {
    const p = await project()
    const entry = await engine.request<{ id: string }>({
      method: 'POST',
      path: `/local-projects/${p.id}/time-entries`,
      body: { hours: 10, rateMinor: 2_000 },
    })
    await engine.request({
      method: 'POST',
      path: `/local-projects/time-entries/${entry.data.id}/approve`,
    })
    const res = await engine.request<{ cost: { totalMinor: number; overheadMinor: number } }>({
      method: 'GET',
      path: `/local-projects/${p.id}/cost`,
    })
    expect(res.data.cost).toEqual({ directMinor: 20_000, overheadMinor: 0, totalMinor: 20_000 })
  })
})
