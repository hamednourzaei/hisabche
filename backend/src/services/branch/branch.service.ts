// ============================================
// backend/src/services/branch/branch.service.ts
//
// Branches, who may act in them, and which ones a report covers.
// ============================================

import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { memoryCache } from '../../utils/pagination'
import type { TenancyContext } from '../tenancy.service'

import {
  branchScopeFor,
  nestBranches,
  reportingBranchIds,
  resolveActiveBranch,
  validateBranchPlacement,
  type Branch,
  type BranchEmployee,
  type BranchScope,
  type BranchTreeNode,
} from './branch.domain'

const COLUMNS =
  'id, workspace_id, code, name, parent_branch_id, is_active, created_at, manager_employee_id'

/**
 * The column list without `manager_employee_id`, for databases that have not
 * run `docs/phase-g-01-branch-manager-migration.sql` yet.
 *
 * The repo's standing rule: code must work before AND after a migration, and
 * selecting a column that does not exist raises 42703 — which takes down the
 * branch list entirely, not just the manager field.
 */
const COLUMNS_WITHOUT_MANAGER =
  'id, workspace_id, code, name, parent_branch_id, is_active, created_at'

/** 42703 undefined_column — the migration has not run yet. */
function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42703') return true
  return (
    /manager_employee_id/i.test(error.message ?? '') && /does not exist/i.test(error.message ?? '')
  )
}

function mapBranch(raw: Record<string, any>): Branch {
  return {
    id: raw.id,
    workspaceId: raw.workspace_id,
    code: raw.code,
    name: raw.name,
    parentBranchId: raw.parent_branch_id ?? null,
    isActive: raw.is_active !== false,
    // `undefined` when the column has not been migrated in yet; normalised to
    // null so callers never have to distinguish "no manager" from "no column".
    managerEmployeeId: raw.manager_employee_id ?? null,
  }
}

export class BranchService {
  private key(workspaceId: string, ...parts: string[]) {
    return `branch:${workspaceId}:${parts.join(':')}`
  }

  private async invalidate(workspaceId: string) {
    await memoryCache.invalidate(`branch:${workspaceId}`)
  }

  async list(ctx: TenancyContext): Promise<Branch[]> {
    const cacheKey = this.key(ctx.workspaceId, 'list')

    const cached = await memoryCache.get<Branch[]>(cacheKey)
    if (cached) return cached

    const read = (columns: string) =>
      supabase
        .from('branches')
        .select(columns)
        .eq('workspace_id', ctx.workspaceId)
        .is('deleted_at', null)
        .order('code')

    let { data, error } = await read(COLUMNS)

    // Retry without the manager column rather than failing the whole list.
    // Until phase-g-01 runs, `manager_employee_id` does not exist and the
    // branch list is load-bearing for far more than the People screen.
    if (error && isMissingColumn(error)) {
      ;({ data, error } = await read(COLUMNS_WITHOUT_MANAGER))
    }

    if (error) throw new DatabaseError('Failed to fetch branches', error)

    const branches = ((data ?? []) as Record<string, any>[]).map(mapBranch)
    await memoryCache.set(cacheKey, branches, 300)
    return branches
  }

  async create(
    ctx: TenancyContext,
    input: {
      code: string
      name: string
      parentBranchId?: string | undefined
      /** G2 — optional. A branch with nobody named yet is how every branch starts. */
      managerEmployeeId?: string | null | undefined
    },
  ) {
    if (ctx.role !== 'owner') throw new ConflictError('BRANCH_MANAGE_FORBIDDEN')

    const existing = await this.list(ctx)
    const problems = validateBranchPlacement(
      { id: '', code: input.code, parentBranchId: input.parentBranchId ?? null },
      existing,
    )
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    // The manager is verified to be an employee OF THIS WORKSPACE before it is
    // written. Without this, a branch could name another business's employee by
    // id — the row would be accepted, and the «شعب» tab would render a stranger's
    // name as the manager of this shop (lesson 17).
    if (input.managerEmployeeId) {
      await this.assertEmployeeInWorkspace(ctx, input.managerEmployeeId)
    }

    const row: Record<string, unknown> = {
      workspace_id: ctx.workspaceId,
      code: input.code,
      name: input.name,
      parent_branch_id: input.parentBranchId ?? null,
      is_active: true,
      created_by: ctx.userId,
    }
    if (input.managerEmployeeId !== undefined) {
      row.manager_employee_id = input.managerEmployeeId ?? null
    }

    let { data, error } = await supabase.from('branches').insert(row).select(COLUMNS).single()

    // Before phase-g-01 runs there is no manager column. A branch is still
    // worth creating without one — failing here would mean nobody can add a
    // branch at all until the migration lands.
    if (error && isMissingColumn(error)) {
      delete row.manager_employee_id
      ;({ data, error } = await supabase
        .from('branches')
        .insert(row)
        .select(COLUMNS_WITHOUT_MANAGER)
        .single())
    }

    if (error) throw new DatabaseError('Failed to create branch', error)

    await this.invalidate(ctx.workspaceId)
    return mapBranch(data as unknown as Record<string, any>)
  }

