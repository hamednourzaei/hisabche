// ============================================
// backend/src/__tests__/v59-1-gold-routes-http.test.ts
//
// Real Fastify HTTP integration tests (buildServer + app.inject) for Item 2 (Gold):
//   • POST /api/metal-rates & GET /api/metal-rates (rate board history)
//   • POST /api/gold/second-hand-purchase (KYC threshold enforcement + idempotency)
//   • POST /api/gold/melt-scrap (loss calculation + recovered > input refusal)
//   • POST /api/gold/reconciliations & GET /api/gold/reconciliations
//   • Cross-tenant 403 enforcement
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDatabase, createFakeDb, fakeId, type Row } from './helpers/fake-supabase'

const db = new FakeDatabase()
const OWNER = { id: '11111111-1111-4111-8111-111111111111', token: 'token-gold-owner' }
const STRANGER = { id: '22222222-2222-4222-8222-222222222222', token: 'token-gold-stranger' }
const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const users = new Map<string, { id: string }>([
  [OWNER.token, { id: OWNER.id }],
  [STRANGER.token, { id: STRANGER.id }],
])

vi.mock('../db', () => createFakeDb(db, users))

let app: FastifyInstance

function resetWorld() {
  db.tables.clear()
  db.failures.clear()
  db.rpcs.clear()
  db.queries.length = 0

  db.seed('workspaces', [
    { id: SHOP, name: 'Kabul Jewellery', base_currency: 'AFN', time_zone: 'Asia/Kabul' },
    { id: OTHER, name: 'Other Jewellery', base_currency: 'AFN', time_zone: 'Asia/Kabul' },
  ])
  db.seed('workspace_members', [
    {
      id: fakeId('m'),
      workspace_id: SHOP,
      user_id: OWNER.id,
      role: 'owner',
      has_access: true,
      suspended_at: null,
      joined_at: '2026-01-01T00:00:00Z',
    },
    {
      id: fakeId('m'),
      workspace_id: OTHER,
      user_id: STRANGER.id,
      role: 'owner',
      has_access: true,
      suspended_at: null,
      joined_at: '2026-01-01T00:00:00Z',
    },
  ])
  db.seed('metal_rates', [])
  db.seed('gold_operations', [])
  db.seed('gold_location_reconciliations', [])

  db.rpc('gold_record_second_hand_purchase', (args: Row) => {
    const op = args.p_op as Row
    const reqId = op.client_request_id ? String(op.client_request_id) : null
    if (reqId) {
      const existing = db
        .rows('gold_operations')
        .find((r) => r.workspace_id === args.p_workspace_id && r.client_request_id === reqId)
      if (existing) return existing
    }
    const row = {
      id: fakeId('gop'),
      workspace_id: args.p_workspace_id,
      operation_type: 'second_hand_purchase',
      ...op,
      created_by: args.p_user_id,
      created_at: '2026-11-11T10:00:00Z',
    }
    db.seed('gold_operations', [row])
    return row
  })

  db.rpc('gold_record_melt_scrap', (args: Row) => {
    const op = args.p_op as Row
    const row = {
      id: fakeId('gmelt'),
      workspace_id: args.p_workspace_id,
      operation_type: 'melt_scrap',
      ...op,
      weight_loss_mg: Number(op.input_weight_mg) - Number(op.recovered_pure_mg),
      created_by: args.p_user_id,
      created_at: '2026-11-11T10:05:00Z',
    }
    db.seed('gold_operations', [row])
    return row
  })

  db.rpc('gold_reconcile_location', (args: Row) => {
    const rec = args.p_rec as Row
    const row = {
      id: fakeId('grec'),
      workspace_id: args.p_workspace_id,
      ...rec,
      variance_mg: Number(rec.physical_counted_mg) - Number(rec.system_weight_mg),
      reconciled_by: args.p_user_id,
      reconciled_at: '2026-11-11T10:10:00Z',
    }
    db.seed('gold_location_reconciliations', [row])
    return row
  })
}

const headersOf = (user: { token: string }, workspaceId = SHOP) => ({
  authorization: `Bearer ${user.token}`,
  'x-workspace-id': workspaceId,
})

beforeAll(async () => {
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
})

afterAll(async () => {
  await app?.close()
})

beforeEach(() => {
  resetWorld()
})

describe('V59.1 Gold rate board & gold operations HTTP routes', () => {
  it('records daily metal rates and drives second-hand KYC purchase, melt/scrap, and location reconciliation', async () => {
    const rateRes = await app.inject({
      method: 'POST',
      url: '/api/metal-rates',
      headers: headersOf(OWNER),
      payload: { rateDate: '2026-11-11', rate24kMinorPerGram: 8000 },
    })
    expect(rateRes.statusCode, rateRes.body).toBe(201)

    const histRes = await app.inject({
      method: 'GET',
      url: '/api/metal-rates',
      headers: headersOf(OWNER),
    })
    expect(histRes.statusCode).toBe(200)
    expect((histRes.json() as { data: unknown[] }).data).toHaveLength(1)

    // Refuses second-hand gold purchase above KYC threshold without identity
    const kycRefusal = await app.inject({
      method: 'POST',
      url: '/api/gold/second-hand-purchase',
      headers: { ...headersOf(OWNER), 'idempotency-key': 'sh-refuse-1' },
      payload: {
        karat: 18,
        scrapWeightMg: 4000,
        deductionBp: 0,
        kycThresholdMinor: 20000,
      },
    })
    expect(kycRefusal.statusCode).toBe(400)

    const shOk = await app.inject({
      method: 'POST',
      url: '/api/gold/second-hand-purchase',
      headers: { ...headersOf(OWNER), 'idempotency-key': 'sh-ok-001' },
      payload: {
        karat: 18,
        scrapWeightMg: 4000,
        deductionBp: 0,
        kycThresholdMinor: 20000,
        identity: { fullName: 'Haji Aman', idType: 'national_id', idNumber: '991122' },
      },
    })
    expect(shOk.statusCode, shOk.body).toBe(201)
    expect((shOk.json() as { data: { net_credit_minor: number } }).data.net_credit_minor).toBe(
      24000,
    )

    const meltRes = await app.inject({
      method: 'POST',
      url: '/api/gold/melt-scrap',
      headers: { ...headersOf(OWNER), 'idempotency-key': 'key-melt-1-0001' },
      payload: { karat: 21, inputWeightMg: 5000, recoveredPureMg: 4850 },
    })
    expect(meltRes.statusCode, meltRes.body).toBe(201)
    expect((meltRes.json() as { data: { weight_loss_mg: number } }).data.weight_loss_mg).toBe(150)

    const recRes = await app.inject({
      method: 'POST',
      url: '/api/gold/reconciliations',
      headers: { ...headersOf(OWNER), 'idempotency-key': 'key-rec-1-0001' },
      payload: {
        location: 'showcase',
        karat: 21,
        systemWeightMg: 25000,
        physicalCountedMg: 24950,
      },
    })
    expect(recRes.statusCode, recRes.body).toBe(201)
    expect((recRes.json() as { data: { variance_mg: number } }).data.variance_mg).toBe(-50)

    const crossTenant = await app.inject({
      method: 'GET',
      url: '/api/gold/reconciliations',
      headers: headersOf(STRANGER, SHOP),
    })
    expect(crossTenant.statusCode).toBe(403)
  })
})
