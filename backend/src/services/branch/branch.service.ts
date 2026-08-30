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
  reportingBranchIds,
  resolveActiveBranch,
  validateBranchPlacement,
  type Branch,
  type BranchScope,
} from './branch.domain'

const COLUMNS = 'id, workspace_id, code, name, parent_branch_id, is_active, created_at'

function mapBranch(raw: Record<string, any>): Branch {
  return {
    id: raw.id,
    workspaceId: raw.workspace_id,
    code: raw.code,
    name: raw.name,
    parentBranchId: raw.parent_branch_id ?? null,
    isActive: raw.is_active !== false,
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

    const { data, error } = await supabase
      .from('branches')
      .select(COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .is('deleted_at', null)
      .order('code')

    if (error) throw new DatabaseError('Failed to fetch branches', error)

    const branches = (data ?? []).map(mapBranch)
    await memoryCache.set(cacheKey, branches, 300)
    return branches
  }

  async create(
    ctx: TenancyContext,
    input: { code: string; name: string; parentBranchId?: string | undefined },
  ) {
    if (ctx.role !== 'owner') throw new ConflictError('BRANCH_MANAGE_FORBIDDEN')

    const existing = await this.list(ctx)
    const problems = validateBranchPlacement(
      { id: '', code: input.code, parentBranchId: input.parentBranchId ?? null },
      existing,
    )
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    const { data, error } = await supabase
      .from('branches')
      .insert({
        workspace_id: ctx.workspaceId,
        code: input.code,
        name: input.name,
        parent_branch_id: input.parentBranchId ?? null,
        is_active: true,
        created_by: ctx.userId,
      })
      .select(COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create branch', error)

    await this.invalidate(ctx.workspaceId)
    return mapBranch(data)
  }

  async update(
    ctx: TenancyContext,
    id: string,
    input: {
      code?: string | undefined
      name?: string | undefined
      parentBranchId?: string | null | undefined
      isActive?: boolean | undefined
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

    const { data, error } = await supabase
      .from('branches')
      .update(values)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .select(COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update branch', error)

    await this.invalidate(ctx.workspaceId)
    return mapBranch(data)
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
