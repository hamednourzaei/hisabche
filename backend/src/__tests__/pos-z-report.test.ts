// ============================================
// backend/src/__tests__/pos-z-report.test.ts
//
// G31 — Standard Shift Z-Report (buildZReport + GET /api/pos/sessions/:id/z-report)
// Verifies:
//   - Multi-currency support (AFN zero-decimal + USD)
//   - Unknown countedCashMinor stays null (never coerced to 0)
//   - Cash movements (in / out), voided orders, and payment methods
//   - Cross-workspace isolation (403)
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildZReport } from '@hisabche/validation'
import { FakeDatabase, createFakeDb, fakeId } from './helpers/fake-supabase'

const db = new FakeDatabase()
const OWNER = { id: '11111111-1111-4111-8111-111111111111', token: 'token-owner' }
const STRANGER = { id: '22222222-2222-4222-8222-222222222222', token: 'token-stranger' }
const SHOP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SHOP_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const SESSION_AFN = 'cccccccc-0000-4000-8000-000000000001'
const SESSION_USD = 'cccccccc-0000-4000-8000-000000000002'

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
  db.rpcs.clear()

  db.seed('workspaces', [
    { id: SHOP_A, name: 'Kabul Shop', base_currency: 'AFN', time_zone: 'Asia/Kabul' },
    { id: SHOP_B, name: 'Other Shop', base_currency: 'USD', time_zone: 'Asia/Kabul' },
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
  db.seed('pos_sessions', [
    {
      id: SESSION_AFN,
      workspace_id: SHOP_A,
      label: 'Shift Morning',
      currency: 'AFN',
      status: 'open',
      opening_float_minor: 5000,
      opened_at: '2026-11-25T08:00:00Z',
      opened_by: OWNER.id,
      closed_at: null,
      closed_by: null,
      counted_cash_minor: null,
      variance_reason: null,
    },
    {
      id: SESSION_USD,
      workspace_id: SHOP_A,
      label: 'USD Desk',
      currency: 'USD',
      status: 'closed',
      opening_float_minor: 10000,
      opened_at: '2026-11-25T08:00:00Z',
      opened_by: OWNER.id,
      closed_at: '2026-11-25T18:00:00Z',
      closed_by: OWNER.id,
      counted_cash_minor: 14500,
      variance_reason: 'Exact count',
    },
  ])
  const ORD_1 = 'dddddddd-0000-4000-8000-000000000001'
  const ORD_2 = 'dddddddd-0000-4000-8000-000000000002'
  const ORD_3 = 'dddddddd-0000-4000-8000-000000000003'
  db.seed('pos_orders', [
    {
      id: ORD_1,
      workspace_id: SHOP_A,
      session_id: SESSION_AFN,
      order_ref: 'ref-1',
      status: 'completed',
      total_minor: 1200,
      change_minor: 0,
      currency: 'AFN',
      payments: [{ method: 'cash', amount_minor: 1200 }],
      created_at: '2026-11-25T09:00:00Z',
    },
    {
      id: ORD_2,
      workspace_id: SHOP_A,
      session_id: SESSION_AFN,
      order_ref: 'ref-2',
      status: 'voided',
      total_minor: 300,
      change_minor: 0,
      currency: 'AFN',
      payments: [],
      created_at: '2026-11-25T09:15:00Z',
    },
    {
      id: ORD_3,
      workspace_id: SHOP_A,
      session_id: SESSION_USD,
      order_ref: 'ref-3',
      status: 'completed',
      total_minor: 4500,
      change_minor: 0,
      currency: 'USD',
      payments: [{ method: 'cash', amount_minor: 4500 }],
      created_at: '2026-11-25T10:00:00Z',
    },
  ])
  db.seed('pos_order_payments', [
    {
      id: fakeId('pay'),
      workspace_id: SHOP_A,
      order_id: ORD_1,
      method: 'cash',
      amount_minor: 1200,
    },
    {
      id: fakeId('pay'),
      workspace_id: SHOP_A,
      order_id: ORD_3,
      method: 'cash',
      amount_minor: 4500,
    },
  ])
  db.seed('pos_cash_movements', [
    {
      id: fakeId('mov'),
      workspace_id: SHOP_A,
      session_id: SESSION_AFN,
      kind: 'cash_in',
      amount_minor: 500,
      reason: 'Petty cash top-up',
      created_at: '2026-11-25T09:30:00Z',
    },
    {
      id: fakeId('mov'),
      workspace_id: SHOP_A,
      session_id: SESSION_AFN,
      kind: 'cash_out',
      amount_minor: 200,
      reason: 'Tea supplies',
      created_at: '2026-11-25T10:00:00Z',
    },
  ])
})

