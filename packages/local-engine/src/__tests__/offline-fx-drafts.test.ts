// WP-07, OFFLINE: an exchange agent writes a currency trade with a locked rate
// while there is no signal. The draft moves NO money and creates NO journal;
// submitting only marks it pending. A repeated key cannot create a second draft.

import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, createTestEngine, type ClosableLocalDb } from './test-db'

let db: ClosableLocalDb
let engine: ReturnType<typeof createTestEngine>

async function draft(overrides: Record<string, unknown> = {}, key?: string) {
  return engine.request<{ id: string; book_amount_minor: number }>({
    method: 'POST',
    path: '/local-fx/trade-drafts',
    headers: key ? { 'idempotency-key': key } : undefined,
    body: {
      side: 'buy',
      currency: 'USD',
      amountMinor: 10_000,
      rate: '70.25',
      bookCurrency: 'AFN',
      ...overrides,
    },
  })
}

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
})

describe('offline FX trade drafts (WP-07)', () => {
  it('creates a draft with a locked book amount but no journal entry', async () => {
    const res = await draft()
    expect(res.status, JSON.stringify(res.data)).toBe(201)
    expect(res.data.book_amount_minor).toBe(7_025)
    const posted = db.get<{ count: number }>('SELECT COUNT(*) as count FROM journal_entry')
    expect(posted?.count ?? 0).toBe(0)
  })

  it('the same Idempotency-Key returns ONE draft', async () => {
    const a = await draft({}, 'fx-key-1')
    const b = await draft({}, 'fx-key-1')
    expect(a.status).toBe(201)
    expect(b.status).toBe(200)
    expect(b.data.id).toBe(a.data.id)
    const rows = db.get<{ count: number }>('SELECT COUNT(*) as count FROM fx_trade_drafts')
    expect(rows?.count).toBe(1)
  })

  it('a bad rate is refused, never priced as zero', async () => {
    const res = await draft({ rate: 'oops' })
    expect(res.status).toBe(400)
  })

  it('submit marks pending without moving money; a queued sell is flagged for review', async () => {
    const created = await draft({ side: 'sell' })
    const submitted = await engine.request<{ status: string; needs_review: number }>({
      method: 'POST',
      path: `/local-fx/trade-drafts/${created.data.id}/submit`,
      body: {},
    })
    expect(submitted.data.status).toBe('pending')
    expect(submitted.data.needs_review).toBe(1)
    const posted = db.get<{ count: number }>('SELECT COUNT(*) as count FROM journal_entry')
    expect(posted?.count ?? 0).toBe(0)
  })

  it('a cancelled draft cannot be submitted', async () => {
    const created = await draft()
    await engine.request({
      method: 'POST',
      path: `/local-fx/trade-drafts/${created.data.id}/cancel`,
      body: {},
    })
    const res = await engine.request({
      method: 'POST',
      path: `/local-fx/trade-drafts/${created.data.id}/submit`,
      body: {},
    })
    expect(res.status).toBe(409)
  })

  it('a viewer cannot create a draft', async () => {
    db.run(`UPDATE local_user SET role = 'viewer'`)
    const res = await draft()
    expect(res.status).toBe(403)
  })
})
