// ============================================
// backend/src/__tests__/v100-admin-control-plane.test.ts
//
// V100 Phase 3 Admin Control Plane Verification Suite:
//   - Unauthorized/non-admin/wrong-RBAC/missing-StepUp rejection
//   - Cross-workspace Support & SLA Queue + atomic RPC transitions & sweeps
//   - Payment Gateway Webhook Events (sanitized, never leaking secrets/raw signatures)
//   - Cross-Core Financial Integrity runner via shared reconcileWorkspaceCrossCore + audit
//   - Project Change Order atomic approval via decide_project_change_order_v2 + version check
//   - Live Capabilities & 21 Cores snapshot from @hisabche/validation
//   - Operational Telemetry included in GET /api/admin/metrics
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { FakeDatabase, createFakeDb } from './helpers/fake-supabase'

process.env.ADMIN_ALLOWED_EMAILS = 'super@hisabche.com,billing@hisabche.com'

const db = new FakeDatabase()

const SHOPKEEPER = {
  id: '11111111-1111-4111-8111-111111111111',
  token: 'token-v100-shopkeeper',
  email: 'shopkeeper@example.com',
}

const SUPER_ADMIN = {
  id: '22222222-2222-4222-8222-222222222222',
  token: 'token-v100-super',
  email: 'super@hisabche.com',
}

const BILLING_ADMIN = {
  id: '33333333-3333-4333-8333-333333333333',
  token: 'token-v100-billing',
  email: 'billing@hisabche.com',
}

const WS_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const TICKET_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PROJECT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const ORDER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const INV_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

const users = new Map<string, { id: string; email: string }>([
  [SHOPKEEPER.token, { id: SHOPKEEPER.id, email: SHOPKEEPER.email }],
  [SUPER_ADMIN.token, { id: SUPER_ADMIN.id, email: SUPER_ADMIN.email }],
  [BILLING_ADMIN.token, { id: BILLING_ADMIN.id, email: BILLING_ADMIN.email }],
])

function authStepUp(admin: { id: string; email: string }, offsetSec = 0) {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const totpTs = Math.floor(Date.now() / 1000) + offsetSec
  const tok = [
    b64({ alg: 'HS256' }),
    b64({
      sub: admin.id,
      aal: 'aal2',
      amr: [
        { method: 'password', timestamp: totpTs - 300 },
        { method: 'totp', timestamp: totpTs },
      ],
    }),
    'sig',
  ].join('.')
  users.set(tok, { id: admin.id, email: admin.email })
  return {
    authorization: `Bearer ${tok}`,
    'x-admin-step-up-timestamp': String(totpTs),
  }
}

vi.mock('../db', () => {
  const fake = createFakeDb(db, users)
  return {
    ...fake,
    supabase: {
      ...fake.supabase,
      auth: {
        ...fake.supabase.auth,
        admin: {
          signOut: async (_userId: string) => ({ error: null }),
        },
      },
    },
  }
})

let app: FastifyInstance

