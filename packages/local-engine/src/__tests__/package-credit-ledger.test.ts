// ============================================
// packages/local-engine/src/__tests__/package-credit-ledger.test.ts
//
// M3 — PACKAGE CREDIT & ENTITLEMENT LEDGER
// Integration tests for Package Credit Ledger in Local Engine (SQLite)
// Verifies 3 distinct truths:
//   1. Package Credit / Entitlement Truth (append-only ledger of facts)
//   2. Payment Truth (handled strictly by existing payment engine)
//   3. Accounting Truth (handled strictly by existing double-entry ledger)
// ============================================

import { describe, expect, it } from 'vitest'
import { createTestDb, createTestEngine, TEST_WORKSPACE_ID, TEST_USER_ID } from './test-db'

describe('M3: Package Credit Ledger Local Engine Integration', () => {
  const ws1 = TEST_WORKSPACE_ID
  const user1 = TEST_USER_ID
  const custId = '44444444-4444-4444-8444-444444444444'
  const pkgProdId = '55555555-5555-4555-8555-555555555555'

  function setupEngine() {
    const db = createTestDb()
    const engine = createTestEngine(db)

    // Seed Customer
    db.run(
      `INSERT OR REPLACE INTO customer (id, workspace_id, full_name, phone, created_at, updated_at)
       VALUES (?, ?, 'Ali Reza', '0799112233', '2026-11-01', '2026-11-01')`,
      [custId, ws1],
    )

    // Seed Package Product
    db.run(
      `INSERT OR REPLACE INTO product (
        id, workspace_id, name, buy_price, sell_price, quantity, is_active, offering_type, updated_at
      ) VALUES (
        ?, ?, '10-Session Gym Package', 0, 10000, 0, 1, 'package', '2026-11-01'
      )`,
      [pkgProdId, ws1],
    )

    const headers = {
      'x-workspace-id': ws1,
      'x-user-id': user1,
      'x-user-role': 'owner',
    }

    return { db, engine, headers }
  }

  // 1. Initial balance is 0
  it('1. returns balance = 0 when customer has no package entries', async () => {
    const { engine, headers } = setupEngine()
    const res = await engine.request<{ balance: number }>({
      method: 'GET',
      path: '/package-credits/balance',
      params: { customerId: custId, packageProductId: pkgProdId },
      headers,
    })

    expect(res.status).toBe(200)
    expect(res.data.balance).toBe(0)
  })

  // 2. Sales invoice creation grants package credits
  it('2. sales invoice with package offering automatically creates GRANT entry', async () => {
    const { db, engine, headers } = setupEngine()

    const invoicePayload = {
      customerId: custId,
      type: 'sale',
      date: '2026-11-01',
      currency: 'AFN',
      items: [
        {
          productId: pkgProdId,
          productName: '10-Session Gym Package',
          quantity: 1,
          unit: 'pack',
          unitPrice: 10000,
        },
      ],
    }

    const invRes = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/invoices',
      body: invoicePayload,
      headers: {
        ...headers,
        'x-hisabche-queue': '1',
      },
    })
    expect(invRes.status).toBe(201)

    // Check balance is now 1 package unit
    const balRes = await engine.request<{ balance: number }>({
      method: 'GET',
      path: '/package-credits/balance',
      params: { customerId: custId, packageProductId: pkgProdId },
      headers,
    })
    expect(balRes.status).toBe(200)
    expect(balRes.data.balance).toBe(1)

    // The credit reaches the server THROUGH THE INVOICE command; a separate ledger command for the grant was routed by the sync
    // engine to the CONSUME endpoint (see package-grant-outbox.test.ts), so none is queued.
    const outboxRows = db.all<{ entity: string; operation: string }>(
      `SELECT entity, operation FROM sync_queue WHERE workspace_id = ? AND entity = 'package_credit_ledger'`,
      [ws1],
    )
    expect(outboxRows).toEqual([])
    const invoiceCommands = db.all<{ entity: string }>(
      `SELECT entity FROM sync_queue WHERE workspace_id = ? AND entity = 'invoice'`,
      [ws1],
    )
    expect(invoiceCommands.length).toBe(1)
  })

  // 3. Multi-unit package grant (e.g. 5 sessions directly)
  it('3. consumes credit, updates balance, and prevents over-consumption', async () => {
    const { db, engine, headers } = setupEngine()

    // Manually insert a GRANT of 5 sessions
    db.run(
      `INSERT INTO package_credit_ledger (
        id, workspace_id, customer_id, package_product_id, entry_type, quantity,
        unit, source_document_type, effective_date, created_at, updated_at
      ) VALUES (
        'grant-5', ?, ?, ?, 'GRANT', 5,
        'piece', 'invoice', '2026-11-01', '2026-11-01T10:00:00Z', '2026-11-01T10:00:00Z'
      )`,
      [ws1, custId, pkgProdId],
    )

    // Consume 2 sessions
    const consumeRes = await engine.request<{ balance: number; entry: { entryType: string } }>({
      method: 'POST',
      path: '/package-credits/consume',
      body: {
        customerId: custId,
        packageProductId: pkgProdId,
        quantity: 2,
        notes: 'Attended training session #1 and #2',
      },
      headers,
    })

    expect(consumeRes.status).toBe(201)
    expect(consumeRes.data.balance).toBe(3)
    expect(consumeRes.data.entry.entryType).toBe('CONSUME')

    // Over-consumption must fail closed (requesting 4 when only 3 remain)
    const overdraw = await engine.request<{ error: string }>({
      method: 'POST',
      path: '/package-credits/consume',
      body: {
        customerId: custId,
        packageProductId: pkgProdId,
        quantity: 4,
      },
      headers,
    })

    expect(overdraw.status).toBe(400)
    expect(overdraw.data.error).toBe('INSUFFICIENT_PACKAGE_CREDIT')
  })

  // 4. Idempotent consumption
  it('4. consumption with existing idempotencyKey is strictly idempotent', async () => {
    const { db, engine, headers } = setupEngine()

    // Grant 10 sessions
    db.run(
      `INSERT INTO package_credit_ledger (
        id, workspace_id, customer_id, package_product_id, entry_type, quantity,
        unit, source_document_type, effective_date, created_at, updated_at
      ) VALUES (
        'grant-10', ?, ?, ?, 'GRANT', 10,
        'piece', 'invoice', '2026-11-01', '2026-11-01T10:00:00Z', '2026-11-01T10:00:00Z'
      )`,
      [ws1, custId, pkgProdId],
    )

    const payload = {
      customerId: custId,
      packageProductId: pkgProdId,
      quantity: 3,
      idempotencyKey: 'idemp-session-attend-999',
    }

    // Call 1
    const res1 = await engine.request<{ balance: number; entry: { id: string } }>({
      method: 'POST',
      path: '/package-credits/consume',
      body: payload,
      headers,
    })
    expect(res1.status).toBe(201)
    expect(res1.data.balance).toBe(7)

    // Call 2 with identical key
    const res2 = await engine.request<{ balance: number; entry: { id: string } }>({
      method: 'POST',
      path: '/package-credits/consume',
      body: payload,
      headers,
    })
    expect(res2.status).toBe(200)
    expect(res2.data.balance).toBe(7) // Balance unchanged!
    expect(res2.data.entry.id).toBe(res1.data.entry.id)
  })

  // 5. Reversal restores balance
  it('5. reversing a consumption restores credits up to consumed amount', async () => {
    const { db, engine, headers } = setupEngine()

    db.run(
      `INSERT INTO package_credit_ledger (
        id, workspace_id, customer_id, package_product_id, entry_type, quantity,
        unit, source_document_type, effective_date, created_at, updated_at
      ) VALUES (
        'grant-10', ?, ?, ?, 'GRANT', 10,
        'piece', 'invoice', '2026-11-01', '2026-11-01T10:00:00Z', '2026-11-01T10:00:00Z'
      )`,
      [ws1, custId, pkgProdId],
    )

    const consumeRes = await engine.request<{ entry: { id: string } }>({
      method: 'POST',
      path: '/package-credits/consume',
      body: {
        customerId: custId,
        packageProductId: pkgProdId,
        quantity: 4,
      },
      headers,
    })
    const consumeId = consumeRes.data.entry.id

    // Reverse 2 of the 4 sessions
    const revRes = await engine.request<{ balance: number; entry: { entryType: string } }>({
      method: 'POST',
      path: '/package-credits/reverse',
      body: {
        referenceEntryId: consumeId,
        quantity: 2,
        notes: 'Session rescheduled',
      },
      headers,
    })

    expect(revRes.status).toBe(200)
    expect(revRes.data.balance).toBe(8) // 10 - 4 + 2 = 8
    expect(revRes.data.entry.entryType).toBe('REVERSAL')
  })

  // 6. Expiration zeroes remaining balance without cash refund
  it('6. expiration zeroes remaining balance without cash refund', async () => {
    const { db, engine, headers } = setupEngine()

    db.run(
      `INSERT INTO package_credit_ledger (
        id, workspace_id, customer_id, package_product_id, entry_type, quantity,
        unit, source_document_type, effective_date, created_at, updated_at
      ) VALUES (
        'grant-10', ?, ?, ?, 'GRANT', 10,
        'piece', 'invoice', '2026-11-01', '2026-11-01T10:00:00Z', '2026-11-01T10:00:00Z'
      )`,
      [ws1, custId, pkgProdId],
    )

    // Consume 3 sessions
    await engine.request({
      method: 'POST',
      path: '/package-credits/consume',
      body: {
        customerId: custId,
        packageProductId: pkgProdId,
        quantity: 3,
      },
      headers,
    })

    // Expire remaining
    const expRes = await engine.request<{
      balance: number
      entry: { quantity: number; entryType: string }
    }>({
      method: 'POST',
      path: '/package-credits/expire',
      body: {
        customerId: custId,
        packageProductId: pkgProdId,
        notes: 'Expired after 90 days',
      },
      headers,
    })

    expect(expRes.status).toBe(200)
    expect(expRes.data.balance).toBe(0)
    expect(expRes.data.entry.quantity).toBe(7)
    expect(expRes.data.entry.entryType).toBe('EXPIRE')

    // Confirm balance query also returns 0
    const finalBal = await engine.request<{ balance: number }>({
      method: 'GET',
      path: '/package-credits/balance',
      params: { customerId: custId, packageProductId: pkgProdId },
      headers,
    })
    expect(finalBal.data.balance).toBe(0)
  })

  // 7. Invoice cancellation revokes granted package credits
  it('7. cancelling an invoice revokes package credits granted by that invoice', async () => {
    const { engine, headers } = setupEngine()

    const invRes = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/invoices',
      body: {
        customerId: custId,
        type: 'sale',
        date: '2026-11-01',
        currency: 'AFN',
        items: [
          {
            productId: pkgProdId,
            productName: '10-Session Gym Package',
            quantity: 3,
            unit: 'pack',
            unitPrice: 10000,
          },
        ],
      },
      headers,
    })
    expect(invRes.status).toBe(201)
    const invoiceId = invRes.data.id

    // Initial balance is 3 packages
    const balBefore = await engine.request<{ balance: number }>({
      method: 'GET',
      path: '/package-credits/balance',
      params: { customerId: custId, packageProductId: pkgProdId },
      headers,
    })
    expect(balBefore.data.balance).toBe(3)

    // Cancel invoice
    const cancelRes = await engine.request({
      method: 'POST',
      path: `/invoices/${invoiceId}/cancel`,
      headers,
    })
    expect(cancelRes.status).toBe(200)

    // Balance after cancellation is 0!
    const balAfter = await engine.request<{ balance: number }>({
      method: 'GET',
      path: '/package-credits/balance',
      params: { customerId: custId, packageProductId: pkgProdId },
      headers,
    })
    expect(balAfter.data.balance).toBe(0)
  })
})
