import { describe, expect, it } from 'vitest'

import {
  consumeRollLength,
  convertBatchQuantity,
  type RollBatch,
} from '../schemas/universal-core/roll-batch.domain'
import {
  returnToRoll,
  rollCostOf,
  splitRollCut,
} from '../schemas/universal-core/roll-cutting.domain'

const roll: RollBatch = {
  id: 'roll-1',
  rollNumber: 'R-50',
  initialLength: 50,
  remainingLength: 50,
  unit: 'm',
  customConversionFactor: 3.2,
}

describe('WP-04 roll cut', () => {
  it('selling 12.5 m from a 50 m roll leaves 37.5 m', () => {
    const consumed = consumeRollLength(roll, 12.5)
    expect(consumed.success).toBe(true)
    expect(consumed.success && consumed.newRemainingLength).toBe(37.5)
  })

  it('a cut is split into sellable length and waste', () => {
    const result = splitRollCut({ roll, cutLength: 20, wasteLength: 2 })
    expect(result.success).toBe(true)
    expect(
      result.success && [result.sellableLength, result.wasteLength, result.newRemainingLength],
    ).toEqual([18, 2, 30])
  })

  it('refuses waste above the cut and a cut beyond the roll', () => {
    expect(splitRollCut({ roll, cutLength: 10, wasteLength: 11 }).success).toBe(false)
    expect(splitRollCut({ roll, cutLength: 51, wasteLength: 0 }).success).toBe(false)
    expect(consumeRollLength(roll, 40).success).toBe(true) // 40 ≤ 50
    expect(consumeRollLength(roll, 50.0002).success).toBe(false)
  })

  it('uses the roll own conversion factor when one is set', () => {
    expect(convertBatchQuantity(2, roll, 4)).toBeCloseTo(6.4)
    expect(convertBatchQuantity(2, { customConversionFactor: null }, 4)).toBe(8)
  })
})

describe('WP-04 roll return and cost', () => {
  it('a return restores the SAME roll and never invents stock', () => {
    const shortened: RollBatch = { ...roll, remainingLength: 37.5 }
    const ok = returnToRoll(shortened, 12.5)
    expect(ok.success).toBe(true)
    expect(ok.success && ok.newRemainingLength).toBe(50)
    const refused = returnToRoll(shortened, 13)
    expect(refused.success ? null : refused.error).toBe('RETURN_EXCEEDS_CONSUMED')
  })

  it('allocates cost in integer minor units', () => {
    expect(rollCostOf(50_000, 50, 12.5)).toEqual({
      consumedCostMinor: 12_500,
      remainingCostMinor: 37_500,
    })
  })

  it('an unknown cost or length is unknown, never a free roll', () => {
    expect(rollCostOf(Number.NaN, 50, 12.5)).toBeNull()
    expect(rollCostOf(50_000, 0, 0)).toBeNull()
    expect(rollCostOf(50_000, 50, 51)).toBeNull()
  })
})
