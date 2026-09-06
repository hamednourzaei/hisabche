// ============================================
// backend/src/services/inventory/cycle-count.service.ts
//
// L2 — counting the shelves, and what the count costs.
//
// ---------------------------------------------------------------------------
// ⚠️ G2 — THE PRICING IS NOT WRITTEN HERE
//
// `inventory-costing/stock-count.domain.ts` already computes variance,
// values a shortage from the cost layers oldest-first, and values a surplus at
// the current average. It had ZERO production consumers. This service is the
// caller it was missing — it does not re-derive any of that.
//
// ---------------------------------------------------------------------------
// THE ONE RULE THIS SERVICE ENFORCES
//
//   variance ≠ 0  →  an ADJUSTMENT stock movement
//
// Never `UPDATE products SET quantity = counted`. Since Phase C,
// `products.quantity` is a projection maintained by trigger and writing it
// directly is forbidden anyway — but the deeper reason is that a count is a
// FINANCIAL event. Ten missing bottles are money that left the business, and
// overwriting the number makes the balance sheet disagree with the shelves in
// the opposite direction while destroying the evidence of why.
// ============================================

import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { costing } from '../inventory-costing'
import {
  priceLine,
  summariseCount,
  type CountLine,
  type VarianceLine,
} from '../inventory-costing/stock-count.domain'
import type { TenancyContext } from '../tenancy.service'

export type CycleCountStatus = 'draft' | 'counting' | 'completed' | 'cancelled'

export interface CreateCycleCountInput {
  warehouseId: string
  productIds: string[]
  notes?: string | undefined
}

export class CycleCountService {
  /**
   * Open a count over a set of products.
   *
   * ⚠️ `expected_qty` is captured NOW and frozen. Reading it again at
   * completion would compare the shelf against a quantity that has moved
   * since, and every sale made during the count would read as a shortage —
   * the write-off would be exactly the day's takings.
   */
  async create(ctx: TenancyContext, input: CreateCycleCountInput) {
    if (input.productIds.length === 0) throw new ValidationError('CYCLE_COUNT_NO_PRODUCTS')

    await this.assertWarehouse(ctx, input.warehouseId)

    // Scoped to the workspace: naming another shop's product id must not put
    // it on this count, where a variance would later move THEIR stock.
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, quantity')
      .eq('workspace_id', ctx.workspaceId)
      .in('id', [...new Set(input.productIds)])

    if (productsError) throw new DatabaseError('Failed to read products', productsError)
    if ((products ?? []).length === 0) throw new NotFoundError('Product')

    const { data: count, error } = await supabase
      .from('cycle_counts')
      .insert({
        workspace_id: ctx.workspaceId,
        warehouse_id: input.warehouseId,
        status: 'counting',
        created_by: ctx.userId,
        notes: input.notes ?? null,
      })
      .select('id, status')
      .single()

    if (error || !count) throw new DatabaseError('Failed to open the count', error)

    const { error: linesError } = await supabase.from('cycle_count_lines').insert(
      (products ?? []).map((product) => ({
        workspace_id: ctx.workspaceId,
        count_id: count.id,
        product_id: product.id,
        expected_qty: Number(product.quantity) || 0,
        // NULL, not 0. «Not yet counted» and «counted zero» are different
        // facts, and treating them the same would write off every product
        // nobody got to.
        counted_qty: null,
      })),
    )

    if (linesError) {
      // Safe here and only here: the header is seconds old, still `counting`,
      // and no movement has been written. A count with no lines can never be
      // completed and would sit in the list forever.
      await supabase.from('cycle_counts').delete().eq('id', count.id)
      throw new DatabaseError('Failed to add count lines', linesError)
    }

    return this.get(ctx, count.id)
  }

