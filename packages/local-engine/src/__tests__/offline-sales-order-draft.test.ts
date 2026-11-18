// ============================================
// WP-13, OFFLINE: a rep writes a sales-order draft with no signal.
//
// A draft is NOT a sale: no stock and no money move on the device, and the
// server still confirms price and availability through the existing `/orders`
// flow. This suite proves the local row is a draft (not a posted invoice), that
// a retry is idempotent, and that a submitted draft cannot be edited behind the
// server's back.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, createTestEngine, type ClosableLocalDb } from './test-db'

let db: ClosableLocalDb
let engine: ReturnType<typeof createTestEngine>

const draftBody = {
  customerName: 'مشتری آفلاین',
  currency: 'AFN',
  lines: [
    { productName: 'مبل', quantity: 2, unitPriceMinor: 150_000 },
    { productName: 'میز', quantity: 1, unitPriceMinor: 75_000 },
  ],
}

async function create(input: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  const res = await engine.request<{ id: string; status: string; total_minor: number }>({
    method: 'POST',
    path: '/orders/drafts',
    headers,
    body: { ...draftBody, ...input },
  })
  return res
}

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
})

describe('offline sales-order drafts (WP-13)', () => {
  it('creates a QUOTED draft with a derived integer total, not a posted invoice', async () => {
    const draft = (await create()).data
    expect(draft.status).toBe('quoted')
    expect(draft.total_minor).toBe(375_000)
    const invoiceCount = db.get<{ n: number }>('SELECT COUNT(*) AS n FROM invoice')?.n
    expect(invoiceCount).toBe(0)
    const lineCount = db.get<{ n: number }>(
      'SELECT COUNT(*) AS n FROM sales_order_draft_items WHERE order_id = ?',
      [draft.id],
    )?.n
    expect(lineCount).toBe(2)
  })

  it('a repeat with the same idempotency key returns the first draft', async () => {
    const first = (await create({}, { 'idempotency-key': 'draft-key-1' })).data
    const again = (await create({}, { 'idempotency-key': 'draft-key-1' })).data
    expect(again.id).toBe(first.id)
    const count = db.get<{ n: number }>('SELECT COUNT(*) AS n FROM sales_order_drafts')?.n
    expect(count).toBe(1)
  })

  it('refuses a draft without a currency — the server currency is never assumed', async () => {
    const res = await engine.request({
      method: 'POST',
      path: '/orders/drafts',
      body: { ...draftBody, currency: '' },
    })
    expect(res.status).toBe(400)
  })

  it('submit marks it pending but still moves no money', async () => {
    const draft = (await create()).data
    const res = await engine.request<{ status: string; submitted_at: string }>({
      method: 'POST',
      path: `/orders/drafts/${draft.id}/submit`,
    })
    expect(res.status).toBe(200)
    expect(res.data.status).toBe('pending')
    expect(res.data.submitted_at).toBeTruthy()
    expect(db.get<{ n: number }>('SELECT COUNT(*) AS n FROM invoice')?.n).toBe(0)
  })

  it('cannot submit the same draft twice', async () => {
    const draft = (await create()).data
    await engine.request({ method: 'POST', path: `/orders/drafts/${draft.id}/submit` })
    const again = await engine.request({
      method: 'POST',
      path: `/orders/drafts/${draft.id}/submit`,
    })
    expect(again.status).toBe(409)
  })

  it('cannot edit a submitted draft behind the server', async () => {
    const draft = (await create()).data
    await engine.request({ method: 'POST', path: `/orders/drafts/${draft.id}/submit` })
    const edit = await engine.request({
      method: 'PATCH',
      path: `/orders/drafts/${draft.id}`,
      body: { notes: 'تغییر بعد از ارسال' },
    })
    expect(edit.status).toBe(409)
  })

  it('cancels a quoted draft and cannot cancel it twice', async () => {
    const draft = (await create()).data
    const cancel = await engine.request<{ status: string }>({
      method: 'POST',
      path: `/orders/drafts/${draft.id}/cancel`,
    })
    expect(cancel.data.status).toBe('cancelled')
    const again = await engine.request({
      method: 'POST',
      path: `/orders/drafts/${draft.id}/cancel`,
    })
    expect(again.status).toBe(409)
  })

  it('a viewer cannot create a draft', async () => {
    db.run(`UPDATE local_user SET role = 'viewer'`)
    const res = await engine.request({
      method: 'POST',
      path: '/orders/drafts',
      body: draftBody,
    })
    expect(res.status).toBe(403)
  })
})
