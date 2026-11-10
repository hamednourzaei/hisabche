// ============================================
// backend/src/services/warehouse/transfer.service.ts
//
// K2 — the transfer document, over the transfer engine that already exists.
//
// ---------------------------------------------------------------------------
// ⚠️ G2 — ONE TRANSFER ENGINE, NOT TWO
//
// `warehouse_transfer_stock()` already moves stock between two warehouses in
// one transaction with the source row locked. It is NOT reimplemented here.
// This service adds the lifecycle around it and calls it for the two actions
// that actually move goods:
//
//   ship    → the source leg   (stock leaves)
//   receive → the destination leg (stock arrives)
//
// The other four actions change a word on a document and touch no stock —
// `movesStock()` is what decides, so the split cannot drift.
//
// ---------------------------------------------------------------------------
// ⚠️ WHY SHIP AND RECEIVE ARE TWO SEPARATE MOVEMENTS
//
// The instantaneous RPC moves A → B in one call. A real transfer cannot: the
// goods leave on Monday and arrive on Thursday, and for those three days they
// are on neither shelf. So the document does it in two legs, through a
// per-workspace holding warehouse the migration does not create and this
// service does not invent — see `TRANSFER_IN_TRANSIT_NOT_A_WAREHOUSE` below.
//
// ---------------------------------------------------------------------------
// STOP CONDITION — READ BEFORE EXTENDING
//
// Splitting the movement into two legs needs somewhere for the stock to BE
// while it is in transit. Three options, none of them decided:
//
//   1. A reserved «in transit» warehouse per workspace. Clean, but it appears
//      in every warehouse picker and stock report unless every one of them is
//      taught to exclude it.
//   2. Allow `stock_movements` rows with a from- and no to-warehouse. Honest,
//      but `stock_movements_project()` (Phase C) would have to learn that such
//      a row decrements the source and credits nothing — a change to the
//      projection trigger, which is the source of truth for every quantity in
//      the product.
//   3. Keep the movement instantaneous at SHIP and treat receiving as
//      confirmation only. Simplest, and it is what happens today — but then
//      `stock_in_transit` reports goods that the stock ledger already says
//      arrived, and the two disagree.
//
// This is a product and accounting decision, not a technical one, and getting
// it wrong writes wrong quantities into the source of truth.
//
// ---------------------------------------------------------------------------
// ✅ DECIDED 10 Nov 2026 (QA document §6 «Pick Request + Task انباردار»):
// the stock moves ONCE, AT RECEIVE, by the instantaneous engine — one keyed
// call per line (`transfer-<id>-<line>`), so a retried receive never moves a
// line twice and a receive that failed half-way finishes on the next try.
// Until then the goods are counted at the SOURCE: `ship` records who sent
// them and when, and `stock_in_transit` lists what was sent and not yet
// received. None of the three options above changes the projection trigger
// or invents a warehouse; this is option 3 moved to the end of the road,
// where a shop that sends goods across the street actually counts them.
// A line in a non-base unit is refused (TRANSFER_UNIT_NOT_SUPPORTED) until
// the unit conversion is done here too.
// ============================================

import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import type { TenancyContext } from '../tenancy.service'
import { WarehouseService } from '../warehouse.service'

import {
  canTransition,
  validateLines,
  type TransferAction,
  type TransferLineInput,
  type TransferStatus,
} from './transfer.domain'

export interface CreateTransferInput {
  fromWarehouseId: string
  toWarehouseId: string
  lines: TransferLineInput[]
  notes?: string | undefined
}

