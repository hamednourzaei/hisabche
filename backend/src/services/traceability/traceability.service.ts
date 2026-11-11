// ============================================
// backend/src/services/traceability/traceability.service.ts
//
// Batches, serial numbers and expiry against real rows.
// ============================================

import {
  routeReturnedSerial,
  routeReturnConditionDisposition,
  type ReturnCondition,
} from '@hisabche/validation'
import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { memoryCache } from '../../utils/pagination'
import { fetchAllPages, selectAllPages } from '../../utils/fetch-all-pages'
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

const LEGACY_SERIAL_COLUMNS =
  'id, product_id, serial_number, status, batch_id, cost_layer_id, unit_cost_minor, warehouse_id, received_on, invoice_id, sold_on'

const SERIAL_COLUMNS = `${LEGACY_SERIAL_COLUMNS}, reserved_for_customer_id, reserved_until`

/** A `stock_batches` row as PostgREST returns it. */
interface BatchRow {
  id: string
  product_id: string
  batch_number: string
  expiry_date: string | null
  manufactured_date: string | null
  received_qty: number | string | null
  remaining_qty: number | string | null
  cost_layer_id: string | null
  warehouse_id: string | null
  received_on: string | null
}

/** A `stock_serials` row as PostgREST returns it. */
interface SerialRow {
  id: string
  product_id: string
  serial_number: string
  status: SerialUnit['status']
  batch_id: string | null
  cost_layer_id: string | null
  unit_cost_minor: number | string | null
  warehouse_id: string | null
  received_on: string | null
  invoice_id?: string | null
  sold_on?: string | null
  reserved_for_customer_id?: string | null
  reserved_until?: string | null
}

