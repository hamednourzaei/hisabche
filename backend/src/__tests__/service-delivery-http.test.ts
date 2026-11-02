// ============================================
// backend/src/__tests__/service-delivery-http.test.ts
//
// M4: Fastify HTTP Route Verification for Service Delivery (buildServer + app.inject)
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
const PROD_SRV_A = fakeId('prod-srv-a')
const PROD_PKG_A = fakeId('prod-pkg-a')
const EMP_DOC_A = fakeId('emp-doc-a')

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
    {
      id: PROD_SRV_A,
      workspace_id: WORKSPACE_A,
      name: 'Physiotherapy Consultation',
      offering_type: 'service',
    },
    {
      id: PROD_PKG_A,
      workspace_id: WORKSPACE_A,
      name: '10-Session Course',
      offering_type: 'package',
    },
  ])

  db.seed('employees', [
    { id: EMP_DOC_A, workspace_id: WORKSPACE_A, full_name: 'Dr. Ahmad', is_active: true },
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

/** What the function was called with, and what it should answer (undefined = answer a normal delivery). */
let deliverCalls: Array<Record<string, unknown>> = []
let cancelCalls: Array<Record<string, unknown>> = []
let deliverFails: string | null = null

beforeEach(() => {
  resetWorld()
  deliverCalls = []
  cancelCalls = []
  deliverFails = null
  db.rpcs.clear()
  db.rpc('service_delivery_deliver', (args) => {
    deliverCalls.push(args)
    if (deliverFails) throw new Error(deliverFails)
    return { replayed: false, package_credit_id: null }
  })
  db.rpc('service_delivery_cancel', (args) => {
    cancelCalls.push(args)
    return { replayed: false, reversal_entry_id: null }
  })
})

async function schedule(extra: Record<string, unknown> = {}) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/service-delivery/sessions',
    headers: asUserA,
    payload: {
      customerId: CUST_A,
      serviceOfferingId: PROD_SRV_A,
      sessionDate: '2026-11-02',
      startTime: '14:00',
      endTime: '15:00',
      ...extra,
    },
  })
  return res
}

