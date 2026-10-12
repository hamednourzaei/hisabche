// ============================================
// backend/src/__tests__/pos-till-currency-http.test.ts
//
// HTTP integration tests for multi-currency tills (pos_sessions).
// Exercised end-to-end: real HTTP (buildServer + app.inject) → routes → guards → service → ledger.
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { FakeDatabase, createFakeDb, fakeId, type Row } from './helpers/fake-supabase'

const db = new FakeDatabase()

const OWNER = { id: fakeId('owner'), token: 'till-cur-token-owner' }
const STRANGER = { id: fakeId('stranger'), token: 'till-cur-token-stranger' }
const SHOP = fakeId('shop')
const OTHER_SHOP = fakeId('shop')

const users = new Map<string, { id: string }>([
  [OWNER.token, { id: OWNER.id }],
  [STRANGER.token, { id: STRANGER.id }],
])

let missingColumnActive = false

const baseFrom = db.from.bind(db)
const interceptingFrom = (table: string) => {
  const builder = baseFrom(table)
  if (!missingColumnActive || table !== 'pos_sessions') return builder

  const originalSelect = builder.select.bind(builder)
  const originalInsert = builder.insert.bind(builder)

  builder.select = (columns = '*', options?: { count?: 'exact' | 'planned' | 'estimated' }) => {
    if (typeof columns === 'string' && columns.includes('currency')) {
      const errorResult = {
        data: null,
        error: { code: '42703', message: 'column currency does not exist' },
      }
      return {
        ...builder,
        eq: () => builder,
        order: () => builder,
        limit: () => builder,
        range: () => builder,
        single: () => Promise.resolve(errorResult),
        maybeSingle: () => Promise.resolve(errorResult),
        then: (
          onfulfilled?: ((value: unknown) => unknown) | null,
          onrejected?: ((reason: unknown) => unknown) | null,
        ) => Promise.resolve(errorResult).then(onfulfilled, onrejected),
      } as unknown as ReturnType<typeof originalSelect>
    }
    return originalSelect(columns, options)
  }

  builder.insert = (values: Row | Row[]) => {
    const list = Array.isArray(values) ? values : [values]
    return {
      ...builder,
      select: (columns = '*') => {
        if (
          (typeof columns === 'string' && columns.includes('currency')) ||
          list.some((v) => 'currency' in v)
        ) {
          const errorResult = {
            data: null,
            error: { code: '42703', message: 'column currency does not exist' },
          }
          return {
            single: () => Promise.resolve(errorResult),
            maybeSingle: () => Promise.resolve(errorResult),
            then: (
              onfulfilled?: ((value: unknown) => unknown) | null,
              onrejected?: ((reason: unknown) => unknown) | null,
            ) => Promise.resolve(errorResult).then(onfulfilled, onrejected),
          } as unknown as ReturnType<typeof originalInsert>
        }
        return originalInsert(values).select(columns)
      },
    } as unknown as ReturnType<typeof originalInsert>
  }

  return builder
}

const fakeDbModule = createFakeDb(db, users)
fakeDbModule.supabase.from = interceptingFrom as unknown as typeof fakeDbModule.supabase.from

vi.mock('../db', () => fakeDbModule)

let app: FastifyInstance

function member(workspaceId: string, userId: string) {
  return {
    id: fakeId('member'),
    workspace_id: workspaceId,
    user_id: userId,
    role: 'owner',
    has_access: true,
    suspended_at: null,
    joined_at: '2026-01-01T00:00:00Z',
  }
}

function resetWorld() {
  db.tables.clear()
  db.failures.clear()
  db.queries.length = 0
  missingColumnActive = false

  db.seed('workspaces', [
    { id: SHOP, name: 'Main Shop', base_currency: 'AFN' },
    { id: OTHER_SHOP, name: 'Other Shop', base_currency: 'USD' },
  ])

  db.seed('workspace_members', [member(SHOP, OWNER.id), member(OTHER_SHOP, STRANGER.id)])

  db.seed('accounts', [
    {
      id: fakeId('acc-cash'),
      workspace_id: SHOP,
      code: '1000',
      name: 'Cash',
      type: 'asset',
      role: 'cash',
      is_active: true,
      is_group: false,
    },
    {
      id: fakeId('acc-sales'),
      workspace_id: SHOP,
      code: '4000',
      name: 'Sales Revenue',
      type: 'revenue',
      role: 'sales',
      is_active: true,
      is_group: false,
    },
  ])

  db.seed('pos_sessions', [])
  db.seed('pos_cash_movements', [])
  db.seed('pos_orders', [])
  db.seed('pos_order_payments', [])
  db.seed('payments', [])
  db.seed('journal_entries', [])
  db.seed('journal_lines', [])
  db.seed('accounting_period_locks', [])

  db.rpc('accounting_post_journal_entry', (args: any) => {
    const entryId = fakeId('journal')
    db.seed('journal_entries', [
      {
        id: entryId,
        workspace_id: args.p_workspace_id,
        created_by: args.p_user_id,
        ...args.p_entry,
        created_at: new Date().toISOString(),
      },
    ])
    if (Array.isArray(args.p_lines)) {
      db.seed(
        'journal_lines',
        args.p_lines.map((l: any) => ({
          id: fakeId('line'),
          workspace_id: args.p_workspace_id,
          journal_entry_id: entryId,
          ...l,
        })),
      )
    }
    return entryId
  })
}

