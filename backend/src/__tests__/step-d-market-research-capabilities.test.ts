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
const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CONTRACT_ID = 'cccccccc-0000-4000-8000-000000000001'

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
    { id: SHOP, name: 'Hisabche Demo', base_currency: 'AFN', time_zone: 'Asia/Kabul' },
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
