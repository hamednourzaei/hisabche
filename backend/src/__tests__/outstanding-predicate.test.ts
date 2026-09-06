// ============================================
// backend/src/__tests__/outstanding-predicate.test.ts
//
// H1 — the number on the card and the list it opens must select the same rows.
//
// `customerDebt` reduces an array in `analytics.service`; the `?outstanding=1`
// filter builds a PostgREST query in `invoice.service`. Two hand-written
// predicates agree on the day they are written. This checks they still do, and
// checks the one case that is easy to get wrong in only one of them: NULL.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  FULLY_PAID_STATUS,
  OUTSTANDING_OR_FILTER,
  isOutstanding,
  outstandingPredicateAgrees,
} from '../services/invoices/outstanding.domain'

const rows = [
  { status: 'pending' },
  { status: 'partial' },
  { status: 'completed' },
  { status: 'cancelled' },
  { status: FULLY_PAID_STATUS },
  { status: null },
  { status: undefined },
  // A status nobody has invented yet. It must land on the outstanding side of
  // BOTH halves, which is why the rule is a negation and not a whitelist.
  { status: 'disputed' },
]

describe('one rule, two implementations', () => {
  it('the query selects exactly what the predicate accepts', () => {
    expect(outstandingPredicateAgrees(rows)).toBe(true)
  })

  it('only `paid` means nothing is owed', () => {
    expect(isOutstanding({ status: FULLY_PAID_STATUS })).toBe(false)
    for (const row of rows.filter((r) => r.status !== FULLY_PAID_STATUS)) {
      expect(isOutstanding(row)).toBe(true)
    }
  })

  it('counts a NULL status as outstanding — and so does the filter', () => {
    // `status.neq.paid` alone compiles to `status <> 'paid'`, which is NULL —
    // and therefore FALSE — for a NULL status. Without the `is.null` branch
    // the list would omit rows the card had summed, and only for rows nobody
    // thinks about.
    expect(isOutstanding({ status: null })).toBe(true)
    expect(OUTSTANDING_OR_FILTER).toContain('status.is.null')
  })

  it('is a negation, so a future status needs no second edit', () => {
    expect(OUTSTANDING_OR_FILTER).toContain(`status.neq.${FULLY_PAID_STATUS}`)
    expect(isOutstanding({ status: 'disputed' })).toBe(true)
  })
})

describe('both call sites really import it', () => {
  const source = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8')

  it('the KPI uses the shared predicate, not an inline status check', () => {
    // This is the drift the module exists to prevent: an inline
    // `status === 'paid'` here and the shared rule in the query would make the
    // list disagree with the figure that opened it.
    const analytics = source('services/analytics.service.ts')
    expect(analytics).toContain('isOutstanding')
    expect(analytics).not.toMatch(/status !== 'paid'|status === 'paid'/)
  })

  it('the list query uses the shared filter', () => {
    const invoices = source('services/invoice.service.ts')
    expect(invoices).toContain('OUTSTANDING_OR_FILTER')
    // Applied to the count as well, or the pager offers pages the list cannot
    // fill — the exact bug the count query already carries a comment about.
    expect(invoices.match(/OUTSTANDING_OR_FILTER/g)?.length).toBeGreaterThanOrEqual(3)
  })
})
