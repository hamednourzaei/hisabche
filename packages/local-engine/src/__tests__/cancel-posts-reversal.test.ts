// ============================================
// Cancelling a document on the device POSTS A REVERSAL; it never edits the original entry in place.
//
// Before: cancelling an invoice or a payment flipped the original journal entry to «reversed» and nothing else —
// no reversal entry, so a period report that skipped «reversed» rows lost the entry for the WHOLE period (not only
// from the cancel date on), and an entry in a closed period was changed after the books were closed. The server posts
// a dated reversal entry (`reverseDocument`) and the device now does the same, through ONE function.
//
//   · the reversal is a new entry: `reversal_of` = the original, the lines inverted, dated today
//   · the original is marked reversed and is otherwise untouched (date, lines)
//   · the books net to zero for the document
//   · the reversal's date is checked against the period lock: a closed day refuses the cancel and NOTHING changes
//   · a cancel never leaves an entry half done (one transaction)
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import type { LocalDb } from '../db'
import { createTestDb, createTestEngine, TEST_WAREHOUSE_ID } from './test-db'

let db: LocalDb
let engine: ReturnType<typeof createTestEngine>

const today = () => new Date().toISOString().slice(0, 10)

interface Entry {
  id: string
  date: string
  status: string
  reversal_of: string | null
  source_type: string
}

const entriesOf = (sourceType: string, sourceId: string) =>
  db.all<Entry>(
    `SELECT id, date, status, reversal_of, source_type FROM journal_entry
      WHERE source_id = ? AND source_type IN (?, 'reversal') ORDER BY created_at, rowid`,
    [sourceId, sourceType],
  )

const netByAccount = (ids: string[]) =>
  db.all<{ account_id: string; net: number }>(
    `SELECT account_id, ROUND(SUM(debit) - SUM(credit), 2) AS net FROM journal_line
      WHERE journal_id IN (${ids.map(() => '?').join(',')}) GROUP BY account_id`,
    ids,
  )

async function makeInvoice() {
  const product = (
    await engine.request<{ id: string }>({
      method: 'POST',
      path: '/products',
      body: {
        name: 'چای',
        buyPrice: 100,
        sellPrice: 150,
        quantity: 10,
        warehouseId: TEST_WAREHOUSE_ID,
      },
    })
  ).data
  const res = await engine.request<{ id: string }>({
    method: 'POST',
    path: '/invoices',
    body: {
      type: 'sale',
      currency: 'AFN',
      warehouseId: TEST_WAREHOUSE_ID,
      items: [{ productId: product.id, productName: 'چای', quantity: 2, unitPrice: 150 }],
    },
  })
  expect(res.status, JSON.stringify(res.data)).toBe(201)
  return res.data.id
}

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
})

describe('cancelling an invoice', () => {
  it('posts a dated reversal entry and leaves the original as it was', async () => {
    const id = await makeInvoice()
    const [original] = entriesOf('invoice', id)
    expect(original?.status).toBe('posted')

    const res = await engine.request({
      method: 'POST',
      path: `/invoices/${id}/cancel`,
      body: { reason: 'اشتباه' },
    })
    expect(res.status, JSON.stringify(res.data)).toBe(200)

    const entries = entriesOf('invoice', id)
    expect(entries).toHaveLength(2)
    const [first, reversal] = entries
    expect(first).toMatchObject({ id: original!.id, status: 'reversed', date: original!.date })
    expect(reversal).toMatchObject({
      source_type: 'reversal',
      reversal_of: original!.id,
      date: today(),
    })
    // the books net to zero for this document
    for (const row of netByAccount([first!.id, reversal!.id])) expect(row.net).toBe(0)
  })

  it('a closed day refuses the cancel, and nothing about the invoice changes', async () => {
    const id = await makeInvoice()
    await engine.request({
      method: 'PUT',
      path: '/accounting/period-lock',
      body: { lockedUntil: `${today()}` },
    })

    const res = await engine.request<{ code: string }>({
      method: 'POST',
      path: `/invoices/${id}/cancel`,
      body: { reason: 'اشتباه' },
    })
    expect(res.status).toBe(409)
    expect(res.data.code).toBe('ACCOUNTING_PERIOD_LOCKED')

    expect(entriesOf('invoice', id)).toHaveLength(1)
    expect(entriesOf('invoice', id)[0]!.status).toBe('posted')
    const invoice = db.all<{ status: string }>('SELECT status FROM invoice WHERE id = ?', [id])[0]!
    expect(invoice.status).not.toBe('cancelled')
  })
})