beforeAll(async () => {
  db.seed('admin_accounts', [
    {
      id: 'acc-v100-1',
      user_id: SUPER_ADMIN.id,
      email: SUPER_ADMIN.email,
      role: 'SUPER',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'acc-v100-2',
      user_id: BILLING_ADMIN.id,
      email: BILLING_ADMIN.email,
      role: 'BILLING',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ])

  db.seed('workspaces', [
    {
      id: WS_ID,
      name: 'Kabul Gold Exchange',
      base_currency: 'XAU',
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ])

  db.seed('support_tickets', [
    {
      id: TICKET_ID,
      workspace_id: WS_ID,
      ticket_code: 'HSB-SLA-1',
      subject: 'Invoice posting stalled',
      priority: 'high',
      category: 'accounting',
      status: 'open',
      sla_hours: 4,
      response_due_at: new Date(Date.now() - 3600_000).toISOString(),
      escalation_level: 0,
      assigned_to: null,
      created_at: new Date(Date.now() - 7200_000).toISOString(),
      updated_at: null,
    },
  ])

  db.seed('payment_gateway_events', [
    {
      id: 'ev-gw-1',
      workspace_id: WS_ID,
      payment_id: 'pay-1',
      gateway_name: 'STRIPE',
      event_id: 'evt_123',
      event_type: 'payment_intent.succeeded',
      amount_minor: 5000,
      currency: 'USD',
      signature_verified: true,
      processing_status: 'processed',
      delivery_attempts: 1,
      last_error: null,
      raw_payload: '{"secret":"MUST_NOT_LEAK"}',
      created_at: new Date().toISOString(),
    },
  ])

  db.seed('projects', [
    {
      id: PROJECT_ID,
      workspace_id: WS_ID,
      name: 'Warehouse Buildout',
      currency: 'USD',
      budget: 1000,
      budget_minor: 100000,
      budget_version: 1,
    },
  ])

  db.seed('project_change_orders', [
    {
      id: ORDER_ID,
      workspace_id: WS_ID,
      project_id: PROJECT_ID,
      title: 'Add cold storage rack',
      delta_minor: 25000,
      status: 'pending_approval',
      decision_reason: null,
      decided_at: null,
      created_at: new Date().toISOString(),
    },
  ])

  db.seed('invoices', [
    {
      id: INV_ID,
      workspace_id: WS_ID,
      currency: 'USD',
      total: 100,
      paid_amount: 0,
      status: 'completed',
    },
  ])

  db.seed('offline_devices', [
    {
      id: 'dev-1',
      device_id: 'dev-guid-1',
      workspace_id: WS_ID,
      device_seat: 'computer',
      label: 'Cashier 1',
      is_active: true,
      last_seen_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  ])

  const { buildServer } = await import('../index')
  app = await buildServer({ testRuntime: true })
})

afterAll(async () => {
  await app.close()
})

describe('V100 Admin Control Plane across 8 Hubs', () => {
  it('blocks non-admin shopkeepers and wrong RBAC roles or missing Step-Up', async () => {
    const shopRes = await app.inject({
      method: 'GET',
      url: '/api/admin/ops/support-tickets',
      headers: { authorization: `Bearer ${SHOPKEEPER.token}` },
    })
    expect(shopRes.statusCode).toBe(403)

    const billingReadTickets = await app.inject({
      method: 'GET',
      url: '/api/admin/ops/support-tickets',
      headers: authStepUp(BILLING_ADMIN),
    })
    expect(billingReadTickets.statusCode).toBe(403)

    // Billing CAN reconcile workspace books with Step-Up, MUST be rejected without fresh Step-Up
    const staleReconcile = await app.inject({
      method: 'POST',
      url: '/api/admin/ops/reconcile-workspace',
      headers: authStepUp(BILLING_ADMIN, -900),
      payload: { workspaceId: WS_ID },
    })
    expect(staleReconcile.statusCode).toBe(403)
  })

  it('lists gateway webhook events without leaking raw payloads or secrets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/ops/gateway-events',
      headers: authStepUp(BILLING_ADMIN),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { events: Array<Record<string, unknown>> }
    expect(body.events.length).toBe(1)
    expect(body.events[0]?.provider).toBe('STRIPE')
    expect(body.events[0]?.signature_valid).toBe(true)
    expect(body.events[0]).not.toHaveProperty('raw_payload')
    expect(JSON.stringify(body)).not.toContain('MUST_NOT_LEAK')
  })

  it('runs cross-core workspace reconciliation from the Admin Control Plane and audits the run', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/ops/reconcile-workspace',
      headers: authStepUp(BILLING_ADMIN),
      payload: { workspaceId: WS_ID },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { balanced: boolean; missingPostings: number } }
    expect(body.data.balanced).toBe(false)
    expect(body.data.missingPostings).toBe(1)
    expect(
      db
        .rows('admin_security_events')
        .some((e) => e.event_type === 'ADMIN_WORKSPACE_RECONCILE_RUN'),
    ).toBe(true)
  })

  it('evaluates Support SLAs, transitions support ticket atomically, and decides change order atomically', async () => {
    const superHeaders = authStepUp(SUPER_ADMIN)

    const sweepRes = await app.inject({
      method: 'POST',
      url: '/api/admin/ops/support-tickets/evaluate-sla',
      headers: superHeaders,
      payload: {},
    })
    expect(sweepRes.statusCode).toBe(200)
    expect(
      (sweepRes.json() as { evaluatedCount: number; escalatedTicketIds: string[] })
        .escalatedTicketIds,
    ).toContain(TICKET_ID)

    const transRes = await app.inject({
      method: 'PATCH',
      url: `/api/admin/ops/support-tickets/${TICKET_ID}/status`,
      headers: superHeaders,
      payload: { status: 'acknowledged', note: 'Investigating ledger event' },
    })
    expect(transRes.statusCode).toBe(200)
    expect(db.rows('support_tickets').find((t) => t.id === TICKET_ID)?.status).toBe('acknowledged')

    const coRes = await app.inject({
      method: 'POST',
      url: `/api/admin/ops/change-orders/${ORDER_ID}/decide`,
      headers: superHeaders,
      payload: { decision: 'approved', expectedVersion: 1 },
    })
    expect(coRes.statusCode).toBe(200)
    expect(db.rows('project_change_orders').find((o) => o.id === ORDER_ID)?.status).toBe('approved')
    expect(db.rows('projects').find((p) => p.id === PROJECT_ID)?.budget).toBe(1250)
  })

  it('exposes real Capabilities & 21 Cores snapshot and operational telemetry in /api/admin/metrics', async () => {
    const superHeaders = authStepUp(SUPER_ADMIN)

    const capRes = await app.inject({
      method: 'GET',
      url: '/api/admin/ops/capabilities',
      headers: superHeaders,
    })
    expect(capRes.statusCode).toBe(200)
    const capBody = capRes.json() as { industryCount: number; engineCount: number }
    expect(capBody.industryCount).toBe(67)
    expect(capBody.engineCount).toBe(21)

    const metricsRes = await app.inject({
      method: 'GET',
      url: '/api/admin/metrics',
      headers: superHeaders,
    })
    expect(metricsRes.statusCode).toBe(200)
    const metricsBody = metricsRes.json() as {
      operations: { openSupportTickets: number; offlineDevicesActive: number }
    }
    expect(metricsBody.operations.openSupportTickets).toBeGreaterThanOrEqual(1)
    expect(metricsBody.operations.offlineDevicesActive).toBeGreaterThanOrEqual(1)
  })
})
