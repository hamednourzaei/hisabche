// ============================================
// backend/src/__tests__/p0-remediation-sync-reconcile.test.ts
//
// Verifies P0 remediation routes via buildServer() + app.inject():
//   - X10: GET/POST /api/payments/:id/processor-state + FSM + cross-tenant 404
//   - X04: POST /api/accounting/reconcile-cross-core (multi-currency balanced & variance detection)
//   - X06/X11: GET /api/workspaces/:id/export-bundle audit log + POST export-restore-preview
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDatabase, createFakeDb, fakeId } from './helpers/fake-supabase'

const db = new FakeDatabase()
const OWNER = { id: '11111111-1111-4111-8111-111111111111', token: 'token-owner' }
const SHOP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SHOP_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PAY_CARD = '22222222-2222-4222-8222-222222222201'
const PAY_OTHER = '22222222-2222-4222-8222-222222222202'
const INV_AFN = '33333333-3333-4333-8333-333333333301'
const INV_USD = '33333333-3333-4333-8333-333333333302'
const PAY_AFN = '44444444-4444-4444-8444-444444444401'
const PAY_USD = '44444444-4444-4444-8444-444444444402'

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
    { id: SHOP_A, name: 'Shop A', base_currency: 'AFN', time_zone: 'Asia/Kabul' },
    { id: SHOP_B, name: 'Shop B', base_currency: 'USD', time_zone: 'UTC' },
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
  ])
  db.seed('payments', [
    {
      id: PAY_CARD,
      workspace_id: SHOP_A,
      method: 'card',
      amount: 5000,
      currency: 'AFN',
      status: 'posted',
      updated_at: '2026-11-25T10:00:00Z',
    },
    {
      id: PAY_OTHER,
      workspace_id: SHOP_B,
      method: 'card',
      amount: 3000,
      currency: 'USD',
      status: 'posted',
      updated_at: '2026-11-25T10:00:00Z',
    },
    {
      id: PAY_AFN,
      workspace_id: SHOP_A,
      method: 'cash',
      amount: 10000,
      currency: 'AFN',
      status: 'posted',
      updated_at: '2026-11-25T10:00:00Z',
    },
    {
      id: PAY_USD,
      workspace_id: SHOP_A,
      method: 'bank_transfer',
      amount: 200,
      currency: 'USD',
      status: 'posted',
      updated_at: '2026-11-25T10:00:00Z',
    },
  ])
  db.seed('payment_gateway_states', [])
  db.seed('audit_logs', [])
  db.seed('invoices', [
    { id: INV_AFN, workspace_id: SHOP_A, currency: 'AFN', paid_amount: 10000, status: 'completed' },
    { id: INV_USD, workspace_id: SHOP_A, currency: 'USD', paid_amount: 200, status: 'completed' },
  ])
  db.seed('payment_allocations', [
    { payment_id: PAY_AFN, invoice_id: INV_AFN, workspace_id: SHOP_A, amount: 10000 },
    { payment_id: PAY_USD, invoice_id: INV_USD, workspace_id: SHOP_A, amount: 200 },
  ])
  db.seed('journal_entries', [
    {
      id: 'je-1',
      workspace_id: SHOP_A,
      source_type: 'invoice',
      source_id: INV_AFN,
      status: 'posted',
    },
    {
      id: 'je-2',
      workspace_id: SHOP_A,
      source_type: 'invoice',
      source_id: INV_USD,
      status: 'posted',
    },
    {
      id: 'je-3',
      workspace_id: SHOP_A,
      source_type: 'payment',
      source_id: PAY_AFN,
      status: 'posted',
    },
    {
      id: 'je-4',
      workspace_id: SHOP_A,
      source_type: 'payment',
      source_id: PAY_USD,
      status: 'posted',
    },
    {
      id: 'je-5',
      workspace_id: SHOP_A,
      source_type: 'payment',
      source_id: PAY_CARD,
      status: 'posted',
    },
  ])
  db.seed('journal_lines', [
    { id: 'jl-1', workspace_id: SHOP_A, journal_id: 'je-1', debit: 10000, credit: 0 },
    { id: 'jl-2', workspace_id: SHOP_A, journal_id: 'je-1', debit: 0, credit: 10000 },
  ])
})