const as = (user: { token: string }, shop = SHOP) => ({
  authorization: `Bearer ${user.token}`,
  'x-workspace-id': shop,
})

beforeAll(async () => {
  resetWorld()
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
}, 60_000)

afterAll(async () => {
  await app?.close()
})

beforeEach(() => {
  resetWorld()
})

describe('multi-currency tills over HTTP', () => {
  // Test 1: Open till with name and USD in AFN workspace -> 201 with both; open with no currency -> books currency.
  it('opens till with label and currency, and defaults omitted currency to workspace books currency', async () => {
    const usdRes = await app.inject({
      method: 'POST',
      url: '/api/pos/sessions',
      headers: as(OWNER),
      payload: {
        openingFloatMinor: 5_000,
        label: 'ﺻﻨﺪﻭﻕ ﺩﻻﺭ',
        currency: 'USD',
      },
    })

    expect(usdRes.statusCode).toBe(201)
    const usdSession = usdRes.json()
    expect(usdSession.label).toBe('ﺻﻨﺪﻭﻕ ﺩﻻﺭ')
    expect(usdSession.currency).toBe('USD')
    expect(usdSession.openingFloatMinor).toBe(5_000)

    const defaultRes = await app.inject({
      method: 'POST',
      url: '/api/pos/sessions',
      headers: as(OWNER),
      payload: {
        openingFloatMinor: 10_000,
      },
    })

    expect(defaultRes.statusCode).toBe(201)
    const defaultSession = defaultRes.json()
    expect(defaultSession.currency).toBe('AFN')
    expect(defaultSession.openingFloatMinor).toBe(10_000)
  })

  // ⚠️ From one to two. «The caller's open till» was read with maybeSingle();
  // the second open till turned that into an error and the page into a 500.
  it('with an AFN and a USD till open, /sessions/current answers the books till — and each by currency', async () => {
    const open = async (payload: Record<string, unknown>) =>
      (
        await app.inject({
          method: 'POST',
          url: '/api/pos/sessions',
          headers: as(OWNER),
          payload,
        })
      ).json() as { id: string; currency: string }
    const usd = await open({ openingFloatMinor: 700, currency: 'USD' })
    const afn = await open({ openingFloatMinor: 300 })

    // The books-currency till stores no currency of its own, like every till
    // opened before the migration.
    const stored = db.rows('pos_sessions')
    expect(stored.find((row) => row.id === afn.id)?.currency ?? null).toBeNull()
    expect(stored.find((row) => row.id === usd.id)?.currency).toBe('USD')

    const current = async (query = '') => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/pos/sessions/current${query}`,
        headers: as(OWNER),
      })
      expect(res.statusCode).toBe(200)
      return res.json().session as {
        id: string
        currency: string
        openingFloatMinor: number
      } | null
    }
    expect((await current())?.id).toBe(afn.id)
    expect((await current('?currency=USD'))?.id).toBe(usd.id)
    expect((await current('?currency=USD'))?.openingFloatMinor).toBe(700)
    expect((await current('?currency=AFN'))?.id).toBe(afn.id)
    expect(await current('?currency=EUR')).toBeNull()
  })

  // Test 2: Two tills (AFN and USD) with cash_in -> running balances independent; no sum across currencies.
  it('maintains independent ledgers for AFN and USD tills without cross-currency sums', async () => {
    const afnOpen = await app.inject({
      method: 'POST',
      url: '/api/pos/sessions',
      headers: as(OWNER),
      payload: { openingFloatMinor: 10_000, currency: 'AFN' },
    })
    const afnId = afnOpen.json().id

    const usdOpen = await app.inject({
      method: 'POST',
      url: '/api/pos/sessions',
      headers: as(OWNER),
      payload: { openingFloatMinor: 1_000, currency: 'USD' },
    })
    const usdId = usdOpen.json().id

    // Cash in to AFN till
    const afnIn = await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${afnId}/cash`,
      headers: as(OWNER),
      payload: { kind: 'cash_in', amountMinor: 2_500, reason: 'افزایش پول خرد افغانی' },
    })
    expect(afnIn.statusCode).toBe(201)

    // Cash in to USD till
    const usdIn = await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${usdId}/cash`,
      headers: as(OWNER),
      payload: { kind: 'cash_in', amountMinor: 200, reason: 'Deposit USD notes' },
    })
    expect(usdIn.statusCode).toBe(201)

    // Verify AFN ledger
    const afnLedgerRes = await app.inject({
      method: 'GET',
      url: `/api/pos/sessions/${afnId}/ledger`,
      headers: as(OWNER),
    })
    expect(afnLedgerRes.statusCode).toBe(200)
    const afnLedger = afnLedgerRes.json()
    expect(afnLedger.entries).toHaveLength(2)
    expect(afnLedger.expectedCashMinor).toBe(12_500)
    expect(afnLedger.entries[1].balanceMinor).toBe(12_500)

    // Verify USD ledger
    const usdLedgerRes = await app.inject({
      method: 'GET',
      url: `/api/pos/sessions/${usdId}/ledger`,
      headers: as(OWNER),
    })
    expect(usdLedgerRes.statusCode).toBe(200)
    const usdLedger = usdLedgerRes.json()
    expect(usdLedger.entries).toHaveLength(2)
    expect(usdLedger.expectedCashMinor).toBe(1_200)
    expect(usdLedger.entries[1].balanceMinor).toBe(1_200)
  })

  // Test 3: POS_CURRENCY_MISMATCH for movement/order with mismatched currency -> 400/409, nothing written.
  it('refuses movement and order with mismatched currency with POS_CURRENCY_MISMATCH', async () => {
    const usdOpen = await app.inject({
      method: 'POST',
      url: '/api/pos/sessions',
      headers: as(OWNER),
      payload: { openingFloatMinor: 1_000, currency: 'USD' },
    })
    const usdId = usdOpen.json().id

    // Movement with EUR against USD till
    const moveRes = await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${usdId}/cash`,
      headers: as(OWNER),
      payload: { kind: 'cash_in', amountMinor: 100, reason: 'Wrong currency', currency: 'EUR' },
    })
    expect(moveRes.statusCode).toBe(400)
    expect(moveRes.body).toContain('POS_CURRENCY_MISMATCH')
    expect(db.rows('pos_cash_movements')).toHaveLength(0)

    // Order with EUR against USD till
    const orderRes = await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${usdId}/orders`,
      headers: as(OWNER),
      payload: {
        orderRef: 'ORD-MISMATCH-001',
        totalMinor: 500,
        currency: 'EUR',
        payments: [{ method: 'cash', amountMinor: 500 }],
      },
    })
    expect(orderRes.statusCode).toBe(400)
    expect(orderRes.body).toContain('POS_CURRENCY_MISMATCH')
    expect(db.rows('pos_orders')).toHaveLength(0)
  })

  // Test 4: Close USD till -> count stored, no ledger entry (POS_FOREIGN_CURRENCY_NOT_IN_LEDGER); close AFN till -> posts journal entry.
  it('skips ledger posting for foreign currency till and posts journal entry for base currency till', async () => {
    const usdOpen = await app.inject({
      method: 'POST',
      url: '/api/pos/sessions',
      headers: as(OWNER),
      payload: { openingFloatMinor: 1_000, currency: 'USD' },
    })
    const usdId = usdOpen.json().id

    const afnOpen = await app.inject({
      method: 'POST',
      url: '/api/pos/sessions',
      headers: as(OWNER),
      payload: { openingFloatMinor: 10_000, currency: 'AFN' },
    })
    const afnId = afnOpen.json().id

    // Seed a cash sale order on AFN till so the close posting has revenue to record
    const orderId = fakeId('order')
    db.seed('pos_orders', [
      {
        id: orderId,
        workspace_id: SHOP,
        session_id: afnId,
        order_ref: 'ORD-AFN-01',
        total_minor: 5_000,
        change_minor: 0,
        status: 'completed',
        currency: 'AFN',
        created_at: new Date().toISOString(),
        payments: [{ method: 'cash', amount_minor: 5_000 }],
      },
    ])
    db.seed('pos_order_payments', [
      {
        id: fakeId('pay'),
        order_id: orderId,
        method: 'cash',
        amount_minor: 5_000,
      },
    ])

    // Close USD till
    const closeUsdRes = await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${usdId}/close`,
      headers: as(OWNER),
      payload: { countedCashMinor: 1_000 },
    })
    expect(closeUsdRes.statusCode).toBe(200)
    const usdCloseBody = closeUsdRes.json()
    expect(usdCloseBody.posted).toBe(false)
    expect(usdCloseBody.ledger?.status).toBe('not_posted')
    expect(usdCloseBody.ledger?.reason).toBe('POS_FOREIGN_CURRENCY_NOT_IN_LEDGER')
    expect(usdCloseBody.session.status).toBe('closed')
    expect(db.rows('journal_entries')).toHaveLength(0)

    // Close AFN till (expected 10_000 float + 5_000 sales = 15_000)
    const closeAfnRes = await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${afnId}/close`,
      headers: as(OWNER),
      payload: { countedCashMinor: 15_000 },
    })
    expect(closeAfnRes.statusCode, closeAfnRes.body).toBe(200)
    const afnCloseBody = closeAfnRes.json()
    expect(afnCloseBody.posted).toBe(true)
    expect(afnCloseBody.session.status).toBe('closed')
    expect(db.rows('journal_entries')).toHaveLength(1)
  })

  // Test 5: Missing currency column -> till list 200, books currency opens 201, foreign currency fails with 400 POS_CURRENCY_SCHEMA_REQUIRED.
  it('handles missing currency column gracefully for base currency and rejects foreign currency with POS_CURRENCY_SCHEMA_REQUIRED', async () => {
    missingColumnActive = true

    // Open list returns 200
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/pos/sessions/open',
      headers: as(OWNER),
    })
    expect(listRes.statusCode).toBe(200)

    // Foreign currency fails
    const foreignRes = await app.inject({
      method: 'POST',
      url: '/api/pos/sessions',
      headers: as(OWNER),
      payload: { openingFloatMinor: 1_000, currency: 'USD' },
    })
    expect(foreignRes.statusCode).toBe(400)
    expect(foreignRes.body).toContain('POS_CURRENCY_SCHEMA_REQUIRED')

    // Base currency succeeds
    const baseRes = await app.inject({
      method: 'POST',
      url: '/api/pos/sessions',
      headers: as(OWNER),
      payload: { openingFloatMinor: 5_000, currency: 'AFN' },
    })
    expect(baseRes.statusCode).toBe(201)
  })

  // Test 6: cash_out with blank reason refused (400); valid reason records and balance drops.
  it('refuses cash_out with blank reason and records valid reason dropping balance', async () => {
    const openRes = await app.inject({
      method: 'POST',
      url: '/api/pos/sessions',
      headers: as(OWNER),
      payload: { openingFloatMinor: 5_000, currency: 'AFN' },
    })
    const id = openRes.json().id

    // Blank reason rejected
    const blankRes = await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${id}/cash`,
      headers: as(OWNER),
      payload: { kind: 'cash_out', amountMinor: 1_000, reason: '' },
    })
    expect(blankRes.statusCode).toBe(400)

    // Valid reason accepted
    const validRes = await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${id}/cash`,
      headers: as(OWNER),
      payload: { kind: 'cash_out', amountMinor: 1_000, reason: 'Office supplies' },
    })
    expect(validRes.statusCode).toBe(201)

    // Verify balance dropped
    const ledgerRes = await app.inject({
      method: 'GET',
      url: `/api/pos/sessions/${id}/ledger`,
      headers: as(OWNER),
    })
    expect(ledgerRes.statusCode).toBe(200)
    expect(ledgerRes.json().expectedCashMinor).toBe(4_000)
  })

  // Test 7: Till ID of another workspace -> 404 for ledger and movements.
  it('protects workspace boundary returning 404 for another workspace till', async () => {
    const openRes = await app.inject({
      method: 'POST',
      url: '/api/pos/sessions',
      headers: as(OWNER, SHOP),
      payload: { openingFloatMinor: 5_000, currency: 'AFN' },
    })
    const id = openRes.json().id

    // Stranger tries to read ledger
    const ledgerRes = await app.inject({
      method: 'GET',
      url: `/api/pos/sessions/${id}/ledger`,
      headers: as(STRANGER, OTHER_SHOP),
    })
    expect(ledgerRes.statusCode).toBe(404)

    // Stranger tries to record cash movement
    const cashRes = await app.inject({
      method: 'POST',
      url: `/api/pos/sessions/${id}/cash`,
      headers: as(STRANGER, OTHER_SHOP),
      payload: { kind: 'cash_in', amountMinor: 500, reason: 'Attack' },
    })
    expect(cashRes.statusCode).toBe(404)
  })
})
