// ============================================
// #62 — bank categorization, wired as a suggestion on unmatched lines.
//
// `categorize` had tests and no caller. What can go wrong in the READING:
// history taken from another workspace, an entry with two other accounts
// treated as evidence, a matched line offered a category, an account name read
// across the boundary, an outgoing habit suggested for incoming money.
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
  const builder: Record<string, unknown> = {
    select: () => builder,
    order: () => builder,
    eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), builder),
    in: (column: string, values: unknown[]) => (
      filters.push((row) => values.includes(row[column])),
      builder
    ),
    not: (column: string, _op: string, value: unknown) => (
      filters.push((row) => (row[column] ?? null) !== value),
      builder
    ),
    range: (start: number, end: number) => ((range = [start, end]), builder),
    maybeSingle: async () => ({ data: run().data[0] ?? null, error: null }),
    update: () => (writes.push(`update ${table}`), builder),
    insert: () => (writes.push(`insert ${table}`), builder),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(run()).then(resolve),
  }
  return builder
}

vi.mock('../db', () => ({ supabase: { from: (table: string) => from(table) } }))

import { BankingService } from '../services/banking/banking.service'

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ctx = { workspaceId: WS, userId: 'u', role: 'owner' } as never
const BANK = 'acc-bank'

let seq = 0
/** A past line a person reconciled to a journal entry that hit `account`. */
function reconciled(description: string, amountMinor: number, accounts: string[], workspace = WS) {
  const id = `old-${++seq}`
  const entry = `je-${seq}`
  ;(tables.bank_statement_lines ??= []).push({
    id,
    workspace_id: workspace,
    statement_id: 'past',
    description,
    amount_minor: amountMinor,
    on_date: '2026-08-01',
    matched_to: entry,
    matched_kind: 'journal',
    external_ref: null,
  })
  for (const account of [BANK, ...accounts]) {
    ;(tables.journal_lines ??= []).push({
      workspace_id: workspace,
      journal_id: entry,
      account_id: account,
    })
  }
}
const open = (id: string, description: string, amountMinor: number): Row => ({
  id,
  workspace_id: WS,
  statement_id: 'st1',
  description,
  amount_minor: amountMinor,
  on_date: '2026-09-10',
  matched_to: null,
  matched_kind: null,
  external_ref: null,
})

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key]
  writes.length = 0
  seq = 0
  tables.bank_statements = [{ id: 'st1', workspace_id: WS, account_id: BANK }]
  tables.accounts = [
    { id: 'acc-rent', workspace_id: WS, name: 'اجاره', type: 'expense' },
    { id: 'acc-power', workspace_id: WS, name: 'برق', type: 'expense' },
    { id: 'acc-odd', workspace_id: WS, name: 'نامشخص', type: 'something-else' },
    { id: 'acc-theirs', workspace_id: OTHER, name: 'secret', type: 'expense' },
  ]
  tables.bank_statement_lines = []
  tables.journal_lines = []
})

const suggest = () => new BankingService().getCategorySuggestions(ctx, 'st1')

describe('category suggestions for unmatched bank lines', () => {
  it('three past lines to one account are a habit — suggested with its evidence, and nothing is written', async () => {
    for (const ref of ['101', '102', '103'])
      reconciled(`RENT OFFICE KABUL ${ref}`, -50_000, ['acc-rent'])
    tables.bank_statement_lines!.push(open('l1', 'RENT OFFICE KABUL 104', -50_000))

    const result = await suggest()
    expect(result.historySize).toBe(3)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0]!.verdict).toMatchObject({
      kind: 'categorized',
      suggestion: {
        accountId: 'acc-rent',
        accountName: 'اجاره',
        root: 'expense',
        sampleSize: 3,
        confidence: 1,
      },
    })
    expect(writes).toEqual([])
  })

  it('two past lines are not a habit: «not enough history», with the count', async () => {
    reconciled('RENT OFFICE KABUL 1', -50_000, ['acc-rent'])
    reconciled('RENT OFFICE KABUL 2', -50_000, ['acc-rent'])
    tables.bank_statement_lines!.push(open('l1', 'RENT OFFICE KABUL 3', -50_000))
    expect((await suggest()).lines[0]!.verdict).toMatchObject({
      kind: 'insufficient_history',
      sampleSize: 2,
    })
  })

  it('a habit learned from money going OUT is not suggested for money coming IN', async () => {
    for (const ref of ['1', '2', '3']) reconciled(`RENT OFFICE KABUL ${ref}`, -50_000, ['acc-rent'])
    tables.bank_statement_lines!.push(open('l1', 'RENT OFFICE KABUL 4', 50_000))
    expect((await suggest()).lines[0]!.verdict.kind).not.toBe('categorized')
  })

  it('an entry with two other accounts is not evidence of where one line went', async () => {
    for (const ref of ['1', '2', '3'])
      reconciled(`UTILITIES MIXED ${ref}`, -9000, ['acc-rent', 'acc-power'])
    tables.bank_statement_lines!.push(open('l1', 'UTILITIES MIXED 4', -9000))
    const result = await suggest()
    expect(result.historySize).toBe(0)
    expect(result.lines[0]!.verdict.kind).not.toBe('categorized')
  })

  it('history split between two accounts is «ambiguous» — no side is picked', async () => {
    reconciled('TRANSFER SHOP ONE 1', -1000, ['acc-rent'])
    reconciled('TRANSFER SHOP ONE 2', -1000, ['acc-rent'])
    reconciled('TRANSFER SHOP ONE 3', -1000, ['acc-power'])
    reconciled('TRANSFER SHOP ONE 4', -1000, ['acc-power'])
    tables.bank_statement_lines!.push(open('l1', 'TRANSFER SHOP ONE 5', -1000))
    expect((await suggest()).lines[0]!.verdict.kind).toBe('ambiguous')
  })

  it('another workspace’s reconciliations and accounts teach this one nothing', async () => {
    for (const ref of ['1', '2', '3'])
      reconciled(`RENT OFFICE KABUL ${ref}`, -50_000, ['acc-theirs'], OTHER)
    // …and a habit of THIS workspace that points at an account it does not own.
    for (const ref of ['1', '2', '3']) reconciled(`SECRET PAYEE NAME ${ref}`, -700, ['acc-theirs'])
    tables.bank_statement_lines!.push(open('l1', 'RENT OFFICE KABUL 4', -50_000))
    tables.bank_statement_lines!.push(open('l2', 'SECRET PAYEE NAME 4', -700))

    const result = await suggest()
    expect(result.historySize).toBe(0)
    expect(JSON.stringify(result)).not.toContain('secret')
  })

  it('an account whose type is not one of the five roots is not guessed at', async () => {
    for (const ref of ['1', '2', '3']) reconciled(`ODD ACCOUNT LINE ${ref}`, -100, ['acc-odd'])
    expect((await suggest()).historySize).toBe(0)
  })

  it('a line that is already matched is not offered a category', async () => {
    for (const ref of ['1', '2', '3']) reconciled(`RENT OFFICE KABUL ${ref}`, -50_000, ['acc-rent'])
    tables.bank_statement_lines!.push({
      ...open('l1', 'RENT OFFICE KABUL 4', -50_000),
      matched_to: 'p1',
      matched_kind: 'payment',
    })
    expect((await suggest()).lines).toEqual([])
  })

  it('another workspace’s statement is «not found»', async () => {
    tables.bank_statements = [{ id: 'st1', workspace_id: OTHER, account_id: BANK }]
    await expect(suggest()).rejects.toThrow('not found')
  })
})
