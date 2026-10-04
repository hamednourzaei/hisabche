// ============================================
// financing.service — the loan and holding registers (#125 #126).
//
// What can go wrong: totals added across currencies, a closed loan still
// counted, interest of the wrong order of magnitude (BUG-096), a value
// restated without its date, another workspace's row changed by id.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const tables: Record<string, Row[]> = {}
const state: { error: { code: string; message: string } | null } = { error: null }
let nextId = 1

function from(table: string) {
  const filters: Array<(row: Row) => boolean> = []
  let mode: 'select' | 'insert' | 'update' = 'select'
  let payload: Row = {}
  const run = () => {
    if (state.error) return { data: null, error: state.error }
    if (mode === 'insert') {
      const row = {
        id: `r${nextId++}`,
        is_active: true,
        created_at: '2026-10-04T00:00:00Z',
        ...payload,
      }
      ;(tables[table] ??= []).push(row)
      return { data: [row], error: null }
    }
    const hit = (tables[table] ?? []).filter((row) => filters.every((f) => f(row)))
    if (mode === 'update') for (const row of hit) Object.assign(row, payload)
    return { data: hit, error: null }
  }
  const builder: Record<string, unknown> = {
    select: () => builder,
    order: () => builder,
    limit: () => builder,
    eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), builder),
    insert: (row: Row) => ((mode = 'insert'), (payload = row), builder),
    update: (row: Row) => ((mode = 'update'), (payload = row), builder),
    single: async () => {
      const result = run()
      return { data: result.data?.[0] ?? null, error: result.error }
    },
    maybeSingle: async () => {
      const result = run()
      return { data: result.data?.[0] ?? null, error: result.error }
    },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(run()).then(resolve),
  }
  return builder
}

vi.mock('../db', () => ({ supabase: { from: (table: string) => from(table) } }))

import { FinancingService } from '../services/financing/financing.service'

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ctx = { workspaceId: WS, userId: 'u1', role: 'owner' } as never

const daysAgo = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
const loanRow = (overrides: Row = {}): Row => ({
  id: `f${nextId++}`,
  workspace_id: WS,
  kind: 'loan',
  counterparty: 'بانک',
  principal_minor: 1_000_000_00,
  currency: 'AFN',
  annual_rate_percent: 12,
  start_date: daysAgo(365),
  end_date: null,
  charges_per_year: 12,
  is_active: true,
  ...overrides,
})

let service: FinancingService
beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key]
  state.error = null
  nextId = 1
  tables.loan_facilities = []
  tables.investment_holdings = []
  service = new FinancingService()
})