describe('Service Delivery HTTP Routes', () => {
  it('GET /api/service-delivery/sessions returns 200 with list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/service-delivery/sessions',
      headers: asUserA,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
  })

  it('POST /api/service-delivery/sessions returns 201 and creates session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/service-delivery/sessions',
      headers: asUserA,
      payload: {
        customerId: CUST_A,
        serviceOfferingId: PROD_SRV_A,
        practitionerId: EMP_DOC_A,
        sessionDate: '2026-11-02',
        startTime: '10:00',
        endTime: '11:00',
        status: 'scheduled',
        settlementMethod: 'package_credit',
      },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.id).toBeDefined()
    expect(body.durationMinutes).toBe(60)
    expect(body.status).toBe('scheduled')
  })

  it('POST .../deliver hands the WHOLE intent to the one atomic function and answers in the device shape', async () => {
    const sessionId = (await schedule()).json().id
    const entryId = fakeId('entry')

    const res = await app.inject({
      method: 'POST',
      url: `/api/service-delivery/sessions/${sessionId}/deliver`,
      headers: { ...asUserA, 'idempotency-key': 'some-header-id' },
      payload: {
        settlementMethod: 'package_credit',
        packageProductId: PROD_PKG_A,
        quantity: 1,
        consumptionEntryId: entryId,
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.session).toMatchObject({ id: sessionId })
    expect(body).not.toHaveProperty('data')
    expect(deliverCalls).toHaveLength(1)
    expect(deliverCalls[0]).toMatchObject({
      p_workspace_id: WORKSPACE_A,
      p_session_id: sessionId,
      p_settlement: 'package_credit',
      p_package_product_id: PROD_PKG_A,
      p_quantity: 1,
      p_entry_id: entryId,
    })
    // the request header is NOT the identity of a delivery: the session is
    expect(JSON.stringify(deliverCalls[0])).not.toContain('some-header-id')
  })

  it('refuses a creation that is not scheduled - a session cannot be BORN delivered', async () => {
    const res = await schedule({ status: 'delivered' })
    expect(res.statusCode).toBeGreaterThanOrEqual(400)
    expect(res.statusCode).toBeLessThan(500)
  })

  it('the same session id again is a replay, not a database error', async () => {
    const id = fakeId('ses-replay')
    const first = await schedule({ id })
    expect(first.statusCode).toBe(201)
    const again = await schedule({ id })
    expect(again.statusCode).toBeLessThan(300)
    expect(again.json().id).toBe(id)
  })

  it('maps the database codes to the status they deserve', async () => {
    const sessionId = (await schedule()).json().id
    const call = () =>
      app.inject({
        method: 'POST',
        url: `/api/service-delivery/sessions/${sessionId}/deliver`,
        headers: asUserA,
        payload: { settlementMethod: 'package_credit' },
      })

    deliverFails = 'INSUFFICIENT_PACKAGE_CREDIT: available 0 is less than requested 1'
    expect((await call()).statusCode).toBe(409)
    deliverFails = 'SETTLEMENT_PACKAGE_REQUIRED'
    expect((await call()).statusCode).toBe(400)
    deliverFails = 'INVALID_STATUS_TRANSITION:cancelled->delivered'
    expect((await call()).statusCode).toBe(409)
    deliverFails = 'SESSION_CHANGED'
    expect((await call()).statusCode).toBe(409)
  })

  it('a cancellation without a reason is a 400 from the database code, and the route sends the reason it was given', async () => {
    const sessionId = (await schedule()).json().id
    db.rpcs.delete('service_delivery_cancel')
    const seen: Array<Record<string, unknown>> = []
    db.rpc('service_delivery_cancel', (args) => {
      seen.push(args)
      if (!args.p_reason) throw new Error('CANCELLATION_REASON_REQUIRED')
      return { replayed: false, reversal_entry_id: null }
    })
    const without = await app.inject({
      method: 'POST',
      url: `/api/service-delivery/sessions/${sessionId}/cancel`,
      headers: asUserA,
      payload: {},
    })
    expect(without.statusCode).toBe(400)
    const withReason = await app.inject({
      method: 'POST',
      url: `/api/service-delivery/sessions/${sessionId}/cancel`,
      headers: asUserA,
      payload: { reason: 'double booked' },
    })
    expect(withReason.statusCode).toBe(200)
    expect(seen.map((args) => args.p_reason)).toEqual([null, 'double booked'])
  })

  it('a database WITHOUT the atomic function refuses the delivery - there is no non-atomic fallback', async () => {
    const sessionId = (await schedule()).json().id
    db.rpcs.delete('service_delivery_deliver')

    const res = await app.inject({
      method: 'POST',
      url: `/api/service-delivery/sessions/${sessionId}/deliver`,
      headers: asUserA,
      payload: { settlementMethod: 'package_credit', packageProductId: PROD_PKG_A },
    })
    expect(res.statusCode).toBeGreaterThanOrEqual(500)
    expect(JSON.stringify(res.json())).not.toContain('delivered')
    const row = db.tables.get('service_delivery_sessions')?.find((r) => r.id === sessionId)
    expect(row?.status).toBe('scheduled')
  })

  it('POST .../cancel hands the reversal id to the one atomic function, in the device shape', async () => {
    const sessionId = (await schedule()).json().id
    const reversalEntryId = fakeId('rev')
    const res = await app.inject({
      method: 'POST',
      url: `/api/service-delivery/sessions/${sessionId}/cancel`,
      headers: asUserA,
      payload: { reversalEntryId, reason: 'customer asked' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveProperty('session')
    expect(res.json()).not.toHaveProperty('data')
    expect(cancelCalls[0]).toMatchObject({
      p_workspace_id: WORKSPACE_A,
      p_session_id: sessionId,
      p_entry_id: reversalEntryId,
      p_reason: 'customer asked',
    })
  })

  it('enforces tenant isolation: Workspace B cannot deliver Workspace A session', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/service-delivery/sessions',
      headers: asUserA,
      payload: {
        customerId: CUST_A,
        serviceOfferingId: PROD_SRV_A,
        sessionDate: '2026-11-02',
        startTime: '16:00',
        endTime: '17:00',
      },
    })

    const sessionId = createRes.json().id

    // User B attempts to access Workspace A's session
    const badRes = await app.inject({
      method: 'POST',
      url: `/api/service-delivery/sessions/${sessionId}/deliver`,
      headers: asUserB,
      payload: {},
    })

    // Must be 404 Not Found (or 403 Forbidden) under tenant boundary
    expect([404, 403]).toContain(badRes.statusCode)
  })
})
