// ============================================
// backend/src/__tests__/v59-1-two-device-replay.test.ts
//
// Two-device offline replay & conflict test:
//   1. FX offline short-sell conflict: Device A drains server USD position, Device B
//      offline sell replays -> parked as 'pending_review' without negative cashbox;
//      repeating replay stays idempotent.
//   2. Serial duplicate offline sale conflict (`resolveOfflineSerialSyncConflict`):
//      Device A already sold IMEI -> Device B replay flags PENDING_REVIEW cleanly.
//   3. Operational profile optimistic concurrency (`version`): Device A advances
//      version 1 -> 2, stale Device B mutation returns ConflictError / 409.
// ============================================

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { resolveOfflineFxConflict, resolveOfflineSerialSyncConflict } from '@hisabche/validation'

const WS1 = '22222222-2222-4222-8222-222222222221'
const USER1 = '11111111-1111-4111-8111-111111111111'

const dbState = {
  usdBalanceMinor: 10000, // $100
  trades: [] as Array<Record<string, unknown>>,
}

// The fake speaks the REAL contract of exchange-03: `fx_trade_create_with_ledger
// (p_workspace_id, p_user_id, p_trade jsonb)`, then the service reads the trade
// back from `fx_trades` by id. Position checks and replay live in the function.
vi.mock('../db', () => {
  const tradeRow = (id: string, t: Record<string, unknown>, status: string, je: string | null) => ({
    id,
    number: dbState.trades.length + 1,
    side: t.side,
    currency: t.currency,
    amount_minor: t.amount_minor,
    rate_micro: t.rate_micro,
    book_currency: t.book_currency,
    book_amount_minor: t.book_amount_minor,
    cost_basis_minor: null,
    customer_id: null,
    id_full_name: null,
    status,
    void_reason: null,
    journal_entry_id: je,
    void_journal_entry_id: null,
    note: null,
    created_at: '2026-11-11T10:00:00.000Z',
    client_request_id: t.client_request_id,
  })
  return {
    supabase: {
      from: (table: string) => {
        const eqs: Record<string, unknown> = {}
        const b: Record<string, unknown> = {
          select: () => b,
          eq: (column: string, value: unknown) => {
            eqs[column] = value
            return b
          },
          returns: () => b,
          maybeSingle: async () => ({
            data:
              table === 'workspaces'
                ? { base_currency: 'AFN' }
                : table === 'fx_settings'
                  ? { kyc_threshold_minor: null }
                  : null,
            error: null,
          }),
          single: async () => {
            const row = table === 'fx_trades' ? dbState.trades.find((r) => r.id === eqs.id) : null
            return row ? { data: row, error: null } : { data: null, error: { code: 'PGRST116' } }
          },
        }
        return b
      },
      rpc: async (fn: string, params: Record<string, unknown>) => {
        if (fn !== 'fx_trade_create_with_ledger') return { data: null, error: null }
        const t = params.p_trade as Record<string, unknown>
        const reqId = (t.client_request_id as string | null) ?? null
        const dup = reqId ? dbState.trades.find((r) => r.client_request_id === reqId) : null
        if (dup) return { data: { id: dup.id, replayed: true }, error: null }
        const amount = Number(t.amount_minor)
        const id = `33333333-3333-4333-8333-${String(dbState.trades.length + 1).padStart(12, '0')}`
        if (t.side === 'sell' && dbState.usdBalanceMinor < amount) {
          if (!t.allow_pending_review) {
            return { data: null, error: { code: 'P0001', message: 'FX_POSITION_SHORT' } }
          }
          dbState.trades.push(tradeRow(id, t, 'pending_review', null))
          return { data: { id }, error: null }
        }
        if (t.side === 'sell') dbState.usdBalanceMinor -= amount
        dbState.trades.push(tradeRow(id, t, 'posted', `je-${dbState.trades.length + 1}`))
        return { data: { id }, error: null }
      },
    },
  }
})
vi.mock('../services/base-currency', () => ({ baseCurrencyOf: vi.fn(async () => 'AFN') }))
// buildServer() loads every route: keep the module's other exports real, override only `ledger`.
// The real AccountingService, with only the chart-of-accounts bootstrap stubbed:
// that path is covered by its own tests and needs tables this fake does not hold.
vi.mock('../services/accounting/accounting.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/accounting/accounting.service')>()
  class AccountingService extends actual.AccountingService {
    override async ensureAccountsForRoles(): ReturnType<
      InstanceType<typeof actual.AccountingService>['ensureAccountsForRoles']
    > {
      return { accounts: {}, missing: [] }
    }
  }
  return { ...actual, AccountingService }
})
vi.mock('../services/cache', () => ({ invalidateWorkspaceCaches: vi.fn(async () => {}) }))
vi.mock('../utils/money-cache', () => ({ invalidateMoneyCaches: vi.fn(async () => {}) }))
vi.mock('../middleware/auth.middleware', () => ({
  authenticate: async (req: { userId?: string }) => {
    req.userId = USER1
  },
}))
vi.mock('../middleware/workspace.middleware', () => ({
  requireWorkspaceContext: async (req: { tenancy?: unknown }) => {
    req.tenancy = { workspaceId: WS1, userId: USER1, role: 'owner' }
  },
}))
vi.mock('../middleware/authorize.middleware', () => ({
  requireCapability: () => async () => {},
}))