  async get(ctx: TenancyContext, id: string) {
    const { data, error } = await supabase
      .from('cycle_counts')
      .select(
        `id, count_number, status, warehouse_id, created_by, completed_by,
         started_at, completed_at, cancelled_at, notes,
         shortage_value, surplus_value, net_loss,
         lines:cycle_count_lines(id, product_id, expected_qty, counted_qty,
                                 variance_qty, variance_value, notes)`,
      )
      .eq('id', id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to load the count', error)
    if (!data) throw new NotFoundError('CycleCount')
    return data
  }

  /** Record what was actually found on one line. */
  async recordCount(ctx: TenancyContext, countId: string, productId: string, countedQty: number) {
    if (!Number.isFinite(countedQty) || countedQty < 0) {
      throw new ValidationError('CYCLE_COUNT_QUANTITY_INVALID')
    }

    const status = await this.statusOf(ctx, countId)
    if (status !== 'counting') throw new ConflictError('CYCLE_COUNT_NOT_OPEN')

    const { data, error } = await supabase
      .from('cycle_count_lines')
      .update({ counted_qty: countedQty })
      .eq('count_id', countId)
      .eq('product_id', productId)
      .eq('workspace_id', ctx.workspaceId)
      .select('id')
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to record the count', error)
    if (!data) throw new NotFoundError('CycleCountLine')
    return data
  }

  /**
   * Close the count: price every variance, write the adjustments, freeze the
   * totals.
   *
   * ⚠️ Lines that were never counted are SKIPPED, not treated as zero. A
   * product nobody reached is not a product with nothing on the shelf.
   */
  async complete(ctx: TenancyContext, countId: string) {
    const count = await this.get(ctx, countId)
    if (count.status !== 'counting') throw new ConflictError('CYCLE_COUNT_NOT_OPEN')

    const rows = (count.lines ?? []) as Record<string, any>[]
    const counted = rows.filter((row) => row.counted_qty !== null)

    if (counted.length === 0) throw new ConflictError('CYCLE_COUNT_NOTHING_COUNTED')

    // ─── Price every line through the domain that already existed ──────────
    const priced: VarianceLine[] = []
    for (const row of counted) {
      const line: CountLine = {
        productId: String(row.product_id),
        expectedQty: Number(row.expected_qty) || 0,
        countedQty: Number(row.counted_qty) || 0,
      }
      // The product's open layers, oldest first — the same order a sale
      // consumes them, which is what makes a shortage cost what those units
      // actually cost.
      //
      // `getLayers` is the costing port's own read; no new query is written
      // here, and the FIFO ordering stays the costing core's business.
      const { layers } = await costing.getLayers(ctx, line.productId, count.warehouse_id)
      priced.push(priceLine(line, layers))
    }

    const summary = summariseCount(priced)

    // ─── variance ≠ 0 → an ADJUSTMENT movement ─────────────────────────────
    //
    // NOT `UPDATE products SET quantity`. The movement is what moves stock
    // (Phase C), and it is what leaves the evidence.
    const movements = priced
      .filter((line) => line.varianceQty !== 0)
      .map((line) => ({
        product_id: line.productId,
        type: 'adjustment',
        quantity: line.varianceQty,
        reference_type: 'cycle_count',
        reference_id: countId,
        workspace_id: ctx.workspaceId,
        user_id: ctx.userId,
        notes: `count variance ${line.varianceQty}`,
      }))

    if (movements.length > 0) {
      const { error: movementError } = await supabase.from('stock_movements').insert(movements)
      // Not swallowed. If the movements fail the count must NOT be marked
      // completed, or the document would claim an effect the stock never had.
      if (movementError) {
        throw new DatabaseError('Failed to write count adjustments', movementError)
      }
    }

    // Freeze the priced figures onto the lines, so the completed document
    // keeps saying the same thing after the layers it was priced from have
    // been consumed by later sales.
    for (const line of priced) {
      await supabase
        .from('cycle_count_lines')
        .update({ variance_qty: line.varianceQty, variance_value: line.varianceValue })
        .eq('count_id', countId)
        .eq('product_id', line.productId)
        .eq('workspace_id', ctx.workspaceId)
    }

    const { error: closeError } = await supabase
      .from('cycle_counts')
      .update({
        status: 'completed',
        completed_by: ctx.userId,
        completed_at: new Date().toISOString(),
        shortage_value: summary.shortageValue,
        surplus_value: summary.surplusValue,
        net_loss: summary.netLoss,
        updated_at: new Date().toISOString(),
      })
      .eq('id', countId)
      .eq('workspace_id', ctx.workspaceId)
      // Re-checked in the WHERE clause: two concurrent completions would both
      // read `counting` and both write adjustments.
      .eq('status', 'counting')

    if (closeError) throw new DatabaseError('Failed to complete the count', closeError)

    // ⚠️ THE JOURNAL ENTRY IS NOT POSTED HERE — see the note in
    // .claude/HANDOFF-PHASES-G-TO-O.md. Stock adjustments have never posted to
    // the ledger (an open gap from J0), and the accounts a write-off should
    // hit — an inventory-shrinkage expense — do not exist in the chart of
    // accounts or in `AccountRole`. Inventing one would put a guess into the
    // books (G4). The variance VALUE is computed and frozen above, so the
    // entry can be posted the moment that account is defined.
    return this.get(ctx, countId)
  }

  async cancel(ctx: TenancyContext, countId: string, reason: string) {
    if (!reason.trim()) throw new ValidationError('CYCLE_COUNT_CANCEL_REASON_REQUIRED')

    const status = await this.statusOf(ctx, countId)
    // Terminal once completed: the adjustments are in the movement log and
    // «cancelled» would deny an effect that exists.
    if (status !== 'draft' && status !== 'counting') {
      throw new ConflictError('CYCLE_COUNT_NOT_CANCELLABLE')
    }

    const { error } = await supabase
      .from('cycle_counts')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        notes: reason.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', countId)
      .eq('workspace_id', ctx.workspaceId)
      .eq('status', status)

    if (error) throw new DatabaseError('Failed to cancel the count', error)
    return this.get(ctx, countId)
  }

  async list(ctx: TenancyContext, status?: CycleCountStatus | undefined) {
    let query = supabase
      .from('cycle_counts')
      .select('id, count_number, status, warehouse_id, started_at, completed_at, net_loss')
      .eq('workspace_id', ctx.workspaceId)
      .order('started_at', { ascending: false })
      .limit(200)

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw new DatabaseError('Failed to list counts', error)
    return data ?? []
  }

  private async statusOf(ctx: TenancyContext, countId: string): Promise<CycleCountStatus> {
    const { data, error } = await supabase
      .from('cycle_counts')
      .select('status')
      .eq('id', countId)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to read the count', error)
    if (!data) throw new NotFoundError('CycleCount')
    return data.status as CycleCountStatus
  }

  private async assertWarehouse(ctx: TenancyContext, warehouseId: string) {
    const { data, error } = await supabase
      .from('warehouses')
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', warehouseId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to verify the warehouse', error)
    if (!data) throw new NotFoundError('Warehouse')
  }
}