describe('loans', () => {
  it('a year at 12% on 1,000,000 has accrued about 120,000 — the right order of magnitude', async () => {
    tables.loan_facilities!.push(loanRow())
    const { facilities } = await service.facilities(ctx)
    expect(facilities[0]!.accruedDays).toBe(365)
    expect(facilities[0]!.accruedInterest).toBe(120_000)
    expect(facilities[0]!.instalment).toBeNull()
  })

  it('a loan with a term states its instalment and how many there are', async () => {
    tables.loan_facilities!.push(loanRow({ start_date: '2026-01-01', end_date: '2027-01-01' }))
    const { facilities } = await service.facilities(ctx)
    expect(facilities[0]!.instalment).toMatchObject({ count: 12, perInstalment: 88_848.79 })
  })

  it('totals are per currency and per direction, over ACTIVE loans of THIS workspace only', async () => {
    tables.loan_facilities!.push(
      loanRow(),
      loanRow({ principal_minor: 500_000_00 }),
      loanRow({ currency: 'USD', principal_minor: 10_000_00 }),
      loanRow({ kind: 'receivable_facility', principal_minor: 70_000_00 }),
      loanRow({ is_active: false, principal_minor: 9_999_999_00 }),
      loanRow({ workspace_id: OTHER, principal_minor: 8_888_888_00 }),
    )
    const { totals, facilities } = await service.facilities(ctx)
    expect(facilities).toHaveLength(5)
    expect(totals.map((total) => [total.currency, total.kind, total.principal]).sort()).toEqual(
      [
        ['AFN', 'loan', 1_500_000],
        ['AFN', 'receivable_facility', 70_000],
        ['USD', 'loan', 10_000],
      ].sort(),
    )
  })

  it('saves money as minor units, for this workspace; an end before the start is refused', async () => {
    const input = {
      kind: 'loan' as const,
      counterparty: ' بانک ',
      principal: 2500.5,
      currency: 'USD',
      annualRatePercent: 9,
      startDate: '2026-10-01',
      endDate: null,
      chargesPerYear: 4,
    }
    await service.createFacility(ctx, input)
    expect(tables.loan_facilities![0]).toMatchObject({
      principal_minor: 250_050,
      workspace_id: WS,
      counterparty: 'بانک',
    })
    await expect(service.createFacility(ctx, { ...input, endDate: '2026-09-01' })).rejects.toThrow(
      'FINANCING_DATES_INVERTED',
    )
    expect(tables.loan_facilities).toHaveLength(1)
  })

  it('another workspace’s loan cannot be closed', async () => {
    tables.loan_facilities!.push(loanRow({ id: 'theirs', workspace_id: OTHER }))
    await expect(service.setFacilityActive(ctx, 'theirs', false)).rejects.toThrow('not found')
    expect(tables.loan_facilities![0]!.is_active).toBe(true)
  })

  it('a missing table is «not set up», not «no loans»', async () => {
    state.error = { code: '42P01', message: 'relation does not exist' }
    await expect(service.facilities(ctx)).rejects.toThrow('FINANCING_MIGRATION_PENDING')
  })
})

describe('holdings', () => {
  const holdingRow = (overrides: Row = {}): Row => ({
    id: `h${nextId++}`,
    workspace_id: WS,
    label: 'طلا',
    cost_minor: 50_000_00,
    market_value_minor: 60_000_00,
    currency: 'USD',
    valued_on: '2026-10-01',
    is_active: true,
    ...overrides,
  })

  it('one summary per currency, and it is named a valuation difference — not a return', async () => {
    tables.investment_holdings!.push(
      holdingRow(),
      holdingRow({ cost_minor: 50_000_00, market_value_minor: 45_000_00 }),
      holdingRow({ currency: 'AFN', cost_minor: 1_000_00, market_value_minor: 1_000_00 }),
      holdingRow({ is_active: false, market_value_minor: 9_000_000_00 }),
    )
    const { summaries } = await service.holdings(ctx)
    const usd = summaries.find((summary) => summary.currency === 'USD')
    expect(usd).toMatchObject({
      cost: 100_000,
      marketValue: 105_000,
      unrealisedGain: 5000,
      unrealisedGainPercent: 5,
    })
    expect(usd!.basis).toBe('VALUATION_DIFFERENCE_ONLY')
    expect(summaries).toHaveLength(2)
  })

  it('a new value needs the day it was stated — and the cost never changes', async () => {
    tables.investment_holdings!.push(holdingRow({ id: 'h' }))
    await expect(service.updateHolding(ctx, 'h', { marketValue: 70_000 })).rejects.toThrow(
      'FINANCING_VALUE_NEEDS_DATE',
    )
    const updated = await service.updateHolding(ctx, 'h', {
      marketValue: 70_000,
      valuedOn: '2026-10-04',
    })
    expect(updated).toMatchObject({ marketValue: 70_000, valuedOn: '2026-10-04', cost: 50_000 })
  })

  it('another workspace’s holding cannot be revalued', async () => {
    tables.investment_holdings!.push(holdingRow({ id: 'theirs', workspace_id: OTHER }))
    await expect(
      service.updateHolding(ctx, 'theirs', { marketValue: 1, valuedOn: '2026-10-04' }),
    ).rejects.toThrow('not found')
    expect(tables.investment_holdings![0]!.market_value_minor).toBe(60_000_00)
  })
})
