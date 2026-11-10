// ============================================
// backend/src/services/traceability/traceability.service.ts
//
// Batches, serial numbers and expiry against real rows.
// ============================================

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

const SERIAL_COLUMNS =
  'id, product_id, serial_number, status, batch_id, cost_layer_id, unit_cost_minor, warehouse_id, received_on, invoice_id, sold_on'

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
    // Every serial (27 Sep 2026): a unit beyond PostgREST's 1000 rows could
    // not be picked — nor would anyone know it existed.
    const { data, error } = await selectAllPages((lo, hi) => {
      let query = supabase
        .from('stock_serials')
        .select(SERIAL_COLUMNS)
        .eq('workspace_id', ctx.workspaceId)
      if (filters.productId) query = query.eq('product_id', filters.productId)
      if (filters.invoiceId) query = query.eq('invoice_id', filters.invoiceId)
      // 'all' = every status (the product page's look-up); default in stock.
      if (filters.status !== 'all') query = query.eq('status', filters.status ?? 'in_stock')
      return query.order('received_on').order('id', { ascending: true }).range(lo, hi)
    })
    if (error) throw new DatabaseError('Failed to fetch serial numbers', error)
    return (data ?? []).map(mapSerial)
  }

  /**
   * Hold a unit for one customer, or release the hold (retail-ops-01). The
   * status is in the WHERE: only an in-stock unit can be held, only a held one
   * released, and two people holding the same phone cannot both succeed.
   */
  async holdSerial(ctx: TenancyContext, serialId: string, customerId: string | null) {
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
    const { data, error } = await supabase
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
      .maybeSingle()
    if (error && (error.code === '42703' || error.code === '23514' || error.code === 'PGRST204')) {
      // retail-ops-01 not run: no column / the old status CHECK.
      throw new ValidationError('SERIAL_HOLD_NOT_READY')
    }
    if (error) throw new DatabaseError('Failed to hold the unit', error)
    if (!data) throw new ValidationError(customerId ? 'SERIAL_NOT_IN_STOCK' : 'SERIAL_NOT_HELD')
    await this.invalidate(ctx.workspaceId)
    return {
      id: data.id as string,
      status: data.status as string,
      heldForCustomerId: (data.reserved_for_customer_id as string | null) ?? null,
    }
  }

  /** Who each held unit of a product is held for. Empty before retail-ops-01. */
  async serialHolds(ctx: TenancyContext, productId: string) {
    const { data, error } = await supabase
      .from('stock_serials')
      .select('id, reserved_for_customer_id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('product_id', productId)
      .eq('status', 'reserved')
    if (error && (error.code === '42703' || error.code === 'PGRST204')) return []
    if (error) throw new DatabaseError('Failed to read the held units', error)
    return (data ?? []).map((row) => ({
      serialId: row.id as string,
      customerId: row.reserved_for_customer_id as string,
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
      .select('id, type, status')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', input.invoiceId)
      .maybeSingle()
    if (invoiceError) throw new DatabaseError('Failed to read the invoice', invoiceError)
    if (!invoice) throw new NotFoundError('INVOICE_NOT_FOUND')
    const row = invoice as { type?: string | null; status?: string | null }
    if (row.type === 'purchase') throw new ValidationError('SERIAL_SALE_ONLY')
    if (row.status === 'cancelled') throw new ValidationError('SERIAL_INVOICE_CANCELLED')

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
