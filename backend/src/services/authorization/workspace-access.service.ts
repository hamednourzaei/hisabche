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
import {
  customRoleAccess,
  effectiveCapabilities,
  restrictByModuleBlocks,
  type Capability,
  type WorkspaceRole,
} from './authorization.domain'
import { memberModuleBlocks, parseBlocks } from './member-module-blocks.service'
import { parseOverrides, roleCapabilities } from './role-capabilities.service'

const FUNCTION_MISSING = new Set(['PGRST202', '42883'])
const RETRY_RPC_AFTER_MS = 60_000

let rpcMissingUntil = 0

interface AccessPayload {
  memberships?: Array<{ workspace_id: string | null; role: string | null }> | null
  overrides?: unknown
  blocks?: unknown
  /**
   * The person's custom role in the chosen workspace and what it grants
   * (docs/workspace-access-rpc-02-custom-role-migration.sql). `null` = they
   * have none. ABSENT = the function predates that migration and did not look.
   */
  custom_role?: { id?: unknown; capabilities?: unknown } | null
}

/** A custom role's grants, or null when the person holds no custom role. */
export type CustomRoleGrants = readonly string[] | null

function parseCustomRole(value: AccessPayload['custom_role']): CustomRoleGrants {
  if (!value || typeof value !== 'object') return null
  return Array.isArray(value.capabilities)
    ? value.capabilities.filter((code): code is string => typeof code === 'string')
    : []
}

function isMissingRelation(error: { code?: string } | null): boolean {
  return (
    !!error && ['42P01', '42703', 'PGRST205', 'PGRST204', 'PGRST200'].includes(error.code ?? '')
  )
}

/**
 * The custom role a person holds in a workspace, read directly — for a database
 * whose `resolve_workspace_access` does not return it yet, and for the fallback
 * path. Only a role OWNED BY THIS WORKSPACE counts: the platform's template
 * profiles (accountant, cashier, …) are shared rows no business may shape.
 * The most recent assignment wins, so the answer is one role, deterministically.
 */
export async function readCustomRole(
  workspaceId: string,
  userId: string,
): Promise<CustomRoleGrants> {
  const { data: assigned, error: assignedError } = await supabase
    .from('user_roles')
    .select('role_id, created_at, role:roles!inner(id, workspace_id)')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('role.workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (assignedError) {
    // RBAC tables not there yet: nobody can hold a custom role.
    if (isMissingRelation(assignedError)) return null
    throw new DatabaseError('Failed to read the custom role', assignedError)
  }
  const roleId = (assigned?.[0] as { role_id?: string } | undefined)?.role_id
  if (!roleId) return null

  const { data: grants, error: grantsError } = await supabase
    .from('role_permissions')
    .select('permission:permissions!inner(code)')
    .eq('role_id', roleId)

  if (grantsError) throw new DatabaseError('Failed to read the custom role grants', grantsError)

  return ((grants ?? []) as Array<{ permission?: { code?: string } | Array<{ code?: string }> }>)
    .flatMap((row) => (Array.isArray(row.permission) ? row.permission : [row.permission]))
    .map((permission) => permission?.code)
    .filter((code): code is string => typeof code === 'string')
}

/**
 * The set the server enforces, from every input that shapes it — ONE function
 * for both paths, so they cannot disagree.
 *
 *   owner            everything, always: a business must keep somebody who can
 *                    unlock it. A custom role or a block on the owner is ignored.
 *   custom role      exactly what the role grants (customRoleAccess).
 *   base role        the defaults with this workspace's changes.
 * …and then the modules the owner took away from THIS person, which only ever
 * narrow it.
 */
export function resolveEffectiveAccess(input: {
  role: WorkspaceRole
  overrides: Parameters<typeof effectiveCapabilities>[1]
  blocks: readonly string[]
  customRole: CustomRoleGrants
}): { capabilities: Set<Capability>; hiddenModules: string[] } {
  if (input.role === 'owner' || input.customRole === null) {
    return {
      capabilities: restrictByModuleBlocks(
        input.role,
        effectiveCapabilities(input.role, input.overrides),
        input.blocks,
      ),
      hiddenModules: [],
    }
  }
  const custom = customRoleAccess(input.customRole)
  return {
    capabilities: restrictByModuleBlocks(input.role, custom.capabilities, input.blocks),
    hiddenModules: custom.hiddenModules,
  }
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

    if (!error) {
      const payload = (data ?? {}) as AccessPayload
      const resolved = fromPayload(userId, requestedWorkspaceId, payload)
      // A function from before the custom-role migration did not look. Until it
      // is replaced the role is read with one more hop — never skipped: a role
      // that silently does not apply is the bug this exists to end.
      if (payload.custom_role !== undefined || resolved.role === 'owner') return resolved
      const customRole = await readCustomRole(resolved.workspaceId, userId)
      if (customRole === null) return resolved
      return withAccess(resolved, {
        role: resolved.role,
        overrides: parseOverrides(payload.overrides),
        blocks: parseBlocks(Array.isArray(payload.blocks) ? payload.blocks : []),
        customRole,
      })
    }
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

  return withAccess(resolved, {
    role: resolved.role,
    overrides: parseOverrides(payload.overrides),
    blocks: parseBlocks(Array.isArray(payload.blocks) ? payload.blocks : []),
    customRole: parseCustomRole(payload.custom_role),
  })
}

function withAccess(
  resolved: TenancyContext,
  input: Parameters<typeof resolveEffectiveAccess>[0],
): TenancyContext {
  const access = resolveEffectiveAccess(input)
  return {
    workspaceId: resolved.workspaceId,
    userId: resolved.userId,
    role: resolved.role,
    capabilities: access.capabilities,
    ...(access.hiddenModules.length > 0 ? { hiddenModules: access.hiddenModules } : {}),
  }
}

/** The previous path: membership, then capabilities and blocks together. */
async function viaSeparateReads(
  userId: string,
  requestedWorkspaceId: string | null,
): Promise<TenancyContext> {
  const resolved = await requireWorkspace(userId, requestedWorkspaceId)
  const [overrides, blocks, customRole] = await Promise.all([
    roleCapabilities.overrides(resolved.workspaceId),
    memberModuleBlocks.forMember(resolved.workspaceId, userId),
    resolved.role === 'owner' ? null : readCustomRole(resolved.workspaceId, userId),
  ])
  // The same function the one-round-trip path ends in.
  return withAccess(resolved, { role: resolved.role, overrides, blocks, customRole })
}

/** Tests only: forget that the function was missing. */
export function __resetWorkspaceAccessProbe(): void {
  rpcMissingUntil = 0
}
