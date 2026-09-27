// ============================================
// backend/src/services/mdm/mdm.service.ts
//
// Finding duplicate parties and products, and performing a confirmed merge.
//
// The scoring is pure (mdm.domain.ts). What is here is the part that touches
// real rows: reading candidates, moving references, and writing down what was
// merged into what.
// ============================================

import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { memoryCache } from '../../utils/pagination'
import type { TenancyContext } from '../tenancy.service'

import {
  findDuplicates,
  goldenRecord,
  pickSurvivor,
  scorePair,
  validateMerge,
  type MdmEntity,
  type MdmRecord,
} from './mdm.domain'

/**
 * Where each entity lives, what points at it, and how a record is retired.
 *
 * ⚠️ `retiredBy` (27 Sep 2026): products and customers have NO `deleted_at`
 * — their soft delete is `is_active = false` (the same flag desktop sync and
 * the lists read). The scan filtered `deleted_at IS NULL` for all three, so
 * duplicate detection for products and customers failed with 42703 (400) on
 * every run, and merging two of them failed writing a column that is not
 * there. Suppliers do carry `deleted_at`.
 */
export const ENTITY_CONFIG: Record<
  MdmEntity,
  {
    table: string
    nameColumn: string
    retiredBy: 'is_active' | 'deleted_at'
    references: Array<{ table: string; column: string }>
  }
> = {
  customer: {
    table: 'customers',
    nameColumn: 'full_name',
    retiredBy: 'is_active',
    references: [
      { table: 'invoices', column: 'customer_id' },
      { table: 'transactions', column: 'customer_id' },
      { table: 'payments', column: 'party_id' },
    ],
  },
  supplier: {
    table: 'suppliers',
    nameColumn: 'name',
    retiredBy: 'deleted_at',
    references: [
      { table: 'invoices', column: 'supplier_id' },
      { table: 'purchase_orders', column: 'supplier_id' },
      { table: 'payments', column: 'party_id' },
    ],
  },
  product: {
    table: 'products',
    nameColumn: 'name',
    retiredBy: 'is_active',
    references: [
      { table: 'invoice_items', column: 'product_id' },
      { table: 'stock_movements', column: 'product_id' },
      { table: 'cost_layers', column: 'product_id' },
      { table: 'cost_consumptions', column: 'product_id' },
    ],
  },
}

export class MdmService {
  private key(workspaceId: string, ...parts: string[]) {
    return `mdm:${workspaceId}:${parts.join(':')}`
  }

  /** Load the candidate set. Bounded: this is a scan, not a report. */
  private async load(ctx: TenancyContext, entity: MdmEntity): Promise<MdmRecord[]> {
    const config = ENTITY_CONFIG[entity]

    const columns =
      entity === 'product'
        ? `id, ${config.nameColumn}, barcode, sku, created_at`
        : `id, ${config.nameColumn}, phone, email, created_at`

    let query = supabase.from(config.table).select(columns).eq('workspace_id', ctx.workspaceId)
    query =
      config.retiredBy === 'is_active' ? query.eq('is_active', true) : query.is('deleted_at', null)
    const { data, error } = await query.limit(2000)

    if (error) throw new DatabaseError('Failed to load records for duplicate detection', error)

    return (data ?? []).map((row: Record<string, any>) => ({
      id: row.id,
      name: row[config.nameColumn] ?? '',
      phone: row.phone ?? null,
      email: row.email ?? null,
      identifier: entity === 'product' ? row.barcode || row.sku || null : null,
      createdAt: row.created_at ?? undefined,
    }))
  }

  /**
   * Candidate duplicates, strongest first.
   *
   * The comparison is O(n²) over a bounded set, which is honest for 2,000
   * records and would not be for 200,000. When a workspace outgrows that, the
   * fix is a blocking key on the normalised phone — not a lower limit that
   * silently stops finding duplicates.
   */
  async findDuplicates(ctx: TenancyContext, entity: MdmEntity, minScore = 0.5) {
    const cacheKey = this.key(ctx.workspaceId, 'duplicates', entity, String(minScore))

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const records = await this.load(ctx, entity)
    const byId = new Map(records.map((record) => [record.id, record]))

    const candidates = findDuplicates(records, minScore).map((candidate) => ({
      ...candidate,
      left: byId.get(candidate.leftId),
      right: byId.get(candidate.rightId),
      suggestedSurvivorId: pickSurvivor(byId.get(candidate.leftId)!, byId.get(candidate.rightId)!)
        .id,
    }))

    const result = { entity, scanned: records.length, candidates }
    await memoryCache.set(cacheKey, result, 300)
    return result
  }

