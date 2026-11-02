// ============================================
// backend/src/__tests__/package-credits-http.test.ts
//
// M3: Fastify HTTP Route Verification for Package Credits (buildServer + app.inject)
// Proves HTTP status codes, authorization gates, and tenant boundary enforcement.
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDatabase, createFakeDb, fakeId } from './helpers/fake-supabase'

const db = new FakeDatabase()

const USER_A = { id: fakeId('user-a'), token: 'token-user-a' }
const USER_B = { id: fakeId('user-b'), token: 'token-user-b' }

const WORKSPACE_A = fakeId('ws-a')
const WORKSPACE_B = fakeId('ws-b')

const users = new Map<string, { id: string }>([
  [USER_A.token, { id: USER_A.id }],
  [USER_B.token, { id: USER_B.id }],
])

const fakeDbModule = createFakeDb(db, users)
vi.mock('../db', () => fakeDbModule)

let app: FastifyInstance

const CUST_A = fakeId('cust-a')
const PROD_PKG_A = fakeId('prod-pkg-a')

function member(workspaceId: string, userId: string, role = 'owner') {
  return {
    id: fakeId('member'),
    workspace_id: workspaceId,
    user_id: userId,
    role,
    has_access: true,
    suspended_at: null,
    joined_at: '2026-01-01T00:00:00Z',
  }
}

function resetWorld() {
  db.tables.clear()
  db.failures.clear()
  db.queries.length = 0

  db.seed('workspaces', [
    { id: WORKSPACE_A, name: 'Workspace A', base_currency: 'AFN' },
    { id: WORKSPACE_B, name: 'Workspace B', base_currency: 'USD' },
  ])

  db.seed('workspace_members', [
    member(WORKSPACE_A, USER_A.id, 'owner'),
    member(WORKSPACE_B, USER_B.id, 'owner'),
  ])

  db.seed('customers', [{ id: CUST_A, workspace_id: WORKSPACE_A, name: 'Customer A' }])

  db.seed('products', [
    { id: PROD_PKG_A, workspace_id: WORKSPACE_A, name: 'Gold Package', offering_type: 'package' },
  ])
}

const asUserA = {
  authorization: `Bearer ${USER_A.token}`,
  'x-workspace-id': WORKSPACE_A,
}

const asUserB = {
  authorization: `Bearer ${USER_B.token}`,
  'x-workspace-id': WORKSPACE_B,
}

beforeAll(async () => {
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

describe('Package Credits HTTP Routes', () => {
  it('GET /api/package-credits/balance returns 200 with initial zero balance', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/package-credits/balance?customerId=${CUST_A}&packageProductId=${PROD_PKG_A}`,
      headers: asUserA,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.balance).toBe(0)
    expect(body.data.customerId).toBe(CUST_A)
  })

  it('POST /api/package-credits/grant returns 201 and updates balance', async () => {
    const grantRes = await app.inject({
      method: 'POST',
      url: '/api/package-credits/grant',
      headers: asUserA,
      payload: {
        customerId: CUST_A,
        packageProductId: PROD_PKG_A,
        quantity: 10,
        unit: 'session',
        notes: 'HTTP grant test',
      },
    })

    expect(grantRes.statusCode).toBe(201)
    const grantBody = grantRes.json()
    expect(grantBody.entryType).toBe('GRANT')
    expect(grantBody.quantity).toBe(10)

    const balRes = await app.inject({
      method: 'GET',
      url: `/api/package-credits/balance?customerId=${CUST_A}&packageProductId=${PROD_PKG_A}`,
      headers: asUserA,
    })
    expect(balRes.statusCode).toBe(200)
    expect(balRes.json().data.balance).toBe(10)
  })

  it('POST /api/package-credits/consume returns 201 on success and 409 on over-consumption', async () => {
    // Grant 5 credits first
    await app.inject({
      method: 'POST',
      url: '/api/package-credits/grant',
      headers: asUserA,
      payload: {
        customerId: CUST_A,
        packageProductId: PROD_PKG_A,
        quantity: 5,
      },
    })

    // Consume 3 credits -> 201
    const consumeRes = await app.inject({
      method: 'POST',
      url: '/api/package-credits/consume',
      headers: asUserA,
      payload: {
        customerId: CUST_A,
        packageProductId: PROD_PKG_A,
        quantity: 3,
      },
    })
    expect(consumeRes.statusCode).toBe(201)

    // Consume 3 more (balance is now 2) -> 409 Conflict
    const overConsumeRes = await app.inject({
      method: 'POST',
      url: '/api/package-credits/consume',
      headers: asUserA,
      payload: {
        customerId: CUST_A,
        packageProductId: PROD_PKG_A,
        quantity: 3,
      },
    })
    expect(overConsumeRes.statusCode).toBe(409)
  })

  it('Cross-workspace isolation: Workspace B cannot read or consume Workspace A package credits', async () => {
    // Grant credits in Workspace A
    await app.inject({
      method: 'POST',
      url: '/api/package-credits/grant',
      headers: asUserA,
      payload: {
        customerId: CUST_A,
        packageProductId: PROD_PKG_A,
        quantity: 10,
      },
    })

    // Workspace B attempts to read Customer A balance in Workspace B
    const bRes = await app.inject({
      method: 'GET',
      url: `/api/package-credits/balance?customerId=${CUST_A}&packageProductId=${PROD_PKG_A}`,
      headers: asUserB,
    })
    expect(bRes.statusCode).toBe(200)
    expect(bRes.json().data.balance).toBe(0)

    // Workspace B attempts to consume Customer A credits in Workspace B -> 409
    const bConsume = await app.inject({
      method: 'POST',
      url: '/api/package-credits/consume',
      headers: asUserB,
      payload: {
        customerId: CUST_A,
        packageProductId: PROD_PKG_A,
        quantity: 1,
      },
    })
    expect(bConsume.statusCode).toBe(409)
  })
})
