// ============================================
// Who must approve, and what happens when nobody does.
//
// The rules that are easy to get subtly wrong and impossible to notice:
// which tier a large amount lands in, whether the author can approve their
// own, and whether a delegate inherits authority they do not hold.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  describeProgress,
  nextStepAfter,
  resolveApprovers,
  tierFor,
  type ApprovalTier,
  type Member,
} from '../services/workflow/approval.domain'

const TIERS: ApprovalTier[] = [
  { fromAmountMinor: 0, role: 'seller', approvals: 1 },
  { fromAmountMinor: 5_000_00, role: 'manager', approvals: 1 },
  { fromAmountMinor: 50_000_00, role: 'owner', approvals: 2 },
]

describe('the approval matrix is a ladder, not a set of conditions', () => {
  it('picks the HIGHEST threshold that applies', () => {
    // Independent conditions would let two match and leave the order to
    // whichever was evaluated first — which is how a 200,000 invoice gets
    // approved by a seller.
    expect(tierFor(TIERS, 200_000_00)?.role).toBe('owner')
    expect(tierFor(TIERS, 6_000_00)?.role).toBe('manager')
    expect(tierFor(TIERS, 100_00)?.role).toBe('seller')
  })

  it('sorts the tiers itself rather than trusting their order', () => {
    // A caller that stored these from a UI form has no reason to have kept
    // them sorted, and the failure would be silent.
    const shuffled = [TIERS[2]!, TIERS[0]!, TIERS[1]!]
    expect(tierFor(shuffled, 200_000_00)?.role).toBe('owner')
  })

  it('routes a large REFUND the same as a large charge', () => {
    // Money leaving is at least as consequential as money arriving.
    expect(tierFor(TIERS, -200_000_00)?.role).toBe('owner')
  })

  it('requires two people once the amount is large enough', () => {
    expect(tierFor(TIERS, 200_000_00)?.approvals).toBe(2)
  })
})

/* ─── Who may approve ─────────────────────────────────────────────────────── */

const member = (over: Partial<Member> & Pick<Member, 'userId' | 'role'>): Member => ({
  branchIds: [],
  ...over,
})

const OWNER = member({ userId: 'owner-1', role: 'owner' })
const MANAGER = member({ userId: 'mgr-1', role: 'manager' })
const SELLER = member({ userId: 'sell-1', role: 'seller' })

const ask = (over: Partial<Parameters<typeof resolveApprovers>[0]> = {}) =>
  resolveApprovers({
    tier: { fromAmountMinor: 0, role: 'manager', approvals: 1 },
    members: [OWNER, MANAGER, SELLER],
    branchId: null,
    raisedBy: 'sell-1',
    approvedBy: [],
    ...over,
  })

describe('rank', () => {
  it('includes everyone at or above the tier', () => {
    expect(ask().eligible).toEqual(['mgr-1', 'owner-1'])
  })

  it('excludes those below it', () => {
    expect(ask().eligible).not.toContain('sell-1')
  })
})

describe('nobody approves their own document', () => {
  it('excludes the author even when they hold the role', () => {
    // A workflow where the person who raised the invoice can approve it
    // documents a decision nobody made.
    const resolution = ask({ raisedBy: 'mgr-1' })
    expect(resolution.eligible).toEqual(['owner-1'])
  })

  it('says so distinctly when the author is the ONLY one who could', () => {
    // "Nobody has that role" and "the only person who does raised it" send
    // the user to two different fixes.
    const resolution = ask({ members: [MANAGER, SELLER], raisedBy: 'mgr-1' })
    expect(resolution.blocked).toBe('ONLY_THE_AUTHOR_IS_ELIGIBLE')
  })

  it('reports no eligible approver when nobody holds the rank at all', () => {
    const resolution = ask({ members: [SELLER], raisedBy: 'sell-1' })
    expect(resolution.blocked).toBe('NO_ELIGIBLE_APPROVER')
  })
})

describe('branch scope applies to approvers too', () => {
  it('excludes a manager who cannot reach the branch', () => {
    const kabulOnly = member({ userId: 'mgr-kabul', role: 'manager', branchIds: ['kabul'] })
    const resolution = ask({ members: [kabulOnly], branchId: 'herat' })
    expect(resolution.eligible).toEqual([])
  })

  it('includes an unrestricted one', () => {
    const resolution = ask({ members: [MANAGER], branchId: 'herat' })
    expect(resolution.eligible).toEqual(['mgr-1'])
  })
})

