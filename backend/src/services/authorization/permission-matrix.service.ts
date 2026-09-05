// ============================================
// backend/src/services/authorization/permission-matrix.service.ts
//
// G3 — the Permission Matrix: modules × roles, and the grants behind each cell.
//
// ---------------------------------------------------------------------------
// ⚠️ WHAT A GRANT CAN AND CANNOT DO — read this before changing anything here
//
// Phase E deliberately left capability resolution ADDITIVE: the enforced
// answer is `can(workspace_members.role, capability)` from the static MIN_ROLE
// table, and `user_roles` → `role_permissions` can only ADD capabilities on
// top. A grant cannot REVOKE one.
//
// That is not an oversight. Flipping to database-only in one step has exactly
// two failure modes and both are catastrophic on a live financial book:
// everyone locked out, or everyone granted everything.
//
// The matrix therefore reports two things per cell and never conflates them:
//
//   BASE     what the role's members already hold from the static table.
//            Read-only here, because unticking it would change nothing and a
//            control that does nothing is worse than no control.
//
//   GRANTED  what `role_permissions` adds. Editable, and it takes effect.
//
// A screen that let someone untick `ledger.post` for a manager — and then
// silently kept letting managers post — would be the most dangerous kind of
// UI theatre in this product. So the base rungs are shown as locked, with the
// reason.
// ============================================

import { supabase } from '../../db'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { memoryCache } from '../../utils/pagination'
import type { TenancyContext } from '../tenancy.service'

import {
  ACCESS_LEVELS,
  CAPABILITIES,
  PERMISSION_MODULES,
  capabilitiesForLevel,
  capabilitiesOf,
  levelOfCapabilities,
  type AccessLevel,
  type Capability,
  type WorkspaceRole,
} from './authorization.domain'

/** The three roles the static table actually enforces. */
const ENFORCED_ROLES: readonly WorkspaceRole[] = ['owner', 'manager', 'seller'] as const

function isEnforcedRole(code: string): code is WorkspaceRole {
  return (ENFORCED_ROLES as readonly string[]).includes(code)
}

export interface MatrixRole {
  id: string
  code: string
  name: string
  description: string | null
  isSystem: boolean
  /**
   * True for owner/manager/seller — the roles the static table decides. Their
   * base cells are not editable; see the header of this file.
   */
  isEnforcedBase: boolean
  /** Only workspace-owned roles may be edited freely. */
  workspaceId: string | null
}

export interface MatrixCell {
  roleId: string
  moduleKey: string
  /** What the static table already gives this role. 'none' for profile roles. */
  baseLevel: AccessLevel
  /** What role_permissions adds. This is the editable value. */
  grantedLevel: AccessLevel
  /** max(base, granted) — what a member of this role effectively holds. */
  effectiveLevel: AccessLevel
  /** False when baseLevel already covers everything this module can grant. */
  editable: boolean
}

export interface PermissionMatrix {
  modules: {
    key: string
    label: string
    /** Rungs this module actually offers — a rung with no capabilities is not a choice. */
    levels: AccessLevel[]
  }[]
  roles: MatrixRole[]
  cells: MatrixCell[]
}

const HIGHER = (a: AccessLevel, b: AccessLevel): AccessLevel =>
  ACCESS_LEVELS.indexOf(a) >= ACCESS_LEVELS.indexOf(b) ? a : b

export class PermissionMatrixService {
  private key(workspaceId: string, ...parts: string[]) {
    return `permissions:${workspaceId}:${parts.join(':')}`
  }

  private async invalidate(workspaceId: string) {
    // The whole prefix: a grant change moves the matrix, every member's
    // effective capability set, and every cached hasPermission answer. Naming
    // individual keys here is how one gets missed and a revoked grant keeps
    // working (lesson 5).
    await memoryCache.invalidate('permissions')
    await memoryCache.invalidate(this.key(workspaceId, 'matrix'))
  }

