// ============================================
// backend/src/__tests__/v59-http-routes.test.ts
//
// Real HTTP integration tests via Fastify `buildServer()` + `app.inject()`
// covering V59 backend endpoints:
//   • GET /api/provider-commissions/my (stylist self-view isolation vs team report/rates 403)
//   • POST /api/fx/reconciliations & GET /api/fx/reconciliations (idempotency, book-currency refusal, 403)
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDatabase, createFakeDb, fakeId, type Row } from './helpers/fake-supabase'

const db = new FakeDatabase()

const OWNER = { id: '11111111-1111-4111-8111-111111111111', token: 'token-owner' }
const STYLIST = { id: '33333333-3333-4333-8333-333333333333', token: 'token-stylist' }
const STRANGER = { id: '22222222-2222-4222-8222-222222222222', token: 'token-stranger' }

const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const EMP_STYLIST = 'eeeeeeee-0000-4000-8000-000000000001'
const EMP_OTHER = 'eeeeeeee-0000-4000-8000-000000000002'
const SVC_CUT = 'cccccccc-0000-4000-8000-000000000001'
const INV_1 = 'dddddddd-0000-4000-8000-000000000001'
const INV_2 = 'dddddddd-0000-4000-8000-000000000002'

const users = new Map<string, { id: string }>([
  [OWNER.token, { id: OWNER.id }],
  [STYLIST.token, { id: STYLIST.id }],
  [STRANGER.token, { id: STRANGER.id }],
])

vi.mock('../db', () => createFakeDb(db, users))

let app: FastifyInstance

const member = (workspaceId: string, userId: string, role: string) => ({
  id: fakeId('member'),
  workspace_id: workspaceId,
  user_id: userId,
  role,
  has_access: true,
  suspended_at: null,
  joined_at: '2026-01-01T00:00:00Z',
})

