// ============================================
// backend/src/services/authorization/scope.domain.ts
//
// PHASE 3 / §8.4 — Subject + Resource + Action + Scope, in one answer.
//
// ---------------------------------------------------------------------------
// THIS FILE COMPOSES; IT DOES NOT RE-DECIDE
//
// Three rules already exist and are already enforced:
//
//   workspace   `TenancyContext` — the only security boundary
//   capability  `can(role, capability)` in authorization.domain.ts
//   branch      `mayUseBranch(scope, branchId)` in branch/branch.domain.ts
//
// What did NOT exist was one place that asks all three in the right order, so
// every route asked whichever subset its author remembered. This is that place.
//
// ⚠️ It deliberately re-exports nothing and re-implements nothing. An earlier
// draft of this file restated the branch rule and got it backwards — it let a
// branch-scoped member see rows with no branch, while `mayUseBranch` refuses
// them. Two answers to one question is how a security rule quietly stops being
// a rule. The branch decision belongs to `branch.domain.ts`; this file asks it.
//
// ---------------------------------------------------------------------------
// PURE. NO DATABASE.
//
// The caller loads the member's branch assignment and the resource's branch,
// then asks. Keeping the decision pure is what lets every branch of it be
// tested, including the ones a live database makes awkward to reach.
// ============================================

import { branchScopeFor, mayUseBranch, type BranchScope } from '../branch/branch.domain'
import type { Capability, WorkspaceRole } from './authorization.domain'
import { can } from './authorization.domain'

/**
 * Where an actor may act.
 *
 * `branchIds` is the RAW assignment, exactly as `member_branches` stores it.
 * Empty means unrestricted — that interpretation lives in `branchScopeFor`,
 * not here, so this type stays a description of the database rather than a
 * second opinion about it.
 */
export interface ActorScope {
  readonly workspaceId: string
  readonly userId: string
  readonly role: WorkspaceRole
  readonly branchIds: readonly string[]
}

/**
 * Where a thing lives.
 *
 * `branchId` null means the row belongs to the workspace as a whole — a
 * setting, or something created before branches existed.
 */
export interface ResourceScope {
  readonly workspaceId: string
  readonly branchId: string | null
  /** Who created it. Used only for the seller's own-rows rule. */
  readonly ownerId?: string | null
}

export type DenialReason =
  'WRONG_WORKSPACE' | 'MISSING_CAPABILITY' | 'OUT_OF_BRANCH_SCOPE' | 'NOT_OWN_RECORD'

export type ScopeDecision = { allowed: true } | { allowed: false; reason: DenialReason }

/**
 * Resources a seller may touch only when they created them.
 *
 * Mirrors `recordScope` in `authorization.domain.ts`: a seller sees the
 * invoices and payments they raised, and the shared catalogue is shared.
 */
const OWN_RECORD_ONLY: Record<string, boolean> = {
  invoice: true,
  payment: true,
  customer: false,
  product: false,
}

export function scopeOf(actor: ActorScope): BranchScope {
  return branchScopeFor([...actor.branchIds])
}

/**
 * The whole question, answered once.
 *
 * The order of the checks is the order of severity, and it matters for what
 * the caller is told: a wrong workspace is never described as a branch
 * problem, because that would confirm to an outsider that the resource exists
 * and merely sits somewhere they cannot reach.
 */
export function authorize(input: {
  actor: ActorScope
  resource: ResourceScope
  resourceType: string
  action: Capability
}): ScopeDecision {
  const { actor, resource } = input

  // 1. Tenancy. The only real security boundary; everything after it is
  //    delegation inside a workspace the actor already belongs to.
  if (actor.workspaceId !== resource.workspaceId) {
    return { allowed: false, reason: 'WRONG_WORKSPACE' }
  }

  // 2. Capability. May this role do this at all, anywhere.
  if (!can(actor.role, input.action)) {
    return { allowed: false, reason: 'MISSING_CAPABILITY' }
  }

  // 3. Branch — asked of the module that owns the rule.
  if (!mayUseBranch(scopeOf(actor), resource.branchId)) {
    return { allowed: false, reason: 'OUT_OF_BRANCH_SCOPE' }
  }

  // 4. Record ownership, for sellers only. An owner or manager acting on a row
  //    somebody else created is the normal running of a shop.
  if (
    actor.role === 'seller' &&
    OWN_RECORD_ONLY[input.resourceType] === true &&
    resource.ownerId !== undefined &&
    resource.ownerId !== null &&
    resource.ownerId !== actor.userId
  ) {
    return { allowed: false, reason: 'NOT_OWN_RECORD' }
  }

  return { allowed: true }
}

/**
 * The branch filter a query should apply.
 *
 * `null` means "do not filter" — an unrestricted actor. Returning an empty
 * array for that case would be a filter matching nothing, which is the
 * dangerous way to get this wrong: it fails QUIET, showing an empty list that
 * looks like an empty shop rather than like a bug.
 */
export function branchFilterFor(actor: ActorScope): readonly string[] | null {
  const scope = scopeOf(actor)
  if (scope.kind === 'limited') return scope.branchIds
  // `none` cannot arise from `branchScopeFor`, which only returns `all` or
  // `limited`. It is handled rather than assumed away, because a future caller
  // constructing a scope by hand could produce it, and the safe reading of "no
  // access" is a filter that matches nothing — not one that matches all.
  if (scope.kind === 'none') return []
  return null
}

/**
 * May this actor write a resource INTO this branch?
 *
 * Separate from `authorize` because creating carries no existing row to check.
 * Without it the scope would only ever be tested on read, and a member pinned
 * to Kabul could file a Herat invoice they then could not see.
 */
export function mayWriteToBranch(actor: ActorScope, branchId: string | null): boolean {
  const scope = scopeOf(actor)
  // Writing a workspace-level row is allowed for anyone who got this far:
  // unlike reading, it does not expose another branch's data.
  if (branchId === null) return scope.kind !== 'none'
  return mayUseBranch(scope, branchId)
}
