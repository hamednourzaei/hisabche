// ============================================
// MODULE ACCOUNTING — closing a year once, and counting a day once.
//
// ---------------------------------------------------------------------------
// TWO DEFECTS, BOTH INVISIBLE BECAUSE THE BOOKS STILL BALANCED
//
// 1. THE YEAR-END CLOSE WAS NOT IDEMPOTENT.
//    `postYearEndClose` called `createJournalEntry`, which posts with
//    `sourceType: 'manual'` and `sourceId: null` — and the idempotency guard
//    in `postDocument` only applies when a source id is set. Pressing «close
//    year» twice, or a client retrying a timed-out request, posted the whole
//    closing entry again: every revenue and expense account driven to the
//    NEGATIVE of its balance, and retained earnings credited with twice the
//    profit.
//
//    ⚠️ The second entry balances exactly like the first, so the trial balance
//    still footed and the balance sheet still balanced. The only symptom was a
//    year's profit wrong by a factor of two.
//
// 2. THE GENERAL LEDGER DOUBLE-COUNTED THE FIRST DAY OF THE WINDOW.
//    The opening balance was `ledgerTotals(..., to = from)` — and `p_to_date`
//    is INCLUSIVE, the same `.lte` convention every other bound uses — while
//    the lines were read with `.gte('date', from)`. Every entry dated on the
//    first day was therefore in the opening balance AND listed as a line.
//
//    So the closing balance disagreed with the trial balance by exactly that
//    day's movement, in the drill-down report people open to check the trial
//    balance.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { dayBefore, dateOnly } from '../services/accounting/accounting.domain'

const DIR = join(__dirname, '..', 'services', 'accounting')

/** Comments stripped — both defects are discussed at length in comments. */
function code(file: string): string {
  return readFileSync(join(DIR, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
}

const service = code('accounting.service.ts')
const repository = code('accounting.repository.ts')

// ─────────────────────────────────────────────────────────────────────────────
describe('dayBefore', () => {
  it('steps back one day', () => {
    expect(dayBefore('2026-03-15')).toBe('2026-03-14')
  })

  it('crosses a month boundary', () => {
    expect(dayBefore('2026-03-01')).toBe('2026-02-28')
  })

  it('crosses a year boundary', () => {
    expect(dayBefore('2026-01-01')).toBe('2025-12-31')
  })

  it('handles a leap day', () => {
    expect(dayBefore('2024-03-01')).toBe('2024-02-29')
  })

  it('⚠️ never returns the same date', () => {
    // A date-only string parsed in local time lands at midnight in the
    // server's zone, and subtracting a day across a DST shift can land back on
    // the same calendar date — which would silently restore the double-count.
    for (const date of [
      '2026-03-29', // European DST forward
      '2026-10-25', // European DST back
      '2026-11-01', // US DST back
      '2026-03-08', // US DST forward
      '2026-01-01',
      '2026-12-31',
    ]) {
      expect(dayBefore(date), date).not.toBe(date)
    }
  })

  it('accepts a full ISO timestamp, like every other date input here', () => {
    expect(dayBefore('2026-03-15T22:30:00.000Z')).toBe('2026-03-14')
  })

  it('agrees with dateOnly about what today is called', () => {
    expect(dayBefore(dateOnly('2026-06-10'))).toBe('2026-06-09')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('the general ledger opening balance', () => {
  it('⚠️ stops strictly BEFORE the window, not at its first day', () => {
    expect(service).toMatch(/ledgerTotals\(ctx\.workspaceId, null, dayBefore\(from\), null\)/)
  })

  it('does not pass the window start as the opening bound any more', () => {
    // The exact shape that double-counted.
    expect(service).not.toMatch(/ledgerTotals\(ctx\.workspaceId, null, from, null\)/)
  })

  it('the lines are still read from the window start inclusive', () => {
    // The fix must be on the opening side. Moving the LINES instead would drop
    // the first day from the report entirely — the opposite error.
    expect(repository).toMatch(/\.gte\('journal_entries\.date', fromDate\)/)
  })

  it('the totals RPC bound is still inclusive, which is why the fix is needed', () => {
    expect(repository).toMatch(/p_to_date: toDate/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('the year-end close', () => {
  it('⚠️ refuses a second close of the same period', () => {
    expect(service).toMatch(/YEAR_END_ALREADY_CLOSED/)
  })

  it('looks for an existing close before posting one', () => {
    const body = service.slice(
      service.indexOf('async postYearEndClose'),
      service.indexOf('async getCashFlow'),
    )
    expect(body.indexOf('findEntryByReference')).toBeGreaterThan(-1)
    expect(body.indexOf('findEntryByReference')).toBeLessThan(body.indexOf('createJournalEntry'))
  })

  it('the key is deterministic in the period', () => {
    expect(service).toMatch(/yearEndReferenceOf/)
    expect(service).toMatch(/`YEC:\$\{from\}:\$\{to\}`/)
  })

  it('the reference is actually written on the entry', () => {
    // A key nothing stores is not a key.
    const body = service.slice(
      service.indexOf('async postYearEndClose'),
      service.indexOf('async getCashFlow'),
    )
    expect(body).toMatch(/reference,/)
  })

  it('⚠️ the refusal names the entry that already exists', () => {
    // «Already closed» with nothing to look at is not actionable — the person
    // has to be able to find the entry and see what it did.
    expect(service).toMatch(/existing\.entryNumber \?\? existing\.id/)
  })

  it('the lookup excludes cancelled entries', () => {
    // A close that was cancelled must not block a legitimate re-close.
    const finder = repository.slice(
      repository.indexOf('async findEntryByReference'),
      repository.indexOf('async findEntryBySource'),
    )
    expect(finder).toMatch(/\.neq\('status', 'cancelled'\)/)
  })

  it('the lookup is scoped to the workspace', () => {
    const finder = repository.slice(
      repository.indexOf('async findEntryByReference'),
      repository.indexOf('async findEntryBySource'),
    )
    expect(finder).toMatch(/\.eq\('workspace_id', workspaceId\)/)
  })

  it('a database failure is not read as «not closed yet»', () => {
    // Swallowing the error would let a second close through on any transient
    // fault — the one moment it matters most.
    const finder = repository.slice(
      repository.indexOf('async findEntryByReference'),
      repository.indexOf('async findEntryBySource'),
    )
    expect(finder).toMatch(/if \(error\) throw new DatabaseError/)
  })
})
