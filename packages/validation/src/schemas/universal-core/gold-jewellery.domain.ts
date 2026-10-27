// ============================================
// packages/validation/src/schemas/universal-core/gold-jewellery.domain.ts
//
// G-13: GOLD PURITY, MAKING CHARGES & OLD-GOLD TRADE-IN
//
// Gold, jewellery, bullion, precious metals.
// Karat purity, dated metal rates, flexible making charges,
// and old gold trade-in credit calculation.
//
// ⚠️ MONEY IS INTEGER MINOR UNITS THROUGHOUT.
// ============================================

export type Karat = 24 | 22 | 21 | 18 | 14 | 9

export type MakingChargeType = 'per_gram' | 'percentage' | 'fixed'

export interface MetalRateRecord {
  readonly date: string // YYYY-MM-DD
  readonly rate24kMinorPerGram: number
}

export interface JewellerySaleLineInput {
  readonly netWeightGrams: number
  readonly karat: Karat
  readonly rate24kMinorPerGram: number
  readonly makingChargeType: MakingChargeType
  readonly makingChargeValue: number // minor units if fixed/per-gram, or percentage number (e.g. 8 for 8%)
}

export interface OldGoldTradeInInput {
  readonly scrapWeightGrams: number
  readonly scrapKarat: Karat
  readonly rate24kMinorPerGram: number
  readonly deductionPercentage?: number | null | undefined // e.g. 2% smelting/refining loss
}

export interface JewelleryLineCalculation {
  readonly netWeightGrams: number
  readonly karat: Karat
  readonly effectiveGramRateMinor: number
  readonly metalValueMinor: number
  readonly makingChargeMinor: number
  readonly lineTotalMinor: number
}

/**
 * Derive gram rate for a specific karat based on 24K pure rate.
 * Formula: 24kRate * (karat / 24)
 */
export function deriveKaratGramRate(rate24kMinorPerGram: number, karat: Karat): number {
  return Math.round((rate24kMinorPerGram * karat) / 24)
}

/**
 * Calculate jewellery sale line price with metal value + making charge.
 * Vector: 10g net, 22K, making 8% of metal.
 */
export function calculateJewelleryLine(input: JewellerySaleLineInput): JewelleryLineCalculation {
  const effectiveGramRateMinor = deriveKaratGramRate(input.rate24kMinorPerGram, input.karat)
  const metalValueMinor = Math.round(input.netWeightGrams * effectiveGramRateMinor)

  let makingChargeMinor: number
  switch (input.makingChargeType) {
    case 'percentage':
      // e.g. 8% of metal value
      makingChargeMinor = Math.round((metalValueMinor * input.makingChargeValue) / 100)
      break
    case 'per_gram':
      // e.g. 50,000 minor per gram
      makingChargeMinor = Math.round(input.netWeightGrams * input.makingChargeValue)
      break
    case 'fixed':
    default:
      makingChargeMinor = Math.round(input.makingChargeValue)
      break
  }

  const lineTotalMinor = metalValueMinor + makingChargeMinor

  return {
    netWeightGrams: input.netWeightGrams,
    karat: input.karat,
    effectiveGramRateMinor,
    metalValueMinor,
    makingChargeMinor,
    lineTotalMinor,
  }
}

/**
 * Calculate old-gold trade-in credit line.
 * Vector: 4g at 18K credited.
 */
export function calculateOldGoldTradeIn(input: OldGoldTradeInInput): {
  scrapWeightGrams: number
  scrapKarat: Karat
  pureEquivalentGrams: number
  creditAmountMinor: number
} {
  const pureEquivalentGrams =
    Math.round(((input.scrapWeightGrams * input.scrapKarat) / 24) * 1000) / 1000
  let creditAmountMinor = Math.round(pureEquivalentGrams * input.rate24kMinorPerGram)

  if (input.deductionPercentage && input.deductionPercentage > 0) {
    const deduction = Math.round((creditAmountMinor * input.deductionPercentage) / 100)
    creditAmountMinor = Math.max(0, creditAmountMinor - deduction)
  }

  return {
    scrapWeightGrams: input.scrapWeightGrams,
    scrapKarat: input.scrapKarat,
    pureEquivalentGrams,
    creditAmountMinor,
  }
}