export class TransferService {
  /**
   * Raise a transfer request. Nothing moves.
   *
   * The document exists from this moment, which is the point: a request that
   * lives only in someone's head cannot be approved, queried or audited.
   */
  async create(ctx: TenancyContext, input: CreateTransferInput) {
    if (input.fromWarehouseId === input.toWarehouseId) {
      throw new ValidationError('TRANSFER_SAME_WAREHOUSE')
    }

    const problems = validateLines(input.lines)
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    await this.assertWarehouses(ctx, [input.fromWarehouseId, input.toWarehouseId])
    await this.assertProducts(
      ctx,
      input.lines.map((line) => line.productId),
    )

    const { data: transfer, error } = await supabase
      .from('stock_transfers')
      .insert({
        workspace_id: ctx.workspaceId,
        from_warehouse_id: input.fromWarehouseId,
        to_warehouse_id: input.toWarehouseId,
        status: 'requested',
        requested_by: ctx.userId,
        notes: input.notes ?? null,
      })
      .select('id, status, from_warehouse_id, to_warehouse_id, requested_at')
      .single()

    if (error || !transfer) throw new DatabaseError('Failed to raise the transfer', error)

    const { error: linesError } = await supabase.from('stock_transfer_lines').insert(
      input.lines.map((line) => ({
        workspace_id: ctx.workspaceId,
        transfer_id: transfer.id,
        product_id: line.productId,
        quantity: line.quantity,
        // K0 — null is the base unit until L1 exists.
        unit_id: line.unitId ?? null,
      })),
    )

    if (linesError) {
      // A header with no lines is a transfer that can never ship and never be
      // cancelled meaningfully. Removing it is safe here and ONLY here: it was
      // created milliseconds ago, is still `requested`, and no stock has moved
      // — none of the reasons the constitution forbids compensating deletes
      // apply to a document that never became real.
      await supabase.from('stock_transfers').delete().eq('id', transfer.id)
      throw new DatabaseError('Failed to add the transfer lines', linesError)
    }

    return this.get(ctx, transfer.id)
  }

