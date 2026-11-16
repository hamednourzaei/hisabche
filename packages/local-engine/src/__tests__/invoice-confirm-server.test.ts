// ============================================
// packages/local-engine/src/__tests__/invoice-confirm-server.test.ts
//
// V68.5: the server accepted a sale the device recorded first.
//
// Run against a real SQLite with the device's real schema — the first guard
// for this route mocked the route itself, so its SQL had never executed.
//
// What a person gets is asserted, not the call: ONE invoice on the device,
// carrying the official number, with its lines, stock movement and posting
// still attached to it.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, createTestEngine, TEST_USER_ID } from './test-db'

const QUEUED = { 'x-hisabche-queue': '1', 'x-hisabche-user-id': TEST_USER_ID }

const SALE = {
  type: 'sale',
  date: '2026-11-16',
  paymentMethod: 'cash',
  items: [{ productName: 'کیبورد', quantity: 2, unitPrice: 50000 }],
}

const SERVER_ID = '11111111-2222-4333-8444-555555555555'
const OFFICIAL = 'INV-000123'

describe('confirm-server: the official number lands on the device row', () => {
  let db: ReturnType<typeof createTestDb>
  let engine: ReturnType<typeof createTestEngine>

  beforeEach(() => {
    db = createTestDb()
    engine = createTestEngine(db)
  })

  const recordOnDevice = async (): Promise<{ id: string; invoiceNumber: string }> => {
    const res = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: SALE,
      headers: QUEUED,
    })
    expect(res.status).toBe(201)
    return res.data as { id: string; invoiceNumber: string }
  }

  const confirm = (clientId: string, body: Record<string, unknown>) =>
    engine.request({
      method: 'POST',
      path: `/invoices/${clientId}/confirm-server`,
      body,
      headers: { 'x-hisabche-user-id': TEST_USER_ID },
    })

  const count = (sql: string, args: unknown[]): number =>
    (db.get<{ n: number }>(sql, args) ?? { n: 0 }).n

  it('moves the row and everything hung on it to the server id', async () => {
    const local = await recordOnDevice()
    expect(local.invoiceNumber.startsWith('OFF-')).toBe(true)
    const linesBefore = count('SELECT COUNT(*) AS n FROM invoice_item WHERE invoice_id = ?', [
      local.id,
    ])
    expect(linesBefore).toBe(1)
    const postingsBefore = count(
      "SELECT COUNT(*) AS n FROM journal_entry WHERE source_type = 'invoice' AND source_id = ?",
      [local.id],
    )

    const res = await confirm(local.id, { serverId: SERVER_ID, invoiceNumber: OFFICIAL })

    expect(res.status).toBe(201)
    expect(res.data).toEqual({ confirmed: true, id: SERVER_ID, invoiceNumber: OFFICIAL })

    // ONE invoice, under the server's id, with the official number.
    const invoices = db.all<{ id: string; invoice_number: string; sync_state: string }>(
      'SELECT id, invoice_number, sync_state FROM invoice',
    )
    expect(invoices).toEqual([{ id: SERVER_ID, invoice_number: OFFICIAL, sync_state: 'synced' }])

    // Its lines and its posting went with it; nothing is left on the old id.
    expect(count('SELECT COUNT(*) AS n FROM invoice_item WHERE invoice_id = ?', [SERVER_ID])).toBe(
      linesBefore,
    )
    expect(count('SELECT COUNT(*) AS n FROM invoice_item WHERE invoice_id = ?', [local.id])).toBe(0)
    expect(
      count(
        "SELECT COUNT(*) AS n FROM journal_entry WHERE source_type = 'invoice' AND source_id = ?",
        [SERVER_ID],
      ),
    ).toBe(postingsBefore)
    expect(
      count(
        "SELECT COUNT(*) AS n FROM journal_entry WHERE source_type = 'invoice' AND source_id = ?",
        [local.id],
      ),
    ).toBe(0)

    // No amount was touched: the total is the one the device computed.
    const total = db.get<{ total: number }>('SELECT total FROM invoice WHERE id = ?', [SERVER_ID])
    expect(total?.total).toBe(100000)
  })

  it('keeps the id when the server kept it, and still writes the number', async () => {
    const local = await recordOnDevice()

    const res = await confirm(local.id, { serverId: local.id, invoiceNumber: OFFICIAL })

    expect(res.data).toEqual({ confirmed: true, id: local.id, invoiceNumber: OFFICIAL })
    expect(
      db.all<{ invoice_number: string }>('SELECT invoice_number FROM invoice WHERE id = ?', [
        local.id,
      ]),
    ).toEqual([{ invoice_number: OFFICIAL }])
  })

  it('does not make a second row when the pull already brought the server row', async () => {
    const local = await recordOnDevice()
    // The pull was faster: the server's row is on the device under its own id.
    const row = db.get<Record<string, unknown>>('SELECT * FROM invoice WHERE id = ?', [local.id])
    const copy: Record<string, unknown> = { ...row, id: SERVER_ID, invoice_number: OFFICIAL }
    const columns = Object.keys(copy)
    db.run(
      `INSERT INTO invoice (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      columns.map((column) => copy[column]),
    )

    const res = await confirm(local.id, { serverId: SERVER_ID, invoiceNumber: OFFICIAL })

    // An answer, not an error: the caller deletes the projection instead.
    expect(res.status).toBe(201)
    expect(res.data).toEqual({ confirmed: false, reason: 'ALREADY_PULLED' })
    // Nothing was moved onto the pulled row.
    expect(count('SELECT COUNT(*) AS n FROM invoice_item WHERE invoice_id = ?', [local.id])).toBe(1)
  })

  it('answers «not on this device» for an id it never recorded', async () => {
    const res = await confirm('never-recorded', { serverId: SERVER_ID, invoiceNumber: OFFICIAL })

    expect(res.status).toBe(201)
    expect(res.data).toEqual({ confirmed: false, reason: 'NOT_ON_DEVICE' })
  })

  it('refuses a confirmation without the number', async () => {
    const local = await recordOnDevice()

    const res = await confirm(local.id, { serverId: SERVER_ID })

    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
    // Untouched.
    expect(
      db.all<{ invoice_number: string }>('SELECT invoice_number FROM invoice WHERE id = ?', [
        local.id,
      ]),
    ).toEqual([{ invoice_number: local.invoiceNumber }])
  })
})
