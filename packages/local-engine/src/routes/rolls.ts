// ============================================
// packages/local-engine/src/routes/rolls.ts
//
// WP-04 — OFFLINE ROLL IDENTITY, CUTTING, WASTE AND RETURN.
//
// A roll is a stock batch measured in meters. The device records every cut and
// return against the SAME roll; the shared validation rules decide the split
// into sellable length and waste. A conditional UPDATE inside a transaction is
// what stops two simultaneous sales from consuming the same meters twice.
// No money or measurement rule lives here — @hisabche/validation owns them.
// ============================================

import {
  convertBatchQuantity,
  consumeRollLength,
  returnToRoll,
  rollCostOf,
  splitRollCut,
  type RollBatch,
} from '@hisabche/validation'
import { requireCapability } from '../auth'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

interface RollRow {
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

function trim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function rollOf(c: RouteHandlerContext, id: string): RollRow {
  const row = c.db.get<RollRow>(
    `SELECT * FROM local_rolls WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [id, c.ctx.workspaceId],
  )
  if (!row) throw new NotFoundError('Roll', id)
  return row
}

function asBatch(row: RollRow): RollBatch {
  return {
    id: row.id,
    rollNumber: row.roll_number,
    initialLength: Number(row.initial_length),
    remainingLength: Number(row.remaining_length),
    unit: row.unit,
    customConversionFactor: row.custom_conversion_factor,
  }
}

function requestId(c: RouteHandlerContext, body: Record<string, unknown>): string {
  return trim(c.headers?.['idempotency-key']) || trim(body.clientRequestId) || trim(body.id)
}

function recordMovement(
  c: RouteHandlerContext,
  rollId: string,
  kind: string,
  length: number,
  waste: number,
  key: string,
): void {
  c.db.run(
    `INSERT INTO roll_movements
       (id, workspace_id, roll_id, kind, length, waste_length, client_request_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      c.ctx.workspaceId,
      rollId,
      kind,
      length,
      waste,
      key || null,
      new Date().toISOString(),
    ],
  )
}

export function registerRollRoutes(router: Router): void {
  // ─── Static routes before `/:id` so they are never captured as an id ──────

  router.get('/local-rolls', (c: RouteHandlerContext) => ({
    data: c.db.all<RollRow>(
      `SELECT * FROM local_rolls WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
      [c.ctx.workspaceId],
    ),
  }))

  /** Roll-centric inventory: meters remaining AND the cost still on the roll. */
  router.get('/local-rolls/report', (c: RouteHandlerContext) => {
    const rows = c.db.all<RollRow>(
      `SELECT * FROM local_rolls WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY roll_number ASC`,
      [c.ctx.workspaceId],
    )
    const data = rows.map((row) => {
      const initial = Number(row.initial_length)
      const remaining = Number(row.remaining_length)
      return {
        ...row,
        consumedLength: Math.max(0, initial - remaining),
        cost: rollCostOf(Number(row.cost_minor), initial, Math.max(0, initial - remaining)),
      }
    })
    return { data }
  })

  router.post('/local-rolls', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'stock.adjust')
    const body = (c.body || {}) as Record<string, unknown>
    const rollNumber = trim(body.rollNumber)
    const initialLength = Number(body.initialLength)
    const costMinor = Number(body.costMinor ?? 0)
    if (!rollNumber) throw new ValidationError('ROLL_NUMBER_REQUIRED')
    if (!Number.isFinite(initialLength) || initialLength <= 0) {
      throw new ValidationError('ROLL_LENGTH_INVALID')
    }
    if (!Number.isSafeInteger(costMinor) || costMinor < 0) {
      throw new ValidationError('ROLL_COST_INVALID')
    }
    const key = requestId(c, body)
    const now = new Date().toISOString()

    return c.db.transaction(() => {
      if (key) {
        const existing = c.db.get<RollRow>(
          `SELECT * FROM local_rolls WHERE workspace_id = ? AND client_request_id = ?`,
          [c.ctx.workspaceId, key],
        )
        if (existing) return { __status: 200, __data: existing }
      }
      const id = trim(body.id) || crypto.randomUUID()
      c.db.run(
        `INSERT INTO local_rolls
           (id, workspace_id, roll_number, initial_length, remaining_length, unit,
            location, cost_minor, custom_conversion_factor, client_request_id,
            created_at, updated_at, origin, sync_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
        [
          id,
          c.ctx.workspaceId,
          rollNumber,
          initialLength,
          initialLength,
          trim(body.unit) || 'm',
          trim(body.location) || null,
          costMinor,
          body.customConversionFactor === null || body.customConversionFactor === undefined
            ? null
            : Number(body.customConversionFactor),
          key || null,
          now,
          now,
        ],
      )
      return rollOf(c, id)
    })
  })

  router.get('/local-rolls/:id', (c: RouteHandlerContext) => ({
    data: rollOf(c, c.params.id ?? ''),
  }))

  /**
   * Consume a length for a partial sale. The conditional UPDATE is the atom:
   * a second concurrent request matches no row and gets a 409, never a second
   * deduction. The shared rule computes the new remainder; the WHERE guards it.
   */
  router.post('/local-rolls/:id/consume', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'stock.adjust')
    const body = (c.body || {}) as Record<string, unknown>
    const key = requestId(c, body)
    const requested = Number(body.length ?? body.quantity)
    const fromUnit = trim(body.fromUnit)
    const now = new Date().toISOString()

    return c.db.transaction(() => {
      const roll = rollOf(c, c.params.id ?? '')
      const length =
        fromUnit && fromUnit !== roll.unit
          ? convertBatchQuantity(
              requested,
              { customConversionFactor: roll.custom_conversion_factor },
              Number(body.fallbackFactor ?? 1),
            )
          : requested
      const verdict = consumeRollLength(asBatch(roll), length)
      if (!verdict.success) {
        throw new ValidationError(verdict.error, {
          requestedLength: length,
          availableLength: roll.remaining_length,
        })
      }
      const updated = c.db.run(
        `UPDATE local_rolls SET remaining_length = ?, updated_at = ?
         WHERE id = ? AND workspace_id = ? AND remaining_length >= ? AND deleted_at IS NULL`,
        [verdict.newRemainingLength, now, roll.id, c.ctx.workspaceId, length],
      )
      if (updated.changes !== 1) throw new ConflictError('ROLL_CONCURRENT_CONSUMPTION')
      recordMovement(c, roll.id, 'consume', length, 0, key)
      return {
        __status: 200,
        __data: {
          rollId: roll.id,
          consumedLength: length,
          newRemainingLength: verdict.newRemainingLength,
        },
      }
    })
  })

  /** Record a cut with its waste; only the sellable part may later be sold. */
  router.post('/local-rolls/:id/cut', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'stock.adjust')
    const body = (c.body || {}) as Record<string, unknown>
    const key = requestId(c, body)
    const cutLength = Number(body.cutLength ?? body.length)
    const wasteLength = Number(body.wasteLength ?? 0)

    return c.db.transaction(() => {
      const roll = rollOf(c, c.params.id ?? '')
      const verdict = splitRollCut({ roll: asBatch(roll), cutLength, wasteLength })
      if (!verdict.success) {
        throw new ValidationError(verdict.error, {
          requestedLength: cutLength,
          availableLength: roll.remaining_length,
        })
      }
      const updated = c.db.run(
        `UPDATE local_rolls SET remaining_length = ?, updated_at = ?
         WHERE id = ? AND workspace_id = ? AND remaining_length >= ? AND deleted_at IS NULL`,
        [
          verdict.newRemainingLength,
          new Date().toISOString(),
          roll.id,
          c.ctx.workspaceId,
          cutLength,
        ],
      )
      if (updated.changes !== 1) throw new ConflictError('ROLL_CONCURRENT_CUT')
      recordMovement(c, roll.id, 'cut', verdict.sellableLength, wasteLength, key)
      return verdict
    })
  })

  /** A return goes back to the SAME roll and cannot invent more than was consumed. */
  router.post('/local-rolls/:id/return', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'stock.adjust')
    const body = (c.body || {}) as Record<string, unknown>
    const key = requestId(c, body)
    const returnLength = Number(body.length ?? body.returnLength)

    return c.db.transaction(() => {
      const roll = rollOf(c, c.params.id ?? '')
      const verdict = returnToRoll(asBatch(roll), returnLength)
      if (!verdict.success) {
        throw new ValidationError(verdict.error, {
          returnedLength: returnLength,
          consumedLength: verdict.consumedLength,
        })
      }
      const updated = c.db.run(
        `UPDATE local_rolls SET remaining_length = ?, updated_at = ?
         WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
        [verdict.newRemainingLength, new Date().toISOString(), roll.id, c.ctx.workspaceId],
      )
      if (updated.changes !== 1) throw new ConflictError('ROLL_CONCURRENT_RETURN')
      recordMovement(c, roll.id, 'return', returnLength, 0, key)
      return verdict
    })
  })
}
