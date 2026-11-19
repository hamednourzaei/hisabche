// ============================================
// backend/src/services/inventory/roll-cutting.service.ts
//
// WP-04 — server authority for roll identity, cutting and return.
//
// A roll is a stock batch measured in meters. Every length change goes through
// the Postgres function `roll_apply_movement` (docs/roll-cutting-01-migration.sql)
// because supabase-js has no transaction: a check-then-write in JS is a race two
// devices can win. The function locks the roll row, refuses a cut beyond the
// remainder, and stamps the caller's idempotency key in the SAME transaction —
// a retried request returns the first result, never a second deduction.
//
// The device records the same events offline (@hisabche/validation owns the
// rules); this service is the sync authority, not a second rule set.
// ============================================

import { rollCostOf } from '@hisabche/validation'
import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import type { TenancyContext } from '../tenancy.service'

export interface RollRow {
  id: string
  workspace_id: string
  roll_number: string
  initial_length: number
  remaining_length: number
  unit: string
  location: string | null
  cost_minor: number
  custom_conversion_factor: number | null
  client_request_id: string | null
}

export interface RollCreateInput {
  rollNumber: string
  initialLength: number
  unit?: string | undefined
  location?: string | undefined
  costMinor: number
  customConversionFactor?: number | null | undefined
  idempotencyKey?: string | undefined
}

export type RollMovementKind = 'consume' | 'cut' | 'return'

export interface RollMovementInput {
  rollId: string
  kind: RollMovementKind
  length: number
  wasteLength?: number | undefined
  idempotencyKey: string
}

/** Rows are tenant-scoped; the workspace is the only security boundary. */
export class RollCuttingService {
  async list(ctx: TenancyContext): Promise<RollRow[]> {
    const { data, error } = await supabase
      .from('rolls')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .is('deleted_at', null)
      .order('roll_number', { ascending: true })
    if (error) throw new DatabaseError('Failed to read rolls', error)
    return (data ?? []) as RollRow[]
  }

  async get(ctx: TenancyContext, id: string): Promise<RollRow> {
    const { data, error } = await supabase
      .from('rolls')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', ctx.workspaceId)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to read the roll', error)
    if (!data) throw new NotFoundError(`Roll ${id}`)
    return data as RollRow
  }

  async create(ctx: TenancyContext, input: RollCreateInput): Promise<RollRow> {
    const { data, error } = await supabase.rpc('roll_create', {
      p_workspace: ctx.workspaceId,
      p_actor: ctx.userId,
      p_roll_number: input.rollNumber,
      p_initial_length: input.initialLength,
      p_unit: input.unit ?? 'm',
      p_location: input.location ?? null,
      p_cost_minor: input.costMinor,
      p_custom_conversion_factor: input.customConversionFactor ?? null,
      p_idempotency_key: input.idempotencyKey ?? null,
    })
    if (error) throw new DatabaseError('Failed to create the roll', error)
    const row = (data ?? {}) as Record<string, unknown>
    return this.get(ctx, String(row.roll_id))
  }

  /**
   * Consume / cut / return in one transaction. A concurrent request that would
   * oversell gets a 409 (ROLL_INSUFFICIENT) from the function — never a second
   * deduction. A retry with the same key returns the first movement.
   */
  async applyMovement(
    ctx: TenancyContext,
    input: RollMovementInput,
  ): Promise<Record<string, unknown>> {
    const { data, error } = await supabase.rpc('roll_apply_movement', {
      p_workspace: ctx.workspaceId,
      p_actor: ctx.userId,
      p_roll: input.rollId,
      p_kind: input.kind,
      p_length: input.length,
      p_waste_length: input.wasteLength ?? 0,
      p_idempotency_key: input.idempotencyKey,
    })
    if (error) {
      if (error.code === 'ROLL_INSUFFICIENT' || error.code === '23514') {
        throw new ConflictError('ROLL_INSUFFICIENT')
      }
      throw new DatabaseError('Failed to apply the roll movement', error)
    }
    return (data ?? {}) as Record<string, unknown>
  }

  /** Roll-centric inventory: meters and the cost still sitting on the roll. */
  async report(
    ctx: TenancyContext,
  ): Promise<Array<RollRow & { consumed_length: number; cost: unknown }>> {
    const rows = await this.list(ctx)
    return rows.map((row) => {
      const initial = Number(row.initial_length)
      const remaining = Number(row.remaining_length)
      const consumed = Math.max(0, initial - remaining)
      // The SAME rule the device runs; an unreadable cost stays unknown, never zero.
      const cost = rollCostOf(Number(row.cost_minor), initial, consumed)
      return { ...row, consumed_length: consumed, cost }
    })
  }
}

export const rollCuttingService = new RollCuttingService()
