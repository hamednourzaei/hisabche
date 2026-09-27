// ============================================
// backend/src/services/dimensions/dimensions.service.ts
//
// Cost centres, projects, campaigns — and the requirement that a posting
// carries them.
// ============================================

import { supabase } from '../../db'
import { ConflictError, DatabaseError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { memoryCache } from '../../utils/pagination'
import { fetchAllPages, selectAllPages } from '../../utils/fetch-all-pages'
import type { TenancyContext } from '../tenancy.service'

import {
  coverageGapMinor,
  totalsByDimension,
  validateLine,
  valueAndDescendants,
  type Dimension,
  type DimensionRequirement,
  type DimensionValue,
  type PostingLine,
} from './dimension.domain'

export class DimensionsService {
  private key(workspaceId: string, ...parts: string[]) {
    return `dimensions:${workspaceId}:${parts.join(':')}`
  }

  private async invalidate(workspaceId: string) {
    await memoryCache.invalidate(`dimensions:${workspaceId}`)
  }

  private assertMayManage(ctx: TenancyContext) {
    // A required dimension changes what every posting must carry. Owner only.
    if (ctx.role !== 'owner') throw new ConflictError('DIMENSION_MANAGE_FORBIDDEN')
  }

  async listDimensions(ctx: TenancyContext): Promise<Dimension[]> {
    const cacheKey = this.key(ctx.workspaceId, 'dimensions')

    const cached = await memoryCache.get<Dimension[]>(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('accounting_dimensions')
      .select('id, code, label_key, allows_hierarchy, is_active')
      .eq('workspace_id', ctx.workspaceId)
      .order('code')

    if (error) throw new DatabaseError('Failed to fetch dimensions', error)

    const dimensions = (data ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      labelKey: row.label_key,
      allowsHierarchy: row.allows_hierarchy !== false,
      isActive: row.is_active !== false,
    }))

    await memoryCache.set(cacheKey, dimensions, 300)
    return dimensions
  }

  async listValues(ctx: TenancyContext, dimensionId?: string): Promise<DimensionValue[]> {
    const cacheKey = this.key(ctx.workspaceId, 'values', dimensionId ?? 'all')

    const cached = await memoryCache.get<DimensionValue[]>(cacheKey)
    if (cached) return cached

    // Every value, in ordered pages (27 Sep 2026): a picker that silently
    // stops at PostgREST's 1000 rows hides values nobody can then choose.
    const { data, error } = await selectAllPages((from, to) => {
      let query = supabase
        .from('dimension_values')
        .select('id, dimension_id, code, name, parent_id, is_active')
        .eq('workspace_id', ctx.workspaceId)
      if (dimensionId) query = query.eq('dimension_id', dimensionId)
      return query.order('code').order('id', { ascending: true }).range(from, to)
    })
    if (error) throw new DatabaseError('Failed to fetch dimension values', error)

    const values = (data ?? []).map((row) => ({
      id: row.id,
      dimensionId: row.dimension_id,
      code: row.code,
      name: row.name,
      parentId: row.parent_id ?? null,
      isActive: row.is_active !== false,
    }))

    await memoryCache.set(cacheKey, values, 300)
    return values
  }

  async listRequirements(ctx: TenancyContext): Promise<DimensionRequirement[]> {
    const cacheKey = this.key(ctx.workspaceId, 'requirements')

    const cached = await memoryCache.get<DimensionRequirement[]>(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('dimension_requirements')
      .select('dimension_id, account_types, account_ids, except_account_ids')
      .eq('workspace_id', ctx.workspaceId)

    if (error) throw new DatabaseError('Failed to fetch dimension requirements', error)

    const requirements = (data ?? []).map((row) => ({
      dimensionId: row.dimension_id,
      accountTypes: (row.account_types as DimensionRequirement['accountTypes']) ?? [],
      accountIds: (row.account_ids as string[]) ?? [],
      exceptAccountIds: (row.except_account_ids as string[]) ?? [],
    }))

    await memoryCache.set(cacheKey, requirements, 300)
    return requirements
  }

  async upsertDimension(
    ctx: TenancyContext,
    input: {
      id?: string | undefined
      code: string
      labelKey: string
      allowsHierarchy?: boolean | undefined
    },
  ) {
    this.assertMayManage(ctx)

    const { data, error } = await supabase
      .from('accounting_dimensions')
      .upsert(
        {
          ...(input.id ? { id: input.id } : {}),
          workspace_id: ctx.workspaceId,
          code: input.code,
          label_key: input.labelKey,
          allows_hierarchy: input.allowsHierarchy !== false,
        },
        { onConflict: 'workspace_id,code' },
      )
      .select('id, code, label_key, allows_hierarchy, is_active')
      .single()

    if (error) throw new DatabaseError('Failed to save the dimension', error)

    await this.invalidate(ctx.workspaceId)
    return data
  }

  async upsertValue(
    ctx: TenancyContext,
    input: {
      id?: string | undefined
      dimensionId: string
      code: string
      name: string
      parentId?: string | null | undefined
    },
  ) {
    this.assertMayManage(ctx)

    const { data, error } = await supabase
      .from('dimension_values')
      .upsert(
        {
          ...(input.id ? { id: input.id } : {}),
          workspace_id: ctx.workspaceId,
          dimension_id: input.dimensionId,
          code: input.code,
          name: input.name,
          parent_id: input.parentId ?? null,
        },
        { onConflict: 'workspace_id,dimension_id,code' },
      )
      .select('id, dimension_id, code, name, parent_id, is_active')
      .single()

    if (error) throw new DatabaseError('Failed to save the dimension value', error)

    await this.invalidate(ctx.workspaceId)
    return data
  }

  /**
   * Whether a posting carries the dimensions it must.
   *
   * Called by the ledger before an entry posts. Returning problems rather than
   * throwing lets the caller report every offending line at once instead of
   * making somebody fix a ten-line entry one error at a time.
   */
  async validatePosting(ctx: TenancyContext, lines: PostingLine[]) {
    const [requirements, values] = await Promise.all([
      this.listRequirements(ctx),
      this.listValues(ctx),
    ])

    return lines.map((line, index) => ({
      index,
      accountId: line.accountId,
      problems: validateLine(line, requirements, values),
    }))
  }

  /**
   * Totals per dimension value for an account and period.
   *
   * The `unassigned` bucket is included on purpose: dropping untagged lines
   * makes the slices sum to less than the account and hides exactly the
   * postings somebody forgot to tag.
   */
  async getTotals(
    ctx: TenancyContext,
    input: {
      dimensionId: string
      accountId?: string | undefined
      from: string
      to: string
      valueId?: string | undefined
    },
  ) {
    const values = await this.listValues(ctx, input.dimensionId)

    // ⚠️ EVERY posting, in ordered pages. `.limit(20_000)` was silently capped
    // at PostgREST max-rows (1000), so totals and the coverage gap were
    // computed from a prefix of the period.
    const data = await fetchAllPages<{ debit: unknown; credit: unknown; dimensions: unknown }>(
      (from, to) => {
        let query = supabase
          .from('journal_lines')
          .select(
            'id, debit, credit, dimensions, journal:journal_entries!inner(date, status, workspace_id)',
          )
          .eq('workspace_id', ctx.workspaceId)
          .eq('journal.status', 'posted')
          .gte('journal.date', input.from.slice(0, 10))
          .lte('journal.date', input.to.slice(0, 10))

        if (input.accountId) query = query.eq('account_id', input.accountId)

        return query.order('id', { ascending: true }).range(from, to)
      },
      'Failed to read postings',
    )

    let rows = data.map((row) => ({
      dimensions: (row.dimensions ?? {}) as Record<string, string>,
      debitMinor: Math.round((Number(row.debit) || 0) * 100),
      creditMinor: Math.round((Number(row.credit) || 0) * 100),
    }))

    // Reporting on a group covers everything under it: a region's total is its
    // shops' totals, not an empty row.
    if (input.valueId) {
      const covered = new Set(valueAndDescendants(input.valueId, values))
      rows = rows.filter((row) => covered.has(row.dimensions[input.dimensionId] ?? ''))
    }

    const totals = totalsByDimension(rows, input.dimensionId, values)
    const accountBalanceMinor = rows.reduce((sum, row) => sum + row.debitMinor - row.creditMinor, 0)

    return {
      dimensionId: input.dimensionId,
      totals,
      accountBalanceMinor,
      // Anything but zero means the slices do not account for the whole
      // figure, and a slice somebody builds a decision on would be wrong.
      coverageGapMinor: coverageGapMinor(totals, accountBalanceMinor),
    }
  }

  async setRequirement(
    ctx: TenancyContext,
    input: {
      dimensionId: string
      accountTypes?: DimensionRequirement['accountTypes'] | undefined
      accountIds?: string[] | undefined
      exceptAccountIds?: string[] | undefined
    },
  ) {
    this.assertMayManage(ctx)

    if (!input.accountTypes?.length && !input.accountIds?.length) {
      // A requirement with no narrowing fires on the bank account too, and a
      // control that fires everywhere gets switched off within a week.
      throw new ValidationError('DIMENSION_REQUIREMENT_TOO_BROAD')
    }

    const { error } = await supabase.from('dimension_requirements').upsert(
      {
        workspace_id: ctx.workspaceId,
        dimension_id: input.dimensionId,
        account_types: input.accountTypes ?? [],
        account_ids: input.accountIds ?? [],
        except_account_ids: input.exceptAccountIds ?? [],
      },
      { onConflict: 'workspace_id,dimension_id' },
    )

    if (error) throw new DatabaseError('Failed to save the requirement', error)
    await this.invalidate(ctx.workspaceId)
  }
}
