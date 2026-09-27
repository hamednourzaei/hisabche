// ============================================
// backend/src/services/traceability/traceability.service.ts
//
// Batches, serial numbers and expiry against real rows.
// ============================================

import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { memoryCache } from '../../utils/pagination'
import { fetchAllPages } from '../../utils/fetch-all-pages'
import type { TenancyContext } from '../tenancy.service'

import {
  bucketByExpiry,
  expiredValueMinor,
  planAllocation,
  serialCostMinor,
  validateSerialIssue,
  type AllocationStrategy,
  type SerialUnit,
  type StockBatch,
  type TrackingMode,
} from './lot.domain'

const BATCH_COLUMNS =
  'id, product_id, batch_number, expiry_date, manufactured_date, received_qty, remaining_qty, cost_layer_id, warehouse_id, received_on'

const SERIAL_COLUMNS =
  'id, product_id, serial_number, status, batch_id, cost_layer_id, unit_cost_minor, warehouse_id, received_on'

function mapBatch(raw: Record<string, any>): StockBatch {
  return {
    id: raw.id,
    productId: raw.product_id,
    batchNumber: raw.batch_number,
    expiryDate: raw.expiry_date ? String(raw.expiry_date).slice(0, 10) : null,
    manufacturedDate: raw.manufactured_date ? String(raw.manufactured_date).slice(0, 10) : null,
    receivedQty: Number(raw.received_qty) || 0,
    remainingQty: Number(raw.remaining_qty) || 0,
    costLayerId: raw.cost_layer_id ?? null,
    warehouseId: raw.warehouse_id ?? null,
    receivedOn: String(raw.received_on ?? '').slice(0, 10),
  }
}

function mapSerial(raw: Record<string, any>): SerialUnit {
  return {
    id: raw.id,
    productId: raw.product_id,
    serialNumber: raw.serial_number,
    status: raw.status,
    batchId: raw.batch_id ?? null,
    costLayerId: raw.cost_layer_id ?? null,
    unitCostMinor: Number(raw.unit_cost_minor) || 0,
    warehouseId: raw.warehouse_id ?? null,
    receivedOn: String(raw.received_on ?? '').slice(0, 10),
  }
}

const today = () => new Date().toISOString().slice(0, 10)

export class TraceabilityService {
  private async invalidate(workspaceId: string) {
    await memoryCache.invalidate(`traceability:${workspaceId}`)
  }