  /**
   * Modules × roles, with base and granted levels per cell.
   *
   * Three reads, not one per cell: roles, permissions, and the grant edges.
   * The cross product is built in memory because it is at most
   * (8 modules × ~12 roles) = 96 cells.
   */
  async matrix(ctx: TenancyContext): Promise<PermissionMatrix> {
    const cacheKey = this.key(ctx.workspaceId, 'matrix')
    const cached = await memoryCache.get<PermissionMatrix>(cacheKey)
    if (cached) return cached

    // System roles (workspace_id IS NULL) plus this workspace's own custom
    // roles. Another workspace's custom roles are not visible — the same
    // boundary `roles_readable` enforces at the database.
    const { data: roleRows, error: roleError } = await supabase
      .from('roles')
      .select('id, code, name, description, is_system, workspace_id')
      .or(`workspace_id.is.null,workspace_id.eq.${ctx.workspaceId}`)
      .order('name')

    if (roleError) throw new DatabaseError('Failed to fetch roles', roleError)

    const { data: permRows, error: permError } = await supabase
      .from('permissions')
      .select('id, code')

    if (permError) throw new DatabaseError('Failed to fetch permissions', permError)

    const permissionCodeById = new Map<string, string>()
    for (const row of (permRows ?? []) as Record<string, any>[]) {
      permissionCodeById.set(row.id, row.code)
    }

    const roleIds = ((roleRows ?? []) as Record<string, any>[]).map((r) => r.id)

    const grantedByRole = new Map<string, Set<string>>()
    if (roleIds.length > 0) {
      const { data: grantRows, error: grantError } = await supabase
        .from('role_permissions')
        .select('role_id, permission_id')
        .in('role_id', roleIds)

      if (grantError) throw new DatabaseError('Failed to fetch role permissions', grantError)

      for (const row of (grantRows ?? []) as Record<string, any>[]) {
        const code = permissionCodeById.get(row.permission_id)
        if (!code) continue
        const set = grantedByRole.get(row.role_id) ?? new Set<string>()
        set.add(code)
        grantedByRole.set(row.role_id, set)
      }
    }

    const roles: MatrixRole[] = ((roleRows ?? []) as Record<string, any>[]).map((row) => ({
      id: row.id,
      code: row.code ?? '',
      name: row.name ?? row.code ?? '',
      description: row.description ?? null,
      isSystem: row.is_system === true,
      isEnforcedBase: isEnforcedRole(row.code ?? ''),
      workspaceId: row.workspace_id ?? null,
    }))

    const cells: MatrixCell[] = []

    for (const role of roles) {
      // The static table's answer, for the three roles it decides. For every
      // other role the base is nothing — a profile grants on top of whatever
      // workspace role the person already has.
      const base = new Set<string>(
        role.isEnforcedBase ? capabilitiesOf(role.code as WorkspaceRole) : [],
      )
      const granted = grantedByRole.get(role.id) ?? new Set<string>()

      for (const module of PERMISSION_MODULES) {
        const baseLevel = levelOfCapabilities(module, base)
        const grantedLevel = levelOfCapabilities(module, granted)
        const maxLevel = this.maxLevelOf(module)

        cells.push({
          roleId: role.id,
          moduleKey: module.key,
          baseLevel,
          grantedLevel,
          effectiveLevel: HIGHER(baseLevel, grantedLevel),
          // A cell whose base already reaches the top rung cannot be raised
          // and cannot be lowered, so it is not a control.
          editable: baseLevel !== maxLevel,
        })
      }
    }

    const matrix: PermissionMatrix = {
      modules: PERMISSION_MODULES.map((module) => ({
        key: module.key,
        label: module.label,
        levels: this.levelsOf(module),
      })),
      roles,
      cells,
    }

    await memoryCache.set(cacheKey, matrix, 60)
    return matrix
  }

  /** The rungs this module offers — one with no capabilities is not a choice. */
  private levelsOf(module: (typeof PERMISSION_MODULES)[number]): AccessLevel[] {
    const levels: AccessLevel[] = ['none']
    if (module.read.length > 0) levels.push('read')
    if (module.write.length > 0) levels.push('write')
    if (module.full.length > 0) levels.push('full')
    return levels
  }

