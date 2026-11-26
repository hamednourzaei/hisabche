// ============================================
// backend/src/__tests__/step-d-market-research-capabilities.test.ts
//
// STEP-D HTTP & Domain tests via buildServer() + app.inject():
//   - X06  GET  /api/workspaces/:id/export-bundle
//   - X07  POST /api/billing/tco-estimate
//   - X08  POST /api/v1/support-tickets
//   - X10  canTransitionOfflineCardPayment (@hisabche/validation)
//   - X13  GET  /api/marketplace/integrations/health
//   - X14  POST /api/appointments/no-show-fee
//   - X21  POST /api/contracts/:id/e-sign
// ============================================

import type { FastifyInstance } from 'fastify'
import { canTransitionOfflineCardPayment } from '@hisabche/validation'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDatabase, createFakeDb, fakeId } from './helpers/fake-supabase'

const db = new FakeDatabase()
const OWNER = { id: '11111111-1111-4111-8111-111111111111', token: 'token-owner' }
const CLERK = { id: '22222222-2222-4222-8222-222222222222', token: 'token-clerk' }
const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CONTRACT_ID = 'cccccccc-0000-4000-8000-000000000001'

const users = new Map<string, { id: string }>([
  [OWNER.token, { id: OWNER.id }],
  [CLERK.token, { id: CLERK.id }],
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
    { id: SHOP, name: 'Hisabche Demo', base_currency: 'AFN', time_zone: 'Asia/Kabul' },
  ])
  db.seed('support_tickets', [])
  db.seed('support_ticket_events', [])
  db.seed('support_ticket_comments', [])
  db.seed('activities', [])
  db.seed('audit_logs', [])
  db.seed('workspace_members', [
    {
      id: fakeId('mem'),
      workspace_id: SHOP,
      user_id: OWNER.id,
      role: 'owner',
      has_access: true,
      suspended_at: null,
    },
    {
      id: fakeId('mem-seller'),
      workspace_id: SHOP,
      user_id: CLERK.id,
      role: 'seller',
      has_access: true,
      suspended_at: null,
    },
  ])
})

