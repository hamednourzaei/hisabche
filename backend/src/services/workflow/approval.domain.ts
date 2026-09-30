// ============================================
// backend/src/services/workflow/approval.domain.ts
//
// A4 · Who must approve, what happens next, and what happens when nobody does.
//
// ---------------------------------------------------------------------------
// §17 ASKS FIVE QUESTIONS. THIS FILE ANSWERS FOUR OF THEM.
//
//   Where am I?            → `describeProgress`
//   What can I do?         → `actionsFor`
//   Why can't I do it?     → `explain.domain.ts`, already built
//   Who must approve?      → `resolveApprovers`
//   What happens next?     → `nextStepAfter`
//
// A workflow that cannot answer these is a status field with extra steps. The
// answers are computed rather than stored because the org changes underneath
// them: a person leaves, a threshold moves, somebody goes on leave. Stored
// answers go stale silently.
//
// ---------------------------------------------------------------------------
// AMOUNT ROUTING IS NOT A CONDITION, IT IS A LADDER
//
// "Over 50,000 needs the owner" is not one rule — it is a sorted set of
// thresholds where the HIGHEST one that applies wins. Modelling it as
// independent conditions lets two of them match and leaves the order to
// whichever was evaluated first, which is how a 200,000 invoice gets approved
// by a seller because their rule was defined earlier.
// ============================================

import type { WorkspaceRole } from '../authorization/authorization.domain'
import { ROLE_RANK } from '../authorization/authorization.domain'

/* ─── The approval matrix ─────────────────────────────────────────────────── */

export interface ApprovalTier {
  /** Applies at or above this amount, in MINOR units. */
  fromAmountMinor: number
  /** The lowest role that may approve at this tier. */
  role: WorkspaceRole
  /** How many distinct people must approve. 1 unless the money is large. */
  approvals: number
}

/**
 * The tier a given amount falls into.
 *
 * ⚠️ The HIGHEST matching threshold wins, so the tiers are sorted here rather
 * than trusted to arrive in order. A caller that stored them from a UI form
 * has no reason to have kept them sorted, and the failure would be silent:
 * a large invoice quietly approved at a small invoice's tier.
 */
export function tierFor(tiers: readonly ApprovalTier[], amountMinor: number): ApprovalTier | null {
  const applicable = tiers
    .filter((tier) => Math.abs(amountMinor) >= tier.fromAmountMinor)
    .sort((left, right) => right.fromAmountMinor - left.fromAmountMinor)

  return applicable[0] ?? null
}

/* ─── Who can actually approve ────────────────────────────────────────────── */

export interface Member {
  userId: string
  role: WorkspaceRole
  /** Empty means unrestricted — the same rule as everywhere else. */
  branchIds: readonly string[]
  /** Set while somebody is away. Their approvals pass to `delegateTo`. */
  absent?: boolean
  delegateTo?: string | null
}

export interface ApproverRequest {
  tier: ApprovalTier
  members: readonly Member[]
  /** The branch the document belongs to, or null for workspace-level. */
  branchId: string | null
  /** Who raised it. They may never approve their own. */
  raisedBy: string
  /** Who has already approved. */
  approvedBy: readonly string[]
}

export type ApprovalBlock =
  'NO_ELIGIBLE_APPROVER' | 'ONLY_THE_AUTHOR_IS_ELIGIBLE' | 'NOT_ENOUGH_APPROVERS'

export interface ApproverResolution {
  /** Who may approve right now. */
  eligible: string[]
  /** How many more approvals are needed. */
  outstanding: number
  /** Set when the document cannot proceed at all. */
  blocked: ApprovalBlock | null
}

/**
 * Who may approve this, now.
 *
 * Four filters, and the order matters only for what the caller is told:
 *
 *   1. rank    — holds the tier's role or better
 *   2. branch  — can reach the document's branch
 *   3. author  — never approves their own document
 *   4. already — has not already approved it
 *
 * ⚠️ Filter 3 is separation of duties in its smallest form, and it is the one
 * people ask to disable. It is not configurable here on purpose: a workflow
 * where the person who raised the invoice can also approve it is a workflow
 * that documents a decision nobody made.
 *
 * An absent member's eligibility passes to their delegate — but the delegate
 * must pass all four filters in their own right. Delegation moves WHO acts,
 * never WHAT they are allowed to do.
 */
