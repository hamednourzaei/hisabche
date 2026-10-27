// ============================================
// «۱ دستگاه لندکروز = ۴۰٬۰۰۰٬۰۰۰ افغانی» sat on the dashboard and could not be
// removed (27 Oct 2026). deleteUnit removes a unit by name, in the caller's
// workspace only, and says so plainly when the server role lacks DELETE.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Call = { table: string; filters: Array<[string, unknown]> }
const calls: Call[] = []
let result: { data: Array<{ id: string }> | null; error: { code: string } | null } = {
  data: [{ id: 'a' }, { id: 'b' }],
  error: null,
}

function builder(table: string) {
  const call: Call = { table, filters: [] }
  const chain: Record<string, unknown> = {
    delete: () => chain,
    eq: (column: string, value: unknown) => (call.filters.push([column, value]), chain),
    select: async () => (calls.push(call), result),
  }
  return chain
}

vi.mock('../db', () => ({ supabase: { from: (table: string) => builder(table) } }))
vi.mock('../services/base-currency', () => ({ baseCurrencyOf: async () => 'AFN' }))
vi.mock('../utils/pagination', () => ({ memoryCache: { invalidate: async () => undefined } }))
vi.mock('../services/accounting', () => ({ ledger: {} }))

const owner = { workspaceId: 'ws-1', userId: 'u-1', role: 'owner' } as never
const seller = { workspaceId: 'ws-1', userId: 'u-2', role: 'seller' } as never

beforeEach(() => {
  calls.length = 0
  result = { data: [{ id: 'a' }, { id: 'b' }], error: null }
})

describe('CurrencyService.deleteUnit', () => {
  it('deletes by name inside the caller workspace and counts what went', async () => {
    const { CurrencyService } = await import('../services/currency/currency.service')
    const out = await new CurrencyService().deleteUnit(owner, '  دستگاه لندکروز ')
    expect(out).toEqual({ removed: 2 })
    expect(calls[0]).toEqual({
      table: 'custom_unit_rates',
      filters: [
        ['workspace_id', 'ws-1'],
        ['name', 'دستگاه لندکروز'],
      ],
    })
  })

  it('a seller may not remove a unit', async () => {
    const { CurrencyService } = await import('../services/currency/currency.service')
    await expect(new CurrencyService().deleteUnit(seller, 'x')).rejects.toThrow(
      'RATE_MANAGE_FORBIDDEN',
    )
    expect(calls).toHaveLength(0)
  })

  it('without the DELETE grant it says so instead of a bare 500', async () => {
    result = { data: null, error: { code: '42501' } }
    const { CurrencyService } = await import('../services/currency/currency.service')
    await expect(new CurrencyService().deleteUnit(owner, 'x')).rejects.toThrow(
      'UNITS_DELETE_NOT_ENABLED',
    )
  })
})
