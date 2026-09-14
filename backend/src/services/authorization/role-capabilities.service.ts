// ============================================
// backend/src/services/authorization/role-capabilities.service.ts
//
// Reads and writes a workspace's changes to owner / manager / seller.
// docs/workspace-role-capabilities-migration.sql
//
// Cached under the `permissions` prefix, which PermissionMatrixService already
// invalidates wholesale on every grant change — so a revoked capability stops
// working on the next request, not after a TTL.
// ============================================

import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import { memoryCache } from '../../utils/pagination'
import {
  CAPABILITIES,
  can,
  effectiveCapabilities,
  OWNER_LOCKED_CAPABILITIES,
  type Capability,
  type CapabilityOverride,
  type WorkspaceRole,
} from './authorization.domain'

const ROLES: readonly WorkspaceRole[] = ['owner', 'manager', 'seller']

function isMissingTable(error: { code?: string } | null): boolean {
  return !!error && (error.code === '42P01' || error.code === 'PGRST205')
}

export class RoleCapabilitiesService {
  private key(workspaceId: string) {
    return `permissions:${workspaceId}:role-capabilities`
  }

  async overrides(workspaceId: string): Promise<CapabilityOverride[]> {
    const cached = await memoryCache.get<CapabilityOverride[]>(this.key(workspaceId))
    if (cached) return cached

    const { data, error } = await supabase
      .from('workspace_role_capabilities')
      .select('role, capability, granted')
      .eq('workspace_id', workspaceId)

    // Before the migration: no changes exist, the defaults apply — which is
    // exactly today's behaviour, not a weaker one.
    if (error && isMissingTable(error)) return []
    // ⚠️ Any other failure must NOT fall back to defaults: a workspace that
    // revoked a capability would silently get it back while the read is down.
    if (error) throw new DatabaseError('Failed to read role capabilities', error)

    const rows = ((data ?? []) as Array<{ role: string; capability: string; granted: boolean }>)
      .filter(
        (r) =>
          (ROLES as readonly string[]).includes(r.role) &&
          (CAPABILITIES as readonly string[]).includes(r.capability),
      )
      .map((r) => ({
        role: r.role as WorkspaceRole,
        capability: r.capability as Capability,
        granted: r.granted === true,
      }))

    await memoryCache.set(this.key(workspaceId), rows, 60)
    return rows
  }

  async effective(workspaceId: string, role: WorkspaceRole): Promise<Set<Capability>> {
    return effectiveCapabilities(role, await this.overrides(workspaceId))
  }

  /**
   * Make `role` hold exactly `wanted` among `scope` capabilities in this
   * workspace. Rows equal to the default are removed (no row = default), so the
   * table only ever holds genuine changes.
   */
  async setForRole(
    workspaceId: string,
    actorId: string,
    role: WorkspaceRole,
    scope: readonly Capability[],
    wanted: ReadonlySet<Capability>,
  ): Promise<{ before: Capability[]; after: Capability[] }> {
    if (role === 'owner') {
      const lost = OWNER_LOCKED_CAPABILITIES.filter((c) => scope.includes(c) && !wanted.has(c))
      if (lost.length > 0) {
        throw new Error(`PERMISSION_OWNER_LOCKED: the owner always keeps ${lost.join(', ')}`)
      }
    }

    const before = [...(await this.effective(workspaceId, role))].filter((c) => scope.includes(c))

    const upserts: Array<Record<string, unknown>> = []
    const resets: Capability[] = []
    for (const capability of scope) {
      const desired = wanted.has(capability)
      if (desired === can(role, capability)) resets.push(capability)
      else
        upserts.push({
          workspace_id: workspaceId,
          role,
          capability,
          granted: desired,
          updated_by: actorId,
          updated_at: new Date().toISOString(),
        })
    }

    if (upserts.length > 0) {
      const { error } = await supabase
        .from('workspace_role_capabilities')
        .upsert(upserts, { onConflict: 'workspace_id,role,capability' })
      if (error && isMissingTable(error)) throw new Error('PERMISSION_MIGRATION_REQUIRED')
      if (error) throw new DatabaseError('Failed to save role capabilities', error)
    }

    if (resets.length > 0) {
      const { error } = await supabase
        .from('workspace_role_capabilities')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('role', role)
        .in('capability', resets)
      if (error && !isMissingTable(error))
        throw new DatabaseError('Failed to reset role capabilities', error)
    }

    await memoryCache.invalidate('permissions')
    const after = [...(await this.effective(workspaceId, role))].filter((c) => scope.includes(c))
    return { before, after }
  }
}

export const roleCapabilities = new RoleCapabilitiesService()