  async update(
    ctx: TenancyContext,
    id: string,
    input: {
      code?: string | undefined
      name?: string | undefined
      parentBranchId?: string | null | undefined
      isActive?: boolean | undefined
      /** G2. `null` clears the manager; `undefined` leaves it alone. */
      managerEmployeeId?: string | null | undefined
    },
  ) {
    if (ctx.role !== 'owner') throw new ConflictError('BRANCH_MANAGE_FORBIDDEN')

    const existing = await this.list(ctx)
    const current = existing.find((b) => b.id === id)
    if (!current) throw new NotFoundError('Branch')

    const problems = validateBranchPlacement(
      {
        id,
        code: input.code ?? current.code,
        parentBranchId:
          input.parentBranchId === undefined ? current.parentBranchId : input.parentBranchId,
      },
      existing,
    )
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    const values: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.code !== undefined) values.code = input.code
    if (input.name !== undefined) values.name = input.name
    if (input.parentBranchId !== undefined) values.parent_branch_id = input.parentBranchId
    if (input.isActive !== undefined) values.is_active = input.isActive

    if (input.managerEmployeeId !== undefined) {
      if (input.managerEmployeeId)
        await this.assertEmployeeInWorkspace(ctx, input.managerEmployeeId)
      values.manager_employee_id = input.managerEmployeeId
    }

    const write = (columns: string, payload: Record<string, unknown>) =>
      supabase
        .from('branches')
        .update(payload)
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', id)
        .select(columns)
        .single()

    let { data, error } = await write(COLUMNS, values)

    if (error && isMissingColumn(error)) {
      // ⚠️ Loud, not silent. The rest of the update is applied, but the caller
      // asked to set a manager and that specifically did not happen — telling
      // them it worked is how someone believes a branch has a manager it does
      // not.
      if (values.manager_employee_id !== undefined) {
        throw new ValidationError(
          'BRANCH_MANAGER_NOT_MIGRATED: branches.manager_employee_id does not exist. Run docs/phase-g-01-branch-manager-migration.sql.',
        )
      }
      ;({ data, error } = await write(COLUMNS_WITHOUT_MANAGER, values))
    }

    if (error) throw new DatabaseError('Failed to update branch', error)

