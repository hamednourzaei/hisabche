// ============================================
// J1 — the period lock, with branches.
//
// The precedence rule is one sentence — "company lock OR branch lock refuses" —
// and every way of getting it wrong is silent:
//
//   · treating a branch lock as an OVERRIDE lets a branch manager reopen a year
//     the owner closed, and the filed figures stop being final;
//   · applying a branch lock to entries with NO branch makes one shop's
//     month-end block head office;
//   · an off-by-one on the boundary either leaks a day into a closed period or
//     closes a day that should be open.
//
// So it lives in a pure function and these are its tests. The SECOND
// enforcement — inside accounting_post_journal_entry, which refuses a direct
// database write — cannot be tested here: this suite mocks Supabase. It is
// covered by V4/V5 in docs/phase-j-01-branch-period-lock-migration.sql, which
// must be run against the real database.
// ============================================

import { describe, expect, it } from 'vitest'

import { evaluatePeriodLock, type PeriodLock } from '../services/accounting/accounting.domain'

const BRANCH_A = 'branch-a'
const BRANCH_B = 'branch-b'

const company = (lockedUntil: string): PeriodLock => ({
  branchId: null,
  lockedUntil,
  reason: 'year end',
})

const branch = (branchId: string, lockedUntil: string): PeriodLock => ({
  branchId,
  lockedUntil,
  reason: 'shop counted',
})

describe('no locks', () => {
  it('leaves every date open', () => {
    expect(evaluatePeriodLock('2026-01-01', BRANCH_A, []).locked).toBe(false)
    expect(evaluatePeriodLock('1900-01-01', null, []).locked).toBe(false)
  })
})

describe('the company lock', () => {
  const locks = [company('2026-03-31')]

  it('refuses a date inside the closed period', () => {
    const decision = evaluatePeriodLock('2026-03-15', BRANCH_A, locks)
    expect(decision.locked).toBe(true)
    expect(decision.scope).toBe('company')
  })

  it('refuses the boundary date itself', () => {
    // Inclusive. An entry dated ON the closing day belongs to the closed
    // period — an exclusive comparison would leak one day into filed figures.
    expect(evaluatePeriodLock('2026-03-31', BRANCH_A, locks).locked).toBe(true)
  })

  it('allows the day after', () => {
    expect(evaluatePeriodLock('2026-04-01', BRANCH_A, locks).locked).toBe(false)
  })

  it('covers a branch that has no lock of its own', () => {
    expect(evaluatePeriodLock('2026-03-15', BRANCH_B, locks).locked).toBe(true)
  })

  it('covers a posting with no branch at all', () => {
    expect(evaluatePeriodLock('2026-03-15', null, locks).locked).toBe(true)
  })
})

describe('a branch lock', () => {
  const locks = [branch(BRANCH_A, '2026-03-31')]

  it('refuses that branch', () => {
    const decision = evaluatePeriodLock('2026-03-15', BRANCH_A, locks)
    expect(decision.locked).toBe(true)
    expect(decision.scope).toBe('branch')
  })

  it('leaves another branch open', () => {
    // The whole point: one shop can close early without closing the others.
    expect(evaluatePeriodLock('2026-03-15', BRANCH_B, locks).locked).toBe(false)
  })

  it('does not block a posting with no branch', () => {
    // Head office is not blocked because one shop finished counting.
    expect(evaluatePeriodLock('2026-03-15', null, locks).locked).toBe(false)
  })
})

describe('both locks — precedence', () => {
  it('refuses when only the company lock applies', () => {
    const locks = [company('2026-03-31'), branch(BRANCH_A, '2026-01-31')]
    const decision = evaluatePeriodLock('2026-02-15', BRANCH_A, locks)

    expect(decision.locked).toBe(true)
    expect(decision.scope).toBe('company')
  })

  it('refuses when only the branch lock applies', () => {
    const locks = [company('2026-01-31'), branch(BRANCH_A, '2026-03-31')]
    const decision = evaluatePeriodLock('2026-02-15', BRANCH_A, locks)

    expect(decision.locked).toBe(true)
    expect(decision.scope).toBe('branch')
  })

  it('a branch lock CANNOT reopen what the company closed', () => {
    // The load-bearing test of this phase.
    //
    // The branch's lock is EARLIER than the company's — read as an override, a
    // branch manager would have just reopened February at their shop after the
    // owner closed March everywhere. It must still refuse.
    const locks = [company('2026-03-31'), branch(BRANCH_A, '2026-01-31')]
    const decision = evaluatePeriodLock('2026-03-01', BRANCH_A, locks)

    expect(decision.locked).toBe(true)
    expect(decision.scope).toBe('company')
  })

  it('reports the company lock when both refuse', () => {
    // The one a branch manager cannot lift is the one worth naming.
    const locks = [company('2026-03-31'), branch(BRANCH_A, '2026-03-31')]

    expect(evaluatePeriodLock('2026-03-01', BRANCH_A, locks).scope).toBe('company')
  })

  it('leaves a date after both open', () => {
    const locks = [company('2026-03-31'), branch(BRANCH_A, '2026-03-31')]

    expect(evaluatePeriodLock('2026-04-01', BRANCH_A, locks).locked).toBe(false)
  })
})

describe('the refusal explains itself', () => {
  it('carries the boundary and the reason', () => {
    const decision = evaluatePeriodLock('2026-03-15', null, [
      { branchId: null, lockedUntil: '2026-03-31', reason: 'audited' },
    ])

    expect(decision.lockedUntil).toBe('2026-03-31')
    expect(decision.reason).toBe('audited')
  })

  it('tolerates a timestamp where a date was expected', () => {
    // Dates arrive from several layers; one of them sends an ISO instant.
    // Comparing '2026-03-15T09:00:00Z' as a string against '2026-03-31' would
    // still work here, but the boundary case would not.
    const locks = [company('2026-03-31T23:59:59.000Z')]

    expect(evaluatePeriodLock('2026-03-31T09:00:00.000Z', null, locks).locked).toBe(true)
    expect(evaluatePeriodLock('2026-04-01T09:00:00.000Z', null, locks).locked).toBe(false)
  })
})
