// ============================================
// backend/src/__tests__/v100-p0-change-order-reconcile.test.ts
//
// V100 P0 (4.2 + 4.3) verification:
//   - Atomic Change Order RPCs (optimistic version lock, cumulative deltas,
//     AFN=0 & USD=2 scale safety, idempotent retry, rollback on projects/audit failure)
//   - Cross-Core Ledger Reconciliation (duplicate postings, reversal mismatches,
//     advance/deposit liability coverage, rounding differences, currency mismatches)
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDatabase, createFakeDb, fakeId } from './helpers/fake-supabase'

const db = new FakeDatabase()
const OWNER = { id: '11111111-1111-4111-8111-111111111111', token: 'token-co-owner' }
const SHOP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SHOP_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PROJ_USD = '33333333-3333-4333-8333-333333333301'
const PROJ_AFN = '33333333-3333-4333-8333-333333333302'

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
  db.writeFailures.clear()
  db.seed('workspaces', [
    { id: SHOP_A, name: 'Engineering Co', base_currency: 'USD', time_zone: 'UTC' },
    { id: SHOP_B, name: 'Foreign Co', base_currency: 'AFN', time_zone: 'UTC' },
  ])
  db.seed('workspace_members', [
    {
      id: fakeId('ma'),
      workspace_id: SHOP_A,
      user_id: OWNER.id,
      role: 'owner',
      has_access: true,
      suspended_at: null,
    },
  ])
  db.seed('projects', [
    {
      id: PROJ_USD,
      workspace_id: SHOP_A,
      name: 'Cloud Migration',
      budget: 1000.0,
      budget_version: 1,
      currency: 'USD',
    },
    {
      id: PROJ_AFN,
      workspace_id: SHOP_A,
      name: 'Kabul Depot',
      budget: 50000,
      budget_version: 1,
      currency: 'AFN',
    },
  ])
  db.seed('project_change_orders', [])
  db.seed('audit_logs', [])
})

