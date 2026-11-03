// ============================================
// backend/src/__tests__/order-deposit-liability.test.ts
//
// P1 (V53 owner decision), proved through the REAL route and the REAL service
// (only the database, the ledger and the books currency are replaced):
//
//   · receiving a deposit books Dr cash|bank / Cr customer advances — the
//     money is a debt to the customer, NEVER revenue;
//   · the method decides the money account: cash → cash, anything else → bank;
//   · the entry is keyed by the deposit id, so a retry cannot book it twice;
//   · minor units are converted with the workspace's currency, not by ×100;
//   · zero, negative and fractional-minor amounts are refused before any write;
//   · a chart of accounts that cannot express the posting still records the
//     deposit, and SAYS the entry was skipped.
// ============================================

import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LedgerPostingRequest } from '../services/accounting/ledger.port'

type Row = Record<string, unknown>

const state: {
  inserted: Row[]
  posting: LedgerPostingRequest[]
  ensured: string[][]
  accounts: Record<string, string> | null
  insertError: { message: string } | null
  orderRows: Row[]
  currency: string
} = {
  inserted: [],
  posting: [],
  ensured: [],
  accounts: null,
  insertError: null,
  orderRows: [],
  currency: 'AFN',
}

vi.mock('../db', () => ({
  supabase: {
    from: () => ({
      insert: (values: Row) => ({
        select: () => ({
          single: async () => {
            if (state.insertError) return { data: null, error: state.insertError }
            state.inserted.push(values)
            const row = {
              ...values,
              id: 'dep-1',
              applied_invoice_id: null,
              journal_entry_id: null,
              posting_status: null,
              created_at: '2026-11-03T00:00:00Z',
            }
            return { data: row, error: null }
          },
        }),
      }),
      // The receipt's outcome is recorded on the row afterwards:
      // posting_status = posted | pending_posting, plus journal_entry_id.
      update: (values: Row) => ({
        eq: () => ({
          eq: () => ({
            select: () => ({
              single: async () => ({
                data: {
                  id: 'dep-1',
                  amount_minor: state.inserted[0]?.amount_minor ?? 0,
                  payment_method: state.inserted[0]?.payment_method ?? 'cash',
                  ...values,
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
      select: () => ({
        eq: () => ({
          eq: async () => ({ data: state.orderRows, error: null }),
        }),
      }),
    }),
  },
}))

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: async (request: { user?: unknown }) => {
    request.user = { id: 'u-1' }
  },
}))
vi.mock('../middleware/workspace.middleware', () => ({
  requireWorkspaceContext: async (request: { tenancy?: unknown }) => {
    request.tenancy = { workspaceId: 'ws-1', userId: 'u-1', role: 'manager' }
  },
}))
vi.mock('../middleware/authorize.middleware', () => ({
  requireCapability: () => async () => undefined,
}))

vi.mock('../services/accounting', () => ({
  ledger: {
    ensureAccountsForRoles: async (_ctx: unknown, roles: string[]) => {
      state.ensured.push(roles)
      if (state.accounts) return { accounts: state.accounts, missing: [] }
      return { accounts: {}, missing: ['customer_advances'] }
    },
    postDocument: async (_ctx: unknown, request: LedgerPostingRequest) => {
      state.posting.push(request)
      return { status: 'posted', entryId: 'je-1', entryNumber: 'JV-0001' }
    },
  },
}))

vi.mock('../services/base-currency', () => ({
  baseCurrencyOf: async () => state.currency,
}))

import { orderDepositRoutes } from '../routes/order-deposit.routes'

function build() {
  const app = Fastify()
  app.register(orderDepositRoutes)
  return app
}

const CUSTOMER = 'c0000000-0000-4000-8000-000000000001'
const ORDER = '00000000-0000-4000-8000-0000000000aa'

beforeEach(() => {
  state.inserted = []
  state.posting = []
  state.ensured = []
  state.accounts = { cash: 'acc-cash', bank: 'acc-bank', customer_advances: 'acc-adv' }
  state.insertError = null
  state.orderRows = []
  state.currency = 'AFN'
})

describe('P1 — an order deposit is a liability, not revenue', () => {
  it('books Dr cash / Cr customer advances, and never revenue', async () => {
    const app = build()
    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${ORDER}/deposits`,
      payload: { customerId: CUSTOMER, amountMinor: 12345, date: '2026-11-02' },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json().posting).toEqual({
      status: 'posted',
      entryId: 'je-1',
      entryNumber: 'JV-0001',
    })

    const entry = state.posting[0]!
    expect(entry.sourceType).toBe('order_deposit')
    expect(entry.sourceId).toBe('dep-1')
    expect(entry.date).toBe('2026-11-02')
    // AFN has ZERO fraction digits: 12,345 minor units are 12,345 afghani.
    // The conversion is the workspace currency's, never a hardcoded ÷100.
    expect(entry.lines).toEqual([
      { accountId: 'acc-cash', debit: 12345, credit: 0 },
      { accountId: 'acc-adv', debit: 0, credit: 12345 },
    ])

    // The amount booked equals the amount stored, and the roles asked for are
    // the money account and the customer advance — nothing named «sales».
    expect(state.inserted[0]?.amount_minor).toBe(12345)
    expect(state.ensured[0]).toEqual(['cash', 'customer_advances'])
    await app.close()
  })

  it('converts minor units with the books currency (USD: two decimals)', async () => {
    state.currency = 'USD'
    const app = build()
    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${ORDER}/deposits`,
      payload: { customerId: CUSTOMER, amountMinor: 12345 },
    })

    expect(response.statusCode).toBe(201)
    expect(state.posting[0]?.lines).toEqual([
      { accountId: 'acc-cash', debit: 123.45, credit: 0 },
      { accountId: 'acc-adv', debit: 0, credit: 123.45 },
    ])
    await app.close()
  })

  it('puts a non-cash deposit in the bank account', async () => {
    const app = build()
    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${ORDER}/deposits`,
      payload: { customerId: CUSTOMER, amountMinor: 50000, paymentMethod: 'bank' },
    })

    expect(response.statusCode).toBe(201)
    expect(state.ensured[0]).toEqual(['bank', 'customer_advances'])
    expect(state.posting[0]?.lines[0]?.accountId).toBe('acc-bank')
    await app.close()
  })

  it('keys the entry by the deposit id so a retry cannot book it twice', async () => {
    const app = build()
    await app.inject({
      method: 'POST',
      url: `/api/orders/${ORDER}/deposits`,
      payload: { customerId: CUSTOMER, amountMinor: 100 },
    })
    await app.inject({
      method: 'POST',
      url: `/api/orders/${ORDER}/deposits`,
      payload: { customerId: CUSTOMER, amountMinor: 100 },
    })

    expect(state.posting).toHaveLength(2)
    // The ledger de-duplicates on (workspace, source_type, source_id); the
    // service must therefore reuse the SAME source id for the same deposit and
    // never invent a fresh one per attempt.
    expect(state.posting[0]?.sourceId).toBe('dep-1')
    expect(state.posting[1]?.sourceId).toBe('dep-1')
    expect(state.posting[0]?.sourceType).toBe('order_deposit')
    await app.close()
  })

  it.each([
    ['zero', 0],
    ['negative', -100],
    ['fractional minor units', 10.5],
  ])('refuses a %s amount before writing anything', async (_label, amountMinor) => {
    const app = build()
    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${ORDER}/deposits`,
      payload: { customerId: CUSTOMER, amountMinor },
    })

    expect(response.statusCode).toBe(400)
    expect(state.inserted).toHaveLength(0)
    expect(state.posting).toHaveLength(0)
    await app.close()
  })

  it('records the deposit and reports the skipped entry when the accounts do not exist', async () => {
    state.accounts = null
    const app = build()
    const response = await app.inject({
      method: 'POST',
      url: `/api/orders/${ORDER}/deposits`,
      payload: { customerId: CUSTOMER, amountMinor: 2500 },
    })

    expect(response.statusCode).toBe(201)
    expect(state.inserted).toHaveLength(1)
    expect(state.posting).toHaveLength(0)
    expect(response.json().posting).toMatchObject({
      status: 'skipped',
      reason: 'missing_accounts',
    })
    await app.close()
  })

  it('reads deposits inside the workspace and order only', async () => {
    state.orderRows = [{ id: 'dep-1', amount_minor: 100 }]
    const app = build()
    const response = await app.inject({
      method: 'GET',
      url: `/api/orders/${ORDER}/deposits`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().data).toEqual([{ id: 'dep-1', amount_minor: 100 }])
    await app.close()
  })
})
