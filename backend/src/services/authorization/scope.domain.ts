// ============================================
// backend/src/services/authorization/scope.domain.ts
//
// PHASE 3 / §8.4 — Subject + Resource + Action + Scope.
//
// ---------------------------------------------------------------------------
// WHAT THIS ADDS TO WHAT ALREADY EXISTS
//
// `authorization.domain.ts` answers three questions: may this ROLE do this at
// all (capability), which ROWS may they touch (record), and which COLUMNS may
// they read (field). All three are answered inside one workspace.
//
// This file adds the fourth: WHERE. A sales manager for Kabul and Herat may
// hold `invoice.update` and still have no business editing the Kandahar
// branch's invoices. Without a scope check, "manager" means "manager
// everywhere", and a multi-branch shop cannot delegate anything without
// delegating all of it.
//
// ---------------------------------------------------------------------------
// AN EMPTY SCOPE MEANS EVERYWHERE, DELIBERATELY
//
// A member with no branches assigned is unrestricted, not locked out. This is
// the same decision `branch.service.ts` already made and it is recorded in
// `.claude/README.md` as settled: the alternative is that the day branch
// scoping shipped, every existing member in every existing workspace lost
// access to everything at once.
//
// The cost is that scoping is opt-in and someone must remember to set it. That
// is a real cost, and it is smaller than a product-wide lockout.
//
// ---------------------------------------------------------------------------
// PURE. NO DATABASE.
//
// The caller loads the member's assignment and the resource's branch, then
// asks. Keeping the decision pure is what lets every branch of it be tested,
// including the ones a live database makes awkward to reach.
// ============================================

import type { Capability, WorkspaceRole } from './authorization.domain'
import { can } from './authorization.domain'

/**
 * Where an actor may act.
 *
 * `branchIds` empty means every branch — see the note above. It is spelled as
 * an empty array rather than `null` so callers cannot forget the case: an
 * empty array still has `.includes`, and `null` would throw.
 */
export interface ActorScope {
  readonly workspaceId: string
  readonly userId: string
  readonly role: WorkspaceRole
  /** Empty = unrestricted. Non-empty = only these. */
  readonly branchIds: readonly string[]
}

/**
 * Where a thing lives.
 *
 * `branchId` null means the resource belongs to no branch — a workspace-level
 * setting, or a row created before branches existed. Those are visible to
 * everyone who holds the capability, because the alternative is that turning
 * branches on hides the shop's entire history.
 */
export interface ResourceScope {
  readonly workspaceId: string
  readonly branchId: string | null
  /** Who created it. Used only for the seller's own-rows rule. */
  readonly ownerId?: string | null
}

export type ScopeDecision =
  | { allowed: true }
  | {
      allowed: false
      reason: 'WRONG_WORKSPACE' | 'MISSING_CAPABILITY' | 'OUT_OF_BRANCH_SCOPE' | 'NOT_OWN_RECORD'
    }

/**
 * Resources a seller may touch only when they created them.
 *
 * Mirrors `recordScope` in `authorization.domain.ts` rather than restating it
 * loosely: a seller sees the invoices and payments they raised, and the shared
 * catalogue is shared.
 */
const OWN_RECORD_ONLY: Record<string, boolean> = {
  invoice: true,
  payment: true,
  customer: false,
  product: false,
}

/**
 * The whole question, answered once.
 *
 * The order of the checks is the order of severity, and it matters for what
 * the caller is told: a wrong workspace is never described as a branch
 * problem, because that would confirm to an outsider that the resource exists.
 */
export function authorize(input: {
  actor: ActorScope
  resource: ResourceScope
  resourceType: string
  action: Capability
}): ScopeDecision {
  const { actor, resource } = input

  // 1. Tenancy. The only real security boundary; everything after this is
  //    delegation inside a workspace the actor already belongs to.
  if (actor.workspaceId !== resource.workspaceId) {
    return { allowed: false, reason: 'WRONG_WORKSPACE' }
  }

  // 2. Capability. May this role do this at all, anywhere.
  if (!can(actor.role, input.action)) {
    return { allowed: false, reason: 'MISSING_CAPABILITY' }
  }

  // 3. Branch scope.
  if (
    actor.branchIds.length > 0 &&
    resource.branchId !== null &&
    !actor.branchIds.includes(resource.branchId)
  ) {
    return { allowed: false, reason: 'OUT_OF_BRANCH_SCOPE' }
  }

  // 4. Record ownership, for sellers only. An owner or manager acting on a
  //    row somebody else created is the normal running of a shop.
  if (
    actor.role === 'seller' &&
    OWN_RECORD_ONLY[input.resourceType] === true &&
    resource.ownerId !== undefined &&
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
 * dangerous way to get this wrong: it fails quiet, showing an empty list that
 * looks like an empty shop.
 */
export function branchFilterFor(actor: ActorScope): readonly string[] | null {
  return actor.branchIds.length > 0 ? actor.branchIds : null
}

/**
 * May this actor write a resource INTO this branch?
 *
 * Separate from `authorize` because creating carries no existing row to check.
 * A member scoped to Kabul must not file a Herat invoice, and without this the
 * scope would only ever be checked on read.
 */
export function mayWriteToBranch(actor: ActorScope, branchId: string | null): boolean {
  if (branchId === null) return true
  if (actor.branchIds.length === 0) return true
  return actor.branchIds.includes(branchId)
}
