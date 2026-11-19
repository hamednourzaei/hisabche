// ============================================
// packages/validation/src/schemas/universal-core/roll-cutting.domain.ts
//
// WP-04 — CUT, WASTE, REMAINDER, RETURN AND ROLL COST.
//
// A roll is a stock batch measured in base units (meters). This file combines
// with roll-batch.domain.ts (consume + conversion) to describe what happens to
// a roll when it is cut, partly wasted, or returned. The device and the server
// run the SAME rules so a roll reads the same in both. No rule lives in a route.
// ============================================

import type { RollBatch } from './roll-batch.domain'

/** 1 mm tolerance, physical cutting is not exact (shared with consume). */
const EPSILON = 0.0001

function roundLength(value: number): number {
  return Math.round(value * 1000) / 1000
}

function validLength(value: number, allowZero: boolean): boolean {
  return Number.isFinite(value) && (allowZero ? value >= 0 : value > 0)
}

// ─── Cut → sellable remainder + waste ──────────────────────────────────────

export interface RollCutInput {
  readonly roll: RollBatch
  /** Total length taken off the roll. */
  readonly cutLength: number
  /** The part of the cut that is waste, never more than the cut. */
  readonly wasteLength: number
}

export type RollCutResult =
  | {
      readonly success: true
      readonly cutLength: number
      readonly wasteLength: number
      /** Cut minus waste — the length that can still be sold. */
      readonly sellableLength: number
      readonly newRemainingLength: number
    }
  | {
      readonly success: false
      readonly error: 'INVALID_CUT' | 'INVALID_WASTE' | 'ROLL_INSUFFICIENT'
      readonly requestedLength: number
      readonly availableLength: number
    }

/**
 * Split a cut into sellable length and waste, and shorten the roll.
 *
 * Example: cut 20 m from a 50 m roll, 2 m waste → 18 m sellable, 30 m left.
 * Waste below zero, above the cut, or a cut beyond the roll is refused — never
 * silently clamped to a shorter cut.
 */
export function splitRollCut(input: RollCutInput): RollCutResult {
  const { roll, cutLength, wasteLength } = input
  if (!validLength(cutLength, false)) {
    return {
      success: false,
      error: 'INVALID_CUT',
      requestedLength: cutLength,
      availableLength: roll.remainingLength,
    }
  }
  if (!validLength(wasteLength, true) || wasteLength > cutLength + EPSILON) {
    return {
      success: false,
      error: 'INVALID_WASTE',
      requestedLength: cutLength,
      availableLength: roll.remainingLength,
    }
  }
  if (cutLength > roll.remainingLength + EPSILON) {
    return {
      success: false,
      error: 'ROLL_INSUFFICIENT',
      requestedLength: cutLength,
      availableLength: roll.remainingLength,
    }
  }
  return {
    success: true,
    cutLength,
    wasteLength,
    sellableLength: roundLength(cutLength - wasteLength),
    newRemainingLength: roundLength(Math.max(0, roll.remainingLength - cutLength)),
  }
}

// ─── Return to the SAME roll ───────────────────────────────────────────────

export type RollReturnResult =
  | {
      readonly success: true
      readonly rollId: string
      readonly returnedLength: number
      readonly newRemainingLength: number
    }
  | {
      readonly success: false
      readonly error: 'INVALID_RETURN' | 'RETURN_EXCEEDS_CONSUMED'
      readonly rollId: string
      readonly returnedLength: number
      readonly consumedLength: number
    }

/**
 * Return cut length to the roll it came from.
 *
 * A return can never give a roll more than it originally had: it is capped by
 * what has actually been consumed (`initial - remaining`). A return that would
 * invent stock is refused, not clamped.
 */
export function returnToRoll(roll: RollBatch, returnLength: number): RollReturnResult {
  const consumedLength = roundLength(Math.max(0, roll.initialLength - roll.remainingLength))
  if (!validLength(returnLength, false)) {
    return {
      success: false,
      error: 'INVALID_RETURN',
      rollId: roll.id,
      returnedLength: returnLength,
      consumedLength,
    }
  }
  if (returnLength > consumedLength + EPSILON) {
    return {
      success: false,
      error: 'RETURN_EXCEEDS_CONSUMED',
      rollId: roll.id,
      returnedLength: returnLength,
      consumedLength,
    }
  }
  return {
    success: true,
    rollId: roll.id,
    returnedLength: returnLength,
    newRemainingLength: roundLength(
      Math.min(roll.initialLength, roll.remainingLength + returnLength),
    ),
  }
}

// ─── Roll-centric cost ─────────────────────────────────────────────────────

export interface RollCost {
  /** Cost of the length consumed, integer minor units. */
  readonly consumedCostMinor: number
  /** Cost still sitting on the roll, integer minor units. */
  readonly remainingCostMinor: number
}

/**
 * Allocate a roll's purchase cost across consumed and remaining length.
 *
 * ⚠️ UNKNOWN IS NOT ZERO. A roll with no cost, a zero length or a consumed
 * length beyond the roll returns `null` — the report must say the cost cannot
 * be calculated, not show a free roll. Money stays in integer minor units; the
 * per-meter rate is only ever an intermediate, never reported as a float.
 */
export function rollCostOf(
  costMinor: number,
  initialLength: number,
  consumedLength: number,
): RollCost | null {
  if (!Number.isSafeInteger(costMinor) || costMinor < 0) return null
  if (!validLength(initialLength, false)) return null
  if (!validLength(consumedLength, true) || consumedLength > initialLength + EPSILON) return null

  const consumedCostMinor = Math.round((costMinor * consumedLength) / initialLength)
  if (!Number.isSafeInteger(consumedCostMinor)) return null
  return { consumedCostMinor, remainingCostMinor: costMinor - consumedCostMinor }
}