    await this.invalidate(ctx.workspaceId)
    return mapBranch(data as unknown as Record<string, any>)
  }

  /**
   * G2 — refuse an employee id that belongs to another business.
   *
   * `branches.manager_employee_id` has a foreign key to `employees`, which
   * proves the employee EXISTS. It cannot prove the employee is OURS: every
   * workspace's employees live in the same table. Lesson 17 is exactly this —
   * an id accepted without a workspace filter reaching across the boundary.
   */
  private async assertEmployeeInWorkspace(ctx: TenancyContext, employeeId: string) {
    const { data, error } = await supabase
      .from('employees')
      .select('id')
      .eq('id', employeeId)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to verify branch manager', error)
    if (!data) throw new NotFoundError('Employee')
  }

  /**
   * G2 — the branch tree with its people, for the «شعب» tab.
   *
   * One read for the branches and one for the postings, then nested in memory.
   * The obvious alternative — fetch branches, then the employees of each — is
   * one request per branch, which is the N+1 the shared containers exist to
   * avoid.
   *
   * Respects the caller's branch scope: a member pinned to one shop sees that
   * shop's subtree, not the whole chain.
   */
  async tree(ctx: TenancyContext): Promise<BranchTreeNode[]> {
    const cacheKey = this.key(ctx.workspaceId, 'tree')

    const cached = await memoryCache.get<BranchTreeNode[]>(cacheKey)
    if (cached) return cached

    const [all, scope] = await Promise.all([this.list(ctx), this.scopeFor(ctx)])

    const visible =
      scope.kind === 'limited' ? all.filter((b) => scope.branchIds.includes(b.id)) : all

    const assignments = await this.currentAssignments(ctx.workspaceId)

    // The manager's name is looked up from the same employee set the postings
    // produced, plus a targeted read for any manager who is not posted to the
    // branch they run — a regional manager legitimately sits elsewhere.
    const managerIds = visible
      .map((b) => b.managerEmployeeId)
      .filter((id): id is string => Boolean(id))

    const names = await this.employeeNames(ctx.workspaceId, managerIds)

    const nodes: BranchTreeNode[] = visible.map((branch) => {
      const employees = assignments.get(branch.id) ?? []
      const manager = branch.managerEmployeeId ? names.get(branch.managerEmployeeId) : undefined

      return {
        ...branch,
        managerName: manager ?? null,
        // Primary postings only: someone lent to another branch for a week is
        // still counted at home, not in both places.
        headCount: employees.filter((e) => e.isPrimary).length,
        employees,
        children: [],
      }
    })

    const tree = nestBranches(nodes)
    await memoryCache.set(cacheKey, tree, 120)
    return tree
  }

  /**
   * Who is currently posted where, keyed by branch.
   *
   * Reads `employee_branch_assignments` (Phase D). If that migration has not
   * run, every branch simply has no people rather than the tab failing — the
   * structure is still worth showing.
   */
  private async currentAssignments(workspaceId: string): Promise<Map<string, BranchEmployee[]>> {
    const byBranch = new Map<string, BranchEmployee[]>()

    const { data, error } = await supabase
      .from('employee_branch_assignments')
      .select(
        'branch_id, is_primary, employees(id, employee_code, first_name, last_name, position)',
      )
      .eq('workspace_id', workspaceId)
      .is('ends_at', null)

    if (error) {
      // 42P01 undefined_table / PGRST200 missing relationship — phase-d-01 has
      // not run here. Reported once, not thrown: a branch tree with no people
      // is degraded, not broken.
      console.warn(
        '[BranchService] employee_branch_assignments unavailable; branch tree will show no staff.',
        error.message,
      )
      return byBranch
    }

    for (const row of (data ?? []) as Record<string, any>[]) {
      // PostgREST returns the embed as an object for a to-one relationship and
      // an array when it cannot tell; both shapes are handled rather than
      // assumed.
      const raw = Array.isArray(row.employees) ? row.employees[0] : row.employees
      if (!raw || !row.branch_id) continue

      const list = byBranch.get(row.branch_id) ?? []
      list.push({
        id: raw.id,
        employeeCode: raw.employee_code ?? null,
        firstName: raw.first_name ?? '',
        lastName: raw.last_name ?? '',
        position: raw.position ?? null,
        isPrimary: row.is_primary === true,
      })
      byBranch.set(row.branch_id, list)
    }

    for (const list of byBranch.values()) {
      list.sort(
        (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.lastName.localeCompare(b.lastName),
      )
    }

    return byBranch
  }

  /** Display names for a set of employee ids, scoped to the workspace. */
  private async employeeNames(workspaceId: string, ids: string[]): Promise<Map<string, string>> {
    const names = new Map<string, string>()
    const unique = [...new Set(ids)]
    if (unique.length === 0) return names

    const { data, error } = await supabase
      .from('employees')
      .select('id, first_name, last_name')
      .eq('workspace_id', workspaceId)
      .in('id', unique)

    if (error) throw new DatabaseError('Failed to fetch branch managers', error)

    for (const row of (data ?? []) as Record<string, any>[]) {
      names.set(row.id, `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim())
    }

    return names
  }

  /** The branches a member is pinned to. Empty means unrestricted. */
  async assignedBranchIds(workspaceId: string, userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('member_branches')
      .select('branch_id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)

    if (error) throw new DatabaseError('Failed to read branch assignments', error)
    return (data ?? []).map((row) => row.branch_id)
  }

  async scopeFor(ctx: TenancyContext): Promise<BranchScope> {
    return branchScopeFor(await this.assignedBranchIds(ctx.workspaceId, ctx.userId))
  }

  /**
   * The branch this request acts in.
   *
   * `requested` comes from the `x-branch-id` header, which is a TARGET and not
   * an authorization — verified against the member's assignments exactly the
   * way a requested workspace id is.
   */
  async resolveActive(ctx: TenancyContext, requested: string | null): Promise<string | null> {
    const [scope, branches] = await Promise.all([this.scopeFor(ctx), this.list(ctx)])

    const resolved = resolveActiveBranch(scope, requested, branches)
    if ('error' in resolved) throw new ConflictError(resolved.error)
    return resolved.branchId
  }

  /** Which branch ids a report should cover. `null` means all of them. */
  async reportingScope(ctx: TenancyContext, requested: string | null): Promise<string[] | null> {
    const [scope, branches] = await Promise.all([this.scopeFor(ctx), this.list(ctx)])
    return reportingBranchIds(scope, requested, branches)
  }

  async assignMember(ctx: TenancyContext, userId: string, branchIds: string[]) {
    if (ctx.role !== 'owner') throw new ConflictError('BRANCH_MANAGE_FORBIDDEN')

    const branches = await this.list(ctx)
    const known = new Set(branches.map((b) => b.id))

    // A branch id from another workspace would pin the member to a place that
    // is not theirs, and the assignment table would carry it forever.
    if (branchIds.some((id) => !known.has(id))) throw new ValidationError('BRANCH_NOT_PERMITTED')

    const { error: deleteError } = await supabase
      .from('member_branches')
      .delete()
      .eq('workspace_id', ctx.workspaceId)
      .eq('user_id', userId)

    if (deleteError) throw new DatabaseError('Failed to clear branch assignments', deleteError)

    if (branchIds.length > 0) {
      const { error } = await supabase.from('member_branches').insert(
        branchIds.map((branchId) => ({
          workspace_id: ctx.workspaceId,
          user_id: userId,
          branch_id: branchId,
          assigned_by: ctx.userId,
        })),
      )

      if (error) throw new DatabaseError('Failed to assign branches', error)
    }

    await this.invalidate(ctx.workspaceId)
    return { userId, branchIds }
  }
}
