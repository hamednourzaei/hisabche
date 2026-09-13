// ============================================
// The capability list screens follow the invoices list structure.
//
// Owner's request: till, expiry, budgets, timesheets, assets, bank and
// governance are laid out like /invoices — header, filter/stat strip, and
// their lists on the ONE shared DataTable (search, column settings, sorting),
// with loading, error and empty as three separate branches.
//
// What this pins, per view:
//   · the list goes through `DataTable`, not a hand-written `<Table>` — a
//     second table implementation is exactly how these screens drifted before;
//   · an `EmptyState` exists and an `ErrorNote` exists, so «failed» and «none»
//     cannot collapse into one branch again.
//
// Comments are stripped first so a comment that NAMES the old pattern cannot
// fail (or satisfy) an assertion.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { matchesSearch } from '../components/ui/data-table/match-search'

const UI = join(__dirname, '..', 'components', 'ui')

const LIST_VIEWS = [
  'till/till-view.tsx',
  'expiry/expiry-view.tsx',
  'budgets/budgets-view.tsx',
  'timesheets/timesheets-view.tsx',
  'assets/assets-view.tsx',
  'bank/bank-view.tsx',
  'governance/governance-view.tsx',
]

function code(file: string): string {
  return readFileSync(join(UI, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/[^\n]*/g, '')
}

describe('capability list screens use the shared list primitives', () => {
  it.each(LIST_VIEWS)('%s renders its list through DataTable', (view) => {
    const source = code(view)
    expect(source).toContain('<DataTable')
    expect(source).not.toContain('<TableHeader')
    expect(source).not.toContain('<TableRow')
  })

  it.each(LIST_VIEWS)('%s keeps error and empty as separate branches', (view) => {
    const source = code(view)
    expect(source).toContain('<ErrorNote')
    expect(source).toContain('<EmptyState')
  })

  it('approvals has an error branch distinct from its empty state', () => {
    const source = code('workflow/approvals-view.tsx')
    expect(source).toContain('<ErrorNote')
    expect(source).toContain('<EmptyState')
  })
})

describe('matchesSearch', () => {
  it('matches any listed field, case-insensitively, ignoring surrounding space', () => {
    expect(matchesSearch('  ABC ', ['x', 'zabcz'])).toBe(true)
    expect(matchesSearch('42', [null, 1420])).toBe(true)
    expect(matchesSearch('nope', ['x', undefined])).toBe(false)
  })

  it('an empty query matches everything', () => {
    expect(matchesSearch('', [])).toBe(true)
  })
})