  private maxLevelOf(module: (typeof PERMISSION_MODULES)[number]): AccessLevel {
    const levels = this.levelsOf(module)
    return levels[levels.length - 1] ?? 'none'
  }

  /**
   * Set one cell: this role's granted level for this module.
   *
   * Replaces only THIS module's capabilities. Every other module's grants for
   * the role are untouched — a matrix where changing one cell silently reset
   * the row would be unusable and dangerous.
   */
  async setCell(
    ctx: TenancyContext,
    input: { roleId: string; moduleKey: string; level: AccessLevel },
  ): Promise<PermissionMatrix> {
    if (ctx.role !== 'owner') {
      throw new ValidationError('PERMISSION_MATRIX_FORBIDDEN: only the owner may change grants.')
    }

    const module = PERMISSION_MODULES.find((m) => m.key === input.moduleKey)
    if (!module) throw new NotFoundError('Module')

    if (!ACCESS_LEVELS.includes(input.level)) {
      throw new ValidationError(`PERMISSION_LEVEL_INVALID: ${input.level}`)
    }

    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('id, code, workspace_id')
      .eq('id', input.roleId)
      .or(`workspace_id.is.null,workspace_id.eq.${ctx.workspaceId}`)
      .maybeSingle()

    if (roleError) throw new DatabaseError('Failed to fetch the role', roleError)
    if (!role) throw new NotFoundError('Role')

    // owner/manager/seller are what the static table enforces. Editing their
    // grants would produce a matrix that shows one thing and enforces another
    // for the three roles every member actually has.
    if (isEnforcedRole((role as Record<string, any>).code ?? '')) {
      throw new ValidationError(
        'PERMISSION_ROLE_IS_ENFORCED_BASE: owner, manager and seller are decided by the enforced capability table, not by grants. Edit a profile role instead.',
      )
    }

    const wanted = capabilitiesForLevel(module, input.level)
    const moduleCapabilities = capabilitiesForLevel(module, 'full')

    const { data: permRows, error: permError } = await supabase
      .from('permissions')
      .select('id, code')
      .in('code', moduleCapabilities.length > 0 ? moduleCapabilities : ['__none__'])

    if (permError) throw new DatabaseError('Failed to fetch permissions', permError)

    const idByCode = new Map<string, string>()
    for (const row of (permRows ?? []) as Record<string, any>[]) idByCode.set(row.code, row.id)

    // A capability with no `permissions` row means phase-e-01 has not been run
    // (or was run against an older capability list). Refused loudly: writing a
    // partial grant would silently give the role less than the cell shows.
    const missing = moduleCapabilities.filter((code) => !idByCode.has(code))
    if (missing.length > 0) {
      throw new ValidationError(
        `PERMISSION_CATALOGUE_INCOMPLETE: no permissions row for ${missing.join(', ')}. Run docs/phase-e-01-rbac-2.0-migration.sql.`,
      )
    }

    const removeIds = moduleCapabilities
      .filter((code) => !wanted.includes(code as Capability))
      .map((code) => idByCode.get(code)!)

    const addRows = wanted.map((code) => ({
      role_id: input.roleId,
      permission_id: idByCode.get(code)!,
    }))

    if (removeIds.length > 0) {
      const { error } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', input.roleId)
        .in('permission_id', removeIds)

      if (error) throw new DatabaseError('Failed to revoke permissions', error)
    }

    if (addRows.length > 0) {
      // `role_permissions_unique` (phase-e-01) makes this idempotent: setting a
      // cell to the level it already has writes nothing.
      const { error } = await supabase
        .from('role_permissions')
        .upsert(addRows, { onConflict: 'role_id,permission_id', ignoreDuplicates: true })

      if (error) throw new DatabaseError('Failed to grant permissions', error)
    }

    await this.invalidate(ctx.workspaceId)
    return this.matrix(ctx)
  }

