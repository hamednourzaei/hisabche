// ============================================
// packages/local-engine/src/__tests__/local-auth.test.ts
//
// Verification for Scenario 30B, 06B, 15B:
// - Role-based capability enforcement in Local Engine
// - Prevention of unauthorized actions by seller role (invoice deletion, pricing modifications, full backup)
// - Prevention of premature projection deletion on dirty invoices
// - Outbox squashing on local invoice cancellation
// ============================================

import { describe, expect, it } from 'vitest'
import { createLocalEngine } from '../index'
import { createTestDb, TEST_WORKSPACE_ID, TEST_WAREHOUSE_ID } from './test-db'

describe('Local Engine Authorization & Safety Guards (Scenarios 30B, 06B, 15B)', () => {
  it('Scenario 30B: seller role cannot delete or cancel invoices', async () => {
    const db = createTestDb()
    const engine = createLocalEngine(db)

    // Seed customer and product via engine
    const custRes = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/customers',
      headers: { 'x-workspace-id': TEST_WORKSPACE_ID },
      body: { fullName: 'مشتری ۱' },
    })
    const customerId = custRes.data.id

    const prodRes = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/products',
      headers: { 'x-workspace-id': TEST_WORKSPACE_ID },
      body: { name: 'کالای ۱', sellPrice: 100 },
    })
    const productId = prodRes.data.id

    // Create an invoice as owner
    const createRes = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/invoices',
      headers: {
        'x-workspace-id': TEST_WORKSPACE_ID,
        'x-user-role': 'owner',
      },
      body: {
        type: 'sale',
        date: '2026-10-31',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [{ productName: 'کالا', quantity: 2, unitPrice: 100 }],
      },
    })
    expect(createRes.status).toBe(201)
    const invoiceId = createRes.data.id

    // Seller tries to cancel invoice -> should be rejected with 403 Forbidden
    const sellerCancelRes = await engine.request({
      method: 'POST',
      path: `/invoices/${invoiceId}/cancel`,
      headers: {
        'x-workspace-id': TEST_WORKSPACE_ID,
        'x-user-role': 'seller',
      },
    })
    expect(sellerCancelRes.status).toBe(403)

    // Seller tries to DELETE invoice -> should also be rejected with 403
    const sellerDeleteRes = await engine.request({
      method: 'DELETE',
      path: `/invoices/${invoiceId}`,
      headers: {
        'x-workspace-id': TEST_WORKSPACE_ID,
        'x-user-role': 'seller',
      },
    })
    expect(sellerDeleteRes.status).toBe(403)

    // Owner can cancel invoice -> 200 OK
    const ownerCancelRes = await engine.request({
      method: 'POST',
      path: `/invoices/${invoiceId}/cancel`,
      headers: {
        'x-workspace-id': TEST_WORKSPACE_ID,
        'x-user-role': 'owner',
      },
    })
    expect(ownerCancelRes.status).toBe(200)
  })

  it('Scenario 30B: seller role cannot create price lists or promotions', async () => {
    const db = createTestDb()
    const engine = createLocalEngine(db)

    // Seller tries to create a price list -> 403
    const sellerPriceRes = await engine.request({
      method: 'POST',
      path: '/price-lists',
      headers: {
        'x-workspace-id': TEST_WORKSPACE_ID,
        'x-user-role': 'seller',
      },
      body: {
        name: 'لیست قیمت فروش ویژه',
        currency: 'AFN',
      },
    })
    expect(sellerPriceRes.status).toBe(403)

    // Seller tries to export full database backup -> 403
    const sellerBackupRes = await engine.request({
      method: 'GET',
      path: '/workspaces/backup',
      headers: {
        'x-workspace-id': TEST_WORKSPACE_ID,
        'x-user-role': 'seller',
      },
    })
    expect(sellerBackupRes.status).toBe(403)

    // Manager can create price list -> 201
    const managerPriceRes = await engine.request({
      method: 'POST',
      path: '/price-lists',
      headers: {
        'x-workspace-id': TEST_WORKSPACE_ID,
        'x-user-role': 'manager',
      },
      body: {
        name: 'لیست قیمت مدیر',
        currency: 'AFN',
      },
    })
    expect(managerPriceRes.status).toBe(201)
  })

  it('Scenario 06B: DELETE /invoices/:id/projection preserves items when invoice is dirty', async () => {
    const db = createTestDb()
    const engine = createLocalEngine(db)

    // Create an invoice
    const createRes = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/invoices',
      headers: { 'x-workspace-id': TEST_WORKSPACE_ID },
      body: {
        type: 'sale',
        date: '2026-10-31',
        items: [{ productName: 'کالا برای تست پروجکشن', quantity: 1, unitPrice: 100 }],
      },
    })
    expect(createRes.status).toBe(201)
    const invId = createRes.data.id

    // Mark dirty = 1 (unsynced)
    db.run('UPDATE invoice SET dirty = 1 WHERE id = ?', [invId])

    // Attempt projection deletion while dirty = 1
    const res = await engine.request<{ removed: number }>({
      method: 'DELETE',
      path: `/invoices/${invId}/projection`,
      headers: { 'x-workspace-id': TEST_WORKSPACE_ID },
    })

    expect(res.status).toBe(200)
    expect(res.data.removed).toBe(0)

    // Verify item was NOT deleted
    const items = db.all('SELECT * FROM invoice_item WHERE invoice_id = ?', [invId])
    expect(items.length).toBe(1)

    // Now mark dirty = 0 (as if reconciled from server)
    db.run('UPDATE invoice SET dirty = 0 WHERE id = ?', [invId])

    const cleanRes = await engine.request<{ removed: number }>({
      method: 'DELETE',
      path: `/invoices/${invId}/projection`,
      headers: { 'x-workspace-id': TEST_WORKSPACE_ID },
    })
    expect(cleanRes.status).toBe(200)
    expect(cleanRes.data.removed).toBe(2) // 1 item + 1 header

    const itemsAfter = db.all('SELECT * FROM invoice_item WHERE invoice_id = ?', [invId])
    expect(itemsAfter.length).toBe(0)
  })

  it('Scenario 15B: cancelling an unsent offline invoice squashes its outbox create entry', async () => {
    const db = createTestDb()
    const engine = createLocalEngine(db)

    // Create invoice with queue flag to record outbox entry
    const createRes = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/invoices',
      headers: {
        'x-workspace-id': TEST_WORKSPACE_ID,
        'x-hisabche-queue': '1',
        'x-user-role': 'owner',
      },
      body: {
        type: 'sale',
        date: '2026-10-31',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [{ productName: 'کالای انبار', quantity: 1, unitPrice: 200 }],
      },
    })
    expect(createRes.status).toBe(201)
    const invId = createRes.data.id

    // Check sync_queue has pending create
    const queuePending = db.all<{ client_id: string; status: string }>(
      "SELECT client_id, status FROM sync_queue WHERE entity = 'invoice' AND operation = 'create'",
    )
    expect(queuePending.length).toBe(1)
    expect(queuePending[0]?.status).toBe('pending')

    // Cancel the invoice before it has synced
    const cancelRes = await engine.request({
      method: 'POST',
      path: `/invoices/${invId}/cancel`,
      headers: {
        'x-workspace-id': TEST_WORKSPACE_ID,
        'x-hisabche-queue': '1',
        'x-user-role': 'owner',
      },
    })
    expect(cancelRes.status).toBe(200)

    // Verify sync_queue create was cancelled (squashed)
    const queueCancelled = db.all<{ client_id: string; status: string }>(
      "SELECT client_id, status FROM sync_queue WHERE entity = 'invoice' AND operation = 'create'",
    )
    expect(queueCancelled[0]?.status).toBe('cancelled')
  })
})
