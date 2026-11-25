// ============================================
// backend/src/__tests__/wave1-tier-pricing.test.ts
//
// G98 — Volume Tier Pricing wired into POST /api/promotions/quote via
// `quoteTieredPrice` (@hisabche/validation).
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDatabase, createFakeDb, fakeId } from './helpers/fake-supabase'

const db = new FakeDatabase()
const OWNER = { id: '11111111-1111-4111-8111-111111111111', token: 'token-owner' }
const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PROD = 'dddddddd-0000-4000-8000-000000000001'

const users = new Map<string, { id: string }>([[OWNER.token, { id: OWNER.id }]])
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
    { id: SHOP, name: 'Wholesale Shop', base_currency: 'AFN', time_zone: 'Asia/Kabul' },
  ])
  db.seed('workspace_members', [
    {
      id: fakeId('mem'),
      workspace_id: SHOP,
      user_id: OWNER.id,
      role: 'owner',
      has_access: true,
      suspended_at: null,
    },
  ])
  db.seed('products', [{ id: PROD, workspace_id: SHOP, name: 'Rice 50kg', sell_price: 2500 }])
  db.seed('promotions', [])
})

describe('G98 — Volume Tier Pricing via /api/promotions/quote', () => {
  it('selects highest earned quantity tier and falls back to base price below minimum tier', async () => {
    const breaks = [
      { minQty: 10, unitPrice: 2300 },
      { minQty: 50, unitPrice: 2100 },
    ]
    const lowRes = await app.inject({
      method: 'POST',
      url: '/api/promotions/quote',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: { productId: PROD, quantity: 5, currency: 'AFN', quantityBreaks: breaks },
    })
    expect(lowRes.statusCode, lowRes.body).toBe(200)
    expect(lowRes.json().unitPriceMinor).toBe(250000)
    expect(lowRes.json().tierMinQty).toBeNull()

    const highRes = await app.inject({
      method: 'POST',
      url: '/api/promotions/quote',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: { productId: PROD, quantity: 60, currency: 'AFN', quantityBreaks: breaks },
    })
    expect(highRes.statusCode, highRes.body).toBe(200)
    expect(highRes.json().unitPriceMinor).toBe(210000)
    expect(highRes.json().tierMinQty).toBe(50)
  })
})
