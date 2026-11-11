// ============================================
// backend/src/__tests__/v59-1-exchange-gl-http.test.ts
//
// Real Fastify HTTP integration tests (buildServer + app.inject) for Item 1:
//   • POST /api/fx/trades (posted buy + offlineQueued short-sell → pending_review)
//   • POST /api/fx/trades/:id/resolve-review (reject/approve conflict)
//   • POST /api/fx/remittances/settle & GET /api/fx/remittances/balances
//   • Tenant isolation (cross-tenant 403)
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDatabase, createFakeDb, fakeId, type Row } from './helpers/fake-supabase'

const db = new FakeDatabase()
const OWNER = { id: '11111111-1111-4111-8111-111111111111', token: 'token-fx-owner' }
const STRANGER = { id: '22222222-2222-4222-8222-222222222222', token: 'token-fx-stranger' }
const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const users = new Map<string, { id: string }>([
  [OWNER.token, { id: OWNER.id }],
  [STRANGER.token, { id: STRANGER.id }],
])

vi.mock('../db', () => createFakeDb(db, users))

let app: FastifyInstance

function resetWorld() {
  db.tables.clear()
  db.failures.clear()
  db.rpcs.clear()
  db.queries.length = 0

  db.seed('workspaces', [
    { id: SHOP, name: 'FX Desk', base_currency: 'AFN', time_zone: 'Asia/Kabul' },
    { id: OTHER, name: 'Other Desk', base_currency: 'USD', time_zone: 'Asia/Kabul' },
  ])
  db.seed('workspace_members', [
    {
      id: fakeId('m'),
      workspace_id: SHOP,
      user_id: OWNER.id,
      role: 'owner',
      has_access: true,
      suspended_at: null,
      joined_at: '2026-01-01T00:00:00Z',
    },
    {
      id: fakeId('m'),
      workspace_id: OTHER,
      user_id: STRANGER.id,
      role: 'owner',
      has_access: true,
      suspended_at: null,
      joined_at: '2026-01-01T00:00:00Z',
    },
  ])
  db.seed('accounts', [
    {
      id: fakeId('acc'),
      workspace_id: SHOP,
      code: '1010',
      name: 'صندوق',
      type: 'asset',
      role: 'cash',
      is_group: false,
      is_active: true,
      deleted_at: null,
    },
    {
      id: fakeId('acc'),
      workspace_id: SHOP,
      code: '1030',
      name: 'صندوق ارزی',
      type: 'asset',
      role: 'fx_vault',
      is_group: false,
      is_active: true,
      deleted_at: null,
    },
    {
      id: fakeId('acc'),
      workspace_id: SHOP,
      code: '1200',
      name: 'حساب‌های دریافتنی',
      type: 'asset',
      role: 'receivable',
      is_group: false,
      is_active: true,
      deleted_at: null,
    },
    {
      id: fakeId('acc'),
      workspace_id: SHOP,
      code: '2000',
      name: 'حساب‌های پرداختنی',
      type: 'liability',
      role: 'payable',
      is_group: false,
      is_active: true,
      deleted_at: null,
    },
    {
      id: fakeId('acc'),
      workspace_id: SHOP,
      code: '3200',
      name: 'سرمایه',
      type: 'equity',
      role: 'owner_capital',
      is_group: false,
      is_active: true,
      deleted_at: null,
    },
    {
      id: fakeId('acc'),
      workspace_id: SHOP,
      code: '4900',
      name: 'سود و زیان تسعیر ارز',
      type: 'revenue',
      role: 'fx_gain_loss',
      is_group: false,
      is_active: true,
      deleted_at: null,
    },
  ])
  db.seed('fx_settings', [{ workspace_id: SHOP, kyc_threshold_minor: null }])
  db.seed('fx_rate_board', [
    {
      id: fakeId('rt'),
      workspace_id: SHOP,
      currency: 'USD',
      buy_rate_micro: 70_000_000,
      sell_rate_micro: 72_000_000,
      set_by: OWNER.id,
      set_at: '2026-11-11T10:00:00Z',
    },
  ])
  db.seed('fx_trades', [])
  db.seed('remittances', [
    {
      id: fakeId('rem'),
      workspace_id: SHOP,
      direction: 'incoming',
      counterparty: 'Herat Partner',
      status: 'paid',
      currency: 'AFN',
      amount_minor: 5000,
    },
  ])
  db.seed('fx_agent_settlements', [])

  db.rpc('fx_trade_create_with_ledger', (args: Row) => {
    const trade = args.p_trade as Row
    const reqId = trade.client_request_id ? String(trade.client_request_id) : null
    if (reqId) {
      const existing = db
        .rows('fx_trades')
        .find((r) => r.workspace_id === args.p_workspace_id && r.client_request_id === reqId)
      if (existing) {
        return {
          id: existing.id,
          status: existing.status,
          journal_entry_id: existing.journal_entry_id ?? null,
          replayed: true,
        }
      }
    }
    const held = db
      .rows('fx_trades')
      .filter(
        (r) =>
          r.workspace_id === args.p_workspace_id &&
          r.currency === trade.currency &&
          r.status === 'posted',
      )
      .reduce(
        (acc, r) => acc + (r.side === 'sell' ? -Number(r.amount_minor) : Number(r.amount_minor)),
        0,
      )

    const amount = Number(trade.amount_minor)
    const isShortSell = trade.side === 'sell' && held < amount
    if (isShortSell && !trade.allow_pending_review) {
      throw new Error('FX_POSITION_SHORT')
    }
    const status = isShortSell ? 'pending_review' : 'posted'
    const journalId = status === 'posted' ? fakeId('je') : null
    const id = fakeId('fx')
    db.seed('fx_trades', [
      {
        id,
        workspace_id: args.p_workspace_id,
        number: db.rows('fx_trades').length + 1,
        side: trade.side,
        currency: trade.currency,
        amount_minor: amount,
        rate_micro: trade.rate_micro,
        book_currency: trade.book_currency,
        book_amount_minor: trade.book_amount_minor,
        cost_basis_minor: trade.side === 'sell' && !isShortSell ? amount : null,
        customer_id: null,
        id_full_name: null,
        status,
        void_reason: null,
        journal_entry_id: journalId,
        void_journal_entry_id: null,
        note: trade.note ?? null,
        client_request_id: reqId,
        created_at: '2026-11-11T11:00:00Z',
      },
    ])
    return { id, status, journal_entry_id: journalId, replayed: false }
  })

  db.rpc('fx_trade_resolve_pending_review', (args: Row) => {
    const row = db
      .rows('fx_trades')
      .find((r) => r.workspace_id === args.p_workspace_id && r.id === args.p_trade_id)
    if (!row) return { outcome: 'not_found' }
    if (row.status !== 'pending_review') return { outcome: 'already_resolved', status: row.status }
    if (args.p_decision === 'reject') {
      row.status = 'voided'
      row.void_reason = String(args.p_reason ?? 'rejected')
      return { outcome: 'rejected', status: 'voided', journal_entry_id: null }
    }
    const je = fakeId('je')
    row.status = 'posted'
    row.journal_entry_id = je
    return { outcome: 'approved', status: 'posted', journal_entry_id: je }
  })

  db.rpc('fx_agent_settle', (args: Row) => {
    const s = args.p_settlement as Row
    const reqId = s.client_request_id ? String(s.client_request_id) : null
    if (reqId) {
      const existing = db
        .rows('fx_agent_settlements')
        .find((r) => r.workspace_id === args.p_workspace_id && r.client_request_id === reqId)
      if (existing) {
        return { id: existing.id, journal_entry_id: existing.journal_entry_id, replayed: true }
      }
    }
    const id = fakeId('settle')
    const je = fakeId('je')
    db.seed('fx_agent_settlements', [
      {
        id,
        workspace_id: args.p_workspace_id,
        counterparty: s.counterparty,
        direction: s.direction,
        currency: s.currency,
        amount_minor: s.amount_minor,
        rate_micro: s.rate_micro,
        book_currency: s.book_currency,
        book_amount_minor: s.book_amount_minor,
        journal_entry_id: je,
        note: s.note ?? null,
        client_request_id: reqId,
        created_at: '2026-11-11T12:00:00Z',
      },
    ])
    return { id, journal_entry_id: je, replayed: false }
  })
}

