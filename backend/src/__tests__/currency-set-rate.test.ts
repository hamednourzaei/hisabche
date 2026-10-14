// ============================================
// «ثبت نرخ» answered 500 on the live site (live audit #47, 14 Oct).
//
// PUT /currency/rates upserts on (workspace_id, currency_code, rate_date); a
// database without that unique key refuses the upsert with 42P10. The rate
// must still be kept — one row per currency per day, updated or created.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Call = { table: string; op: string; payload?: unknown; filters: Array<[string, unknown]> }
const calls: Call[] = []
let upsertError: { code: string } | null = null
let existingId: string | null = null

function builder(table: string) {
  const call: Call = { table, op: 'select', filters: [] }
  const chain: Record<string, unknown> = {}
  const done = () => {
    calls.push(call)
    if (call.op === 'upsert' && upsertError) return { data: null, error: upsertError }
    if (call.op === 'select') {
      return { data: existingId ? { id: existingId } : null, error: null }
    }
    return {
      data: { currency_code: 'USD', rate: 70, rate_date: '2026-10-14' },
      error: null,
    }
  }
  Object.assign(chain, {
    upsert: (payload: unknown) => ((call.op = 'upsert'), (call.payload = payload), chain),
    insert: (payload: unknown) => ((call.op = 'insert'), (call.payload = payload), chain),
    update: (payload: unknown) => ((call.op = 'update'), (call.payload = payload), chain),
    select: () => chain,
    eq: (column: string, value: unknown) => (call.filters.push([column, value]), chain),
    limit: () => chain,
    single: async () => done(),
    maybeSingle: async () => done(),
  })
  return chain
}

vi.mock('../db', () => ({ supabase: { from: (table: string) => builder(table) } }))
vi.mock('../services/base-currency', () => ({ baseCurrencyOf: async () => 'AFN' }))
vi.mock('../utils/pagination', () => ({ memoryCache: { invalidate: async () => undefined } }))
vi.mock('../services/accounting', () => ({ ledger: {} }))

const ctx = { workspaceId: 'ws-1', userId: 'u-1', role: 'owner' } as never
const input = { currency: 'USD', rate: 70, onDate: '2026-10-14T00:00:00.000Z' }

beforeEach(() => {
  calls.length = 0
  upsertError = null
  existingId = null
})

describe('CurrencyService.setRate', () => {
  it('with the unique key present it is one upsert', async () => {
    const { CurrencyService } = await import('../services/currency/currency.service')
    const quote = await new CurrencyService().setRate(ctx, input)
    expect(quote).toEqual({ currency: 'USD', rate: 70, onDate: '2026-10-14' })
    expect(calls.map((c) => c.op)).toEqual(['upsert'])
  })

  it('⚠️ without the key (42P10) the day’s rate is CREATED, not a 500', async () => {
    upsertError = { code: '42P10' }
    const { CurrencyService } = await import('../services/currency/currency.service')
    await new CurrencyService().setRate(ctx, input)
    expect(calls.map((c) => c.op)).toEqual(['upsert', 'select', 'insert'])
    expect(calls[1]!.filters).toEqual([
      ['workspace_id', 'ws-1'],
      ['currency_code', 'USD'],
      ['rate_date', '2026-10-14'],
    ])
  })

  it('without the key, a rate already set that day is UPDATED — still one row per day', async () => {
    upsertError = { code: '42P10' }
    existingId = 'rate-1'
    const { CurrencyService } = await import('../services/currency/currency.service')
    await new CurrencyService().setRate(ctx, input)
    expect(calls.map((c) => c.op)).toEqual(['upsert', 'select', 'update'])
    // Scoped to the workspace as well as the row.
    expect(calls[2]!.filters).toEqual([
      ['id', 'rate-1'],
      ['workspace_id', 'ws-1'],
    ])
  })

  it('any other database error is still an error', async () => {
    upsertError = { code: '42501' }
    const { CurrencyService } = await import('../services/currency/currency.service')
    await expect(new CurrencyService().setRate(ctx, input)).rejects.toThrow()
  })

  it('the books currency against itself is refused by name', async () => {
    const { CurrencyService } = await import('../services/currency/currency.service')
    await expect(new CurrencyService().setRate(ctx, { ...input, currency: 'AFN' })).rejects.toThrow(
      'RATE_BASE_CURRENCY',
    )
    expect(calls).toEqual([])
  })
})
