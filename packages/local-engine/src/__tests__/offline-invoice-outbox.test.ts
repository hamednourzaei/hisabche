// ============================================
// packages/local-engine/src/__tests__/offline-invoice-outbox.test.ts
//
// F3.1 (D1 + D2): an offline sale in the cloud edition is written by the ONE
// local engine — invoice, lines, stock, party balance, KPI projection — and
// its outbox row in the SAME transaction.
//
// The tests read what a person gets: the invoice the screen shows (temporary
// number) and the row the sync engine will send (client_id = that invoice's
// id, the F1 owner, the raw body). And they prove the transaction: when the
// outbox write fails, no invoice survives.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalEngine } from '../index'
import { createTestDb, TEST_USER_ID, TEST_WORKSPACE_ID } from './test-db'

const SALE = {
  type: 'sale',
  date: '2026-10-20',
  paymentMethod: 'cash',
  items: [{ productName: 'کیبورد', quantity: 2, unitPrice: 50000 }],
}

interface QueueRow {
  client_id: string
  entity: string
  operation: string
  payload: string
  user_id: string | null
  workspace_id: string | null
}

describe('offline sale: one transaction, one outbox row', () => {
  let db: ReturnType<typeof createTestDb>
  let engine: ReturnType<typeof createLocalEngine>

  beforeEach(() => {
    db = createTestDb()
    engine = createLocalEngine(db)
  })

  const queueRows = (): QueueRow[] =>
    db.all<QueueRow>('SELECT * FROM sync_queue ORDER BY created_at')

  it('writes no outbox row when the request does not ask for one', async () => {
    const res = await engine.request({ method: 'POST', path: '/invoices', body: SALE })

    expect(res.status).toBe(201)
    expect(queueRows()).toHaveLength(0)
    expect(db.all('SELECT id FROM invoice')).toHaveLength(1)
  })

  it('writes the invoice and its outbox row, numbered temporarily', async () => {
    const res = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: SALE,
      headers: { 'x-hisabche-queue': '1', 'x-hisabche-user-id': TEST_USER_ID },
    })

    expect(res.status).toBe(201)
    const created = res.data as { id: string; invoiceNumber: string }
    // D4: the device writes a temporary id, never an official number.
    expect(created.invoiceNumber.startsWith('OFF-')).toBe(true)

    const rows = queueRows()
    expect(rows).toHaveLength(1)
    // D2: the idempotency key is the document's own local id.
    expect(rows[0]!.client_id).toBe(created.id)
    expect(rows[0]!.entity).toBe('invoice')
    expect(rows[0]!.operation).toBe('create')
    // F1: the owner is the account that made the change, never blank.
    expect(rows[0]!.user_id).toBe(TEST_USER_ID)
    expect(rows[0]!.workspace_id).toBe(TEST_WORKSPACE_ID)
    // The body travels unchanged: the server creates the same sale.
    expect(JSON.parse(rows[0]!.payload)).toEqual(SALE)
  })

  it('rolls the invoice back when the outbox row cannot be written', async () => {
    // A queue that cannot accept the row stands in for a crash mid-write.
    db.exec(
      "CREATE TRIGGER no_queue BEFORE INSERT ON sync_queue BEGIN SELECT RAISE(ABORT, 'queue is down'); END",
    )

    const res = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: SALE,
      headers: { 'x-hisabche-queue': '1', 'x-hisabche-user-id': TEST_USER_ID },
    })

    expect(res.status).toBe(500)
    // Neither half survives alone: no invoice without its outbox row.
    expect(db.all('SELECT id FROM invoice')).toHaveLength(0)
    expect(db.all('SELECT id FROM invoice_item')).toHaveLength(0)
    expect(queueRows()).toHaveLength(0)
  })

  it('deletes the projection (header and lines) in one call', async () => {
    const res = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: SALE,
      headers: { 'x-hisabche-queue': '1', 'x-hisabche-user-id': TEST_USER_ID },
    })
    const created = res.data as { id: string }

    const removed = await engine.request({
      method: 'DELETE',
      path: `/invoices/${created.id}/projection`,
    })

    expect(removed.status).toBe(200)
    expect(removed.data).toEqual({ removed: 2 })
    expect(db.all('SELECT id FROM invoice WHERE id = ?', [created.id])).toHaveLength(0)
    expect(db.all('SELECT id FROM invoice_item WHERE invoice_id = ?', [created.id])).toHaveLength(0)
    // The outbox row stays: the sale itself is still waiting to be sent.
    expect(queueRows()).toHaveLength(1)
  })
})