describe('delegation moves WHO acts, never WHAT they may do', () => {
  it('passes an absent approver to their delegate', () => {
    const away = member({ userId: 'mgr-1', role: 'manager', absent: true, delegateTo: 'owner-1' })
    const resolution = ask({ members: [away, OWNER] })
    expect(resolution.eligible).toContain('owner-1')
    expect(resolution.eligible).not.toContain('mgr-1')
  })

  it('refuses a delegate who does not hold the role themselves', () => {
    // Otherwise a seller inherits an owner's authority by being named as a
    // stand-in, which is a privilege escalation with a friendly name.
    const away = member({ userId: 'mgr-1', role: 'manager', absent: true, delegateTo: 'sell-2' })
    const junior = member({ userId: 'sell-2', role: 'seller' })
    const resolution = ask({ members: [away, junior], raisedBy: 'nobody' })
    expect(resolution.eligible).toEqual([])
  })

  it('refuses a delegate who cannot reach the branch', () => {
    const away = member({ userId: 'mgr-1', role: 'manager', absent: true, delegateTo: 'mgr-2' })
    const other = member({ userId: 'mgr-2', role: 'manager', branchIds: ['kabul'] })
    const resolution = ask({ members: [away, other], branchId: 'herat', raisedBy: 'nobody' })
    expect(resolution.eligible).toEqual([])
  })

  it('drops an absent approver with no delegate', () => {
    const away = member({ userId: 'mgr-1', role: 'manager', absent: true, delegateTo: null })
    expect(ask({ members: [away], raisedBy: 'nobody' }).eligible).toEqual([])
  })
})

describe('two-person approval', () => {
  const twoTier = { fromAmountMinor: 0, role: 'owner' as const, approvals: 2 }

  it('counts what is still outstanding', () => {
    const owner2 = member({ userId: 'owner-2', role: 'owner' })
    const resolution = resolveApprovers({
      tier: twoTier,
      members: [OWNER, owner2],
      branchId: null,
      raisedBy: 'sell-1',
      approvedBy: ['owner-1'],
    })
    expect(resolution.outstanding).toBe(1)
    expect(resolution.eligible).toEqual(['owner-2'])
  })

  it('never lets the same person approve twice', () => {
    const resolution = resolveApprovers({
      tier: twoTier,
      members: [OWNER],
      branchId: null,
      raisedBy: 'sell-1',
      approvedBy: ['owner-1'],
    })
    expect(resolution.eligible).toEqual([])
    expect(resolution.blocked).toBe('ONLY_THE_AUTHOR_IS_ELIGIBLE')
  })

  it('flags when there are simply not enough people', () => {
    const resolution = resolveApprovers({
      tier: twoTier,
      members: [OWNER],
      branchId: null,
      raisedBy: 'sell-1',
      approvedBy: [],
    })
    expect(resolution.blocked).toBe('NOT_ENOUGH_APPROVERS')
  })
})

/* ─── Progress ────────────────────────────────────────────────────────────── */

const STEPS = [
  { stepOrder: 1, role: 'manager' as const, isFinal: false },
  { stepOrder: 2, role: 'owner' as const, isFinal: true },
]

describe('what happens next', () => {
  it('says the final approval POSTS, not merely approves', () => {
    // Saying "approved" at both makes the last click feel like the first —
    // and it is exactly the click that should not.
    expect(describeProgress(STEPS, 2).nextKey).toBe('workflow.next.posts')
    expect(describeProgress(STEPS, 1).nextKey).toBe('workflow.next.goes_to')
  })

  it('finds the next step', () => {
    expect(nextStepAfter(STEPS, 1)?.stepOrder).toBe(2)
    expect(nextStepAfter(STEPS, 2)).toBeNull()
  })

  it('uses i18n keys, never a sentence', () => {
    const progress = describeProgress(STEPS, 1)
    expect(progress.statusKey).toMatch(/^workflow\./)
    expect(progress.nextKey).toMatch(/^workflow\./)
  })
})

/* ─── Escalation ──────────────────────────────────────────────────────────── */

// ⚠️ MOVED to `escalation.domain.ts` on 30 September 2026 — capability #68.
//
// The tests that lived here covered `shouldEscalate` and `escalatedRole`, which
// were correct and called by nothing. The replacements are in
// `escalation-and-compensation.test.ts`, and they cover the same three
// boundaries PLUS the one the old pair never checked: whether the target role
// holds anybody at all. `escalatedRole('manager', {toRole: 'owner'})` returned
// `'owner'` in a workspace with no owner, so the document escalated into an
// empty room and sat there forever with a log entry saying it had moved.

describe('escalation is owned by escalation.domain', () => {
  it('the old functions are gone from approval.domain', () => {
    // A source assertion rather than an import, because an import of a removed
    // export fails at compile time and would take the whole file with it.
    const source = readFileSync(
      join(__dirname, '..', 'services/workflow/approval.domain.ts'),
      'utf8',
    )
    expect(source).not.toMatch(/export function shouldEscalate/)
    expect(source).not.toMatch(/export function escalatedRole/)
  })
})
