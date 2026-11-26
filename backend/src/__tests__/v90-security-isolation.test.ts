// ============================================
// backend/src/__tests__/v90-security-isolation.test.ts
//
// Adversarial cross-tenant IDOR, RBAC role escalation, payload tampering,
// and live/ready observability probe verification via buildServer() + app.inject().
// ============================================

import type { FastifyInstance } from 'fastify'
import { createHash } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDatabase, createFakeDb, fakeId } from './helpers/fake-supabase'

const db = new FakeDatabase()
const OWNER_A = { id: '11111111-1111-4111-8111-111111111111', token: 'token-owner-a' }
const SELLER_A = { id: '22222222-2222-4222-8222-222222222222', token: 'token-seller-a' }
const VIEWER_A = { id: '33333333-3333-4333-8333-333333333333', token: 'token-viewer-a' }
const OWNER_B = { id: '44444444-4444-4444-8444-444444444444', token: 'token-owner-b' }

const SHOP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SHOP_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PROJ_A = 'cccccccc-0000-4000-8000-000000000001'
const ORDER_A = 'dddddddd-0000-4000-8000-000000000001'
const TICKET_A = 'eeeeeeee-0000-4000-8000-000000000001'

const users = new Map<string, { id: string }>([
  [OWNER_A.token, { id: OWNER_A.id }],
  [SELLER_A.token, { id: SELLER_A.id }],
  [VIEWER_A.token, { id: VIEWER_A.id }],
  [OWNER_B.token, { id: OWNER_B.id }],
])
vi.mock('../db', () => createFakeDb(db, users))

let app: FastifyInstance
let setPrimaryHealthProbeForTest: typeof import('../routes/database-ha.routes').setPrimaryHealthProbeForTest
beforeAll(async () => {
  const ha = await import('../routes/database-ha.routes')
  setPrimaryHealthProbeForTest = ha.setPrimaryHealthProbeForTest
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
})

afterAll(async () => {
  setPrimaryHealthProbeForTest?.(null)
  await app?.close()
})

beforeEach(() => {
  setPrimaryHealthProbeForTest?.(null)
  db.tables.clear()
  db.failures.clear()
  db.seed('workspaces', [
    { id: SHOP_A, name: 'Shop A', base_currency: 'AFN', time_zone: 'Asia/Kabul' },
    { id: SHOP_B, name: 'Shop B', base_currency: 'USD', time_zone: 'Asia/Kabul' },
  ])
  db.seed('workspace_members', [
    {
      id: fakeId('ma-owner'),
      workspace_id: SHOP_A,
      user_id: OWNER_A.id,
      role: 'owner',
      has_access: true,
      suspended_at: null,
    },
    {
      id: fakeId('ma-seller'),
      workspace_id: SHOP_A,
      user_id: SELLER_A.id,
      role: 'seller',
      has_access: true,
      suspended_at: null,
    },
    {
      id: fakeId('ma-viewer'),
      workspace_id: SHOP_A,
      user_id: VIEWER_A.id,
      role: 'viewer',
      has_access: true,
      suspended_at: null,
    },
    {
      id: fakeId('mb-owner'),
      workspace_id: SHOP_B,
      user_id: OWNER_B.id,
      role: 'owner',
      has_access: true,
      suspended_at: null,
    },
  ])
  db.seed('products', [{ id: fakeId('prod'), workspace_id: SHOP_A, name: 'Tea' }])
  db.seed('projects', [
    { id: PROJ_A, workspace_id: SHOP_A, name: 'Warehouse Fitout', budget: 1000, currency: 'AFN' },
  ])
  db.seed('project_change_orders', [
    {
      id: ORDER_A,
      workspace_id: SHOP_A,
      project_id: PROJ_A,
      title: 'Electrical upgrade',
      original_budget_minor: 100000,
      delta_minor: 20000,
      revised_budget_minor: 120000,
      estimated_cost_delta_minor: 10000,
      net_margin_delta_minor: 10000,
      status: 'pending_approval',
      created_by: OWNER_A.id,
    },
  ])
  db.seed('support_tickets', [
    {
      id: TICKET_A,
      workspace_id: SHOP_A,
      ticket_code: 'HSB-SEC-1',
      subject: 'Invoice layout print gap',
      priority: 'high',
      category: 'pos',
      description: 'Thermal printer wraps SKU line',
      sla_hours: 4,
      response_due_at: new Date(Date.now() + 3600_000).toISOString(),
      status: 'open',
      escalation_level: 0,
      created_by: SELLER_A.id,
    },
  ])
  db.seed('support_ticket_events', [])
  db.seed('support_ticket_comments', [
    {
      id: fakeId('c-public'),
      workspace_id: SHOP_A,
      ticket_id: TICKET_A,
      author_id: SELLER_A.id,
      is_internal: false,
      body: 'Customer confirmed firmware version',
      created_at: new Date().toISOString(),
    },
    {
      id: fakeId('c-internal'),
      workspace_id: SHOP_A,
      ticket_id: TICKET_A,
      author_id: OWNER_A.id,
      is_internal: true,
      body: 'Internal escalation billing credit note pending',
      created_at: new Date().toISOString(),
    },
  ])
  db.seed('audit_logs', [])
  db.seed('activities', [])
})

