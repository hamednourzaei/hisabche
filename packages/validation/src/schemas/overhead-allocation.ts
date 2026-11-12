import { z } from 'zod'

export const OVERHEAD_BASES = ['revenue_share', 'labour_hours', 'direct_cost', 'manual'] as const
export type OverheadBasis = (typeof OVERHEAD_BASES)[number]

export const overheadPolicySchema = z
  .object({
    basis: z.enum(OVERHEAD_BASES),
    sourceAccountIds: z.array(z.string().uuid()).min(1).max(50),
    targetDimensionId: z.string().uuid(),
    manualWeights: z.record(z.string().uuid(), z.number().nonnegative()).optional(),
  })
  .strict()
export type OverheadPolicyInput = z.infer<typeof overheadPolicySchema>

export const overheadRunSchema = z
  .object({
    period: z.string().regex(/^\d{4}-\d{2}$/),
    entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    currency: z.string().min(3).max(6).optional(),
  })
  .strict()
export type OverheadRunInput = z.infer<typeof overheadRunSchema>

export interface OverheadTargetDriver {
  readonly dimensionValueId: string
  /** Null when driver data is unknown/unreadable; never coerced to 0. */
  readonly driverValue: number | null
}

export interface OverheadAllocationLine {
  readonly dimensionValueId: string
  readonly amountMinor: number
}

export type OverheadAllocationResult =
  | { readonly status: 'allocated'; readonly allocations: readonly OverheadAllocationLine[] }
  | { readonly status: 'unknown_cost'; readonly allocations: null }
  | { readonly status: 'zero_driver_total'; readonly allocations: null }

/**
 * Pure integer-minor overhead split using largest-remainder apportionment.
 * Unknown cost or unknown driver value stays null (never 0, never guessed).
 */
export function computeOverheadAllocation(input: {
  basis: OverheadBasis
  poolAmountMinor: number | null
  targets: readonly OverheadTargetDriver[]
  manualWeights?: Readonly<Record<string, number>> | undefined
}): OverheadAllocationResult {
  if (input.poolAmountMinor === null || !Number.isInteger(input.poolAmountMinor)) {
    return { status: 'unknown_cost', allocations: null }
  }
  if (input.targets.length === 0) {
    return { status: 'zero_driver_total', allocations: null }
  }

  const weights: Array<{ id: string; w: number }> = []
  for (const t of input.targets) {
    if (input.basis === 'manual') {
      const w = input.manualWeights?.[t.dimensionValueId]
      if (w === undefined || w === null || !Number.isFinite(w) || w < 0) {
        return { status: 'unknown_cost', allocations: null }
      }
      weights.push({ id: t.dimensionValueId, w })
    } else {
      if (t.driverValue === null || !Number.isFinite(t.driverValue) || t.driverValue < 0) {
        return { status: 'unknown_cost', allocations: null }
      }
      weights.push({ id: t.dimensionValueId, w: t.driverValue })
    }
  }

  const totalWeight = weights.reduce((sum, x) => sum + x.w, 0)
  if (totalWeight <= 0) {
    return { status: 'zero_driver_total', allocations: null }
  }

  const pool = input.poolAmountMinor
  const rawShares = weights.map((x, idx) => {
    const exact = (pool * x.w) / totalWeight
    const floorVal = Math.trunc(exact)
    return { idx, id: x.id, floorVal, rem: Math.abs(exact - floorVal) }
  })

  let remainder = pool - rawShares.reduce((s, x) => s + x.floorVal, 0)
  const step = remainder >= 0 ? 1 : -1
  const sorted = [...rawShares].sort((a, b) => b.rem - a.rem || a.idx - b.idx)
  for (let i = 0; remainder !== 0 && i < sorted.length; i++) {
    sorted[i]!.floorVal += step
    remainder -= step
  }

  return {
    status: 'allocated',
    allocations: rawShares.map((x) => ({ dimensionValueId: x.id, amountMinor: x.floorVal })),
  }
}
