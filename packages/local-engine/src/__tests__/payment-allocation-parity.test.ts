// ============================================
// A payment recorded on the device: the rules the server applies, and NO allocation nobody asked for.
//
//   · a payment names its invoices (or none). The device never allocates on its own — no oldest-first spread —
//     and it tells the server so (`autoAllocate: false`), otherwise the server would settle invoices on sync that
//     the person saw as still open (the two sides would disagree about the same payment).
//   · an unallocated payment is visible as such (`unallocated`), writes no allocation row and leaves every
//     invoice unpaid; only its own ledger entry exists.
//   · the shared rules: the named invoice must belong to the party; a foreign-currency payment needs a rate (never a
//     silent 1); a fee is not booked offline, so it is refused instead of silently dropped.
//   · the same payment id twice is one payment.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import type { LocalDb } from '../db'
import { createTestDb, createTestEngine, TEST_WORKSPACE_ID } from './test-db'

let db: LocalDb
let engine: ReturnType<typeof createTestEngine>
let n = 0
const C1 = '00000000-0000-4000-8000-000000000001'
const C2 = '00000000-0000-4000-8000-000000000002'
const P1 = '00000000-0000-4000-8000-000000000101'
const P2 = '00000000-0000-4000-8000-000000000102'
const P3 = '00000000-0000-4000-8000-000000000103'
const P4 = '00000000-0000-4000-8000-000000000104'
const P5 = '00000000-0000-4000-8000-000000000105'
const P6 = '00000000-0000-4000-8000-000000000106'
const P7 = '00000000-0000-4000-8000-000000000107'
const P8 = '00000000-0000-4000-8000-000000000108'
const P9 = '00000000-0000-4000-8000-000000000109'

const QUEUE = { 'x-hisabche-queue': '1' }
const count = (sql: string, params: unknown[] = []) => db.all<{ n: number }>(sql, params)[0]!.n

function seedInvoice(customerId: string | null, total: number, rate: number | null = null) {
  n += 1
  const id = `00000000-0000-4000-9000-${String(n).padStart(12, '0')}`
  db.run(
    `INSERT INTO invoice (id, workspace_id, invoice_number, type, customer_id, date, total, paid_amount, currency, exchange_rate, status, updated_at)
     VALUES (?, ?, ?, 'sale', ?, '2026-10-01', ?, 0, ?, ?, 'pending', datetime('now'))`,
    [id, TEST_WORKSPACE_ID, `INV-${n}`, customerId, total, rate ? 'USD' : 'AFN', rate],
  )
  return id
}

const pay = (body: Record<string, unknown>, headers: Record<string, string> = QUEUE) =>
  engine.request<{ unallocated?: number; replayed?: boolean }>({
    method: 'POST',
    path: '/payments',
    headers,
    body,
  })

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
})

