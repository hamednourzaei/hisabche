// ============================================
// backend/src/services/inventory/reservation.service.ts
//
// V58 · P0-1 — stock reservations and available-to-promise.
//
// ONE CORE. The POS hold, a sale order for later, a transfer plan and the
// warehouse dashboard's «available» figure all read and write through this
// file. The multi-row writes are Postgres functions
// (docs/stock-reservations-01-migration.sql) because supabase-js has no
// transaction — a check-then-write in JS is a race two devices can win.
//
// SEMANTICS (mirrors the migration header — one source of truth per rule):
//   · ATP = on hand − active, unexpired reservations. A hold is never free.
//   · Settle moves NO stock: the sale that honours the promise decrements
//     warehouse_stock through its own existing path.
//   · Nothing is deleted; release/settle leave their row, actor, timestamp.
//   · Idempotent on the caller's key: a retried reserve returns the hold it
//     already made.
// ============================================

import { z } from 'zod'
import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import type { TenancyContext } from '../tenancy.service'

export const stockReserveSchema = z.object({
  warehouseId: z.string().uuid(),
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullish(),
  quantity: z.number().positive(),
  referenceType: z.string().max(40).nullish(),
  referenceId: z.string().uuid().nullish(),
  /** The caller's own idempotency key (a client-generated UUID). */
  idempotencyKey: z.string().min(8).max(120),
  /** When the hold gives up its claim. Omitted = hold until released/settled. */
  expiresAt: z.string().datetime({ offset: true }).nullish(),
  notes: z.string().max(500).nullish(),
})
export type StockReserveInput = z.infer<typeof stockReserveSchema>

export const stockReservationActionSchema = z.object({
  reservationId: z.string().uuid(),
  /** Omit for the whole remainder. */
  quantity: z.number().positive().nullish(),
  notes: z.string().max(500).nullish(),
})
export type StockReservationActionInput = z.infer<typeof stockReservationActionSchema>

export interface StockReservationRow {
  id: string
  warehouseId: string
  productId: string
  variantId: string | null
  quantity: number
  status: 'active' | 'settled' | 'released' | 'expired'
  referenceType: string | null
  referenceId: string | null
  expiresAt: string | null
  createdAt: string
  settledQuantity: number | null
  releasedQuantity: number | null
}

/** A Postgres exception the reserve path raises on purpose — map, not crash. */
const RESERVATION_CODES: Record<string, () => Error> = {
  STOCK_RESERVATION_INSUFFICIENT: () =>
    new ConflictError('RESERVATION_INSUFFICIENT', { reason: 'RESERVATION_INSUFFICIENT' }),
  STOCK_RESERVATION_NO_STOCK: () =>
    new ConflictError('RESERVATION_NO_STOCK', { reason: 'RESERVATION_NO_STOCK' }),
  STOCK_RESERVATION_INVALID_QUANTITY: () => new ValidationError('RESERVATION_INVALID_QUANTITY'),
  STOCK_RESERVATION_NOT_FOUND: () => new NotFoundError('Reservation'),
  STOCK_RESERVATION_NOT_ACTIVE: () =>
    new ConflictError('RESERVATION_NOT_ACTIVE', { reason: 'RESERVATION_NOT_ACTIVE' }),
}

function mapRpcError(operation: string, error: { code?: string; message?: string } | null): never {
  const code = error?.code ?? ''
  if (code === 'P0001' || code === '23514' || code === '23505') {
    // PL/pgSQL RAISE EXCEPTION lands here with the message carrying the slug.
    for (const [slug, build] of Object.entries(RESERVATION_CODES)) {
      if ((error?.message ?? '').includes(slug)) return build() as never
    }
  }
  throw new DatabaseError(`Failed to ${operation}`, error ?? undefined)
}

