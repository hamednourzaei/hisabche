// ============================================
// A payment recorded on the device books the SAME entry the server's
// `bookPayment` (backend/src/services/payments/payments.service.ts) books:
//
//   · a foreign payment settles each invoice at that invoice's frozen rate;
//     the gap between that and the day's rate goes to `fx_gain_loss`;
//   · the money side is cash for cash and the bank for any other method
//     (`moneyAccountRole`) — a transfer never moves the drawer.
//
// Until 16 Nov 2026 the device posted every allocation at the payment's own
// rate and always to cash, so these two cases booked differently on the two
// sides of the same payment.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import type { LocalDb } from '../db'
import { createTestDb, createTestEngine, TEST_WORKSPACE_ID } from './test-db'

let db: LocalDb
let engine: ReturnType<typeof createTestEngine>
const C1 = '00000000-0000-4000-8000-000000000001'
const INV = '00000000-0000-4000-9000-000000000001'

function seedUsdInvoice(total: number, rate: number) {
  db.run(
    `INSERT INTO invoice (id, workspace_id, invoice_number, type, customer_id, date, total, paid_amount, currency, exchange_rate, status, updated_at)
     VALUES (?, ?, 'INV-1', 'sale', ?, '2026-10-01', ?, 0, 'USD', ?, 'pending', datetime('now'))`,
    [INV, TEST_WORKSPACE_ID, C1, total, rate],
  )
}

function linesOf(paymentId: string) {
  return db.all<{ role: string; debit: number; credit: number }>(
    `SELECT a.role AS role, l.debit AS debit, l.credit AS credit
       FROM journal_entry e
       JOIN journal_line l ON l.journal_id = e.id
       JOIN account a ON a.id = l.account_id
      WHERE e.source_type = 'payment' AND e.source_id = ?
      ORDER BY a.role`,
    [paymentId],
  )
}

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
})

describe('device payment posting = server payment posting', () => {
  it('a dollar receipt at 72 against a dollar invoice frozen at 70 books the difference as a gain', async () => {
    seedUsdInvoice(100, 70)
    const id = '00000000-0000-4000-8000-000000000201'
    const res = await engine.request({
      method: 'POST',
      path: '/payments',
      body: {
        id,
        direction: 'in',
        partyType: 'customer',
        partyId: C1,
        amount: 100,
        currency: 'USD',
        exchangeRate: 72,
        method: 'cash',
        allocations: [{ invoiceId: INV, amount: 100 }],
      },
    })
    expect(res.status, JSON.stringify(res.data)).toBe(201)
    // cash 7200 in; the debt was 7000 at the invoice's rate; 200 is a gain.
    expect(linesOf(id)).toEqual([
      { role: 'cash', debit: 7200, credit: 0 },
      { role: 'fx_gain_loss', debit: 0, credit: 200 },
      { role: 'receivable', debit: 0, credit: 7000 },
    ])
  })

  it('a bank transfer debits the bank, not the drawer', async () => {
    const id = '00000000-0000-4000-8000-000000000202'
    const res = await engine.request({
      method: 'POST',
      path: '/payments',
      body: {
        id,
        direction: 'in',
        partyType: 'customer',
        partyId: C1,
        amount: 500,
        currency: 'AFN',
        method: 'bank',
      },
    })
    expect(res.status, JSON.stringify(res.data)).toBe(201)
    expect(linesOf(id)).toEqual([
      { role: 'bank', debit: 500, credit: 0 },
      { role: 'receivable', debit: 0, credit: 500 },
    ])
  })
})