describe('V90 Security, Tenancy IDOR, Role Escalation & Readiness Probes', () => {
  it('blocks cross-tenant access (Owner B cannot read or mutate Shop A tickets, change orders, or exports)', async () => {
    const hdrB = { authorization: `Bearer ${OWNER_B.token}`, 'x-workspace-id': SHOP_B }

    const readEvents = await app.inject({
      method: 'GET',
      url: `/api/v1/support-tickets/${TICKET_A}/events`,
      headers: hdrB,
    })
    expect(readEvents.statusCode).toBe(404)

    const patchStatus = await app.inject({
      method: 'PATCH',
      url: `/api/v1/support-tickets/${TICKET_A}/status`,
      headers: hdrB,
      payload: { status: 'acknowledged' },
    })
    expect(patchStatus.statusCode).toBe(404)

    const decideOrder = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJ_A}/change-orders/${ORDER_A}/decide`,
      headers: hdrB,
      payload: { decision: 'approved' },
    })
    expect(decideOrder.statusCode).toBe(404)

    const restoreMismatch = await app.inject({
      method: 'POST',
      url: `/api/workspaces/${SHOP_A}/export-restore-preview`,
      headers: hdrB,
      payload: { backup: { meta: {}, data: {} } },
    })
    expect(restoreMismatch.statusCode).toBe(403)
  })

  it('rejects cross-tenant payload injection inside export-restore-preview', async () => {
    const backupData = {
      products: [
        {
          id: fakeId('foreign-prod'),
          workspace_id: SHOP_B,
          name: 'Smuggled foreign SKU',
        },
      ],
    }
    const checksumSha256 = createHash('sha256').update(JSON.stringify(backupData)).digest('hex')
    const res = await app.inject({
      method: 'POST',
      url: `/api/workspaces/${SHOP_A}/export-restore-preview`,
      headers: { authorization: `Bearer ${OWNER_A.token}`, 'x-workspace-id': SHOP_A },
      payload: {
        meta: { workspaceId: SHOP_A, schemaVersion: '1.0', checksumSha256 },
        data: backupData,
      },
    })
    expect(res.statusCode, res.body).toBe(200)
    const body = res.json()
    expect(body.data.valid).toBe(false)
    expect(body.data.crossTenantRows).toHaveLength(1)
    expect(body.data.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('CROSS_TENANT_ROW_DETECTED')]),
    )
    expect(body.data.restoreExecutionSupported).toBe(false)
  })

  it('enforces role boundaries: seller & viewer cannot escalate privileges or read internal ticket notes', async () => {
    const hdrSeller = { authorization: `Bearer ${SELLER_A.token}`, 'x-workspace-id': SHOP_A }
    const hdrViewer = { authorization: `Bearer ${VIEWER_A.token}`, 'x-workspace-id': SHOP_A }

    const sellerStatus = await app.inject({
      method: 'PATCH',
      url: `/api/v1/support-tickets/${TICKET_A}/status`,
      headers: hdrSeller,
      payload: { status: 'acknowledged' },
    })
    expect(sellerStatus.statusCode).toBe(403)

    const sellerAssign = await app.inject({
      method: 'POST',
      url: `/api/v1/support-tickets/${TICKET_A}/assign`,
      headers: hdrSeller,
      payload: { assigneeId: OWNER_A.id },
    })
    expect(sellerAssign.statusCode).toBe(403)

    const sellerInternalNote = await app.inject({
      method: 'POST',
      url: `/api/v1/support-tickets/${TICKET_A}/comments`,
      headers: hdrSeller,
      payload: { body: 'Trying internal note', isInternal: true },
    })
    expect(sellerInternalNote.statusCode).toBe(403)

    const sellerReadComments = await app.inject({
      method: 'GET',
      url: `/api/v1/support-tickets/${TICKET_A}/comments`,
      headers: hdrSeller,
    })
    expect(sellerReadComments.statusCode).toBe(200)
    const visibleComments = sellerReadComments.json().data as Array<{ is_internal?: boolean }>
    expect(visibleComments).toHaveLength(1)
    expect(visibleComments[0]?.is_internal).toBe(false)

    const sellerDecideOrder = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJ_A}/change-orders/${ORDER_A}/decide`,
      headers: hdrSeller,
      payload: { decision: 'approved' },
    })
    expect(sellerDecideOrder.statusCode).toBe(403)

    const viewerCreateOrder = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJ_A}/change-orders`,
      headers: hdrViewer,
      payload: { title: 'Viewer tamper', deltaMinor: 1000 },
    })
    expect(viewerCreateOrder.statusCode).toBe(403)
  })

  it('proves /live, /ready (200 healthy / 503 failed DB), and /api/health/db readiness semantics', async () => {
    const live = await app.inject({ method: 'GET', url: '/live' })
    expect(live.statusCode).toBe(200)
    expect(live.json().status).toBe('ok')

    const readyOk = await app.inject({ method: 'GET', url: '/ready' })
    expect(readyOk.statusCode).toBe(200)
    expect(readyOk.json().database).toBe('connected')

    db.fail('products', { message: 'simulated primary outage' })
    const readyFail = await app.inject({ method: 'GET', url: '/ready' })
    expect(readyFail.statusCode).toBe(503)
    expect(readyFail.json().database).toBe('disconnected')

    setPrimaryHealthProbeForTest(async () => ({ healthy: false, latencyMs: 5000 }))
    const dbHealthFail = await app.inject({ method: 'GET', url: '/api/health/db' })
    expect(dbHealthFail.statusCode).toBe(503)
    expect(dbHealthFail.json().status).toBe('degraded')
  })
})
