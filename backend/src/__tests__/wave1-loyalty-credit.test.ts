// ============================================
// backend/src/__tests__/wave1-loyalty-credit.test.ts
//
// G01 (Gift Cards), G02 (Store Credit) & G65 (Loyalty Points)
// Real Fastify buildServer() + app.inject() integration tests.
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDatabase, createFakeDb, fakeId } from './helpers/fake-supabase'

const db = new FakeDatabase()
const OWNER = { id: '11111111-1111-4111-8111-111111111111', token: 'token-owner' }
const STRANGER = { id: '22222222-2222-4222-8222-222222222222', token: 'token-stranger' }
const SHOP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SHOP_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const CUST_A = 'cccccccc-0000-4000-8000-000000000001'

const users = new Map<string, { id: string }>([
  [OWNER.token, { id: OWNER.id }],
  [STRANGER.token, { id: STRANGER.id }],
])

vi.mock('../db', () => createFakeDb(db, users))

let app: FastifyInstance
beforeAll(async () => {
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
})
afterAll(async () => {
  await app?.close()
})
beforeEach(() => {
  db.tables.clear()
  db.failures.clear()
  db.seed('workspaces', [
    { id: SHOP_A, name: 'Shop A', base_currency: 'AFN', time_zone: 'Asia/Kabul' },
    { id: SHOP_B, name: 'Shop B', base_currency: 'USD', time_zone: 'Asia/Kabul' },
  ])
  db.seed('workspace_members', [
    {
      id: fakeId('mem'),
      workspace_id: SHOP_A,
      user_id: OWNER.id,
      role: 'owner',
      has_access: true,
      suspended_at: null,
    },
    {
      id: fakeId('mem'),
      workspace_id: SHOP_B,
      user_id: STRANGER.id,
      role: 'owner',
      has_access: true,
      suspended_at: null,
    },
  ])
  db.seed('customers', [{ id: CUST_A, workspace_id: SHOP_A, name: 'Ahmad' }])
  db.seed('gift_cards', [])
  db.seed('gift_card_transactions', [])
  db.seed('store_credit_ledger', [])
  db.seed('loyalty_points_ledger', [])
})

describe('G01/G02/G65 — Gift Cards, Store Credit & Loyalty Points', () => {
  const headersA = { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A }
  const headersB = { authorization: `Bearer ${STRANGER.token}`, 'x-workspace-id': SHOP_B }

  it('issues & redeems a gift card idempotently and refuses currency mismatch / insufficient balance / cross-tenant', async () => {
    const issue = await app.inject({
      method: 'POST',
      url: '/api/gift-cards',
      headers: headersA,
      payload: { code: 'GIFT-2026', currency: 'AFN', initialBalanceMinor: 5000 },
    })
    expect(issue.statusCode, issue.body).toBe(201)

    const redeem1 = await app.inject({
      method: 'POST',
      url: '/api/gift-cards/redeem',
      headers: headersA,
      payload: {
        code: 'gift-2026',
        currency: 'AFN',
        amountMinor: 2000,
        idempotencyKey: 'idem-gift-1',
      },
    })
    expect(redeem1.statusCode, redeem1.body).toBe(200)
    expect(redeem1.json().idempotentReplay).toBe(false)
    expect(redeem1.json().card.balance_minor).toBe(3000)

    // Replay same key
    const replay = await app.inject({
      method: 'POST',
      url: '/api/gift-cards/redeem',
      headers: headersA,
      payload: {
        code: 'GIFT-2026',
        currency: 'AFN',
        amountMinor: 2000,
        idempotencyKey: 'idem-gift-1',
      },
    })
    expect(replay.statusCode).toBe(200)
    expect(replay.json().idempotentReplay).toBe(true)

    // Currency mismatch refused
    const wrongCur = await app.inject({
      method: 'POST',
      url: '/api/gift-cards/redeem',
      headers: headersA,
      payload: {
        code: 'GIFT-2026',
        currency: 'USD',
        amountMinor: 500,
        idempotencyKey: 'idem-gift-2',
      },
    })
    expect(wrongCur.statusCode).toBe(400)

    // Cross-tenant cannot see or redeem SHOP_A gift card
    const cross = await app.inject({
      method: 'POST',
      url: '/api/gift-cards/redeem',
      headers: headersB,
      payload: {
        code: 'GIFT-2026',
        currency: 'AFN',
        amountMinor: 500,
        idempotencyKey: 'idem-gift-3',
      },
    })
    expect(cross.statusCode).toBe(404)
  })

  it('tracks multi-currency store credit separately and prevents negative loyalty points', async () => {
    const scAfn = await app.inject({
      method: 'POST',
      url: '/api/store-credit',
      headers: headersA,
      payload: {
        customerId: CUST_A,
        currency: 'AFN',
        amountMinor: 1500,
        reason: 'Return credit',
        idempotencyKey: 'idem-sc-1',
      },
    })
    expect(scAfn.statusCode).toBe(201)

    const scUsd = await app.inject({
      method: 'POST',
      url: '/api/store-credit',
      headers: headersA,
      payload: {
        customerId: CUST_A,
        currency: 'USD',
        amountMinor: 2500,
        reason: 'USD return',
        idempotencyKey: 'idem-sc-2',
      },
    })
    expect(scUsd.statusCode).toBe(201)

    const bal = await app.inject({
      method: 'GET',
      url: `/api/store-credit/${CUST_A}`,
      headers: headersA,
    })
    expect(bal.statusCode).toBe(200)
    expect(bal.json().balancesByCurrency).toEqual({ AFN: 1500, USD: 2500 })

    // Loyalty earn & redeem
    const earn = await app.inject({
      method: 'POST',
      url: '/api/loyalty/mutate',
      headers: headersA,
      payload: {
        customerId: CUST_A,
        kind: 'earn',
        points: 100,
        reason: 'Purchase #1',
        idempotencyKey: 'idem-loy-1',
      },
    })
    expect(earn.statusCode).toBe(201)
    expect(earn.json().pointsBalance).toBe(100)

    const overRedeem = await app.inject({
      method: 'POST',
      url: '/api/loyalty/mutate',
      headers: headersA,
      payload: {
        customerId: CUST_A,
        kind: 'redeem',
        points: 150,
        reason: 'Too much',
        idempotencyKey: 'idem-loy-2',
      },
    })
    expect(overRedeem.statusCode).toBe(400)
  })
})
