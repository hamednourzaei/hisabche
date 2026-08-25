// ============================================
// backend/src/services/tenancy.service.ts
//
// The single place that answers: WHICH WORKSPACE IS THIS REQUEST ALLOWED TO
// TOUCH? Every read and write of invoices, customers, products and
// transactions must scope itself with a workspace id that came from here.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS AND WHY THE OLD RESOLVERS ARE NOT REUSED
//
// Three functions already resolved a workspace before this one:
//
//   auth.middleware.ts      membership?.workspace_id || ''
//   invoice.service.ts      membership?.workspace_id ?? userId
//   event-log.service.ts    membership?.workspace_id ?? userId
//
// All three FAIL OPEN. Two return the USER's id as a workspace id — a
// fabricated tenancy boundary living in the same UUID space as real ones. The
// third returns '' and, in the same object, `role: 'admin'`.
//
// That was survivable while a workspace id only stamped an activity row. The
// moment it decides which invoices a shopkeeper sees, a fail-open resolver is
// a cross-tenant read. So this module fails CLOSED: no membership, no access,
// no data — a 403, never an empty filter and never a guess.
//
// ---------------------------------------------------------------------------
// THE AUTHORIZATION CHAIN
//
//   authenticated user  ->  workspace_members  ->  has_access = true
//                       ->  suspended_at IS NULL  ->  authorized workspace
//
// A workspace id in a request body is a REQUEST, not an authorization. It is
// checked against this chain like any other, and rejected if the user is not a
// member. There is no path from `request.body.workspaceId` to a query.
//
// ---------------------------------------------------------------------------
// PLATFORM ADMIN IS NOT A WORKSPACE ROLE
//
// Nothing in this file knows or asks whether the caller is a platform admin.
// That is deliberate and load-bearing. Platform administration
// (ADMIN_ALLOWED_EMAILS, platformAdminGuard, the Admin Panel) and workspace
// authorization are separate security domains. A platform admin who is not in
// `workspace_members` gets exactly what any other non-member gets from this
// module: 403. Adding a bypass here would silently turn the admin allowlist
// into read access over every customer's books.
// ============================================

import { supabase } from '../db'
import { ForbiddenError } from '../errors/auth.error'
import { DatabaseError } from '../errors/database.error'

/** The workspace roles. Platform admin is deliberately absent — see above. */
export const WORKSPACE_ROLES = ['owner', 'manager', 'seller'] as const
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number]

export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return typeof value === 'string' && (WORKSPACE_ROLES as readonly string[]).includes(value)
}

/**
 * A verified answer to "this user may act in this workspace as this role".
 * Nothing downstream should construct one of these by hand.
 */
export interface TenancyContext {
  /** The authorized tenancy boundary. Safe to put in a WHERE clause. */
  readonly workspaceId: string
  /** The actor. Recorded on mutations; never used as a tenancy boundary. */
  readonly userId: string
  readonly role: WorkspaceRole
}

interface MembershipRow {
  workspace_id: string
  role: string | null
  has_access: boolean | null
  suspended_at: string | null
}

const MEMBERSHIP_COLUMNS = 'workspace_id, role, has_access, suspended_at'

/**
 * Every workspace the user may currently act in, oldest membership first.
 *
 * Ordering by `joined_at` is what makes single-workspace resolution
 * deterministic. The previous `.limit(1)` with no ORDER BY let PostgreSQL
 * return whichever row it liked, so a user in two workspaces could open a
 * different set of books on two consecutive requests.
 */
export async function listAuthorizedWorkspaces(userId: string): Promise<TenancyContext[]> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select(MEMBERSHIP_COLUMNS)
    .eq('user_id', userId)
    .eq('has_access', true)
    .is('suspended_at', null)
    .order('joined_at', { ascending: true })

  if (error) throw new DatabaseError('Failed to resolve workspace membership', error)

  return (data ?? [])
    .filter((row): row is MembershipRow => Boolean(row?.workspace_id))
    .map((row) => ({
      workspaceId: row.workspace_id,
      userId,
      // An unrecognised or NULL role degrades to the LEAST privilege, not the
      // most. The old code defaulted a missing membership to 'admin', which
      // workflow.service.ts then accepted as an approver override.
      role: isWorkspaceRole(row.role) ? row.role : 'seller',
    }))
}

/**
 * Resolve the workspace this request may act on, or throw.
 *
 * `requestedWorkspaceId` — typically from a header, query or body — is treated
 * strictly as a TARGET to be verified. If the user is not an active member of
 * it, this throws; it is never trusted and never falls back to another
 * workspace.
 *
 * With no requested id and exactly one membership, that membership is used.
 * With no requested id and several memberships, this throws rather than
 * choosing: which book to open is a product decision the data cannot make, and
 * guessing it silently would post a sale into the wrong business.
 */
export async function requireWorkspace(
  userId: string,
  requestedWorkspaceId?: string | null,
): Promise<TenancyContext> {
  if (!userId) throw new ForbiddenError('Not authenticated')

  const authorized = await listAuthorizedWorkspaces(userId)

  if (authorized.length === 0) {
    // Covers all of: never onboarded, removed from the workspace, has_access
    // revoked, suspended, and platform admin who is not a member.
    throw new ForbiddenError('No active workspace membership')
  }

  if (requestedWorkspaceId) {
    const match = authorized.find((ctx) => ctx.workspaceId === requestedWorkspaceId)
    if (!match) {
      // Deliberately the same message and status as "no membership": telling a
      // caller apart "that workspace exists but is not yours" from "no such
      // workspace" leaks which workspace ids are real.
      throw new ForbiddenError('No active workspace membership')
    }
    return match
  }

  const sole = authorized[0]
  if (authorized.length > 1 || !sole) {
    throw new ForbiddenError(
      'Multiple workspaces available; an explicit workspace must be selected',
    )
  }

  return sole
}

/**
 * Assert a minimum role within an ALREADY-resolved context.
 *
 * Takes a TenancyContext rather than a user id so it cannot be called before
 * membership has been verified — the type makes the unsafe ordering
 * unexpressible.
 */
const ROLE_RANK: Record<WorkspaceRole, number> = { seller: 1, manager: 2, owner: 3 }

export function requireRole(ctx: TenancyContext, minimum: WorkspaceRole): void {
  if (ROLE_RANK[ctx.role] < ROLE_RANK[minimum]) {
    throw new ForbiddenError(`Requires ${minimum} role in this workspace`)
  }
}