describe('cancelling a payment', () => {
  it('posts a reversal entry and the books net to zero', async () => {
    const invoiceId = await makeInvoice()
    const paid = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/payments',
      body: {
        id: '00000000-0000-4000-8000-0000000000aa',
        direction: 'in',
        partyType: 'customer',
        partyId: null,
        amount: 100,
        currency: 'AFN',
        allocations: [{ invoiceId, amount: 100 }],
      },
    })
    expect(paid.status, JSON.stringify(paid.data)).toBe(201)

    const res = await engine.request({
      method: 'POST',
      path: `/payments/${paid.data.id}/cancel`,
      body: { reason: 'اشتباه' },
    })
    expect(res.status, JSON.stringify(res.data)).toBe(200)

    const entries = entriesOf('payment', paid.data.id)
    expect(entries).toHaveLength(2)
    expect(entries[0]!.status).toBe('reversed')
    expect(entries[1]).toMatchObject({ source_type: 'reversal', reversal_of: entries[0]!.id })
    for (const row of netByAccount(entries.map((entry) => entry.id))) expect(row.net).toBe(0)
  })

  it('a closed day refuses the cancel and the allocation stays', async () => {
    const invoiceId = await makeInvoice()
    const paid = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/payments',
      body: {
        id: '00000000-0000-4000-8000-0000000000bb',
        direction: 'in',
        partyType: 'customer',
        partyId: null,
        amount: 100,
        currency: 'AFN',
        allocations: [{ invoiceId, amount: 100 }],
      },
    })
    await engine.request({
      method: 'PUT',
      path: '/accounting/period-lock',
      body: { lockedUntil: today() },
    })
    const res = await engine.request<{ code: string }>({
      method: 'POST',
      path: `/payments/${paid.data.id}/cancel`,
      body: { reason: 'اشتباه' },
    })
    expect(res.status).toBe(409)
    expect(res.data.code).toBe('ACCOUNTING_PERIOD_LOCKED')
    expect(
      db.all<{ n: number }>(
        'SELECT COUNT(*) AS n FROM payment_allocation WHERE deleted_at IS NULL',
      )[0]!.n,
    ).toBe(1)
    expect(entriesOf('payment', paid.data.id)).toHaveLength(1)
  })
})

describe('a payment shared with another invoice (the server refuses: INVOICE_PAYMENT_SHARED)', () => {
  it('cancelling one of the two invoices is refused and changes nothing', async () => {
    const first = await makeInvoice()
    const second = await makeInvoice()
    const paid = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/payments',
      body: {
        id: '00000000-0000-4000-8000-0000000000cc',
        direction: 'in',
        partyType: 'customer',
        partyId: null,
        amount: 200,
        currency: 'AFN',
        allocations: [
          { invoiceId: first, amount: 120 },
          { invoiceId: second, amount: 80 },
        ],
      },
    })
    expect(paid.status, JSON.stringify(paid.data)).toBe(201)

    const res = await engine.request<{ code: string }>({
      method: 'POST',
      path: `/invoices/${first}/cancel`,
      body: { reason: 'اشتباه' },
    })
    expect(res.status).toBe(409)
    expect(res.data.code).toBe('INVOICE_PAYMENT_SHARED')

    // nothing moved: both allocations, the payment and every entry are as they were
    expect(
      db.all<{ n: number }>(
        'SELECT COUNT(*) AS n FROM payment_allocation WHERE deleted_at IS NULL',
      )[0]!.n,
    ).toBe(2)
    expect(
      db.all<{ status: string }>('SELECT status FROM payment WHERE id = ?', [paid.data.id])[0]!
        .status,
    ).not.toBe('cancelled')
    expect(entriesOf('invoice', first)).toHaveLength(1)
    expect(entriesOf('payment', paid.data.id)).toHaveLength(1)
    expect(
      db.all<{ status: string }>('SELECT status FROM invoice WHERE id = ?', [first])[0]!.status,
    ).not.toBe('cancelled')
  })
})