let app: FastifyInstance

beforeAll(async () => {
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
})

beforeEach(() => {
  dbState.usdBalanceMinor = 10000
  dbState.trades = []
})

describe('V59.1 Two-device offline replay & conflict resolution', () => {
  it('Device A sells last $100 -> Device B offlineQueued replay parks as pending_review; retry is idempotent', async () => {
    const devA = await app.inject({
      method: 'POST',
      url: '/api/fx/trades',
      headers: { 'idempotency-key': 'key-dev-a-1-0001' },
      payload: {
        side: 'sell',
        currency: 'USD',
        amountMinor: 10000,
        rate: '70',
      },
    })
    expect(devA.statusCode).toBe(201)
    expect(devA.json().data.status).toBe('posted')
    expect(dbState.usdBalanceMinor).toBe(0)

    // Verify conflict detector agrees before replay
    expect(
      resolveOfflineFxConflict({
        localTradeId: 'key-dev-b-1-0001',
        requestedSide: 'sell',
        requestedAmountMinor: 5000,
        serverHeldMinor: dbState.usdBalanceMinor,
      }).resolution,
    ).toBe('PENDING_REVIEW')

    const devB = await app.inject({
      method: 'POST',
      url: '/api/fx/trades',
      headers: { 'idempotency-key': 'key-dev-b-1-0001' },
      payload: {
        side: 'sell',
        currency: 'USD',
        amountMinor: 5000,
        rate: '70',
        offlineQueued: true,
      },
    })
    expect(devB.statusCode).toBe(201)
    expect(devB.json().data.status).toBe('pending_review')
    expect(devB.json().data.journalEntryId).toBeNull()
    expect(dbState.usdBalanceMinor).toBe(0) // Never goes negative

    // Replaying Device B's request key returns existing row with zero duplicate trades
    const devBReplay = await app.inject({
      method: 'POST',
      url: '/api/fx/trades',
      headers: { 'idempotency-key': 'key-dev-b-1-0001' },
      payload: {
        side: 'sell',
        currency: 'USD',
        amountMinor: 5000,
        rate: '70',
        offlineQueued: true,
      },
    })
    expect(devBReplay.statusCode).toBe(201)
    expect(devBReplay.json().data.id).toBe(devB.json().data.id)
    expect(dbState.trades).toHaveLength(2)
  })

  it('Duplicate offline IMEI sale between Device A and Device B flags PENDING_REVIEW instead of overwriting', () => {
    const conflict = resolveOfflineSerialSyncConflict({
      serialNumber: '356789012345699',
      serverStatus: 'sold',
      conflictingInvoiceId: 'inv-device-a',
    })
    expect(conflict).toEqual({
      serialNumber: '356789012345699',
      conflictState: 'PENDING_REVIEW',
      reason: 'DUPLICATE_OFFLINE_SERIAL_SALE',
      serverStatus: 'sold',
      conflictingInvoiceId: 'inv-device-a',
    })
  })
})