  /**
   * Give a person a profile — the whole point of profiles.
   *
   * ⚠️ Takes a USER id, not an employee id. A grant lives in `user_roles`,
   * which is about someone who signs in. Most employees have no login at all,
   * so "assign the Accountant profile to this employee" only means anything
   * once that employee is linked to a user account (`employees.user_id`).
   * The caller resolves that link and this refuses without it, rather than
   * writing a grant keyed to nothing.
   */
  async assignProfile(
    ctx: TenancyContext,
    input: { userId: string; roleId: string; replaceExisting?: boolean | undefined },
  ) {
    if (ctx.role !== 'owner') {
      throw new ValidationError('PERMISSION_MATRIX_FORBIDDEN: only the owner may assign profiles.')
    }

    // The person must be a member of THIS workspace. Without this check a
    // profile could be granted to any user id in the platform — and the grant
    // row would carry our workspace_id, making them a member by side effect.
    const { data: member, error: memberError } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('user_id', input.userId)
      .maybeSingle()

    if (memberError) throw new DatabaseError('Failed to verify the member', memberError)
    if (!member) throw new NotFoundError('Workspace member')

    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('id, code')
      .eq('id', input.roleId)
      .or(`workspace_id.is.null,workspace_id.eq.${ctx.workspaceId}`)
      .maybeSingle()

    if (roleError) throw new DatabaseError('Failed to fetch the role', roleError)
    if (!role) throw new NotFoundError('Role')

    if (input.replaceExisting) {
      // Only the profile roles are cleared. The row matching the member's own
      // workspace role (seeded by phase-e-01 so both systems agree) is left
      // alone — removing it would make the two disagree about a real person.
      const { data: baseRoles } = await supabase
        .from('roles')
        .select('id')
        .is('workspace_id', null)
        .in('code', [...ENFORCED_ROLES])

      const baseIds = ((baseRoles ?? []) as Record<string, any>[]).map((r) => r.id)

      let query = supabase
        .from('user_roles')
        .delete()
        .eq('workspace_id', ctx.workspaceId)
        .eq('user_id', input.userId)

      if (baseIds.length > 0) query = query.not('role_id', 'in', `(${baseIds.join(',')})`)

      const { error } = await query
      if (error) throw new DatabaseError('Failed to clear the previous profile', error)
    }

    const { error } = await supabase.from('user_roles').upsert(
      {
        workspace_id: ctx.workspaceId,
        user_id: input.userId,
        role_id: input.roleId,
      },
      { onConflict: 'workspace_id,user_id,role_id', ignoreDuplicates: true },
    )

    if (error) throw new DatabaseError('Failed to assign the profile', error)

    await this.invalidate(ctx.workspaceId)
    return { success: true }
  }

  /** Who holds this role in this workspace — the matrix's drill-down (H5). */
  async membersOfRole(ctx: TenancyContext, roleId: string) {
    const { data, error } = await supabase
      .from('user_roles')
      .select('user_id, created_at')
      .eq('workspace_id', ctx.workspaceId)
      .eq('role_id', roleId)

    if (error) throw new DatabaseError('Failed to fetch role members', error)

    const userIds = ((data ?? []) as Record<string, any>[]).map((r) => r.user_id)
    if (userIds.length === 0) return []

    // Employees carry the display name; a member with no employee record is
    // still returned, with a null name, rather than being dropped.
    const { data: employees } = await supabase
      .from('employees')
      .select('user_id, first_name, last_name, position')
      .eq('workspace_id', ctx.workspaceId)
      .in('user_id', userIds)

    const byUser = new Map<string, Record<string, any>>()
    for (const row of (employees ?? []) as Record<string, any>[]) byUser.set(row.user_id, row)

    return userIds.map((userId) => {
      const employee = byUser.get(userId)
      return {
        userId,
        name: employee ? `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim() : null,
        position: employee?.position ?? null,
      }
    })
  }

  /** Every capability code the app enforces — for the catalogue screens. */
  capabilities(): readonly string[] {
    return CAPABILITIES
  }
}

export const permissionMatrix = new PermissionMatrixService()
