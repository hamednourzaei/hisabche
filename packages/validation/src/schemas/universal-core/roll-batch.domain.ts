// ============================================
// packages/validation/src/schemas/universal-core/roll-batch.domain.ts
//
// G-07: ROLL / PER-BATCH UNIT FACTOR & PARTIAL ROLL CONSUMPTION
//
// Fabric rolls, carpets, cables, industrial yarn.
// A roll is a stock batch measured in base units (meters).
// Partial sales consume from the batch's remaining quantity.
// ============================================

export interface RollBatch {
  readonly id: string
  readonly rollNumber: string
  readonly initialLength: number
  readonly remainingLength: number
  readonly unit: string
  /** Optional custom batch conversion factor (e.g. kg to meters) */
  readonly customConversionFactor?: number | null | undefined
}

export type RollConsumptionResult =
  | {
      readonly success: true
      readonly rollId: string
      readonly consumedLength: number
      readonly newRemainingLength: number
    }
  | {
      readonly success: false
      readonly error: 'ROLL_INSUFFICIENT' | 'INVALID_QUANTITY'
      readonly rollId: string
      readonly requestedLength: number
      readonly availableLength: number
    }

/**
 * Consume a partial length from a roll batch.
 * Vector: Roll 50m, sell 12.5m -> remaining 37.5m.
 * Sell 40m -> refused ROLL_INSUFFICIENT.
 */
export function consumeRollLength(roll: RollBatch, requestedLength: number): RollConsumptionResult {
  if (!Number.isFinite(requestedLength) || requestedLength <= 0) {
    return {
      success: false,
      error: 'INVALID_QUANTITY',
      rollId: roll.id,
      requestedLength,
      availableLength: roll.remainingLength,
    }
  }

  // Tolerance for floating point precision in physical cutting (1mm = 0.001m)
  const epsilon = 0.0001
  if (requestedLength > roll.remainingLength + epsilon) {
    return {
      success: false,
      error: 'ROLL_INSUFFICIENT',
      rollId: roll.id,
      requestedLength,
      availableLength: roll.remainingLength,
    }
  }

  const rawRemaining = Math.max(0, roll.remainingLength - requestedLength)
  const newRemainingLength = Math.round(rawRemaining * 1000) / 1000

  return {
    success: true,
    rollId: roll.id,
    consumedLength: requestedLength,
    newRemainingLength,
  }
}

/**
 * Convert quantity for a batch that defines its own conversion factor.
 * E.g. Batch A: 1 kg = 3.2 m; Batch B: 1 kg = 3.5 m.
 */
export function convertBatchQuantity(
  quantityInFromUnit: number,
  batch: Pick<RollBatch, 'customConversionFactor'>,
  fallbackProductFactor: number,
): number {
  const factor = batch.customConversionFactor ?? fallbackProductFactor
  return quantityInFromUnit * factor
}
