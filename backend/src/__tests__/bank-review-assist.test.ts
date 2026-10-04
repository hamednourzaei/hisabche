// ============================================
// #55 — the bank auto-match engine, wired as a NOTE on each suggestion.
//
// `decideAutoMatches` had tests and no caller. `getSuggestions` now attaches
// its verdict as `review`. What must hold:
//
//   • nothing is matched — the statement lines are not written to;
//   • the bank's own charge is named as such, even when its amount and
//     reference happen to match a payment exactly;
//   • «ready» is only said when the bank's reference matched ONE entry.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const tables: Record<string, Row[]> = {}
const writes: string[] = []

function from(table: string) {
  const filters: Array<(row: Row) => boolean> = []
  let range: [number, number] | null = null
  const run = () => {
    const hit = (tables[table] ?? []).filter((row) => filters.every((f) => f(row)))
    return { data: range ? hit.slice(range[0], range[1] + 1) : hit, error: null }
  }
  const self = () => builder
  const builder: Record<string, unknown> = {
    select: self,
    order: self,
    gte: self,
    lte: self,
    not: self,
    limit: self,
    eq: (column: string, value: unknown) => {
      // An embedded-table filter («journal_lines.account_id») is the database's
      // job; the fixture holds no journals.
      if (!column.includes('.')) filters.push((row) => row[column] === value)
      return builder
    },
    range: (start: number, end: number) => ((range = [start, end]), builder),
    maybeSingle: async () => ({ data: run().data[0] ?? null, error: null }),
    update: () => (writes.push(`update ${table}`), builder),
    insert: () => (writes.push(`insert ${table}`), builder),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(run()).then(resolve),
  }
  return builder
}

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => from(table),
    rpc: () => (writes.push('rpc'), { data: null, error: null }),
  },
}))

import { BankingService } from '../services/banking/banking.service'

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ctx = { workspaceId: WS, userId: 'u', role: 'owner' } as never

const line = (id: string, description: string, amountMinor: number): Row => ({
  id,
  workspace_id: WS,
  statement_id: 'st1',
  external_ref: null,
  on_date: '2026-09-10',
  amount_minor: amountMinor,
  description,
  matched_to: null,
})
const payment = (id: string, number: string, amount: number): Row => ({
  id,
  workspace_id: WS,
  status: 'posted',
  payment_number: number,
  direction: 'in',
  amount,
  entry_date: '2026-09-10',
  party_id: null,
})

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key]
  writes.length = 0
  tables.bank_statements = [
    { id: 'st1', workspace_id: WS, account_id: 'acc', statement_date: '2026-09-30' },
  ]
})

describe('bank suggestions carry the engine’s note, and match nothing', () => {
  it('a line whose bank reference matches one payment is «ready» — and still unmatched', async () => {
    tables.bank_statement_lines = [line('l1', 'TRANSFER PAY-000123 AHMAD', 50_000)]
    tables.payments = [payment('p1', 'PAY-000123', 500)]

    const { suggestions } = await new BankingService().getSuggestions(ctx, 'st1')
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]).toMatchObject({
      bookEntryId: 'p1',
      confidence: 'certain',
      review: { kind: 'ready' },
    })
    expect(writes).toEqual([])
  })

  it('the bank’s own charge is named as one even when it matches a payment exactly', async () => {
    tables.bank_statement_lines = [line('l1', 'SERVICE CHARGE PAY-000123', 50_000)]
    tables.payments = [payment('p1', 'PAY-000123', 500)]

    const { suggestions } = await new BankingService().getSuggestions(ctx, 'st1')
    expect(suggestions[0]!.review).toEqual({ kind: 'check', reason: 'BANK_CHARGE' })
  })

  it('an amount-only match is not «ready»', async () => {
    tables.bank_statement_lines = [line('l1', 'CASH DEPOSIT', 50_000)]
    tables.payments = [payment('p1', 'PAY-000123', 500)]

    const { suggestions } = await new BankingService().getSuggestions(ctx, 'st1')
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]!.review.kind).toBe('check')
  })
})