describe('G31 — Shift Z-Report', () => {
  it('computes pure Z-report and keeps uncounted cash null', () => {
    const report = buildZReport(
      {
        id: SESSION_AFN,
        currency: 'AFN',
        status: 'open',
        openingFloatMinor: 5000,
        openedAt: '2026-11-25T08:00:00Z',
        openedBy: OWNER.id,
        countedCashMinor: null,
      },
      [
        {
          id: 'o1',
          orderRef: 'r1',
          totalMinor: 1200,
          changeMinor: 0,
          payments: [{ method: 'cash', amountMinor: 1200 }],
          status: 'completed',
          createdAt: '2026-11-25T09:00:00Z',
        },
        {
          id: 'o2',
          orderRef: 'r2',
          totalMinor: 300,
          changeMinor: 0,
          payments: [],
          status: 'voided',
          createdAt: '2026-11-25T09:15:00Z',
        },
      ],
      [
        {
          id: 'm1',
          kind: 'cash_in',
          amountMinor: 500,
          reason: 'Top-up',
          createdAt: '2026-11-25T09:30:00Z',
        },
        {
          id: 'm2',
          kind: 'cash_out',
          amountMinor: 200,
          reason: 'Supplies',
          createdAt: '2026-11-25T10:00:00Z',
        },
      ],
    )

    expect(report.orderCount).toBe(1)
    expect(report.voidedCount).toBe(1)
    expect(report.grossSalesMinor).toBe(1200)
    expect(report.voidedTotalMinor).toBe(300)
    expect(report.cashInMinor).toBe(500)
    expect(report.cashOutMinor).toBe(200)
    expect(report.expectedCashMinor).toBe(6500)
    expect(report.countedCashMinor).toBeNull()
    expect(report.varianceMinor).toBeNull()
  })

  it('serves GET /api/pos/sessions/:id/z-report across currencies and blocks cross-workspace access', async () => {
    const resAfn = await app.inject({
      method: 'GET',
      url: `/api/pos/sessions/${SESSION_AFN}/z-report`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A },
    })
    expect(resAfn.statusCode, resAfn.body).toBe(200)
    const afn = resAfn.json()
    expect(afn.currency).toBe('AFN')
    expect(afn.expectedCashMinor).toBe(6500)
    expect(afn.countedCashMinor).toBeNull()
    expect(afn.varianceMinor).toBeNull()

    const resUsd = await app.inject({
      method: 'GET',
      url: `/api/pos/sessions/${SESSION_USD}/z-report`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A },
    })
    expect(resUsd.statusCode, resUsd.body).toBe(200)
    const usd = resUsd.json()
    expect(usd.currency).toBe('USD')
    expect(usd.expectedCashMinor).toBe(14500)
    expect(usd.countedCashMinor).toBe(14500)
    expect(usd.varianceMinor).toBe(0)

    const crossRes = await app.inject({
      method: 'GET',
      url: `/api/pos/sessions/${SESSION_AFN}/z-report`,
      headers: { authorization: `Bearer ${STRANGER.token}`, 'x-workspace-id': SHOP_B },
    })
    expect([403, 404]).toContain(crossRes.statusCode)
  })
})
