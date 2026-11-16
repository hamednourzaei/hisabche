// ============================================
// packages/local-engine/src/__tests__/payment-confirm-server.test.ts
//
// V70 §8: the server accepted a payment the device recorded first.
//
// Real SQLite, the device's real schema. What a person gets is asserted: ONE
// payment on the device, under the server's id and number, with its
// allocation and its ledger entry still attached — so «cancel this payment»
// later names the id the server knows.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, createTestEngine, TEST_USER_ID, TEST_WORKSPACE_ID } from './test-db'

const QUEUED = { 'x-hisabche-queue': '1', 'x-hisabche-user-id': TEST_USER_ID }
const CUSTOMER = '00000000-0000-4000-8000-000000000001'
const INVOICE = '00000000-0000-4000-9000-000000000001'
const CLIENT_ID = 'pay_device_intent_1'
const SERVER_ID = '11111111-2222-4333-8444-555555555555'
const OFFICIAL = 'PMT-2026-000042'

describe('payment confirm-server: the server id lands on the device row', () => {
  let db: ReturnType<typeof createTestDb>
  let engine: ReturnType<typeof createTestEngine>

  beforeEach(() => {
    db = createTestDb()
    engine = createTestEngine(db)
    db.run(
      `INSERT INTO invoice (id, workspace_id, invoice_number, type, customer_id, date, total, paid_amount, currency, status, updated_at)
       VALUES (?, ?, 'INV-1', 'sale', ?, '2026-11-01', 1000, 0, 'AFN', 'pending', datetime('now'))`,
      [INVOICE, TEST_WORKSPACE_ID, CUSTOMER],
    )
  })

  const recordOnDevice = async () => {
    const res = await engine.request({
      method: 'POST',
      path: '/payments',
      headers: QUEUED,
      body: {
        id: CLIENT_ID,
        direction: 'in',
        partyType: 'customer',
        partyId: CUSTOMER,
        amount: 400,
        currency: 'AFN',
        allocations: [{ invoiceId: INVOICE, amount: 400 }],
      },
    })
    expect(res.status, JSON.stringify(res.data)).toBe(201)
  }

  const confirm = (clientId: string, body: Record<string, unknown>) =>
    engine.request<{ confirmed: boolean; reason?: string; paymentNumber?: string }>({
      method: 'POST',
      path: `/payments/${clientId}/confirm-server`,
      body,
      headers: { 'x-hisabche-user-id': TEST_USER_ID },
    })

  const count = (sql: string, args: unknown[]): number =>
    (db.get<{ n: number }>(sql, args) ?? { n: 0 }).n

  it('records the payment AND its outbox row under the intent key, in one write', async () => {
    await recordOnDevice()
    expect(
      count(
        "SELECT COUNT(*) AS n FROM sync_queue WHERE entity = 'payment' AND operation = 'create' AND client_id = ?",
        [CLIENT_ID],
      ),
    ).toBe(1)
  })

  it('moves the row, its allocation and its ledger entry to the server id', async () => {
    await recordOnDevice()
    const res = await confirm(CLIENT_ID, { serverId: SERVER_ID, paymentNumber: OFFICIAL })
    expect(res.status, JSON.stringify(res.data)).toBe(201)
    expect(res.data.confirmed).toBe(true)

    expect(count('SELECT COUNT(*) AS n FROM payment', [])).toBe(1)
    const row = db.get<{ id: string; payment_number: string; sync_state: string }>(
      'SELECT id, payment_number, sync_state FROM payment',
      [],
    )
    expect(row).toEqual({ id: SERVER_ID, payment_number: OFFICIAL, sync_state: 'synced' })
    expect(
      count('SELECT COUNT(*) AS n FROM payment_allocation WHERE payment_id = ?', [SERVER_ID]),
    ).toBe(1)
    expect(
      count('SELECT COUNT(*) AS n FROM payment_allocation WHERE payment_id = ?', [CLIENT_ID]),
    ).toBe(0)
    expect(
      count(
        "SELECT COUNT(*) AS n FROM journal_entry WHERE source_type = 'payment' AND source_id = ?",
        [SERVER_ID],
      ),
    ).toBe(1)
    // Nothing recomputed: the invoice the payment settled is still settled by 400.
    expect(db.get<{ paid: number }>('SELECT paid_amount AS paid FROM invoice', [])!.paid).toBe(400)
  })

  it('a cancel after confirmation reverses the entry under the server id', async () => {
    await recordOnDevice()
    await confirm(CLIENT_ID, { serverId: SERVER_ID, paymentNumber: OFFICIAL })
    const res = await engine.request({
      method: 'POST',
      path: `/payments/${SERVER_ID}/cancel`,
      headers: QUEUED,
      body: { reason: 'اشتباه ثبت شد' },
    })
    expect(res.status, JSON.stringify(res.data)).toBe(200)
    expect(db.get<{ paid: number }>('SELECT paid_amount AS paid FROM invoice', [])!.paid).toBe(0)
  })

  it('a second confirm, or one for a payment the device does not have, changes nothing', async () => {
    await recordOnDevice()
    await confirm(CLIENT_ID, { serverId: SERVER_ID, paymentNumber: OFFICIAL })
    const again = await confirm(CLIENT_ID, { serverId: SERVER_ID, paymentNumber: OFFICIAL })
    expect(again.data).toMatchObject({ confirmed: false, reason: 'NOT_ON_DEVICE' })
    expect(count('SELECT COUNT(*) AS n FROM payment', [])).toBe(1)
  })

  it('never leaves two rows when the server row is already on the device', async () => {
    await recordOnDevice()
    db.run(
      `INSERT INTO payment (id, workspace_id, payment_number, direction, party_type, party_id, amount, currency, entry_date, created_at, updated_at)
       VALUES (?, ?, ?, 'in', 'customer', ?, 400, 'AFN', '2026-11-16', datetime('now'), datetime('now'))`,
      [SERVER_ID, TEST_WORKSPACE_ID, OFFICIAL, CUSTOMER],
    )
    const res = await confirm(CLIENT_ID, { serverId: SERVER_ID, paymentNumber: OFFICIAL })
    expect(res.data).toMatchObject({ confirmed: false, reason: 'ALREADY_PRESENT' })
  })

  it('refuses a confirmation without the server id', async () => {
    await recordOnDevice()
    const res = await confirm(CLIENT_ID, { paymentNumber: OFFICIAL })
    expect(res.status).toBe(400)
  })
})