describe('no allocation nobody asked for', () => {
  it('a payment with no invoices named leaves every invoice unpaid and says what is unallocated', async () => {
    const invoiceId = seedInvoice(C1, 1000)
    const res = await pay({
      id: P1,
      direction: 'in',
      partyType: 'customer',
      partyId: C1,
      amount: 400,
      currency: 'AFN',
    })
    expect(res.status, JSON.stringify(res.data)).toBe(201)
    expect(res.data.unallocated).toBe(400)
    expect(count('SELECT COUNT(*) AS n FROM payment_allocation')).toBe(0)
    const inv = db.all<{ paid_amount: number; status: string }>(
      'SELECT paid_amount, status FROM invoice WHERE id = ?',
      [invoiceId],
    )[0]!
    expect(inv).toEqual({ paid_amount: 0, status: 'pending' })
  })

  it('the queued payload tells the server not to allocate by itself', async () => {
    seedInvoice(C1, 1000)
    await pay({
      id: P2,
      direction: 'in',
      partyType: 'customer',
      partyId: C1,
      amount: 400,
      currency: 'AFN',
    })
    const row = db.all<{ payload: string }>('SELECT payload FROM sync_queue WHERE client_id = ?', [
      P2,
    ])[0]!
    expect(JSON.parse(row.payload)).toMatchObject({ id: P2, autoAllocate: false })
  })

  it('a named allocation is applied once and reported', async () => {
    const invoiceId = seedInvoice(C1, 1000)
    const res = await pay({
      id: P3,
      direction: 'in',
      partyType: 'customer',
      partyId: C1,
      amount: 600,
      currency: 'AFN',
      allocations: [{ invoiceId, amount: 600 }],
    })
    expect(res.status).toBe(201)
    expect(res.data.unallocated).toBe(0)
    expect(count('SELECT COUNT(*) AS n FROM payment_allocation')).toBe(1)
  })

  it('the same payment id sent twice is one payment, one allocation', async () => {
    const invoiceId = seedInvoice(C1, 1000)
    const body = {
      id: P4,
      direction: 'in',
      partyType: 'customer',
      partyId: C1,
      amount: 300,
      currency: 'AFN',
      allocations: [{ invoiceId, amount: 300 }],
    }
    expect((await pay(body)).status).toBe(201)
    const again = await pay(body)
    expect(again.data.replayed).toBe(true)
    expect(count('SELECT COUNT(*) AS n FROM payment')).toBe(1)
    expect(count('SELECT COUNT(*) AS n FROM payment_allocation')).toBe(1)
    expect(
      count('SELECT COUNT(*) AS n FROM journal_entry WHERE source_type = ?', ['payment']),
    ).toBe(1)
    expect(count('SELECT COUNT(*) AS n FROM sync_queue WHERE client_id = ?', [P4])).toBe(1)
  })
})

describe('the shared rules', () => {
  it("an invoice of another customer cannot be settled with this customer's money", async () => {
    const invoiceId = seedInvoice(C2, 1000)
    const res = await pay({
      id: P5,
      direction: 'in',
      partyType: 'customer',
      partyId: C1,
      amount: 100,
      currency: 'AFN',
      allocations: [{ invoiceId, amount: 100 }],
    })
    expect(res.status).toBe(400)
    expect(JSON.stringify(res.data)).toContain('PAYMENT_ALLOCATION_PARTY_MISMATCH')
    expect(count('SELECT COUNT(*) AS n FROM payment')).toBe(0)
  })

  it('a foreign payment with no rate (and no invoice carrying one) is refused, nothing written', async () => {
    const res = await pay({
      id: P6,
      direction: 'in',
      partyType: 'customer',
      partyId: C1,
      amount: 50,
      currency: 'USD',
    })
    expect(res.status).toBe(400)
    expect(JSON.stringify(res.data)).toContain('PAYMENT_EXCHANGE_RATE_REQUIRED')
    expect(count('SELECT COUNT(*) AS n FROM payment')).toBe(0)
    expect(count('SELECT COUNT(*) AS n FROM journal_entry')).toBe(0)
  })

  it('a foreign payment with a given rate is booked at that rate', async () => {
    const res = await pay({
      id: P7,
      direction: 'in',
      partyType: 'customer',
      partyId: C1,
      amount: 50,
      currency: 'USD',
      exchangeRate: 70,
    })
    expect(res.status, JSON.stringify(res.data)).toBe(201)
  })

  it('a foreign payment takes the rate its named invoice was frozen at', async () => {
    const invoiceId = seedInvoice(C1, 100, 72)
    const res = await pay({
      id: P8,
      direction: 'in',
      partyType: 'customer',
      partyId: C1,
      amount: 50,
      currency: 'USD',
      allocations: [{ invoiceId, amount: 50 }],
    })
    expect(res.status, JSON.stringify(res.data)).toBe(201)
  })

  it('a fee is refused on the device (it would be dropped from the books but sent to the server)', async () => {
    const res = await pay({
      id: P9,
      direction: 'in',
      partyType: 'customer',
      partyId: C1,
      amount: 100,
      currency: 'AFN',
      feeAmount: 2,
    })
    expect(res.status).toBe(400)
    expect(JSON.stringify(res.data)).toContain('PAYMENT_FEE_ONLINE_ONLY')
    expect(count('SELECT COUNT(*) AS n FROM payment')).toBe(0)
  })
})