describe('P0 Remediation — Processor State, Cross-Core Reconcile & Export Preview', () => {
  it('X10 tracks persistent processor FSM states and refuses cross-tenant access', async () => {
    const initial = await app.inject({
      method: 'GET',
      url: `/api/payments/${PAY_CARD}/processor-state`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A },
    })
    expect(initial.statusCode).toBe(200)
    expect(initial.json().data.processorState).toBe('queued_offline')

    const toPending = await app.inject({
      method: 'POST',
      url: `/api/payments/${PAY_CARD}/processor-state`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A },
      payload: {
        processorState: 'pending_capture',
        gatewayName: 'LocalPOS',
        externalRef: 'EXT-99',
        feeMinor: 150,
      },
    })
    expect(toPending.statusCode).toBe(200)
    expect(toPending.json().data.processorState).toBe('pending_capture')
    expect(toPending.json().data.feeMinor).toBe(150)

    const captured = await app.inject({
      method: 'POST',
      url: `/api/payments/${PAY_CARD}/processor-state`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A },
      payload: { processorState: 'captured', feeMinor: 150 },
    })
    expect(captured.statusCode).toBe(200)

    // Invalid transition from captured -> pending_capture must be refused (409)
    const invalid = await app.inject({
      method: 'POST',
      url: `/api/payments/${PAY_CARD}/processor-state`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A },
      payload: { processorState: 'pending_capture', feeMinor: 0 },
    })
    expect(invalid.statusCode).toBe(409)

    // Cross-tenant payment must 404
    const crossTenant = await app.inject({
      method: 'GET',
      url: `/api/payments/${PAY_OTHER}/processor-state`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A },
    })
    expect(crossTenant.statusCode).toBe(404)
  })

  it('X04 reconciles multi-currency invoices, allocations, payments & ledger accurately', async () => {
    const balancedRes = await app.inject({
      method: 'POST',
      url: '/api/accounting/reconcile-cross-core',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A },
      payload: {},
    })
    expect(balancedRes.statusCode).toBe(200)
    const body = balancedRes.json().data
    expect(body.balanced).toBe(true)
    expect(body.perCurrency).toHaveLength(2)
    expect(body.ledger.debitCreditVarianceMinor).toBe(0)

    // Inject an allocation mismatch in USD and confirm balanced flips to false with exact variance
    db.seed('invoices', [
      {
        id: INV_AFN,
        workspace_id: SHOP_A,
        currency: 'AFN',
        paid_amount: 10000,
        status: 'completed',
      },
      { id: INV_USD, workspace_id: SHOP_A, currency: 'USD', paid_amount: 350, status: 'completed' },
    ])
    const skewedRes = await app.inject({
      method: 'POST',
      url: '/api/accounting/reconcile-cross-core',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A },
      payload: {},
    })
    expect(skewedRes.statusCode).toBe(200)
    const skewed = skewedRes.json().data
    expect(skewed.balanced).toBe(false)
    const usd = skewed.perCurrency.find((c: { currency: string }) => c.currency === 'USD')
    expect(usd.invoicePaidVsAllocationsVarianceMinor).toBe(150)
  })

  it('X06/X11 explicitly marks export-bundle restorable=false, writes audit log, and previews archives', async () => {
    db.seed('products', [])
    db.seed('customers', [])
    db.seed('warehouses', [])
    db.seed('accounts', [])
    db.seed('employees', [])
    db.seed('orders', [])
    db.seed('installments', [])
    db.seed('suppliers', [])
    db.seed('purchase_orders', [])
    db.seed('stock_transfers', [])
    db.seed('branches', [])

    const exp = await app.inject({
      method: 'GET',
      url: `/api/workspaces/${SHOP_A}/export-bundle`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A },
    })
    expect(exp.statusCode).toBe(200)
    expect(exp.json().data.restorable).toBe(false)
    expect(exp.json().data.rowCapPerTable).toBe(5000)
    expect(db.rows('audit_logs').length).toBeGreaterThanOrEqual(1)

    const preview = await app.inject({
      method: 'POST',
      url: `/api/workspaces/${SHOP_A}/export-restore-preview`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A },
      payload: {
        meta: { workspaceId: SHOP_A, schemaVersion: '1', truncatedTables: [] },
        data: { products: [{ id: 'p1' }] },
      },
    })
    expect(preview.statusCode).toBe(200)
    expect(preview.json().data.dryRunOnly).toBe(true)
    expect(preview.json().data.valid).toBe(true)
    expect(preview.json().data.tableCounts.products).toBe(1)
  })
})
