// ============================================
// FROM THE END BACK TO THE START — a till.
//
// Opening a till had no way back: seventeen routes on `/api/pos`, none of them
// a DELETE. A drawer opened by mistake stayed in the list until somebody
// «counted and closed» a till that had never held anything.
//
// The rule this pins, both halves:
//   • a till that was never used can be removed, and the list is as it was;
//   • a till that has seen money can NOT — it is a record, and is closed.
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { FakeDatabase, createFakeDb, fakeId } from './helpers/fake-supabase'

const db = new FakeDatabase()

const OWNER = { id: fakeId('owner'), token: 'till-token-owner' }
const STRANGER = { id: fakeId('stranger'), token: 'till-token-stranger' }
const SHOP = fakeId('shop')
const OTHER_SHOP = fakeId('shop')
const users = new Map<string, { id: string }>([
  [OWNER.token, { id: OWNER.id }],
  [STRANGER.token, { id: STRANGER.id }],
])

vi.mock('../db', async () => (globalThis as any).__tillFakeDb)

function member(workspaceId: string, userId: string) {
  return {
    id: fakeId('member'),
    workspace_id: workspaceId,
    user_id: userId,
    role: 'owner',
    has_access: true,
    suspended_at: null,
    joined_at: '2026-01-01T00:00:00Z',
  }
}

function resetWorld() {
  db.tables.clear()
  db.queries.length = 0
  db.seed('workspace_members', [member(SHOP, OWNER.id), member(OTHER_SHOP, STRANGER.id)])
  db.seed('accounts', [])
  db.seed('accounting_period_locks', [])
  db.seed('pos_orders', [])
  db.seed('pos_cash_movements', [])
  db.seed('payments', [])
}

let app: FastifyInstance

beforeAll(async () => {
  ;(globalThis as any).__tillFakeDb = createFakeDb(db, users)
  resetWorld()
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
}, 60_000)

afterAll(async () => {
  await app?.close()
})

beforeEach(() => {
  resetWorld()
})

const as = (user: { token: string }, shop: string) => ({
  authorization: `Bearer ${user.token}`,
  'x-workspace-id': shop,
})

async function openTill(): Promise<string> {
  const opened = await app.inject({
    method: 'POST',
    url: '/api/pos/sessions',
    headers: as(OWNER, SHOP),
    payload: { openingFloatMinor: 0 },
  })
  expect(opened.statusCode, opened.body).toBe(201)
  return (JSON.parse(opened.body) as { id: string }).id
}

describe('a till, undone', () => {
  it('⚠️ a till that was never used can be removed, and nothing is left of it', async () => {
    const before = db.rows('pos_sessions').length
    const id = await openTill()
    expect(db.rows('pos_sessions')).toHaveLength(before + 1)

    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/pos/sessions/${id}`,
      headers: as(OWNER, SHOP),
    })

    expect(removed.statusCode, removed.body).toBe(200)
    expect(db.rows('pos_sessions')).toHaveLength(before)
    expect(db.rows('journal_entries')).toHaveLength(0)
  })

  it('⚠️ a till that has taken cash is refused and stays exactly as it was', async () => {
    const id = await openTill()
    const cash = await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${id}/cash`,
      headers: as(OWNER, SHOP),
      payload: { kind: 'cash_in', amountMinor: 5_000, reason: 'خرد' },
    })
    expect(cash.statusCode, cash.body).toBeLessThan(300)

    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/pos/sessions/${id}`,
      headers: as(OWNER, SHOP),
    })

    expect(removed.statusCode, removed.body).toBe(409)
    expect(removed.body).toContain('POS_SESSION_IN_USE')
    expect(db.rows('pos_sessions').find((row) => row.id === id)?.status).toBe('open')
    expect(db.rows('pos_cash_movements')).toHaveLength(1)
  })

  it('another business cannot remove it', async () => {
    const id = await openTill()

    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/pos/sessions/${id}`,
      headers: as(STRANGER, OTHER_SHOP),
    })

    expect(removed.statusCode, removed.body).toBe(404)
    expect(db.rows('pos_sessions').some((row) => row.id === id)).toBe(true)
  })
})
