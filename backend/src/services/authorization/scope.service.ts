// ============================================
// backend/src/services/authorization/scope.service.ts
//
// PHASE 3 — the one call a service makes before touching a specific row.
//
// ---------------------------------------------------------------------------
// WHAT WAS ACTUALLY MISSING
//
// `scope.domain.ts` could answer "may this actor touch this row" from the
// moment it was written, and nothing called it. Meanwhile `invoice.update`
// and `invoice.delete` filtered by `workspace_id` alone — so a seller could
// edit an invoice another seller raised, and a member pinned to Kabul could
// edit Herat's, by knowing an id.
//
// Workspace isolation was never broken: an outsider still gets nothing. What
// was missing is the delegation INSIDE a workspace, which is exactly what §8.4
// asks for and what a multi-branch shop needs before it can hand anyone a
// login.
//
// ---------------------------------------------------------------------------
// IT READS THE ROW BEFORE DECIDING
//
// One extra SELECT per guarded mutation. That is the cost of not trusting the
// caller's claim about which branch a row is in — and a claim from the client
// about the row it is editing is precisely the thing that must not be trusted.
// ============================================

import { supabase } from '../../db'
import { ForbiddenError } from '../../errors/auth.error'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { branches } from '../branch'
import type { TenancyContext } from '../tenancy.service'

import type { Capability } from './authorization.domain'
import { authorize, type ActorScope, type DenialReason } from './scope.domain'

/** Which column carries the branch and the creator, per guarded table. */
const SHAPE: Record<
  string,
  { table: string; branchColumn: string | null; ownerColumn: string | null }
> = {
  invoice: { table: 'invoices', branchColumn: 'branch_id', ownerColumn: 'user_id' },
  payment: { table: 'payments', branchColumn: 'branch_id', ownerColumn: 'user_id' },
  customer: { table: 'customers', branchColumn: null, ownerColumn: 'user_id' },
  product: { table: 'products', branchColumn: null, ownerColumn: 'user_id' },
}

/**
 * The message a refusal turns into.
 *
 * ⚠️ `WRONG_WORKSPACE` deliberately becomes a NOT FOUND. Telling somebody the
 * row exists but belongs to another workspace confirms it exists — and the
 * only person who benefits from that confirmation is the one probing for ids.
 * The other three refusals are safe to state plainly: the actor is already
 * inside the workspace and knowing why they were stopped helps them ask the
 * right person for access.
 */
function refuse(reason: DenialReason, resourceType: string): never {
  if (reason === 'WRONG_WORKSPACE') throw new NotFoundError(resourceType)
  throw new ForbiddenError(reason)
}

export class ScopeService {
  /**
   * The actor, with their branch assignment loaded.
   *
   * Not cached here. `branches.assignedBranchIds` has its own cache, and a
   * second layer over an authorization input is how a revoked assignment keeps
   * working for another five minutes.
   */
  async actorScope(ctx: TenancyContext): Promise<ActorScope> {
    const branchIds = await branches.assignedBranchIds(ctx.workspaceId, ctx.userId)
    return {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      role: ctx.role,
      branchIds,
    }
  }

  /**
   * May this actor perform this action on THIS row?
   *
   * Throws on refusal rather than returning a boolean, because the only
   * correct handling of a refusal at every call site is to stop — and a
   * boolean invites a call site that forgets to check it.
   */
  async assertMay(
    ctx: TenancyContext,
    resourceType: keyof typeof SHAPE | string,
    resourceId: string,
    action: Capability,
  ): Promise<void> {
    const shape = SHAPE[resourceType]
    if (!shape) {
      // An unguarded resource type is a programming error, not a permission
      // question. Failing closed here means adding a table to the guard is
      // deliberate rather than something that silently does nothing.
      throw new ForbiddenError('RESOURCE_NOT_GUARDED')
    }

    const columns = ['workspace_id', shape.branchColumn, shape.ownerColumn]
      .filter((column): column is string => column !== null)
      .join(', ')

    // ⚠️ `workspace_id` is filtered HERE, not only inside `authorize`.
    //
    // The first draft read the row by id alone and let `authorize` compare the
    // workspace afterwards. `tenancy-idor.test.ts` rejected it, and it was
    // right to: reading a foreign row at all — even to refuse it — makes this
    // the one query in the codebase that can touch another tenant's data, and
    // "we check it afterwards" is exactly the reasoning that fails the day
    // somebody reorders the function.
    //
    // With the filter, a foreign id simply is not found. The workspace branch
    // inside `authorize` is then defence in depth rather than the only guard.
    const { data, error } = await supabase
      .from(shape.table)
      .select(columns)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', resourceId)
      .maybeSingle()

    if (error) throw new DatabaseError(`Failed to read the ${resourceType}`, error)
    if (!data) throw new NotFoundError(resourceType)

    const row = data as unknown as Record<string, string | null>

    const decision = authorize({
      actor: await this.actorScope(ctx),
      resource: {
        workspaceId: row['workspace_id'] ?? '',
        branchId: shape.branchColumn ? (row[shape.branchColumn] ?? null) : null,
        ...(shape.ownerColumn ? { ownerId: row[shape.ownerColumn] ?? null } : {}),
      },
      resourceType,
      action,
    })

    if (!decision.allowed) refuse(decision.reason, resourceType)
  }

  /**
   * May this actor CREATE a row in this branch?
   *
   * Separate because there is no existing row to read. Without it the scope
   * would only ever be tested on read, and a member pinned to Kabul could file
   * a Herat invoice they then could not see.
   */
  async assertMayWriteToBranch(ctx: TenancyContext, branchId: string | null): Promise<void> {
    const { mayWriteToBranch } = await import('./scope.domain')
    if (!mayWriteToBranch(await this.actorScope(ctx), branchId)) {
      throw new ForbiddenError('OUT_OF_BRANCH_SCOPE')
    }
  }
}

export const scopes = new ScopeService()