export function resolveApprovers(request: ApproverRequest): ApproverResolution {
  const { tier, branchId, raisedBy, approvedBy } = request

  const reachesBranch = (member: Member) =>
    branchId === null || member.branchIds.length === 0 || member.branchIds.includes(branchId)

  const eligible = new Set<string>()
  let anyOfRank = false

  for (const member of request.members) {
    if (ROLE_RANK[member.role] < ROLE_RANK[tier.role]) continue
    anyOfRank = true

    if (!reachesBranch(member)) continue

    // An absent member is not eligible; their delegate might be. The delegate
    // is checked as themselves, so a seller cannot inherit an owner's
    // approval by being named as a stand-in.
    const actingUserId = member.absent ? (member.delegateTo ?? null) : member.userId
    if (!actingUserId) continue

    if (member.absent) {
      const delegate = request.members.find((candidate) => candidate.userId === actingUserId)
      if (!delegate) continue
      if (ROLE_RANK[delegate.role] < ROLE_RANK[tier.role]) continue
      if (!reachesBranch(delegate)) continue
    }

    if (actingUserId === raisedBy) continue
    if (approvedBy.includes(actingUserId)) continue

    eligible.add(actingUserId)
  }

  const outstanding = Math.max(0, tier.approvals - approvedBy.length)

  let blocked: ApprovalBlock | null = null
  if (outstanding > 0 && eligible.size === 0) {
    // Told apart deliberately. "Nobody has that role" and "the only person who
    // does is the one who raised it" send the user to two different fixes.
    blocked = anyOfRank ? 'ONLY_THE_AUTHOR_IS_ELIGIBLE' : 'NO_ELIGIBLE_APPROVER'
  } else if (outstanding > eligible.size && eligible.size > 0) {
    blocked = 'NOT_ENOUGH_APPROVERS'
  }

  return { eligible: [...eligible].sort(), outstanding, blocked }
}

/* ─── Where am I, and what happens next ───────────────────────────────────── */

export interface WorkflowStep {
  stepOrder: number
  role: WorkspaceRole
  isFinal: boolean
}

export interface Progress {
  currentStep: number
  totalSteps: number
  /** i18n key for the state in business language. */
  statusKey: string
  /** What happens when this step is approved. */
  nextKey: string
  isFinalStep: boolean
}

export function nextStepAfter(
  steps: readonly WorkflowStep[],
  currentStep: number,
): WorkflowStep | null {
  return steps.find((step) => step.stepOrder > currentStep) ?? null
}

/**
 * The sentence a user reads at the top of a document awaiting approval.
 *
 * §17 wants business language, not `status: pending_2`. The key names the
 * outcome — "posted to the ledger" — rather than the mechanism, because the
 * person waiting cares what becomes true, not which row updates.
 */
export function describeProgress(steps: readonly WorkflowStep[], currentStep: number): Progress {
  const total = steps.length
  const next = nextStepAfter(steps, currentStep)
  const isFinalStep = next === null

  return {
    currentStep,
    totalSteps: total,
    statusKey: currentStep === 0 ? 'workflow.state.draft' : 'workflow.state.waiting',
    // The final approval POSTS. Every earlier one just moves it along, and
    // saying "approved" at both makes the last click feel the same as the
    // first — which is exactly the click that should not.
    nextKey: isFinalStep ? 'workflow.next.posts' : 'workflow.next.goes_to',
    isFinalStep,
  }
}

/* ─── When nobody acts ────────────────────────────────────────────────────── */

// ⚠️ Escalation moved to `./escalation.domain.ts` on 30 September 2026, which is
// capability #68 of the Business OS. `shouldEscalate` and `escalatedRole` lived
// here, complete and tested, with no caller in the repository — the `§7.1`
// pattern of "correct code nobody can find". They were on the unwired register
// until the new module gave them one.
//
// ⚠️ THE NEW VERSION CHECKS SOMETHING THESE NEVER DID: whether the target role
// HOLDS ANYBODY. `escalatedRole('manager', {toRole: 'owner'})` returned `'owner'`
// whether an owner existed or not, so a shop with no owner escalated a document
// into an empty room and the workflow sat there forever with a log entry saying
// it had moved. `decideEscalation` reports `NO_ONE_TO_ESCALATE_TO` instead.
//
// The ROLE_ORDER ladder is also spelled out there rather than derived from
// `ROLE_RANK`, because "higher" for escalation is a different question from
// "higher" for capability checks.
