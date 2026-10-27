// ============================================
// packages/validation/src/schemas/universal-core/area-dimension.domain.ts
//
// G-06: AREA & DIMENSION PRICING
//
// Carpet, flooring, tiles, glass, fabric by area.
// Derives quantity from width × length (× optional count/pieces).
//
// ⚠️ NO SILENT ROUNDING: Area is exact decimal to 4 places unless
// `roundUpToWhole` is explicitly requested by the product policy.
// ============================================

export type LengthUnit = 'm' | 'cm' | 'mm' | 'ft' | 'in'
export type AreaUnit = 'sqm' | 'sqcm' | 'sqft'

export interface DimensionInput {
  readonly width: number
  readonly length: number
  readonly count?: number | null | undefined
  readonly unit?: LengthUnit | string | null | undefined
  readonly targetAreaUnit?: AreaUnit | string | null | undefined
  readonly roundUpToWhole?: boolean | null | undefined
}

export interface DimensionResult {
  readonly area: number
  readonly billableQuantity: number
  readonly widthMeters: number
  readonly lengthMeters: number
  readonly count: number
}

/** Convert length to meters */
export function toMeters(value: number, unit?: string | null): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  switch (unit) {
    case 'cm':
      return value / 100
    case 'mm':
      return value / 1000
    case 'ft':
      return value * 0.3048
    case 'in':
      return value * 0.0254
    case 'm':
    default:
      return value
  }
}

/** Convert square meters to target area unit */
export function fromSquareMeters(sqm: number, targetUnit?: string | null): number {
  if (!Number.isFinite(sqm) || sqm <= 0) return 0
  switch (targetUnit) {
    case 'sqcm':
      return sqm * 10000
    case 'sqft':
      return sqm * 10.7639
    case 'sqm':
    default:
      return sqm
  }
}

/**
 * Compute area and billable quantity from dimensions.
 * Vector: 3m × 2.5m = 7.5 sqm. At 1,200,000 / sqm = 9,000,000.
 */
export function calculateAreaDimension(input: DimensionInput): DimensionResult {
  const widthMeters = toMeters(input.width, input.unit)
  const lengthMeters = toMeters(input.length, input.unit)
  const count = Number.isFinite(input.count) && (input.count ?? 0) > 0 ? (input.count as number) : 1

  const rawSqm = widthMeters * lengthMeters * count
  const rawTargetArea = fromSquareMeters(rawSqm, input.targetAreaUnit)

  const area = Math.round(rawTargetArea * 10000) / 10000
  const billableQuantity = input.roundUpToWhole ? Math.ceil(area) : area

  return {
    area,
    billableQuantity,
    widthMeters,
    lengthMeters,
    count,
  }
}

/**
 * Calculate line total in integer minor units.
 */
export function calculateAreaLineTotal(
  dimensions: DimensionInput,
  unitPriceMinor: number,
): { quantity: number; lineTotalMinor: number } {
  const { billableQuantity } = calculateAreaDimension(dimensions)
  const lineTotalMinor = Math.round(billableQuantity * unitPriceMinor)
  return {
    quantity: billableQuantity,
    lineTotalMinor,
  }
}