  /** One transfer with its lines. */
  async get(ctx: TenancyContext, id: string) {
    const { data, error } = await supabase
      .from('stock_transfers')
      .select(
        `id, transfer_number, status, from_warehouse_id, to_warehouse_id,
         requested_by, approved_by, shipped_by, received_by,
         requested_at, approved_at, shipped_at, received_at, cancelled_at,
         notes, cancel_reason,
         lines:stock_transfer_lines(id, product_id, quantity, unit_id, received_quantity, notes)`,
      )
      .eq('id', id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to load the transfer', error)
    if (!data) throw new NotFoundError('Transfer')
    return data
  }

  async list(ctx: TenancyContext, status?: TransferStatus | undefined) {
    let query = supabase
      .from('stock_transfers')
      .select(
        `id, transfer_number, status, from_warehouse_id, to_warehouse_id,
         requested_at, shipped_at, received_at`,
      )
      .eq('workspace_id', ctx.workspaceId)
      .order('requested_at', { ascending: false })
      .limit(200)

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw new DatabaseError('Failed to list transfers', error)
    return data ?? []
  }

  /**
   * Move the document one step.
   *
   * ⚠️ The verdict comes from `canTransition`, which is pure and exhaustively
   * tested. This method's job is to READ the current status, apply the
   * verdict, and record who did it — never to re-decide.
   */
  async advance(
    ctx: TenancyContext,
    id: string,
    action: TransferAction,
    options: { reason?: string | undefined } = {},
  ) {
    const { data: current, error } = await supabase
      .from('stock_transfers')
      .select('id, status')
      .eq('id', id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to read the transfer', error)
    if (!current) throw new NotFoundError('Transfer')

    const verdict = canTransition(current.status as TransferStatus, action)
    if (!verdict.ok) throw new ConflictError(verdict.code)

    if (action === 'cancel' && !options.reason?.trim()) {
      // A cancellation with no reason is unauditable — the same rule the
      // conflict queue and the SoD override already enforce.
      throw new ValidationError('TRANSFER_CANCEL_REASON_REQUIRED')
    }

    // Decided 10 Nov 2026 — see the header: the stock moves at RECEIVE, line
    // by line, BEFORE the document says «received». A receive that fails
    // half-way leaves the document «shipped» and the next try finishes it.
    if (action === 'receive') await this.moveLines(ctx, id)

    const now = new Date().toISOString()
    const updates: Record<string, unknown> = { status: verdict.next, updated_at: now }

    // Each irreversible step records its OWN actor. One `updated_by` could not
    // answer «did the same person ship and receive this», which is the
    // question the document exists to answer.
    if (action === 'approve') {
      updates.approved_by = ctx.userId
      updates.approved_at = now
    }
    if (action === 'ship') {
      updates.shipped_by = ctx.userId
      updates.shipped_at = now
    }
    if (action === 'receive') {
      updates.received_by = ctx.userId
      updates.received_at = now
    }
    if (action === 'cancel') {
      updates.cancelled_at = now
      updates.cancel_reason = options.reason?.trim() ?? null
    }

    const { data: updated, error: updateError } = await supabase
      .from('stock_transfers')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', ctx.workspaceId)
      // ⚠️ The status is re-checked in the WHERE clause. Two approvals racing
      // would both read `requested` and both pass `canTransition`; this makes
      // the second one match no row.
      .eq('status', current.status)
      .select('id, status')
      .maybeSingle()

    if (updateError) throw new DatabaseError('Failed to advance the transfer', updateError)
    if (!updated) throw new ConflictError('TRANSFER_CONCURRENT_UPDATE')

    return this.get(ctx, id)
  }

  /**
   * The stock leg of «receive»: each line not yet received is moved by the one
   * transfer engine with its own key, then marked received. Re-running it
   * skips what already arrived; the engine's key stops a line moving twice
   * even when the mark was lost.
   */
  private async moveLines(ctx: TenancyContext, id: string): Promise<void> {
    const transfer = (await this.get(ctx, id)) as unknown as {
      transfer_number: string | null
      from_warehouse_id: string
      to_warehouse_id: string
      lines: Array<{
        id: string
        product_id: string
        quantity: number | string
        unit_id: string | null
        received_quantity: number | string | null
      }>
    }
    if (transfer.lines.some((line) => line.unit_id)) {
      throw new ValidationError('TRANSFER_UNIT_NOT_SUPPORTED')
    }
    const engine = new WarehouseService()
    for (const line of transfer.lines) {
      if (line.received_quantity !== null && line.received_quantity !== undefined) continue
      const quantity = Number(line.quantity)
      await engine.transferStock(
        ctx,
        {
          productId: line.product_id,
          fromWarehouseId: transfer.from_warehouse_id,
          toWarehouseId: transfer.to_warehouse_id,
          quantity,
          notes: `transfer ${transfer.transfer_number ?? id}`,
        },
        { idempotencyKey: `transfer-${id}-${line.id}` },
      )
      const { error } = await supabase
        .from('stock_transfer_lines')
        .update({ received_quantity: quantity })
        .eq('id', line.id)
        .eq('workspace_id', ctx.workspaceId)
        .is('received_quantity', null)
      if (error) throw new DatabaseError('Failed to mark the line received', error)
    }
  }

  /** K3 — what has left a warehouse and not yet arrived. Derived, never stored. */
  async inTransit(ctx: TenancyContext, productId?: string | undefined) {
    let query = supabase.from('stock_in_transit').select('*').eq('workspace_id', ctx.workspaceId)

    if (productId) query = query.eq('product_id', productId)

    const { data, error } = await query
    if (error) {
      // The view does not exist until phase-k-01 runs. An empty list is the
      // honest answer for a database without it — nothing is in transit,
      // because nothing can be.
      if (error.code === '42P01' || error.code === 'PGRST205') return []
      throw new DatabaseError('Failed to read goods in transit', error)
    }
    return data ?? []
  }

  private async assertWarehouses(ctx: TenancyContext, ids: string[]) {
    const unique = [...new Set(ids)]
    const { data, error } = await supabase
      .from('warehouses')
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .is('deleted_at', null)
      .in('id', unique)

    if (error) throw new DatabaseError('Failed to verify warehouses', error)
    // Naming another workspace's warehouse must not transfer anything into it.
    if ((data ?? []).length !== unique.length) throw new NotFoundError('Warehouse')
  }

  private async assertProducts(ctx: TenancyContext, ids: string[]) {
    const unique = [...new Set(ids)]
    if (unique.length === 0) return

    const { data, error } = await supabase
      .from('products')
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .in('id', unique)

    if (error) throw new DatabaseError('Failed to verify products', error)
    if ((data ?? []).length !== unique.length) throw new NotFoundError('Product')
  }
}