export class InventoryReservationService {
  /** Available-to-promise for one warehouse + product. Never counts a hold. */
  async available(
    ctx: TenancyContext,
    warehouseId: string,
    productId: string,
  ): Promise<{ onHand: number; reserved: number; available: number }> {
    const { data, error } = await supabase
      .from('warehouse_stock')
      .select('quantity')
      .eq('workspace_id', ctx.workspaceId)
      .eq('warehouse_id', warehouseId)
      .eq('product_id', productId)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to read the stock level', error)

    const { data: heldRows, error: heldError } = await supabase
      .from('stock_reservations')
      .select('quantity')
      .eq('workspace_id', ctx.workspaceId)
      .eq('warehouse_id', warehouseId)
      .eq('product_id', productId)
      .eq('status', 'active')
      .or('expires_at.is.null,expires_at.gt.now()')
    if (heldError) throw new DatabaseError('Failed to read the reservations', heldError)

    const onHand = Number(data?.quantity) || 0
    const reserved = (heldRows ?? []).reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)
    return { onHand, reserved, available: onHand - reserved }
  }

  /**
   * Reserve stock. Atomic (the Postgres function locks the stock row) and
   * idempotent on `idempotencyKey` — a retried request returns the hold it
   * already made and never a second one.
   */
  async reserve(ctx: TenancyContext, input: StockReserveInput) {
    const { data, error } = await supabase.rpc('stock_reserve', {
      p_workspace: ctx.workspaceId,
      p_actor: ctx.userId,
      p_warehouse: input.warehouseId,
      p_product: input.productId,
      p_quantity: input.quantity,
      p_reference_type: input.referenceType ?? null,
      p_reference_id: input.referenceId ?? null,
      p_idempotency_key: input.idempotencyKey,
      p_expires_at: input.expiresAt ?? null,
      p_variant: input.variantId ?? null,
      p_notes: input.notes ?? null,
    })
    if (error) mapRpcError('reserve the stock', error)
    const result = (data ?? {}) as Record<string, unknown>
    return {
      status: String(result.status ?? 'reserved') as 'reserved' | 'already_reserved',
      reservationId: String(result.reservation_id),
      quantity: Number(result.quantity) || 0,
      reservationStatus: String(result.reservation_status ?? 'active'),
    }
  }

  /** Release a hold — whole, or the rest after a partial. Never deletes. */
  async release(ctx: TenancyContext, input: StockReservationActionInput) {
    const { data, error } = await supabase.rpc('stock_release_reservation', {
      p_workspace: ctx.workspaceId,
      p_actor: ctx.userId,
      p_reservation: input.reservationId,
      p_quantity: input.quantity ?? null,
      p_notes: input.notes ?? null,
    })
    if (error) mapRpcError('release the reservation', error)
    return (data ?? {}) as Record<string, unknown>
  }

  /** Settle a hold — the promise was honoured. Moves no stock. */
  async settle(ctx: TenancyContext, input: StockReservationActionInput) {
    const { data, error } = await supabase.rpc('stock_settle_reservation', {
      p_workspace: ctx.workspaceId,
      p_actor: ctx.userId,
      p_reservation: input.reservationId,
      p_quantity: input.quantity ?? null,
      p_notes: input.notes ?? null,
    })
    if (error) mapRpcError('settle the reservation', error)
    return (data ?? {}) as Record<string, unknown>
  }

  /** The workspace's holds, newest first, a page at a time. */
  async list(
    ctx: TenancyContext,
    options: {
      status?: 'active' | 'settled' | 'released' | 'expired' | undefined
      warehouseId?: string | undefined
      productId?: string | undefined
      limit: number
      offset: number
    },
  ): Promise<{ reservations: StockReservationRow[]; total: number }> {
    let query = supabase
      .from('stock_reservations')
      .select(
        'id, warehouse_id, product_id, variant_id, quantity, status, reference_type, reference_id, expires_at, created_at, settled_quantity, released_quantity',
        { count: 'exact' },
      )
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })
      .range(options.offset, options.offset + options.limit - 1)
    if (options.status) query = query.eq('status', options.status)
    if (options.warehouseId) query = query.eq('warehouse_id', options.warehouseId)
    if (options.productId) query = query.eq('product_id', options.productId)

    const { data, error, count } = await query
    if (error) throw new DatabaseError('Failed to fetch the reservations', error)
    return {
      reservations: (data ?? []).map((row) => {
        const r = row as Record<string, unknown>
        return {
          id: String(r.id),
          warehouseId: String(r.warehouse_id),
          productId: String(r.product_id),
          variantId: (r.variant_id as string | null) ?? null,
          quantity: Number(r.quantity) || 0,
          status: String(r.status) as StockReservationRow['status'],
          referenceType: (r.reference_type as string | null) ?? null,
          referenceId: (r.reference_id as string | null) ?? null,
          expiresAt: (r.expires_at as string | null) ?? null,
          createdAt: String(r.created_at ?? ''),
          settledQuantity: (r.settled_quantity as number | null) ?? null,
          releasedQuantity: (r.released_quantity as number | null) ?? null,
        }
      }),
      total: count ?? 0,
    }
  }
}