  /** How a product is tracked. `none` for most goods, and that is correct. */
  async getTrackingMode(ctx: TenancyContext, productId: string): Promise<TrackingMode> {
    const { data, error } = await supabase
      .from('products')
      .select('tracking_mode')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', productId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to read the tracking mode', error)
    return (data?.tracking_mode as TrackingMode) ?? 'none'
  }

  async setTrackingMode(ctx: TenancyContext, productId: string, mode: TrackingMode) {
    if (ctx.role === 'seller') throw new ConflictError('TRACKING_MANAGE_FORBIDDEN')

    // Turning tracking ON for a product that already has stock leaves that
    // stock untracked and unsellable under the new rule. Refused rather than
    // silently creating a product nobody can sell.
    if (mode !== 'none') {
      const { count } = await supabase
        .from('cost_layers')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', ctx.workspaceId)
        .eq('product_id', productId)
        .gt('remaining_qty', 0)

      if ((count ?? 0) > 0) throw new ConflictError('TRACKING_CHANGE_HAS_STOCK')
    }

    const { error } = await supabase
      .from('products')
      .update({ tracking_mode: mode })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', productId)

    if (error) throw new DatabaseError('Failed to set the tracking mode', error)
    await this.invalidate(ctx.workspaceId)
  }

  // ─── Batches ──────────────────────────────────────────────────────────────

  async listBatches(
    ctx: TenancyContext,
    filters: { productId?: string; openOnly?: boolean } = {},
  ): Promise<StockBatch[]> {
    // ⚠️ EVERY open batch, in ordered pages (27 Sep 2026). This was
    // `.limit(5000)`, which PostgREST silently caps at max-rows (1000) — and
    // the FEFO plan and the expired-value report are DECISIONS computed over
    // this list. `id` last makes the page order total, so no batch is seen
    // twice or skipped. Per product, the order matches stock_batches_fefo_idx.
    const data = await fetchAllPages((from, to) => {
      let query = supabase
        .from('stock_batches')
        .select(BATCH_COLUMNS)
        .eq('workspace_id', ctx.workspaceId)
      if (filters.productId) query = query.eq('product_id', filters.productId)
      if (filters.openOnly !== false) query = query.gt('remaining_qty', 0)
      return (
        query
          // Soonest expiry first, nulls last — the FEFO order.
          .order('expiry_date', { ascending: true, nullsFirst: false })
          .order('received_on', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)
      )
    }, 'Failed to fetch batches')
    return data.map(mapBatch)
  }

  async receiveBatch(
    ctx: TenancyContext,
    input: {
      productId: string
      batchNumber: string
      quantity: number
      expiryDate?: string | null | undefined
      manufacturedDate?: string | null | undefined
      costLayerId?: string | null | undefined
      warehouseId?: string | null | undefined
      receivedOn?: string | undefined
    },
  ): Promise<StockBatch> {
    if (input.quantity <= 0) throw new ValidationError('BATCH_QUANTITY_INVALID')

    const { data, error } = await supabase
      .from('stock_batches')
      .insert({
        workspace_id: ctx.workspaceId,
        product_id: input.productId,
        batch_number: input.batchNumber,
        expiry_date: input.expiryDate ?? null,
        manufactured_date: input.manufacturedDate ?? null,
        received_qty: input.quantity,
        remaining_qty: input.quantity,
        cost_layer_id: input.costLayerId ?? null,
        warehouse_id: input.warehouseId ?? null,
        received_on: (input.receivedOn ?? today()).slice(0, 10),
        created_by: ctx.userId,
      })
      .select(BATCH_COLUMNS)
      .single()

    if (error) {
      if (error.code === '23505') throw new ConflictError('BATCH_NUMBER_DUPLICATE')
      throw new DatabaseError('Failed to receive the batch', error)
    }

    await this.invalidate(ctx.workspaceId)
    return mapBatch(data)
  }

  /**
   * Correct a batch's expiry (request #95) — the date was mistyped, or the
   * label says something else.
   *
   * ⚠️ ONLY the dates. Quantities are what the batch has already given out and
   * taken in; letting a screen rewrite them would break the FEFO queue and the
   * lot trail that says which goods went to which invoice.
   */
  async updateBatchDates(
    ctx: TenancyContext,
    batchId: string,
    input: { expiryDate?: string | null | undefined; manufacturedDate?: string | null | undefined },
  ): Promise<StockBatch> {
    const patch: Record<string, string | null> = {}
    if (input.expiryDate !== undefined) patch.expiry_date = input.expiryDate
    if (input.manufacturedDate !== undefined) patch.manufactured_date = input.manufacturedDate
    if (Object.keys(patch).length === 0) throw new ValidationError('BATCH_NOTHING_TO_UPDATE')

    const { data, error } = await supabase
      .from('stock_batches')
      .update(patch)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', batchId)
      .select(BATCH_COLUMNS)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to update the batch', error)
    if (!data) throw new NotFoundError('Batch')

    await this.invalidate(ctx.workspaceId)
    return mapBatch(data)
  }

  /**
   * Which batches an issue would take, without taking them.
   *
   * FEFO by default: goods received later can expire sooner, and FIFO would
   * ship the older carton and leave the sooner-expiring one to be written off.
   */
  async planIssue(
    ctx: TenancyContext,
    input: {
      productId: string
      quantity: number
      strategy?: AllocationStrategy | undefined
      asOf?: string | undefined
      manual?: Array<{ batchId: string; quantity: number }> | undefined
    },
  ) {
    const batches = await this.listBatches(ctx, { productId: input.productId })

    return planAllocation(batches, input.quantity, {
      strategy: input.strategy ?? 'fefo',
      asOf: (input.asOf ?? today()).slice(0, 10),
      ...(input.manual
        ? {
            manual: input.manual.map((row) => ({
              batchId: row.batchId,
              batchNumber: '',
              quantity: row.quantity,
              expiryDate: null,
              costLayerId: null,
            })),
          }
        : {}),
    })
  }

  /**
   * Take the stock and record which batches it came from.
   *
   * Refuses when no usable batch covers the quantity: for a tracked product,
   * "sold something we cannot identify" is not a state worth having. Expired
   * batches are excluded and reported, never quietly consumed.
   */
  async issueFromBatches(
    ctx: TenancyContext,
    input: {
      productId: string
      quantity: number
      consumerType: string
      consumerId: string
      consumerLine?: string | undefined
      strategy?: AllocationStrategy | undefined
      asOf?: string | undefined
      manual?: Array<{ batchId: string; quantity: number }> | undefined
    },
  ) {
    const plan = await this.planIssue(ctx, input)

    if (plan.shortfall > 0) {
      throw new ConflictError(
        plan.blockedByExpiry.length > 0 ? 'BATCH_ONLY_EXPIRED_STOCK' : 'BATCH_INSUFFICIENT_STOCK',
      )
    }

    const entryDate = (input.asOf ?? today()).slice(0, 10)

    for (const allocation of plan.allocations) {
      const { error } = await supabase.rpc('traceability_consume_batch', {
        p_workspace_id: ctx.workspaceId,
        p_batch_id: allocation.batchId,
        p_quantity: allocation.quantity,
      })

      // No RPC deployed yet: fall back to a guarded update that still cannot
      // over-consume, because the CHECK constraint refuses a negative
      // remainder. Slower and racier than the function, and it says so.
      if (error) {
        const { data: batch } = await supabase
          .from('stock_batches')
          .select('remaining_qty')
          .eq('workspace_id', ctx.workspaceId)
          .eq('id', allocation.batchId)
          .single()

        const remaining = (Number(batch?.remaining_qty) || 0) - allocation.quantity
        if (remaining < 0) throw new ConflictError('BATCH_INSUFFICIENT_STOCK')

        const { error: updateError } = await supabase
          .from('stock_batches')
          .update({ remaining_qty: remaining })
          .eq('workspace_id', ctx.workspaceId)
          .eq('id', allocation.batchId)

        if (updateError) throw new DatabaseError('Failed to consume the batch', updateError)
      }

      const { error: allocationError } = await supabase.from('lot_allocations').insert({
        workspace_id: ctx.workspaceId,
        consumer_type: input.consumerType,
        consumer_id: input.consumerId,
        consumer_line: input.consumerLine ?? null,
        product_id: input.productId,
        batch_id: allocation.batchId,
        quantity: allocation.quantity,
        entry_date: entryDate,
      })

      if (allocationError)
        throw new DatabaseError('Failed to record the allocation', allocationError)
    }

    await this.invalidate(ctx.workspaceId)
    return plan
  }

  // ─── Serial numbers ───────────────────────────────────────────────────────

  async listSerials(
    ctx: TenancyContext,
    filters: { productId?: string; status?: string } = {},
  ): Promise<SerialUnit[]> {
    let query = supabase
      .from('stock_serials')
      .select(SERIAL_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .order('received_on')
      .limit(5000)

    if (filters.productId) query = query.eq('product_id', filters.productId)
    query = query.eq('status', filters.status ?? 'in_stock')

    const { data, error } = await query
    if (error) throw new DatabaseError('Failed to fetch serial numbers', error)
    return (data ?? []).map(mapSerial)
  }

  async receiveSerials(
    ctx: TenancyContext,
    input: {
      productId: string
      serialNumbers: string[]
      unitCostMinor: number
      batchId?: string | null | undefined
      costLayerId?: string | null | undefined
      warehouseId?: string | null | undefined
      receivedOn?: string | undefined
    },
  ) {
    if (input.serialNumbers.length === 0) throw new ValidationError('SERIAL_COUNT_MISMATCH')
    if (new Set(input.serialNumbers).size !== input.serialNumbers.length) {
      throw new ValidationError('SERIAL_DUPLICATE')
    }

    const { data, error } = await supabase
      .from('stock_serials')
      .insert(
        input.serialNumbers.map((serialNumber) => ({
          workspace_id: ctx.workspaceId,
          product_id: input.productId,
          serial_number: serialNumber,
          status: 'in_stock',
          batch_id: input.batchId ?? null,
          cost_layer_id: input.costLayerId ?? null,
          unit_cost_minor: input.unitCostMinor,
          warehouse_id: input.warehouseId ?? null,
          received_on: (input.receivedOn ?? today()).slice(0, 10),
        })),
      )
      .select(SERIAL_COLUMNS)

    if (error) {
      if (error.code === '23505') throw new ConflictError('SERIAL_DUPLICATE')
      throw new DatabaseError('Failed to receive the serial numbers', error)
    }

    await this.invalidate(ctx.workspaceId)
    return (data ?? []).map(mapSerial)
  }

  /**
   * Sell specific units.
   *
   * Costed from each unit's OWN layer — the point of serial tracking. The
   * status update is guarded on `in_stock` so two tills cannot both sell the
   * same phone.
   */
  async issueSerials(
    ctx: TenancyContext,
    input: {
      productId: string
      serialNumbers: string[]
      quantity: number
      consumerType: string
      consumerId: string
      consumerLine?: string | undefined
      asOf?: string | undefined
    },
  ) {
    const available = await this.listSerials(ctx, { productId: input.productId })

    const problems = validateSerialIssue(input.serialNumbers, available, {
      productId: input.productId,
      quantity: input.quantity,
    })
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    const costMinor = serialCostMinor(input.serialNumbers, available)
    const entryDate = (input.asOf ?? today()).slice(0, 10)

    const { data, error } = await supabase
      .from('stock_serials')
      .update({ status: 'sold', invoice_id: input.consumerId, sold_on: entryDate })
      .eq('workspace_id', ctx.workspaceId)
      .eq('product_id', input.productId)
      .in('serial_number', input.serialNumbers)
      .eq('status', 'in_stock')
      .select('id')

    if (error) throw new DatabaseError('Failed to issue the serial numbers', error)

    if ((data ?? []).length !== input.serialNumbers.length) {
      // Somebody else sold one between the check and the write.
      throw new ConflictError('SERIAL_NOT_IN_STOCK')
    }

    await supabase.from('lot_allocations').insert(
      (data ?? []).map((row) => ({
        workspace_id: ctx.workspaceId,
        consumer_type: input.consumerType,
        consumer_id: input.consumerId,
        consumer_line: input.consumerLine ?? null,
        product_id: input.productId,
        serial_id: row.id,
        quantity: 1,
        entry_date: entryDate,
      })),
    )

    await this.invalidate(ctx.workspaceId)
    return { issued: input.serialNumbers.length, costMinor }
  }

  // ─── Expiry ───────────────────────────────────────────────────────────────

  async getExpiryReport(ctx: TenancyContext, asOf = today(), nearExpiryDays = 30) {
    const batches = await this.listBatches(ctx)

    const layerIds = [...new Set(batches.map((b) => b.costLayerId).filter(Boolean))] as string[]

    // A failed cost read is an error, not «these goods cost nothing» — the
    // expired value is a write-off figure (§7.3). Chunked: an `in()` with
    // thousands of ids is a URL PostgREST refuses.
    const costs = new Map<string, number>()
    for (let i = 0; i < layerIds.length; i += 200) {
      const { data, error } = await supabase
        .from('cost_layers')
        .select('id, unit_cost')
        .eq('workspace_id', ctx.workspaceId)
        .in('id', layerIds.slice(i, i + 200))
      if (error) throw new DatabaseError('Failed to read batch costs', error)

      for (const row of data ?? []) {
        costs.set(row.id, Math.round((Number(row.unit_cost) || 0) * 100))
      }
    }

    return {
      asOf,
      buckets: bucketByExpiry(batches, asOf, nearExpiryDays),
      // Inventory the balance sheet still counts and the shop can no longer
      // sell. The gap between those two facts is what a write-off decision
      // needs.
      expiredValueMinor: expiredValueMinor(batches, costs, asOf),
    }
  }

  /** The trail from a document back to the exact physical goods. */
  async getTrail(ctx: TenancyContext, consumerType: string, consumerId: string) {
    const { data, error } = await supabase
      .from('lot_allocations')
      .select(
        'id, product_id, batch_id, serial_id, quantity, entry_date, batch:stock_batches(batch_number, expiry_date), serial:stock_serials(serial_number)',
      )
      .eq('workspace_id', ctx.workspaceId)
      .eq('consumer_type', consumerType)
      .eq('consumer_id', consumerId)
      .limit(1000)

    if (error) throw new DatabaseError('Failed to fetch the lot trail', error)
    if ((data ?? []).length === 0) throw new NotFoundError('Lot trail')
    return data
  }
}