  /** Score one specific pair, for a screen showing them side by side. */
  async comparePair(ctx: TenancyContext, entity: MdmEntity, leftId: string, rightId: string) {
    const records = await this.load(ctx, entity)
    const left = records.find((record) => record.id === leftId)
    const right = records.find((record) => record.id === rightId)

    if (!left || !right) throw new NotFoundError('Record')

    return {
      left,
      right,
      candidate: scorePair(left, right),
      suggestedSurvivor: pickSurvivor(left, right),
      preview: goldenRecord(
        pickSurvivor(left, right),
        pickSurvivor(left, right) === left ? right : left,
      ),
    }
  }

  /**
   * Merge two records, on a person's explicit instruction.
   *
   * Everything pointing at the absorbed record is repointed at the survivor,
   * the survivor is filled in from what the absorbed record knew and it did
   * not, and the absorbed record is soft-deleted with a pointer to where it
   * went.
   *
   * The absorbed row is NOT hard-deleted. Somebody holding a printed invoice
   * with the old id must still be able to find out what happened to it.
   */
  async merge(
    ctx: TenancyContext,
    entity: MdmEntity,
    input: { survivorId: string; absorbedId: string; reason: string },
  ) {
    // Merging moves debts and history between identities. Manager or owner.
    if (ctx.role !== 'owner' && ctx.role !== 'manager') {
      throw new ConflictError('MERGE_FORBIDDEN')
    }

    const config = ENTITY_CONFIG[entity]
    const records = await this.load(ctx, entity)
    const known = new Set(records.map((record) => record.id))

    const problems = validateMerge(input.survivorId, input.absorbedId, input.reason, known)
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    const survivor = records.find((record) => record.id === input.survivorId)!
    const absorbed = records.find((record) => record.id === input.absorbedId)!

    // Recorded FIRST. If the reference moves fail halfway, the record of what
    // was attempted still exists — a half-finished merge with no trace is the
    // worst outcome available here.
    const { data: mergeRow, error: recordError } = await supabase
      .from('mdm_merges')
      .insert({
        workspace_id: ctx.workspaceId,
        entity,
        survivor_id: input.survivorId,
        absorbed_id: input.absorbedId,
        absorbed_snapshot: absorbed,
        reason: input.reason,
        merged_by: ctx.userId,
      })
      .select('id')
      .single()

    if (recordError) throw new DatabaseError('Failed to record the merge', recordError)

    const moved: Record<string, number> = {}

    for (const reference of config.references) {
      const { error, count } = await supabase
        .from(reference.table)
        .update({ [reference.column]: input.survivorId }, { count: 'exact' })
        .eq('workspace_id', ctx.workspaceId)
        .eq(reference.column, input.absorbedId)

      if (error) {
        // Reported, not swallowed: a reference table that did not move leaves
        // history split across two identities, which is the exact problem the
        // merge was meant to fix.
        console.error(`[MDM] failed to move ${reference.table}.${reference.column}:`, error)
        throw new DatabaseError(`Failed to move ${reference.table} during merge`, error)
      }

      moved[reference.table] = count ?? 0
    }

    const golden = goldenRecord(survivor, absorbed)
    const fill: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (entity !== 'product') {
      if (!survivor.phone && golden.phone) fill.phone = golden.phone
      if (!survivor.email && golden.email) fill.email = golden.email
    }

    if (Object.keys(fill).length > 1) {
      const { error } = await supabase
        .from(config.table)
        .update(fill)
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', input.survivorId)

      if (error) throw new DatabaseError('Failed to update the surviving record', error)
    }

    const { error: deleteError } = await supabase
      .from(config.table)
      .update(
        config.retiredBy === 'is_active'
          ? { is_active: false, merged_into_id: input.survivorId }
          : { deleted_at: new Date().toISOString(), merged_into_id: input.survivorId },
      )
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', input.absorbedId)

    if (deleteError) throw new DatabaseError('Failed to retire the absorbed record', deleteError)

    await memoryCache.invalidate(`mdm:${ctx.workspaceId}`)
    await memoryCache.invalidate(
      `${entity === 'customer' ? 'customers' : entity + 's'}:${ctx.workspaceId}`,
    )

    return {
      mergeId: mergeRow?.id,
      survivorId: input.survivorId,
      absorbedId: input.absorbedId,
      moved,
    }
  }

  async listMerges(ctx: TenancyContext, limit = 100) {
    const { data, error } = await supabase
      .from('mdm_merges')
      .select('id, entity, survivor_id, absorbed_id, reason, merged_by, created_at')
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 500))

    if (error) throw new DatabaseError('Failed to fetch merge history', error)
    return data ?? []
  }
}
