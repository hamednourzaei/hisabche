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
import { randomUUID } from 'node:crypto'

import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { memoryCache } from '../../utils/pagination'
import type { TenancyContext } from '../tenancy.service'
import { roleCapabilities } from './role-capabilities.service'
import { logBusinessEvent } from '../event-log.service'

import {
  ACCESS_LEVELS,
  CAPABILITIES,
  effectiveCapabilities,
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
  /**
   * A role this business made: its holder gets exactly what it grants, it can
   * be renamed, shaped and deleted here, and it is what a new employee is given.
   */
  isCustom: boolean
  /**
   * One of the platform's shared profiles (حسابدار، صندوق‌دار، …). Read-only
   * for every business — a starting point to copy a custom role from.
   */
  isTemplate: boolean
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
      isCustom: row.workspace_id === ctx.workspaceId,
      isTemplate: !row.workspace_id && !isEnforcedRole(row.code ?? ''),
    }))

    const cells: MatrixCell[] = []
    // This workspace's changes to owner / manager / seller, read once.
    const overrides = await roleCapabilities.overrides(ctx.workspaceId)

    for (const role of roles) {
      // For the three enforced roles: the EFFECTIVE set in this workspace —
      // the defaults with this workspace's changes applied, i.e. exactly what
      // requireCapability enforces. For every other role the base is nothing —
      // a profile grants on top of whatever workspace role the person has.
      const base = new Set<string>(
        role.isEnforcedBase
          ? [...effectiveCapabilities(role.code as WorkspaceRole, overrides)]
          : [],
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
          // Enforced roles are now editable in both directions (the owner's
          // lock is refused on save, with a reason). A profile cell whose base
          // already reaches the top rung is still not a control.
          //
          // A template is the platform's row, shared by every business: never
          // editable from inside one of them.
          editable: role.isTemplate ? false : role.isEnforcedBase ? true : baseLevel !== maxLevel,
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

    // owner / manager / seller: written as THIS workspace's change to the role
    // (workspace_role_capabilities), never to `role_permissions` — the system
    // roles are global rows, and a grant there would change every business on
    // the platform. The same effective set is what requireCapability enforces.
    const roleCode = String((role as Record<string, any>).code ?? '')
    if (isEnforcedRole(roleCode)) {
      const scope = capabilitiesForLevel(module, 'full')
      const wantedSet = new Set(capabilitiesForLevel(module, input.level))
      let change
      try {
        change = await roleCapabilities.setForRole(
          ctx.workspaceId,
          ctx.userId,
          roleCode as WorkspaceRole,
          scope,
          wantedSet,
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : ''
        if (message.startsWith('PERMISSION_')) throw new ValidationError(message)
        throw err
      }

      // Who changed which role's access, from what to what.
      void logBusinessEvent({
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        entityType: 'role',
        entityId: String((role as Record<string, any>).id),
        action: 'permissions_changed',
        title: `دسترسی نقش ${roleCode} در بخش ${module.key} تغییر کرد`,
        metadata: {
          role: roleCode,
          module: module.key,
          level: input.level,
          before: change.before,
          after: change.after,
        },
        notify: false,
      })

      await this.invalidate(ctx.workspaceId)
      return this.matrix(ctx)
    }

    // ⚠️ ONLY THIS BUSINESS'S OWN ROLE IS WRITTEN BELOW.
    //
    // The role was matched with «system OR mine», and anything that was not
    // owner/manager/seller fell through to `role_permissions` — including the
    // platform's shared profiles. One owner changing «حسابدار» changed it for
    // every business on the platform.
    if ((role as Record<string, any>).workspace_id !== ctx.workspaceId) {
      throw new ValidationError(
        'PERMISSION_TEMPLATE_READONLY: this is a shared template; make your own role from it.',
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
      .select('id, code, workspace_id')
      .eq('id', input.roleId)
      .or(`workspace_id.is.null,workspace_id.eq.${ctx.workspaceId}`)
      .maybeSingle()

    if (roleError) throw new DatabaseError('Failed to fetch the role', roleError)
    if (!role) throw new NotFoundError('Role')

    // Only a role this business made can be given to a person. A base role is
    // the membership itself, and a shared template grants nothing here — it
    // used to be «assignable» and changed no behaviour at all.
    const assigned = role as Record<string, any> & { workspace_id?: string | null }
    if (assigned.workspace_id !== undefined && assigned.workspace_id !== ctx.workspaceId) {
      throw new ValidationError(
        'PERMISSION_ROLE_NOT_ASSIGNABLE: choose a role made in this business.',
      )
    }

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

  // ─── Custom roles ───────────────────────────────────────────────────────────

  private requireOwner(ctx: TenancyContext): void {
    if (ctx.role !== 'owner') {
      throw new ValidationError('PERMISSION_MATRIX_FORBIDDEN: only the owner may manage roles.')
    }
  }

  /** This business's own role, or 404 — never a shared row, never another business's. */
  private async ownRole(ctx: TenancyContext, roleId: string) {
    const { data, error } = await supabase
      .from('roles')
      .select('id, name, workspace_id')
      .eq('id', roleId)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to fetch the role', error)
    if (!data) throw new NotFoundError('Role')
    return data as { id: string; name: string; workspace_id: string }
  }

  /**
   * Make a role for this business. With `templateRoleId` it starts with that
   * role's grants (a shared template, or one of this business's own); without
   * it, it starts with nothing — its holder sees only the home screen until
   * the owner opens modules for it.
   */
  async createRole(
    ctx: TenancyContext,
    input: { name: string; templateRoleId?: string | undefined },
  ): Promise<PermissionMatrix> {
    this.requireOwner(ctx)
    const name = input.name.trim()
    if (name.length === 0 || name.length > 60)
      throw new ValidationError('PERMISSION_ROLE_NAME_INVALID')

    let grantIds: string[] = []
    if (input.templateRoleId) {
      const { data: template, error: templateError } = await supabase
        .from('roles')
        .select('id, code')
        .eq('id', input.templateRoleId)
        .or(`workspace_id.is.null,workspace_id.eq.${ctx.workspaceId}`)
        .maybeSingle()
      if (templateError) throw new DatabaseError('Failed to fetch the template', templateError)
      if (!template) throw new NotFoundError('Template role')

      const { data: grants, error: grantsError } = await supabase
        .from('role_permissions')
        .select('permission_id')
        .eq('role_id', input.templateRoleId)
      if (grantsError) throw new DatabaseError('Failed to read the template grants', grantsError)
      grantIds = ((grants ?? []) as Array<{ permission_id: string }>).map((g) => g.permission_id)
    }

    const { data: created, error: createError } = await supabase
      .from('roles')
      .insert({
        // The code is an identifier nobody types; the name is what people see.
        code: `custom_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
        name,
        description: null,
        is_system: false,
        workspace_id: ctx.workspaceId,
      })
      .select('id')
      .single()
    if (createError || !created) throw new DatabaseError('Failed to create the role', createError)
    const roleId = (created as { id: string }).id

    if (grantIds.length > 0) {
      const { error: copyError } = await supabase.from('role_permissions').upsert(
        grantIds.map((permission_id) => ({ role_id: roleId, permission_id })),
        { onConflict: 'role_id,permission_id', ignoreDuplicates: true },
      )
      // The role exists with FEWER grants than asked — the safe direction — and
      // the owner is told, rather than a half-copied role passing as the template.
      if (copyError)
        throw new DatabaseError('The role was created but its grants were not copied', copyError)
    }

    void logBusinessEvent({
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      entityType: 'role',
      entityId: roleId,
      action: 'created',
      title: `نقش «${name}» ساخته شد`,
      metadata: { name, templateRoleId: input.templateRoleId ?? null },
      notify: false,
    })

    await this.invalidate(ctx.workspaceId)
    return this.matrix(ctx)
  }

  async renameRole(ctx: TenancyContext, roleId: string, name: string): Promise<PermissionMatrix> {
    this.requireOwner(ctx)
    const next = name.trim()
    if (next.length === 0 || next.length > 60)
      throw new ValidationError('PERMISSION_ROLE_NAME_INVALID')
    await this.ownRole(ctx, roleId)

    const { error } = await supabase
      .from('roles')
      .update({ name: next })
      .eq('id', roleId)
      .eq('workspace_id', ctx.workspaceId)
    if (error) throw new DatabaseError('Failed to rename the role', error)

    await this.invalidate(ctx.workspaceId)
    return this.matrix(ctx)
  }

  /**
   * Delete a role nobody holds.
   *
   * ⚠️ REFUSED WHILE SOMEBODY HOLDS IT. Without the role its holder falls back
   * to their base role — which may be WIDER than the role that was limiting
   * them. Deleting must never be how somebody gains access; the owner moves
   * those people to another role first.
   */
  async deleteRole(ctx: TenancyContext, roleId: string): Promise<PermissionMatrix> {
    this.requireOwner(ctx)
    const role = await this.ownRole(ctx, roleId)

    const { count, error: countError } = await supabase
      .from('user_roles')
      .select('user_id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId)
      .eq('role_id', roleId)
    if (countError) throw new DatabaseError('Failed to count the role holders', countError)
    if ((count ?? 0) > 0) throw new ConflictError('PERMISSION_ROLE_IN_USE')

    // Grants first: if the second write fails, what is left is a role that
    // grants nothing — the safe direction.
    const { error: grantsError } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId)
    if (grantsError) throw new DatabaseError('Failed to remove the role grants', grantsError)

    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', roleId)
      .eq('workspace_id', ctx.workspaceId)
    if (error) throw new DatabaseError('Failed to delete the role', error)

    void logBusinessEvent({
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      entityType: 'role',
      entityId: roleId,
      action: 'deleted',
      title: `نقش «${role.name}» حذف شد`,
      notify: false,
    })

    await this.invalidate(ctx.workspaceId)
    return this.matrix(ctx)
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
