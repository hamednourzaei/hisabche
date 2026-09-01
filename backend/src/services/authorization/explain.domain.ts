// ============================================
// backend/src/services/authorization/explain.domain.ts
//
// A1 · §17 — "Why can't I do it?", answered in business language.
//
// ---------------------------------------------------------------------------
// A REFUSAL THE USER CANNOT ACT ON IS A BUG WITH GOOD MANNERS
//
// `403 MISSING_CAPABILITY` tells a shopkeeper nothing. They cannot tell
// whether they clicked the wrong thing, whether the feature is broken, or
// whether they need to ask somebody for something — and the third is almost
// always the answer.
//
// So every refusal resolves to three things:
//
//   what      the rule that stopped you
//   why       in the shop's own terms, not the system's
//   who       the person who can change it
//
// The third is the one that matters. "Ask the owner" turns a dead end into a
// message someone can send.
//
// ---------------------------------------------------------------------------
// IT NEVER LEAKS WHAT IT REFUSED
//
// `WRONG_WORKSPACE` is absent from this file on purpose. That case is reported
// as NOT FOUND everywhere else precisely so an outsider cannot confirm a row
// exists, and an explanation endpoint that helpfully said "that belongs to
// another workspace" would undo it in one sentence.
// ============================================

import type { Capability, WorkspaceRole } from './authorization.domain'
import { ROLE_RANK } from './authorization.domain'

/** Refusals a member INSIDE the workspace can be told about. */
export type ExplainableRefusal =
  'MISSING_CAPABILITY' | 'OUT_OF_BRANCH_SCOPE' | 'NOT_OWN_RECORD' | 'SOD_CONFLICT' | 'PERIOD_LOCKED'

export interface Explanation {
  readonly refusal: ExplainableRefusal
  /** i18n key for the sentence. Never text. */
  readonly reasonKey: string
  /** Who can lift it. This is the actionable half. */
  readonly resolvedBy: 'owner' | 'manager' | 'nobody'
  /** The role that would hold this capability, when that is the problem. */
  readonly requiredRole?: WorkspaceRole
  /** True when waiting changes nothing and only a person can act. */
  readonly needsSomeoneElse: boolean
}

const RESOLUTION: Record<
  ExplainableRefusal,
  { reasonKey: string; resolvedBy: Explanation['resolvedBy'] }
> = {
  MISSING_CAPABILITY: {
    reasonKey: 'authz.reason.missing_capability',
    resolvedBy: 'owner',
  },
  OUT_OF_BRANCH_SCOPE: {
    reasonKey: 'authz.reason.out_of_branch',
    resolvedBy: 'owner',
  },
  NOT_OWN_RECORD: {
    // A manager can act on it for them, which is usually faster than changing
    // anybody's role.
    reasonKey: 'authz.reason.not_own_record',
    resolvedBy: 'manager',
  },
  SOD_CONFLICT: {
    // Separation of duties is the one refusal that is WORKING when it fires.
    // Nobody should "fix" it by handing the same person both duties.
    reasonKey: 'authz.reason.sod_conflict',
    resolvedBy: 'nobody',
  },
  PERIOD_LOCKED: {
    reasonKey: 'authz.reason.period_locked',
    resolvedBy: 'owner',
  },
}

/**
 * The lowest role that could perform this action.
 *
 * Told to the user as "a manager can do this", which is more useful than the
 * capability name — nobody outside the codebase knows what `ledger.post` is.
 */
export function roleThatCould(
  minRoleFor: (capability: Capability) => WorkspaceRole,
  capability: Capability,
): WorkspaceRole {
  return minRoleFor(capability)
}

export function explain(
  refusal: ExplainableRefusal,
  context: { requiredRole?: WorkspaceRole } = {},
): Explanation {
  const resolution = RESOLUTION[refusal]

  return {
    refusal,
    reasonKey: resolution.reasonKey,
    resolvedBy: resolution.resolvedBy,
    ...(context.requiredRole ? { requiredRole: context.requiredRole } : {}),
    // Every one of these needs a human except the SoD conflict, which needs a
    // different human entirely — the point of the rule is that the same person
    // may not do both halves.
    needsSomeoneElse: resolution.resolvedBy !== 'nobody',
  }
}

/**
 * Would raising this actor's role fix it?
 *
 * Answers the question a user actually asks — "do I need more access, or is
 * this something else?" — without them having to learn the capability model.
 *
 * ⚠️ A branch scope is deliberately NOT fixed by a higher role: an owner
 * pinned to Kabul is still pinned to Kabul, and saying otherwise would send
 * someone to ask for a promotion that changes nothing.
 */
export function wouldAHigherRoleHelp(
  refusal: ExplainableRefusal,
  actual: WorkspaceRole,
  required: WorkspaceRole,
): boolean {
  if (refusal !== 'MISSING_CAPABILITY' && refusal !== 'NOT_OWN_RECORD') return false
  return ROLE_RANK[actual] < ROLE_RANK[required]
}
