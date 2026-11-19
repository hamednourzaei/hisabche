// WP-17: a recurring contract is recorded offline, a bill period is proposed
// with a stable idempotency key, and no invoice/money is created on the device.

import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, createTestEngine, type ClosableLocalDb } from './test-db'

let db: ClosableLocalDb
let engine: ReturnType<typeof createTestEngine>

async function contract() {
  return engine.request<{ id: string }>({
    method: 'POST',
    path: '/local-contracts',
    body: {
      customerId: 'c1',
      title: 'Monthly maintenance',
      contractType: 'maintenance',
      cadence: 'monthly',
      currency: 'AFN',
      amountMinor: 5000,
    },
  })
}

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
})

describe('offline recurring contracts (WP-17)', () => {
  it('records a draft and can only bill once active', async () => {
    const c = await contract()
    expect(c.status, JSON.stringify(c.data)).toBe(201)
    const refused = await engine.request({
      method: 'POST',
      path: `/local-contracts/${c.data.id}/bill-period`,
      body: { periodKey: '2026-01' },
    })
    expect(refused.status).toBe(409)
    await engine.request({
      method: 'POST',
      path: `/local-contracts/${c.data.id}/activate`,
      body: {},
    })
    const ok = await engine.request({
      method: 'POST',
      path: `/local-contracts/${c.data.id}/bill-period`,
      body: { periodKey: '2026-01' },
    })
    expect(ok.status).toBe(201)
  })

  it('a repeated period is a no-op (stable idempotency key)', async () => {
    const c = await contract()
    await engine.request({
      method: 'POST',
      path: `/local-contracts/${c.data.id}/activate`,
      body: {},
    })
    const a = await engine.request<{
      id: string
      idempotencyKey: string
      alreadyProposed: boolean
    }>({
      method: 'POST',
      path: `/local-contracts/${c.data.id}/bill-period`,
      body: { periodKey: '2026-02' },
    })
    const b = await engine.request<{ id: string; alreadyProposed: boolean }>({
      method: 'POST',
      path: `/local-contracts/${c.data.id}/bill-period`,
      body: { periodKey: '2026-02' },
    })
    expect(a.data.idempotencyKey).toBe(`contract:${c.data.id}:bill:2026-02`)
    expect(a.data.alreadyProposed).toBe(false)
    expect(b.data.alreadyProposed).toBe(true)
    expect(b.data.id).toBe(a.data.id)
  })

  it('proposing a period creates no invoice and posts no money', async () => {
    const c = await contract()
    await engine.request({
      method: 'POST',
      path: `/local-contracts/${c.data.id}/activate`,
      body: {},
    })
    await engine.request({
      method: 'POST',
      path: `/local-contracts/${c.data.id}/bill-period`,
      body: { periodKey: '2026-03' },
    })
    const inv = db.get<{ count: number }>('SELECT COUNT(*) as count FROM invoice')
    expect(inv?.count ?? 0).toBe(0)
    const je = db.get<{ count: number }>('SELECT COUNT(*) as count FROM journal_entry')
    expect(je?.count ?? 0).toBe(0)
  })
})