describe('STEP-D — Market Research X06-X21 capabilities', () => {
  it('X07/X08/X13 compute TCO breakdown, create SLA ticket, and return integration health', async () => {
    const tco = await app.inject({
      method: 'POST',
      url: '/api/billing/tco-estimate',
      headers: { authorization: `Bearer ${OWNER.token}` },
      payload: {
        basePlanMonthlyMinor: 5000,
        extraUsers: 2,
        perUserMonthlyMinor: 500,
        extraBranches: 1,
        perBranchMonthlyMinor: 1000,
        addonsMonthlyMinor: 1000,
        annualDiscountBps: 1000,
        currency: 'usd',
      },
    })
    expect(tco.statusCode, tco.body).toBe(200)
    expect(tco.json().data.monthlyTotalMinor).toBe(8000)
    expect(tco.json().data.annualNetMinor).toBe(86400)

    const ticket = await app.inject({
      method: 'POST',
      url: '/api/v1/support-tickets',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: {
        subject: 'POS printer alignment issue',
        priority: 'high',
        category: 'pos',
        description: 'Thermal printer cuts off footer on 58mm roll.',
      },
    })
    expect(ticket.statusCode, ticket.body).toBe(201)
    expect(ticket.json().data.slaHours).toBe(4)
    expect(ticket.json().data.status).toBe('open')

    const listTickets = await app.inject({
      method: 'GET',
      url: '/api/v1/support-tickets',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
    })
    expect(listTickets.statusCode).toBe(200)
    expect(listTickets.json().data).toHaveLength(1)

    const ticketId = ticket.json().data.id
    // Ordinary non-manager workspace member (clerk) must receive 403 on ticket status transition & SLA sweep
    const forbiddenStatus = await app.inject({
      method: 'PATCH',
      url: `/api/v1/support-tickets/${ticketId}/status`,
      headers: { authorization: `Bearer ${CLERK.token}`, 'x-workspace-id': SHOP },
      payload: { status: 'resolved' },
    })
    expect(forbiddenStatus.statusCode).toBe(403)

    const resolveRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/support-tickets/${ticketId}/status`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: { status: 'resolved', rcaSummary: 'Adjusted ESC/POS margin offset to 4mm.' },
    })
    expect(resolveRes.statusCode, resolveRes.body).toBe(200)
    expect(resolveRes.json().data.status).toBe('resolved')
    expect(resolveRes.json().data.rca_summary).toContain('4mm')

    // Reopen without reason rejected (400), with reason allowed (200), then closed -> invalid direct jump check
    const reopenNoReason = await app.inject({
      method: 'PATCH',
      url: `/api/v1/support-tickets/${ticketId}/status`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: { status: 'acknowledged' },
    })
    expect(reopenNoReason.statusCode).toBe(400)

    const reopenOk = await app.inject({
      method: 'PATCH',
      url: `/api/v1/support-tickets/${ticketId}/status`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: { status: 'acknowledged', reason: 'Customer still sees cut footer' },
    })
    expect(reopenOk.statusCode).toBe(200)
    expect(reopenOk.json().data.status).toBe('acknowledged')

    // Invalid jump acknowledged -> closed without resolving must return 409
    const invalidJump = await app.inject({
      method: 'PATCH',
      url: `/api/v1/support-tickets/${ticketId}/status`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: { status: 'closed' },
    })
    expect(invalidJump.statusCode).toBe(409)

    // Assign within workspace allowed; outsider blocked 404
    const assignOk = await app.inject({
      method: 'POST',
      url: `/api/v1/support-tickets/${ticketId}/assign`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: { assigneeId: CLERK.id },
    })
    expect(assignOk.statusCode).toBe(200)
    expect(assignOk.json().data.assigned_to).toBe(CLERK.id)

    const assignOutsider = await app.inject({
      method: 'POST',
      url: `/api/v1/support-tickets/${ticketId}/assign`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: { assigneeId: '99999999-9999-4999-8999-999999999999' },
    })
    expect(assignOutsider.statusCode).toBe(404)

    // Internal comment blocked for clerk (403); owner note masked when clerk fetches comments
    const clerkInternalPost = await app.inject({
      method: 'POST',
      url: `/api/v1/support-tickets/${ticketId}/comments`,
      headers: { authorization: `Bearer ${CLERK.token}`, 'x-workspace-id': SHOP },
      payload: { body: 'secret debug note', isInternal: true },
    })
    expect(clerkInternalPost.statusCode).toBe(403)

    await app.inject({
      method: 'POST',
      url: `/api/v1/support-tickets/${ticketId}/comments`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: { body: 'Internal triage: escalate hardware firmware', isInternal: true },
    })
    await app.inject({
      method: 'POST',
      url: `/api/v1/support-tickets/${ticketId}/comments`,
      headers: { authorization: `Bearer ${CLERK.token}`, 'x-workspace-id': SHOP },
      payload: { body: 'Checked USB cable on cashier station', isInternal: false },
    })
    const clerkComments = await app.inject({
      method: 'GET',
      url: `/api/v1/support-tickets/${ticketId}/comments`,
      headers: { authorization: `Bearer ${CLERK.token}`, 'x-workspace-id': SHOP },
    })
    expect(clerkComments.statusCode).toBe(200)
    expect(clerkComments.json().data).toHaveLength(1)

    const eventsRes = await app.inject({
      method: 'GET',
      url: `/api/v1/support-tickets/${ticketId}/events`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
    })
    expect(eventsRes.statusCode).toBe(200)
    expect(eventsRes.json().data.length).toBeGreaterThanOrEqual(4)

    // Overdue SLA sweep escalates open breached tickets automatically
    db.seed('support_tickets', [
      ...db.rows('support_tickets'),
      {
        id: 'dddddddd-0000-4000-8000-000000000099',
        workspace_id: SHOP,
        ticket_code: 'HSB-OVERDUE',
        subject: 'Overdue sync incident',
        priority: 'critical',
        category: 'sync',
        description: 'Overdue response window',
        sla_hours: 2,
        response_due_at: '2020-01-01T00:00:00.000Z',
        status: 'open',
        escalation_level: 0,
        created_by: OWNER.id,
      },
    ])
    const slaSweep = await app.inject({
      method: 'POST',
      url: '/api/v1/support-tickets/evaluate-sla',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: {},
    })
    expect(slaSweep.statusCode).toBe(200)
    expect(slaSweep.json().data.escalatedTicketIds).toContain(
      'dddddddd-0000-4000-8000-000000000099',
    )

    const health = await app.inject({
      method: 'GET',
      url: '/api/marketplace/integrations/health',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
    })
    expect(health.statusCode, health.body).toBe(200)
    expect(health.json().data.status).toBe('healthy')
  })

  it('X10/X14/X21 validate offline card transitions, no-show fees, and contract e-sign', async () => {
    expect(canTransitionOfflineCardPayment('queued_offline', 'pending_capture')).toBe(true)
    expect(canTransitionOfflineCardPayment('pending_capture', 'captured')).toBe(true)
    expect(canTransitionOfflineCardPayment('voided', 'captured')).toBe(false)

    const noShow = await app.inject({
      method: 'POST',
      url: '/api/appointments/no-show-fee',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: {
        depositMinor: 5000,
        noShowFeeMinor: 2000,
        hoursBeforeAppointment: 4,
        freeCancelWindowHours: 24,
      },
    })
    expect(noShow.statusCode, noShow.body).toBe(200)
    expect(noShow.json().data).toEqual({
      withinFreeWindow: false,
      forfeitedMinor: 2000,
      refundableMinor: 3000,
    })

    const esign = await app.inject({
      method: 'POST',
      url: `/api/contracts/${CONTRACT_ID}/e-sign`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
      payload: {
        signerName: 'Ahmad Rahimi',
        signerEmail: 'ahmad@example.com',
        documentSha256: 'a'.repeat(64),
      },
    })
    expect(esign.statusCode, esign.body).toBe(200)
    expect(esign.json().data.status).toBe('signed')
  })

  it('X06 serves self-serve workspace export bundle', async () => {
    const exp = await app.inject({
      method: 'GET',
      url: `/api/workspaces/${SHOP}/export-bundle`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP },
    })
    expect(exp.statusCode, exp.body).toBe(200)
    expect(exp.json().data.workspaceId).toBe(SHOP)
    expect(exp.json().data.formats).toEqual(['json', 'markdown'])
    expect(exp.json().data.markdownBytes).toBeGreaterThan(0)
  })
})
