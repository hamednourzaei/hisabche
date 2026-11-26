// ============================================
// backend/src/__tests__/p0-remediation-sync-reconcile.test.ts
//
// Verifies P0 remediation routes via buildServer() + app.inject():
//   - X10: GET/POST /api/payments/:id/processor-state + FSM + cross-tenant 404
//   - X04: POST /api/accounting/reconcile-cross-core (multi-currency balanced & variance detection)
//   - X06/X11: GET /api/workspaces/:id/export-bundle audit log + POST export-restore-preview
// ============================================

import { createHmac } from 'node:crypto'
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
  db.seed('payment_gateway_events', [])
  db.seed('audit_logs', [])
  db.seed('invoices', [
    {
      id: INV_AFN,
      workspace_id: SHOP_A,
      currency: 'AFN',
      total: 10000,
      paid_amount: 10000,
      status: 'completed',
    },
    {
      id: INV_USD,
      workspace_id: SHOP_A,
      currency: 'USD',
      total: 200,
      paid_amount: 200,
      status: 'completed',
    },
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

    // Append-only gateway event trail must contain pending_capture and captured
    const eventsRes = await app.inject({
      method: 'GET',
      url: `/api/payments/${PAY_CARD}/gateway-events`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A },
    })
    expect(eventsRes.statusCode).toBe(200)
    expect(eventsRes.json().data).toHaveLength(2)

    // HMAC-verified webhook: bad signature rejected 401; valid signature accepted 200 & logged
    process.env.PAYMENT_WEBHOOK_SECRET = 'test-webhook-secret-256'
    const webhookPayload = {
      processorState: 'captured',
      gatewayName: 'MelliWebhook',
      externalRef: 'WH-EXT-77',
      feeMinor: 150,
    }
    const badSig = await app.inject({
      method: 'POST',
      url: `/api/payments/${PAY_CARD}/gateway-webhook`,
      headers: {
        authorization: `Bearer ${OWNER.token}`,
        'x-workspace-id': SHOP_A,
        'x-hisabche-signature': 'deadbeef',
      },
      payload: webhookPayload,
    })
    expect(badSig.statusCode).toBe(401)

    const canonical = `${PAY_CARD}:${webhookPayload.processorState}:${webhookPayload.externalRef}:${webhookPayload.feeMinor}`
    const sig = createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET)
      .update(canonical)
      .digest('hex')
    const goodSig = await app.inject({
      method: 'POST',
      url: `/api/payments/${PAY_CARD}/gateway-webhook`,
      headers: {
        authorization: `Bearer ${OWNER.token}`,
        'x-workspace-id': SHOP_A,
        'x-hisabche-signature': sig,
      },
      payload: webhookPayload,
    })
    expect(goodSig.statusCode).toBe(200)
    expect(goodSig.json().data.externalRef).toBe('WH-EXT-77')
    expect(goodSig.json().data.replay).toBe(false)

    // Replay with exact same externalRef + state is deduplicated idempotently without appending another event
    const replaySig = await app.inject({
      method: 'POST',
      url: `/api/payments/${PAY_CARD}/gateway-webhook`,
      headers: {
        authorization: `Bearer ${OWNER.token}`,
        'x-workspace-id': SHOP_A,
        'x-hisabche-signature': sig,
      },
      payload: webhookPayload,
    })
    expect(replaySig.statusCode).toBe(200)
    expect(replaySig.json().data.replay).toBe(true)

    // Currency mismatch webhook must be refused 409
    const badCurrencyPayload = {
      processorState: 'captured',
      gatewayName: 'MelliWebhook',
      externalRef: 'WH-EXT-BADCUR',
      feeMinor: 100,
      currency: 'USD',
    }
    const curSig = createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET)
      .update(`${PAY_CARD}:captured:WH-EXT-BADCUR:100`)
      .digest('hex')
    const mismatchRes = await app.inject({
      method: 'POST',
      url: `/api/payments/${PAY_CARD}/gateway-webhook`,
      headers: {
        authorization: `Bearer ${OWNER.token}`,
        'x-workspace-id': SHOP_A,
        'x-hisabche-signature': curSig,
      },
      payload: badCurrencyPayload,
    })
    expect(mismatchRes.statusCode).toBe(409)

    const eventsAfterWebhook = await app.inject({
      method: 'GET',
      url: `/api/payments/${PAY_CARD}/gateway-events`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A },
    })
    expect(eventsAfterWebhook.json().data).toHaveLength(3)

    // Gateway-to-ledger reconciliation summarizes per-currency totals and fees cleanly
    const gwRec = await app.inject({
      method: 'GET',
      url: '/api/payments/gateway-reconciliation',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A },
    })
    expect(gwRec.statusCode).toBe(200)
    expect(gwRec.json().data.reconciled).toBe(true)
    const afnGw = gwRec
      .json()
      .data.perCurrency.find((c: { currency: string }) => c.currency === 'AFN')
    expect(afnGw.capturedMinor).toBe(15000)
    expect(afnGw.totalFeesMinor).toBe(150)
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
    expect(body.status).toBe('balanced')
    expect(body.debits).toBe(10000)
    expect(body.credits).toBe(10000)
    expect(body.mismatched).toBe(0)
    expect(body.orphaned).toBe(0)
    expect(body.perCurrency).toHaveLength(2)
    expect(body.ledger.debitCreditVarianceMinor).toBe(0)
    expect(body.ledger.unpostedJournalLinesCount).toBe(0)

    // Unposted draft journal lines must NOT pollute posted debit/credit variance, and are counted
    db.seed('journal_entries', [
      ...db.rows('journal_entries'),
      {
        id: 'je-draft',
        workspace_id: SHOP_A,
        source_type: 'manual',
        source_id: null,
        status: 'draft',
      },
    ])
    db.seed('journal_lines', [
      ...db.rows('journal_lines'),
      { id: 'jl-draft-1', workspace_id: SHOP_A, journal_id: 'je-draft', debit: 99999, credit: 0 },
    ])
    const draftRes = await app.inject({
      method: 'POST',
      url: '/api/accounting/reconcile-cross-core',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A },
      payload: {},
    })
    expect(draftRes.statusCode).toBe(200)
    expect(draftRes.json().data.ledger.debitCreditVarianceMinor).toBe(0)
    expect(draftRes.json().data.ledger.unpostedJournalLinesCount).toBe(1)

    // Inject an allocation mismatch in USD and confirm balanced flips to false with exact variance
    db.seed('invoices', [
      {
        id: INV_AFN,
        workspace_id: SHOP_A,
        currency: 'AFN',
        total: 10000,
        paid_amount: 10000,
        status: 'completed',
      },
      {
        id: INV_USD,
        workspace_id: SHOP_A,
        currency: 'USD',
        total: 200,
        paid_amount: 350,
        status: 'completed',
      },
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
    expect(skewed.status).toBe('unbalanced')
    expect(skewed.invoicePaidExceedsTotalCount).toBe(1)
    expect(
      skewed.exceptions.some((e: { code: string }) => e.code === 'INVOICE_PAID_EXCEEDS_TOTAL'),
    ).toBe(true)
    const usd = skewed.perCurrency.find((c: { currency: string }) => c.currency === 'USD')
    expect(usd.invoicePaidVsAllocationsVarianceMinor).toBe(150)

    // Currency-mismatch allocation must set mismatched > 0 and emit ALLOCATION_CURRENCY_MISMATCH
    db.seed('payment_allocations', [
      ...db.rows('payment_allocations'),
      { payment_id: PAY_AFN, invoice_id: INV_USD, workspace_id: SHOP_A, amount: 50 },
    ])
    const curMismatch = await app.inject({
      method: 'POST',
      url: '/api/accounting/reconcile-cross-core',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A },
      payload: {},
    })
    expect(curMismatch.statusCode).toBe(200)
    expect(curMismatch.json().data.mismatched).toBeGreaterThanOrEqual(1)
    expect(
      curMismatch
        .json()
        .data.exceptions.some((e: { code: string }) => e.code === 'ALLOCATION_CURRENCY_MISMATCH'),
    ).toBe(true)
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

    // Invalid archive (wrong workspace, unsupported version, checksum mismatch, unknown table,
    // duplicate ID, cross-tenant row, malformed timestamp, broken FK) must set valid=false
    const invalidPreview = await app.inject({
      method: 'POST',
      url: `/api/workspaces/${SHOP_A}/export-restore-preview`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A },
      payload: {
        meta: {
          workspaceId: SHOP_B,
          schemaVersion: '999',
          truncatedTables: [],
          checksumSha256: 'deadbeef'.repeat(8),
        },
        data: {
          products: [
            {
              id: 'dup-1',
              workspace_id: SHOP_B,
              created_at: 'not-a-date',
              sell_price: 12.345,
              currency: 'AFN',
            },
            { id: 'dup-1' },
          ],
          invoices: [{ id: 'inv-1' }],
          invoice_items: [{ id: 'ii-1', invoice_id: 'missing-inv-99' }],
          mystery_table: [{ id: 'x' }],
        },
      },
    })
    expect(invalidPreview.statusCode).toBe(200)
    const invData = invalidPreview.json().data
    expect(invData.valid).toBe(false)
    expect(invData.restoreExecutionSupported).toBe(false)
    expect(invData.workspaceMatch).toBe(false)
    expect(invData.unknownTables).toContain('mystery_table')
    expect(invData.duplicateIds).toContainEqual({ table: 'products', id: 'dup-1' })
    expect(invData.crossTenantRows).toHaveLength(1)
    expect(invData.malformedTimestamps).toHaveLength(1)
    expect(invData.invalidMoneyRows).toHaveLength(1)
    expect(invData.brokenForeignKeys).toHaveLength(1)
    expect(invData.errors).toEqual(
      expect.arrayContaining([
        'WORKSPACE_ID_MISMATCH',
        'UNSUPPORTED_SCHEMA_VERSION',
        'CHECKSUM_MISMATCH',
        'CROSS_TENANT_ROW_DETECTED',
        'MALFORMED_TIMESTAMP',
        'INVALID_MONETARY_VALUE',
        'BROKEN_FOREIGN_KEY',
      ]),
    )
  })
})