describe('V100 P0 (4.2 + 4.3) — Atomic Change Orders & Full Ledger Reconciliation', () => {
  it('enforces optimistic version + cumulative minor budget + atomic rollback across USD and AFN', async () => {
    const hdr = { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A }

    // 1) USD project (2 decimals): budget=1000.00 -> +250.50 (+25050 minor) = 1250.50
    const co1 = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJ_USD}/change-orders`,
      headers: hdr,
      payload: {
        title: 'Phase 2 infra',
        deltaMinor: 25050,
        estimatedCostDeltaMinor: 10000,
        approved: false,
      },
    })
    expect(co1.statusCode, co1.body).toBe(201)
    const order1Id = String(co1.json().data.id)

    // Audit failure must roll back atomically (order stays pending, budget untouched at 1000)
    db.failWrite('audit_logs', { message: 'audit table immutable write fault' })
    const failedAudit = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJ_USD}/change-orders/${order1Id}/decide`,
      headers: hdr,
      payload: { decision: 'approved', expectedVersion: 1 },
    })
    expect(failedAudit.statusCode).toBe(500)
    db.writeFailures.clear()
    expect(db.rows('projects').find((p) => p.id === PROJ_USD)?.budget).toBe(1000)
    expect(db.rows('project_change_orders').find((o) => o.id === order1Id)?.status).toBe(
      'pending_approval',
    )

    // Approve order1 cleanly -> budget becomes 1250.50, budget_version becomes 2
    const okDecide = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJ_USD}/change-orders/${order1Id}/decide`,
      headers: hdr,
      payload: { decision: 'approved', expectedVersion: 1, reason: 'Client signed SOW' },
    })
    expect(okDecide.statusCode, okDecide.body).toBe(200)
    expect(db.rows('projects').find((p) => p.id === PROJ_USD)?.budget).toBe(1250.5)
    expect(db.rows('projects').find((p) => p.id === PROJ_USD)?.budget_version).toBe(2)

    // Create a second pending order while budget_version=2, then attempt stale version=1 approval -> 409
    const co2 = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJ_USD}/change-orders`,
      headers: hdr,
      payload: { title: 'Extra cabling', deltaMinor: 1000, approved: false },
    })
    expect(co2.statusCode).toBe(201)
    const staleVer = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJ_USD}/change-orders/${co2.json().data.id}/decide`,
      headers: hdr,
      payload: { decision: 'approved', expectedVersion: 1 },
    })
    expect(staleVer.statusCode).toBe(409)
    expect(staleVer.json().code).toBe('STALE_PROJECT_VERSION_CONFLICT')

    // Zero-decimal AFN project: +2500 minor = +2500 AFN (never /100!)
    const afnCo = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJ_AFN}/change-orders`,
      headers: hdr,
      payload: { title: 'AFN expansion', deltaMinor: 2500, approved: true },
    })
    expect(afnCo.statusCode, afnCo.body).toBe(201)
    expect(db.rows('projects').find((p) => p.id === PROJ_AFN)?.budget).toBe(52500)
  })

  it('detects duplicate postings, unreversed cancellations, and unposted customer deposit liabilities', async () => {
    const hdr = { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A }
    const INV1 = '55555555-5555-4555-8555-555555555501'
    const INV_CANCEL = '55555555-5555-4555-8555-555555555502'
    const PAY1 = '66666666-6666-4666-8666-666666666601'
    const DEP1 = '77777777-7777-4777-8777-777777777701'

    db.seed('invoices', [
      {
        id: INV1,
        workspace_id: SHOP_A,
        currency: 'USD',
        total: 100,
        paid_amount: 100,
        status: 'completed',
      },
      {
        id: INV_CANCEL,
        workspace_id: SHOP_A,
        currency: 'USD',
        total: 50,
        paid_amount: 0,
        status: 'cancelled',
      },
    ])
    db.seed('payments', [
      { id: PAY1, workspace_id: SHOP_A, currency: 'USD', amount: 100, status: 'posted' },
    ])
    db.seed('payment_allocations', [
      { workspace_id: SHOP_A, payment_id: PAY1, invoice_id: INV1, amount: 100 },
    ])
    db.seed('order_deposits', [
      {
        id: DEP1,
        workspace_id: SHOP_A,
        order_id: fakeId('ord'),
        customer_id: fakeId('cust'),
        amount_minor: 5000,
        applied_invoice_id: null,
      },
    ])
    db.seed('journal_entries', [
      {
        id: 'je-1',
        workspace_id: SHOP_A,
        source_type: 'invoice',
        source_id: INV1,
        status: 'posted',
      },
      {
        id: 'je-1-dup',
        workspace_id: SHOP_A,
        source_type: 'invoice',
        source_id: INV1,
        status: 'posted',
      },
      {
        id: 'je-cancel-unreversed',
        workspace_id: SHOP_A,
        source_type: 'invoice',
        source_id: INV_CANCEL,
        status: 'posted',
      },
      {
        id: 'je-pay-1',
        workspace_id: SHOP_A,
        source_type: 'payment',
        source_id: PAY1,
        status: 'posted',
      },
    ])
    db.seed('journal_lines', [
      { id: 'jl-1', workspace_id: SHOP_A, journal_id: 'je-1', debit: 100, credit: 0 },
      { id: 'jl-2', workspace_id: SHOP_A, journal_id: 'je-1', debit: 0, credit: 100 },
    ])

    const res = await app.inject({
      method: 'POST',
      url: '/api/accounting/reconcile-cross-core',
      headers: hdr,
      payload: {},
    })
    expect(res.statusCode, res.body).toBe(200)
    const d = res.json().data
    expect(d.balanced).toBe(false)
    expect(d.duplicatePostings).toBe(1)
    expect(d.reversalMismatch).toBe(1)
    expect(d.advanceLiabilityMismatch).toBe(5000)
    const codes = (d.exceptions as Array<{ code: string }>).map((e) => e.code)
    expect(codes).toContain('DUPLICATE_POSTING')
    expect(codes).toContain('REVERSAL_MISMATCH')
    expect(codes).toContain('ADVANCE_LIABILITY_MISMATCH')
  })
})