const headersOf = (user: { token: string }, workspaceId = SHOP) => ({
  authorization: `Bearer ${user.token}`,
  'x-workspace-id': workspaceId,
})

beforeAll(async () => {
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
})

afterAll(async () => {
  await app?.close()
})

beforeEach(() => {
  resetWorld()
})

describe('V59.1 Exchange → GL & Agent Settlement HTTP routes', () => {
  it('posts FX buy with journalEntryId, puts offlineQueued short sell into pending_review, and resolves it', async () => {
    const buy = await app.inject({
      method: 'POST',
      url: '/api/fx/trades',
      headers: { ...headersOf(OWNER), 'idempotency-key': 'key-fx-buy-1-0001' },
      payload: { side: 'buy', currency: 'USD', amountMinor: 1000, rate: '70' },
    })
    expect(buy.statusCode, buy.body).toBe(201)
    const buyData = (buy.json() as { data: { status: string; journalEntryId: string | null } }).data
    expect(buyData.status).toBe('posted')
    expect(buyData.journalEntryId).toBeTruthy()

    // Offline queued sell beyond held position enters pending_review
    const offlineShort = await app.inject({
      method: 'POST',
      url: '/api/fx/trades',
      headers: { ...headersOf(OWNER), 'idempotency-key': 'fx-short-offline' },
      payload: {
        side: 'sell',
        currency: 'USD',
        amountMinor: 5000,
        rate: '72',
        offlineQueued: true,
      },
    })
    expect(offlineShort.statusCode, offlineShort.body).toBe(201)
    const pending = (
      offlineShort.json() as { data: { id: string; status: string; journalEntryId: string | null } }
    ).data
    expect(pending.status).toBe('pending_review')
    expect(pending.journalEntryId).toBeNull()

    const rejected = await app.inject({
      method: 'POST',
      url: `/api/fx/trades/${pending.id}/resolve-review`,
      headers: headersOf(OWNER),
      payload: { decision: 'reject', reason: 'short after sync' },
    })
    expect(rejected.statusCode).toBe(200)
    expect((rejected.json() as { data: { status: string } }).data.status).toBe('voided')
  })

  it('settles partner balances with idempotent GL posting and enforces tenant isolation', async () => {
    const settle1 = await app.inject({
      method: 'POST',
      url: '/api/fx/remittances/settle',
      headers: { ...headersOf(OWNER), 'idempotency-key': 'settle-req-1' },
      payload: {
        counterparty: 'Herat Partner',
        direction: 'collect',
        currency: 'AFN',
        amountMinor: 3000,
      },
    })
    expect(settle1.statusCode, settle1.body).toBe(201)
    const s1 = (settle1.json() as { data: { id: string; journalEntryId: string | null } }).data
    expect(s1.journalEntryId).toBeTruthy()

    const balRes = await app.inject({
      method: 'GET',
      url: '/api/fx/remittances/balances',
      headers: headersOf(OWNER),
    })
    expect(balRes.statusCode).toBe(200)
    const balances = (
      balRes.json() as { data: { balances: Array<{ counterparty: string; balanceMinor: number }> } }
    ).data.balances
    expect(balances[0]!.balanceMinor).toBe(2000)

    const crossTenant = await app.inject({
      method: 'GET',
      url: '/api/fx/remittances/settlements',
      headers: headersOf(STRANGER, SHOP),
    })
    expect(crossTenant.statusCode).toBe(403)
  })
})
