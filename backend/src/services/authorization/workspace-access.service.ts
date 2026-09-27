// ============================================
// backend/src/services/authorization/workspace-access.service.ts
//
// The request's authorization context — membership, role, capabilities,
// page blocks — in ONE database round trip (27 Sep 2026).
//
// WHY: requireWorkspaceContext read workspace_members, and only then (it needs
// the workspace) role capabilities and page blocks. The database answers each
// in ~0.15 ms; the network between the API (Render, Oregon) and the database
// (ap-southeast-2) costs ~150–300 ms per hop. Two sequential hops were the
// floor of every request. docs/workspace-access-rpc-migration.sql returns all
// three from one call.
//
// ⚠️ SAME RULES, ONE SOURCE. The RPC only READS. The decisions are made here,
// by the very functions the old path uses: chooseWorkspace (which book),
// resolveWorkspaceRole (which role), parseOverrides / parseBlocks (which rows
// count), effectiveCapabilities + restrictByModuleBlocks (what they add up
// to). The two paths cannot disagree.
//
// ⚠️ NOTHING HERE IS CACHED. An authorization decision is not read from this
// process's memory (see memoryCache.getShared); one round trip is already the
// cost a shared-cache read would have.
//
// Before the migration has run: PostgREST answers PGRST202 (or Postgres
// 42883). That — and only that — falls back to the previous path, and is
// remembered for a minute so every request does not pay a failed call first.
// Any other error is thrown: it is never read as «no access» or «no blocks».
// ============================================

import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import {
  chooseWorkspace,
  requireWorkspace,
  resolveWorkspaceRole,
  type TenancyContext,
} from '../tenancy.service'
import { effectiveCapabilities, restrictByModuleBlocks } from './authorization.domain'
import { memberModuleBlocks, parseBlocks } from './member-module-blocks.service'
import { parseOverrides, roleCapabilities } from './role-capabilities.service'

const FUNCTION_MISSING = new Set(['PGRST202', '42883'])
const RETRY_RPC_AFTER_MS = 60_000

let rpcMissingUntil = 0

interface AccessPayload {
  memberships?: Array<{ workspace_id: string | null; role: string | null }> | null
  overrides?: unknown
  blocks?: unknown
}

export async function resolveWorkspaceAccess(
  userId: string,
  requestedWorkspaceId: string | null,
): Promise<TenancyContext> {
  if (Date.now() >= rpcMissingUntil) {
    const { data, error } = await supabase.rpc('resolve_workspace_access', {
      p_user_id: userId,
      p_workspace_id: requestedWorkspaceId,
    })

    if (!error) return fromPayload(userId, requestedWorkspaceId, (data ?? {}) as AccessPayload)
    if (!FUNCTION_MISSING.has(error.code)) {
      throw new DatabaseError('Failed to resolve workspace access', error)
    }
    rpcMissingUntil = Date.now() + RETRY_RPC_AFTER_MS
  }

  return viaSeparateReads(userId, requestedWorkspaceId)
}

function fromPayload(
  userId: string,
  requestedWorkspaceId: string | null,
  payload: AccessPayload,
): TenancyContext {
  const authorized: TenancyContext[] = (payload.memberships ?? [])
    .filter((m): m is { workspace_id: string; role: string | null } => Boolean(m?.workspace_id))
    .map((m) => ({ workspaceId: m.workspace_id, userId, role: resolveWorkspaceRole(m.role) }))

  // Throws exactly as requireWorkspace would: none, not a member, ambiguous.
  const resolved = chooseWorkspace(authorized, requestedWorkspaceId)

  const overrides = parseOverrides(payload.overrides)
  const blocks = parseBlocks(Array.isArray(payload.blocks) ? payload.blocks : [])
  return {
    ...resolved,
    capabilities: restrictByModuleBlocks(
      resolved.role,
      effectiveCapabilities(resolved.role, overrides),
      blocks,
    ),
  }
}

/** The previous path: membership, then capabilities and blocks together. */
async function viaSeparateReads(
  userId: string,
  requestedWorkspaceId: string | null,
): Promise<TenancyContext> {
  const resolved = await requireWorkspace(userId, requestedWorkspaceId)
  const [capabilities, blocks] = await Promise.all([
    roleCapabilities.effective(resolved.workspaceId, resolved.role),
    memberModuleBlocks.forMember(resolved.workspaceId, userId),
  ])
  return {
    ...resolved,
    // The role's set, minus any modules the owner took away from THIS person.
    // Only ever a subset; never applied to the owner (restrictByModuleBlocks).
    capabilities: restrictByModuleBlocks(resolved.role, capabilities, blocks),
  }
}

/** Tests only: forget that the function was missing. */
export function __resetWorkspaceAccessProbe(): void {
  rpcMissingUntil = 0
}
