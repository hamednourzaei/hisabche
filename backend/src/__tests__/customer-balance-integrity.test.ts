// ============================================
// MODULE CUSTOMER — what a party owes, and what may be deleted.
//
// ---------------------------------------------------------------------------
// THREE DEFECTS, ALL SILENT
//
// 1. THE BALANCE WAS SUMMED FROM A TRUNCATED SET.
//    `getBalance` read `transactions_view` with `.limit(10000)`. PostgREST
//    returns the first ten thousand rows and says nothing about the rest, so a
//    party with more movements than that got a balance summed from an
//    arbitrary prefix — a wrong number, with no error and no flag. A shop with
//    a daily-trading customer reaches that in a few years.
//
// 2. DELETION WAS GUARDED BY A PLANNER ESTIMATE.
//    `count: 'estimated'` is answered from table statistics. It is routinely
//    wrong and can read 0 for a table that has rows, so a customer with real
//    movements was deletable and every transaction pointing at them was
//    orphaned.
//
// 3. A FAILED SECOND WRITE DELETED THE FIRST.
//    On a failed opening-balance insert, `create` ran
//    `supabase.from('customers').delete().eq('id', customer.id)`. supabase-js
//    has no transactions, so that is not a rollback — it is another write that
//    can fail on its own, leaving exactly the half-state it was meant to
//    prevent, and it was addressed by id with no `workspace_id` filter. This
//    codebase's fourth rule names the pattern and forbids it.
//
// ⚠️ These are source-level assertions, not an HTTP suite. The standing rule
// here is that green tests are not proof — proof is real HTTP or a real
// database. What they lock down is that the shapes which produced the bugs
// cannot come back.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SERVICE = join(__dirname, '..', 'services', 'customer.service.ts')

/** Comments stripped — all three defects are discussed at length in comments. */
const source = readFileSync(SERVICE, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '')

/** One method body, up to the next method at the same indentation. */
function methodBody(name: string): string {
  const start = source.indexOf(`async ${name}(`)
  expect(start, `${name} not found`).toBeGreaterThan(-1)
  const rest = source.slice(start + 1)
  const next = rest.search(/\n {2}(?:private )?async \w+\(/)
  return next === -1 ? rest : rest.slice(0, next)
}

describe('the balance is complete', () => {
  const body = methodBody('getBalance')

  it('⚠️ does not read the movements with a bare limit', () => {
    // The exact shape that produced a wrong number.
    expect(body).not.toMatch(/\.limit\(\s*10000\s*\)/)
    expect(body).not.toMatch(/from\('transactions_view'\)[\s\S]{0,200}?\.limit\(/)
  })

  it('pages until the source is exhausted', () => {
    expect(body).toMatch(/\.range\(/)
    // The loop must end on a SHORT page, which is the only reliable signal
    // that there is nothing left.
    expect(body).toMatch(/length < PAGE/)
  })

  it('⚠️ orders the pages', () => {
    // Without ORDER BY, PostgreSQL may return rows in any order between
    // pages, so a row can be counted twice or missed entirely — a wrong
    // balance again, arrived at differently.
    expect(body).toMatch(/\.order\('id'/)
  })

  it("the page size stays under PostgREST's own ceiling", () => {
    // A page at or above `max-rows` comes back short every time, the loop
    // stops on the first page, and the truncation returns in a new disguise.
    const match = body.match(/const PAGE = (\d+)/)
    expect(match, 'PAGE must be a literal so this can be checked').not.toBeNull()
    expect(Number(match![1])).toBeLessThanOrEqual(1000)
  })

  it('still establishes tenancy on the customer before summing', () => {
    // `transactions_view` is a view and may not expose `workspace_id`, so the
    // boundary is proven on `customers` first. That reasoning must survive.
    expect(body).toMatch(/from\('customers'\)[\s\S]{0,200}?\.eq\('workspace_id', workspaceId\)/)
  })
})

describe('deletion is guarded by fact, not by estimate', () => {
  const body = methodBody('delete')

  it('⚠️ does not use an estimated count to decide', () => {
    expect(body).not.toMatch(/count:\s*'estimated'/)
  })

  it('asks whether any linked row exists', () => {
    expect(body).toMatch(/from\('transactions'\)/)
    expect(body).toMatch(/\.limit\(1\)/)
  })

  it('the existence check is scoped to the workspace', () => {
    expect(body).toMatch(/\.eq\('workspace_id', workspaceId\)/)
  })

  it('a database failure on the check is not read as «no transactions»', () => {
    // Swallowing the error would make an unreachable database look like a
    // customer that is safe to delete.
    expect(body).toMatch(/linkedError/)
  })

  it('the row-level scope guard still runs first', () => {
    expect(body).toMatch(/scopes\.assertMay\(ctx, 'customer', id, 'customer\.write'\)/)
  })
})

describe('create does not compensate with a delete', () => {
  const body = methodBody('create')

  it('⚠️ never deletes the customer it just made', () => {
    // Rule 4: supabase-js has no transactions, and a compensating DELETE is
    // forbidden — it is a second write that can fail on its own.
    expect(body).not.toMatch(/from\('customers'\)\s*\.delete\(\)/)
    expect(body).not.toMatch(/\.delete\(\)\s*\.eq\('id', customer\.id\)/)
  })

  it('reports the partial failure instead of hiding it', () => {
    // The customer exists and is usable; what did not happen has to be said,
    // or somebody re-enters a person who is already there.
    expect(body).toMatch(/opening balance transaction failed/)
  })

  it('⚠️ does not post a zero-amount opening balance', () => {
    // A zero «sale» on every credit customer is a ledger row that says
    // nothing and appears in every statement of account.
    expect(body).toMatch(/opening !== 0/)
  })

  it('writes workspace_id and user_id, and filters on neither here', () => {
    expect(body).toMatch(/workspace_id: workspaceId/)
    expect(body).toMatch(/user_id: userId/)
  })
})