function resetWorld() {
  db.tables.clear()
  db.failures.clear()
  db.rpcs.clear()
  db.queries.length = 0

  db.seed('workspaces', [
    { id: SHOP, name: 'Kabul Studio & FX', base_currency: 'AFN', time_zone: 'Asia/Kabul' },
    { id: OTHER, name: 'Other Business', base_currency: 'USD', time_zone: 'Asia/Kabul' },
  ])
  db.seed('workspace_members', [
    member(SHOP, OWNER.id, 'owner'),
    // employee role has invoice.read, lacks payroll.read/payroll.write & payment.record
    member(SHOP, STYLIST.id, 'employee'),
    member(OTHER, STRANGER.id, 'owner'),
  ])
  db.seed('employees', [
    {
      id: EMP_STYLIST,
      workspace_id: SHOP,
      user_id: STYLIST.id,
      first_name: 'Nadia',
      last_name: 'K.',
    },
    {
      id: EMP_OTHER,
      workspace_id: SHOP,
      user_id: OWNER.id,
      first_name: 'Sara',
      last_name: 'M.',
    },
  ])
  db.seed('provider_commission_rates', [
    { workspace_id: SHOP, employee_id: EMP_STYLIST, rate_bp: 3000 },
    { workspace_id: SHOP, employee_id: EMP_OTHER, rate_bp: 4000 },
  ])
  db.seed('invoices', [
    { id: INV_1, workspace_id: SHOP, currency: 'AFN' },
    { id: INV_2, workspace_id: SHOP, currency: 'AFN' },
  ])
  db.seed('invoice_items', [
    {
      workspace_id: SHOP,
      invoice_id: INV_1,
      product_id: SVC_CUT,
      unit_price: 1000,
      total_price: 1000,
    },
    {
      workspace_id: SHOP,
      invoice_id: INV_2,
      product_id: SVC_CUT,
      unit_price: 2000,
      total_price: 2000,
    },
  ])
  db.seed('service_delivery_sessions', [
    {
      id: fakeId('sess'),
      workspace_id: SHOP,
      practitioner_id: EMP_STYLIST,
      service_offering_id: SVC_CUT,
      settlement_method: 'invoice',
      invoice_id: INV_1,
      status: 'delivered',
      session_date: '2026-11-11',
      deleted_at: null,
    },
    {
      id: fakeId('sess'),
      workspace_id: SHOP,
      practitioner_id: EMP_OTHER,
      service_offering_id: SVC_CUT,
      settlement_method: 'invoice',
      invoice_id: INV_2,
      status: 'delivered',
      session_date: '2026-11-11',
      deleted_at: null,
    },
  ])
  db.seed('fx_cashbox_reconciliations', [])

  db.rpc('fx_reconcile_cashbox', (args: Row) => {
    const currency = String(args.p_currency).toUpperCase()
    const counted = Number(args.p_counted_minor)
    const reqId = args.p_client_request_id ? String(args.p_client_request_id) : null
    if (reqId) {
      const existing = db
        .rows('fx_cashbox_reconciliations')
        .find((r) => r.workspace_id === args.p_workspace_id && r.client_request_id === reqId)
      if (existing) return existing
    }
    const expected = 50_000
    const variance = counted - expected
    const row = {
      id: fakeId('rec'),
      workspace_id: args.p_workspace_id,
      currency,
      expected_minor: expected,
      counted_minor: counted,
      variance_minor: variance,
      status: variance === 0 ? 'matched' : variance > 0 ? 'over' : 'short',
      note: args.p_note ?? null,
      client_request_id: reqId,
      reconciled_by: args.p_user_id,
      reconciled_at: '2026-11-11T12:00:00.000Z',
    }
    db.seed('fx_cashbox_reconciliations', [row])
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

describe('V59 real HTTP routes (buildServer + app.inject)', () => {
  it('allows stylist to read ONLY their own commission via /api/provider-commissions/my and denies team payroll endpoints', async () => {
    const myRes = await app.inject({
      method: 'GET',
      url: '/api/provider-commissions/my?from=2026-11-01&to=2026-11-30',
      headers: headersOf(STYLIST, SHOP),
    })
    expect(myRes.statusCode, myRes.body).toBe(200)
    const body = myRes.json() as {
      data: { ready: boolean; lines: Array<{ practitionerId: string; commissionMinor: number }> }
    }
    expect(body.data.ready).toBe(true)
    expect(body.data.lines).toHaveLength(1)
    expect(body.data.lines[0]!.practitionerId).toBe(EMP_STYLIST)
    // FRACTION_DIGITS['AFN'] === 0, so 1000 AFN (1000 minor) * 30% (3000 bp) = 300 AFN
    expect(body.data.lines[0]!.commissionMinor).toBe(300)

    const teamRes = await app.inject({
      method: 'GET',
      url: '/api/provider-commissions?from=2026-11-01&to=2026-11-30',
      headers: headersOf(STYLIST, SHOP),
    })
    expect(teamRes.statusCode).toBe(403)

    const writeRateRes = await app.inject({
      method: 'PUT',
      url: '/api/provider-commissions/rates',
      headers: headersOf(STYLIST, SHOP),
      payload: { employeeId: EMP_STYLIST, rateBp: 5000 },
    })
    expect(writeRateRes.statusCode).toBe(403)

    const crossTenantRes = await app.inject({
      method: 'GET',
      url: '/api/provider-commissions/my?from=2026-11-01&to=2026-11-30',
      headers: headersOf(STRANGER, SHOP),
    })
    expect(crossTenantRes.statusCode).toBe(403)
  })

  it('records FX cashbox reconciliations idempotently, rejects book currency, and enforces payment.record', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/fx/reconciliations',
      headers: { ...headersOf(OWNER, SHOP), 'idempotency-key': 'fx-rec-http-1' },
      payload: { currency: 'USD', countedMinor: 49_000, note: 'evening close' },
    })
    expect(createRes.statusCode).toBe(201)
    const first = (
      createRes.json() as { data: { id: string; varianceMinor: number; status: string } }
    ).data
    expect(first.varianceMinor).toBe(-1_000)
    expect(first.status).toBe('short')

    const replayRes = await app.inject({
      method: 'POST',
      url: '/api/fx/reconciliations',
      headers: { ...headersOf(OWNER, SHOP), 'idempotency-key': 'fx-rec-http-1' },
      payload: { currency: 'USD', countedMinor: 99_999 },
    })
    expect(replayRes.statusCode).toBe(201)
    expect((replayRes.json() as { data: { id: string } }).data.id).toBe(first.id)

    const bookRefusal = await app.inject({
      method: 'POST',
      url: '/api/fx/reconciliations',
      headers: headersOf(OWNER, SHOP),
      payload: { currency: 'AFN', countedMinor: 1000 },
    })
    expect(bookRefusal.statusCode).toBe(400)

    const forbidden = await app.inject({
      method: 'POST',
      url: '/api/fx/reconciliations',
      headers: headersOf(STRANGER, SHOP),
      payload: { currency: 'USD', countedMinor: 50_000 },
    })
    expect(forbidden.statusCode).toBe(403)

    const sellerSettingsForbidden = await app.inject({
      method: 'PUT',
      url: '/api/fx/settings',
      headers: headersOf(STYLIST, SHOP),
      payload: { kycThresholdMinor: 10_000 },
    })
    expect(sellerSettingsForbidden.statusCode).toBe(403)

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/fx/reconciliations',
      headers: headersOf(OWNER, SHOP),
    })
    expect(listRes.statusCode).toBe(200)
    expect(
      (listRes.json() as { data: { reconciliations: unknown[] } }).data.reconciliations,
    ).toHaveLength(1)
  })
})