function mapBatch(raw: BatchRow): StockBatch {
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

function mapSerial(raw: SerialRow): SerialUnit {
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
    // Where a sold unit went — the invoice that handed it over.
    invoiceId: raw.invoice_id ?? null,
    soldOn: raw.sold_on ? String(raw.sold_on).slice(0, 10) : null,
    reservedForCustomerId: raw.reserved_for_customer_id ?? null,
    reservedUntil: raw.reserved_until ? String(raw.reserved_until) : null,
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

  /**
   * Which batches a recorded SALE took (V55 final completion).
   *
   * The offline engine runs the same claim on the device
   * (packages/local-engine/src/routes/batches.ts, POST /operations/batches/issue)
   * against the SAME shared `planAllocation` core. The gates here mirror the
   * device's: a recorded non-cancelled SALE, the product actually on the
   * invoice, and a replay that cannot take the shelf twice — the allocations
   * already recorded for this invoice count against the sale.
   */
  async issueBatchesForSale(
    ctx: TenancyContext,
    input: {
      invoiceId: string
      productId: string
      quantity: number
      strategy?: AllocationStrategy | undefined
      asOf?: string | undefined
      manual?: Array<{ batchId: string; quantity: number }> | undefined
      consumerLine?: string | undefined
    },
  ) {
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('type, status')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', input.invoiceId)
      .maybeSingle()
    if (invoiceError) throw new DatabaseError('Failed to read the invoice', invoiceError)
    if (!invoice) throw new NotFoundError('Invoice')
    if (invoice.type === 'purchase') throw new ConflictError('BATCH_SALE_ONLY')
    if (invoice.status === 'cancelled') throw new ConflictError('BATCH_INVOICE_CANCELLED')

    const { data: lines, error: linesError } = await supabase
      .from('invoice_items')
      .select('quantity')
      .eq('workspace_id', ctx.workspaceId)
      .eq('invoice_id', input.invoiceId)
      .eq('product_id', input.productId)
    if (linesError) throw new DatabaseError('Failed to read the invoice lines', linesError)
    const sold = (lines ?? []).reduce((sum, line) => sum + (Number(line.quantity) || 0), 0)
    if (sold <= 0) throw new ConflictError('BATCH_PRODUCT_NOT_ON_INVOICE')

    const { data: recorded, error: recordedError } = await supabase
      .from('lot_allocations')
      .select('quantity')
      .eq('workspace_id', ctx.workspaceId)
      .eq('consumer_type', 'invoice')
      .eq('consumer_id', input.invoiceId)
      .eq('product_id', input.productId)
      .not('batch_id', 'is', null)
    // A database before `lot_allocations` (42P01 / PGRST205) has recorded
    // nothing — the same tolerant read the purchase binding keeps for
    // pre-schema tables. Any other failure is real and surfaces.
    if (recordedError && recordedError.code !== '42P01' && recordedError.code !== 'PGRST205') {
      throw new DatabaseError('Failed to read the recorded allocations', recordedError)
    }
    const already = (recorded ?? []).reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)
    if (already + input.quantity > sold) throw new ConflictError('BATCH_COUNT_MISMATCH')

    return this.issueFromBatches(ctx, {
      productId: input.productId,
      quantity: input.quantity,
      consumerType: 'invoice',
      consumerId: input.invoiceId,
      ...(input.consumerLine !== undefined ? { consumerLine: input.consumerLine } : {}),
      ...(input.strategy !== undefined ? { strategy: input.strategy } : {}),
      ...(input.asOf !== undefined ? { asOf: input.asOf } : {}),
      ...(input.manual !== undefined ? { manual: input.manual } : {}),
    })
  }

  // ─── Serial numbers ───────────────────────────────────────────────────────

  async listSerials(
    ctx: TenancyContext,
    filters: { productId?: string; status?: string; invoiceId?: string } = {},
  ): Promise<SerialUnit[]> {
    const runQuery = (columns: string) =>
      selectAllPages((lo, hi) => {
        let query = supabase
          .from('stock_serials')
          .select(columns)
          .eq('workspace_id', ctx.workspaceId)
        if (filters.productId) query = query.eq('product_id', filters.productId)
        if (filters.invoiceId) query = query.eq('invoice_id', filters.invoiceId)
        // 'all' = every status (the product page's look-up); default in stock.
        if (filters.status !== 'all') query = query.eq('status', filters.status ?? 'in_stock')
        return query.order('received_on').order('id', { ascending: true }).range(lo, hi)
      })
    let { data, error } = await runQuery(SERIAL_COLUMNS)
    if (error && (error.code === '42703' || error.code === 'PGRST204')) {
      ;({ data, error } = await runQuery(LEGACY_SERIAL_COLUMNS))
    }
    if (error) throw new DatabaseError('Failed to fetch serial numbers', error)
    return (data ?? []).map((row) => mapSerial(row as unknown as SerialRow))
  }

  /**
   * Hold a unit for one customer (optionally expiring at `expiresAt` / `holdMinutes`),
   * or release the hold (retail-ops-01 + mobile-serial-01).
   * Uses row-locked `serial_hold_with_expiry` RPC when present so expired holds
   * auto-release and two competing devices cannot both win the same IMEI.
   */
  async holdSerial(
    ctx: TenancyContext,
    serialId: string,
    customerId: string | null,
    options?: {
      expiresAt?: string | null | undefined
      holdMinutes?: number | null | undefined
    },
  ) {
    const resolvedExpiresAt =
      customerId === null
        ? null
        : options?.expiresAt
          ? options.expiresAt
          : options?.holdMinutes
            ? new Date(Date.now() + options.holdMinutes * 60_000).toISOString()
            : null

    if (customerId) {
      const { data: customer, error } = await supabase
        .from('customers')
        .select('id')
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', customerId)
        .maybeSingle()
      if (error) throw new DatabaseError('Failed to read the customer', error)
      if (!customer) throw new ValidationError('SERIAL_HOLD_CUSTOMER_NOT_FOUND')
    }

    // Prefer the atomic FOR UPDATE database function (`mobile-serial-01-migration.sql`).
    const { data: rpcRows, error: rpcErr } = await supabase.rpc('serial_hold_with_expiry', {
      p_workspace_id: ctx.workspaceId,
      p_serial_id: serialId,
      p_customer_id: customerId,
      p_expires_at: resolvedExpiresAt,
    })
    if (!rpcErr && Array.isArray(rpcRows) && rpcRows.length > 0) {
      const row = rpcRows[0] as {
        id: string
        status: string
        reserved_for_customer_id: string | null
        reserved_until: string | null
      }
      await this.invalidate(ctx.workspaceId)
      return {
        id: row.id,
        status: row.status,
        heldForCustomerId: row.reserved_for_customer_id ?? null,
        reservedUntil: row.reserved_until ?? null,
      }
    }
    if (rpcErr && rpcErr.code !== '42883' && rpcErr.code !== 'PGRST202') {
      const msg = rpcErr.message ?? ''
      if (msg.includes('SERIAL_RESERVED_FOR_ANOTHER_CUSTOMER')) {
        throw new ConflictError('SERIAL_RESERVED_FOR_ANOTHER_CUSTOMER')
      }
      if (
        msg.includes('SERIAL_NOT_IN_STOCK') ||
        msg.includes('SERIAL_NOT_HELD') ||
        msg.includes('SERIAL_HOLD_CUSTOMER_NOT_FOUND')
      ) {
        throw new ValidationError(msg)
      }
      if (msg.includes('SERIAL_NOT_FOUND')) {
        throw new NotFoundError('Serial')
      }
      throw new DatabaseError('Failed to hold the unit', rpcErr)
    }

    // Pre-migration / unit-mock fallback: release an expired hold first, then CAS on status.
    const nowIso = new Date().toISOString()
    if (customerId) {
      await supabase
        .from('stock_serials')
        .update({ status: 'in_stock', reserved_for_customer_id: null, reserved_until: null })
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', serialId)
        .eq('status', 'reserved')
        .lte('reserved_until', nowIso)
    }

    const patchWithExpiry = customerId
      ? {
          status: 'reserved',
          reserved_for_customer_id: customerId,
          ...(resolvedExpiresAt !== null ? { reserved_until: resolvedExpiresAt } : {}),
        }
      : { status: 'in_stock', reserved_for_customer_id: null, reserved_until: null }

    let { data, error } = await supabase
      .from('stock_serials')
      .update(patchWithExpiry)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', serialId)
      .eq('status', customerId ? 'in_stock' : 'reserved')
      .select('id, status, reserved_for_customer_id, reserved_until')
      .maybeSingle()

    if (error && (error.code === '42703' || error.code === 'PGRST204')) {
      ;({ data, error } = await supabase
        .from('stock_serials')
        .update(
          customerId
            ? { status: 'reserved', reserved_for_customer_id: customerId }
            : { status: 'in_stock', reserved_for_customer_id: null },
        )
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', serialId)
        .eq('status', customerId ? 'in_stock' : 'reserved')
        .select('id, status, reserved_for_customer_id')
        .maybeSingle())
    }

    if (error && (error.code === '42703' || error.code === '23514' || error.code === 'PGRST204')) {
      throw new ValidationError('SERIAL_HOLD_NOT_READY')
    }
    if (error) throw new DatabaseError('Failed to hold the unit', error)
    if (!data) throw new ConflictError(customerId ? 'SERIAL_NOT_IN_STOCK' : 'SERIAL_NOT_HELD')
    await this.invalidate(ctx.workspaceId)
    const row = data as {
      id: string
      status: string
      reserved_for_customer_id?: string | null
      reserved_until?: string | null
    }
    return {
      id: row.id,
      status: row.status,
      heldForCustomerId: row.reserved_for_customer_id ?? null,
      reservedUntil: row.reserved_until ?? null,
    }
  }

  /** Release every expired serial hold in the workspace (`mobile-serial-01`). */
  async releaseExpiredHolds(ctx: TenancyContext) {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('serial_release_expired_holds', {
      p_workspace_id: ctx.workspaceId,
    })
    if (!rpcErr && Array.isArray(rpcData)) {
      const releasedIds = (rpcData as Array<{ released_id?: string }>)
        .map((r) => r.released_id)
        .filter((v): v is string => typeof v === 'string')
      await this.invalidate(ctx.workspaceId)
      return { releasedCount: releasedIds.length, releasedIds }
    }
    if (rpcErr && rpcErr.code !== '42883' && rpcErr.code !== 'PGRST202') {
      throw new DatabaseError('Failed to release expired serial holds', rpcErr)
    }

    const nowIso = new Date().toISOString()
    const { data, error } = await supabase
      .from('stock_serials')
      .update({ status: 'in_stock', reserved_for_customer_id: null, reserved_until: null })
      .eq('workspace_id', ctx.workspaceId)
      .eq('status', 'reserved')
      .lte('reserved_until', nowIso)
      .select('id')
    if (error && (error.code === '42703' || error.code === 'PGRST204')) {
      return { releasedCount: 0, releasedIds: [] as string[] }
    }
    if (error) throw new DatabaseError('Failed to release expired serial holds', error)
    const releasedIds = (data ?? []).map((r) => String((r as { id: string }).id))
    await this.invalidate(ctx.workspaceId)
    return { releasedCount: releasedIds.length, releasedIds }
  }

  /** Who each active held unit of a product is held for. Empty before retail-ops-01. */
  async serialHolds(ctx: TenancyContext, productId: string) {
    type HoldQueryRow = {
      id: string
      reserved_for_customer_id: string
      reserved_until?: string | null
    }
    const primary = await supabase
      .from('stock_serials')
      .select('id, reserved_for_customer_id, reserved_until')
      .eq('workspace_id', ctx.workspaceId)
      .eq('product_id', productId)
      .eq('status', 'reserved')
    let rows = primary.data as HoldQueryRow[] | null
    let error = primary.error
    if (error && (error.code === '42703' || error.code === 'PGRST204')) {
      const legacy = await supabase
        .from('stock_serials')
        .select('id, reserved_for_customer_id')
        .eq('workspace_id', ctx.workspaceId)
        .eq('product_id', productId)
        .eq('status', 'reserved')
      rows = legacy.data as HoldQueryRow[] | null
      error = legacy.error
    }
    if (error && (error.code === '42703' || error.code === 'PGRST204')) return []
    if (error) throw new DatabaseError('Failed to read the held units', error)
    return (rows ?? []).map((r) => ({
      serialId: r.id,
      customerId: r.reserved_for_customer_id,
      reservedUntil: r.reserved_until ?? null,
    }))
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

    // Workspace-wide IMEI uniqueness: an IMEI already belonging to another product
    // or unit in the workspace is refused cleanly instead of corrupting stock identity.
    const { data: existingWs, error: dupCheckError } = await supabase
      .from('stock_serials')
      .select('serial_number')
      .eq('workspace_id', ctx.workspaceId)
      .in('serial_number', input.serialNumbers)
      .limit(1)
    if (dupCheckError) {
      throw new DatabaseError('Failed to check serial uniqueness', dupCheckError)
    }
    if ((existingWs ?? []).length > 0) {
      throw new ConflictError('SERIAL_DUPLICATE')
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

  /**
   * Name the exact units a SALE handed over (QA report, Mobile Retail DNA:
   * «فروش = انتخاب IMEI مشخص، نه یک عدد از مدل»).
   *
   * `issueSerials` was written and tested and had no caller: a phone sold on
   * an invoice stayed «in stock» by serial for ever. The invoice is recorded
   * first (stock and money move there, as for any product); this then marks
   * the named units sold ON that invoice. It never moves stock or cost a
   * second time. Deleting the invoice frees them again (`releaseClaims`).
   *
   * Refused when the invoice is not this workspace's sale, does not carry the
   * product, or would end up with more serials than units sold.
   */
  async assignSerialsToSale(
    ctx: TenancyContext,
    input: { invoiceId: string; productId: string; serialNumbers: string[] },
  ) {
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, type, status, customer_id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', input.invoiceId)
      .maybeSingle()
    if (invoiceError) throw new DatabaseError('Failed to read the invoice', invoiceError)
    if (!invoice) throw new NotFoundError('INVOICE_NOT_FOUND')
    const row = invoice as {
      type?: string | null
      status?: string | null
      customer_id?: string | null
    }
    if (row.type === 'purchase') throw new ValidationError('SERIAL_SALE_ONLY')
    if (row.status === 'cancelled') throw new ValidationError('SERIAL_INVOICE_CANCELLED')

    // Refuse any unit with a non-expired hold for a DIFFERENT customer; release matching or expired holds before issuing.
    const holds = await this.serialHolds(ctx, input.productId)
    if (holds.length > 0) {
      const nowMs = Date.now()
      const units = await this.listSerials(ctx, { productId: input.productId, status: 'all' })
      const holdMap = new Map(holds.map((h) => [h.serialId, h]))
      const bySerial = new Map(units.map((u) => [u.serialNumber, u]))
      for (const serialNumber of input.serialNumbers) {
        const unit = bySerial.get(serialNumber)
        if (!unit) continue
        const hold = holdMap.get(unit.id)
        if (!hold) continue
        const expired = Boolean(hold.reservedUntil && Date.parse(hold.reservedUntil) <= nowMs)
        if (!expired && hold.customerId !== row.customer_id) {
          throw new ConflictError('SERIAL_RESERVED_FOR_ANOTHER_CUSTOMER')
        }
        await this.holdSerial(ctx, unit.id, null)
      }
    }

    const { data: lines, error: linesError } = await supabase
      .from('invoice_items')
      .select('quantity')
      .eq('invoice_id', input.invoiceId)
      .eq('product_id', input.productId)
    if (linesError) throw new DatabaseError('Failed to read the invoice lines', linesError)
    const sold = (lines ?? []).reduce(
      (sum, line) => sum + (Number((line as { quantity?: unknown }).quantity) || 0),
      0,
    )
    if (sold <= 0) throw new ValidationError('SERIAL_PRODUCT_NOT_ON_INVOICE')

    const { count, error: countError } = await supabase
      .from('stock_serials')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId)
      .eq('invoice_id', input.invoiceId)
      .eq('product_id', input.productId)
      .eq('status', 'sold')
    if (countError) throw new DatabaseError('Failed to count the sold serials', countError)
    if ((count ?? 0) + input.serialNumbers.length > sold) {
      throw new ValidationError('SERIAL_COUNT_MISMATCH')
    }

    return this.issueSerials(ctx, {
      productId: input.productId,
      serialNumbers: input.serialNumbers,
      quantity: input.serialNumbers.length,
      consumerType: 'invoice',
      consumerId: input.invoiceId,
    })
  }

  /**
   * Return a sold IMEI / serial unit: executes financial credit reversal on its original sale
   * invoice through InvoiceReturnService.createReturn (plus optional refund), and routes the
   * physical serial unit through `routeReturnedSerial` by physical condition.
   */
  async returnSoldSerial(
    ctx: TenancyContext,
    serialId: string,
    input: {
      conditionCode: ReturnCondition
      restockChoice?: 'restock' | 'scrap' | undefined
      returnNumber?: string | undefined
      returnDate?: string | undefined
      reasonCode?: string | undefined
      notes?: string | undefined
      refundMethod?: 'cash' | 'bank' | undefined
      refundAmount?: number | undefined
      clientRequestId?: string | null | undefined
    },
  ) {
    const { data: serialRow, error: serialErr } = await supabase
      .from('stock_serials')
      .select('id, product_id, serial_number, status, warehouse_id, invoice_id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', serialId)
      .maybeSingle()
    if (serialErr) throw new DatabaseError('Failed to read serial unit', serialErr)
    if (!serialRow) throw new NotFoundError('Serial')

    const unit = serialRow as {
      id: string
      product_id: string
      serial_number: string
      status: string
      warehouse_id: string | null
      invoice_id: string | null
    }
    if (unit.status !== 'sold' || !unit.invoice_id) {
      throw new ValidationError('SERIAL_NOT_SOLD_ON_INVOICE')
    }

    const { data: lines, error: linesErr } = await supabase
      .from('invoice_items')
      .select('id, product_id, quantity')
      .eq('invoice_id', unit.invoice_id)
      .eq('product_id', unit.product_id)
      .order('id', { ascending: true })
    if (linesErr) throw new DatabaseError('Failed to read original invoice line', linesErr)
    const originalLine = (lines ?? [])[0] as { id: string } | undefined
    if (!originalLine) throw new ValidationError('SERIAL_PRODUCT_NOT_ON_INVOICE')

    const disposition = routeReturnConditionDisposition({
      conditionCode: input.conditionCode,
      restockChoice: input.restockChoice ?? 'restock',
    })

    const { InvoiceReturnService } = await import('../sales/invoice-return.service')
    const returnService = new InvoiceReturnService()
    const returnDate = input.returnDate ?? today()
    const returnNumber = input.returnNumber ?? `RET-IMEI-${unit.serial_number.slice(-6)}`

    const returnDocument = await returnService.createReturn(ctx.workspaceId, {
      originalInvoiceId: unit.invoice_id,
      userId: ctx.userId,
      clientRequestId: input.clientRequestId ?? `serial-return-${unit.id}-${returnNumber}`,
      returnType: 'sale_return',
      returnNumber,
      returnDate,
      reasonCode:
        input.reasonCode ??
        (input.conditionCode === 'defective' || input.conditionCode === 'damaged'
          ? 'defective'
          : 'other'),
      notes: input.notes ?? `IMEI ${unit.serial_number} (${input.conditionCode})`,
      lines: [
        {
          originalLineId: originalLine.id,
          returnQuantity: 1,
          restockChoice: disposition.restockChoice,
          reasonCode: (input.reasonCode ??
            (input.conditionCode === 'defective' || input.conditionCode === 'damaged'
              ? 'defective'
              : 'other')) as
            | 'defective'
            | 'wrong_item'
            | 'customer_change_of_mind'
            | 'damaged_in_transit'
            | 'expired'
            | 'other',
          conditionCode: input.conditionCode,
        },
      ],
    })

    let refund: unknown = null
    if (
      input.refundAmount &&
      input.refundAmount > 0 &&
      input.refundMethod &&
      returnDocument &&
      typeof returnDocument === 'object' &&
      'id' in returnDocument
    ) {
      refund = await returnService.refundReturn(
        ctx,
        unit.invoice_id,
        String((returnDocument as { id: string }).id),
        {
          amount: input.refundAmount,
          method: input.refundMethod,
          entryDate: returnDate,
          clientRequestId: input.clientRequestId
            ? `${input.clientRequestId}:refund`
            : `serial-refund-${unit.id}-${returnNumber}`,
        },
      )
    }

    const routed = routeReturnedSerial(
      {
        serialNumber: unit.serial_number,
        productId: unit.product_id,
        status: 'sold',
        warehouseId: unit.warehouse_id,
        soldInvoiceId: unit.invoice_id,
      },
      input.conditionCode,
    )
    const persistedStatus = disposition.restockChoice === 'scrap' ? 'scrapped' : routed.status

    const { data: updatedSerial, error: updateErr } = await supabase
      .from('stock_serials')
      .update({
        status: persistedStatus,
        invoice_id: null,
        sold_on: null,
        reserved_for_customer_id: null,
        reserved_until: null,
      })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', unit.id)
      .eq('status', 'sold')
      .select('id, serial_number, status, invoice_id')
      .maybeSingle()

    if (updateErr && (updateErr.code === '42703' || updateErr.code === 'PGRST204')) {
      const fallback = await supabase
        .from('stock_serials')
        .update({
          status: persistedStatus,
          invoice_id: null,
          sold_on: null,
          reserved_for_customer_id: null,
        })
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', unit.id)
        .eq('status', 'sold')
        .select('id, serial_number, status, invoice_id')
        .maybeSingle()
      if (fallback.error)
        throw new DatabaseError('Failed to update returned serial', fallback.error)
      await this.invalidate(ctx.workspaceId)
      return {
        serial: fallback.data,
        routedStatus: persistedStatus,
        dispositionBucket: disposition.bucket,
        originalInvoiceId: unit.invoice_id,
        returnDocument,
        refund,
      }
    }
    if (updateErr) throw new DatabaseError('Failed to update returned serial', updateErr)

    await this.invalidate(ctx.workspaceId)
    return {
      serial: updatedSerial,
      routedStatus: persistedStatus,
      dispositionBucket: disposition.bucket,
      originalInvoiceId: unit.invoice_id,
      returnDocument,
      refund,
    }
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
    // The whole trail (27 Sep 2026), not its first 1000 allocations.
    const { data, error } = await selectAllPages((lo, hi) =>
      supabase
        .from('lot_allocations')
        .select(
          'id, product_id, batch_id, serial_id, quantity, entry_date, batch:stock_batches(batch_number, expiry_date), serial:stock_serials(serial_number)',
        )
        .eq('workspace_id', ctx.workspaceId)
        .eq('consumer_type', consumerType)
        .eq('consumer_id', consumerId)
        .order('id', { ascending: true })
        .range(lo, hi),
    )

    if (error) throw new DatabaseError('Failed to fetch the lot trail', error)
    if ((data ?? []).length === 0) throw new NotFoundError('Lot trail')
    return data
  }
}
