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

import { z } from 'zod'

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

// ─── Integer-Weight Jewellery Model, Rate Snapshot & Reports (W5 §8.5) ─────

/** 1 gram = 1,000 milligrams (integer base weight unit; zero floating-point drift). */
export const WEIGHT_SCALE_MG = 1000

export function gramsToMilligrams(grams: number): number {
  if (!Number.isFinite(grams) || grams < 0) throw new Error('GOLD_WEIGHT_INVALID')
  return Math.round(grams * WEIGHT_SCALE_MG)
}

export function milligramsToGrams(mg: number): number {
  return mg / WEIGHT_SCALE_MG
}

export type GoldStorageLocation = 'showcase' | 'safe'

export interface GoldItemWeightSpec {
  readonly uniqueCode: string
  readonly karat: Karat
  readonly grossWeightMg: number
  readonly stoneWeightMg: number
  readonly netWeightMg: number
  readonly location: GoldStorageLocation
}

export function validateGoldItemWeights(
  spec: Omit<GoldItemWeightSpec, 'netWeightMg'>,
): GoldItemWeightSpec {
  if (!Number.isInteger(spec.grossWeightMg) || spec.grossWeightMg <= 0) {
    throw new Error('GOLD_GROSS_WEIGHT_INVALID')
  }
  if (!Number.isInteger(spec.stoneWeightMg) || spec.stoneWeightMg < 0) {
    throw new Error('GOLD_STONE_WEIGHT_INVALID')
  }
  const netWeightMg = spec.grossWeightMg - spec.stoneWeightMg
  if (netWeightMg <= 0) {
    throw new Error('GOLD_NET_WEIGHT_INVALID')
  }
  return { ...spec, netWeightMg }
}

export interface LockedMetalRateSnapshot {
  readonly rate24kMinorPerGram: number
  readonly capturedAt: string
  readonly capturedBy: string
}

export interface GoldLineQuoteInput {
  readonly productId: string
  readonly karat: Karat
  readonly netWeightMg: number
  readonly rateSnapshot: LockedMetalRateSnapshot
  readonly makingChargeType: MakingChargeType
  /** Minor units if per_gram/fixed; basis points (e.g. 800 = 8%) or integer % when `percentageIsBp` */
  readonly makingChargeValue: number
  readonly profitBp?: number | undefined
  readonly taxBp?: number | undefined
}

export interface GoldLinePricingResult {
  readonly metalValueMinor: number
  readonly makingChargeMinor: number
  readonly profitMinor: number
  readonly taxMinor: number
  readonly totalMinor: number
  readonly rateSnapshot: LockedMetalRateSnapshot
}

/**
 * Pure BigInt pricing using integer milligrams × locked 24K snapshot × purity factor
 * + making charge + workspace profit + workspace tax.
 * Historical lines store this locked snapshot and NEVER re-price when rate board changes.
 */
export function priceGoldLineWithSnapshot(input: GoldLineQuoteInput): GoldLinePricingResult {
  if (!Number.isInteger(input.netWeightMg) || input.netWeightMg <= 0) {
    throw new Error('GOLD_NET_WEIGHT_INVALID')
  }
  if (
    !Number.isInteger(input.rateSnapshot.rate24kMinorPerGram) ||
    input.rateSnapshot.rate24kMinorPerGram <= 0
  ) {
    throw new Error('GOLD_RATE_INVALID')
  }

  const netMg = BigInt(input.netWeightMg)
  const rate24k = BigInt(input.rateSnapshot.rate24kMinorPerGram)
  const karat = BigInt(input.karat)
  const scale = BigInt(WEIGHT_SCALE_MG) * BigInt(24)
  const metalValueMinor = Number((netMg * rate24k * karat + scale / BigInt(2)) / scale)

  const makingChargeMinor =
    input.makingChargeType === 'percentage'
      ? Math.round((metalValueMinor * input.makingChargeValue) / 100)
      : input.makingChargeType === 'per_gram'
        ? Number(
            (netMg * BigInt(input.makingChargeValue) + BigInt(WEIGHT_SCALE_MG) / BigInt(2)) /
              BigInt(WEIGHT_SCALE_MG),
          )
        : Math.round(input.makingChargeValue)

  const subBeforeProfit = metalValueMinor + makingChargeMinor
  const profitMinor = input.profitBp ? Math.round((subBeforeProfit * input.profitBp) / 10_000) : 0
  const taxable = subBeforeProfit + profitMinor
  const taxMinor = input.taxBp ? Math.round((taxable * input.taxBp) / 10_000) : 0

  return {
    metalValueMinor,
    makingChargeMinor,
    profitMinor,
    taxMinor,
    totalMinor: taxable + taxMinor,
    rateSnapshot: { ...input.rateSnapshot },
  }
}

export interface SecondHandGoldPurchaseInput {
  readonly scrapWeightMg: number
  readonly scrapKarat: Karat
  readonly rateSnapshot: LockedMetalRateSnapshot
  readonly deductionBp?: number | undefined
  readonly kycThresholdMinor?: number | null | undefined
  readonly hasIdentityCaptured?: boolean | undefined
}

export interface SecondHandGoldPurchasePlan {
  readonly documentType: 'second_hand_gold_purchase'
  readonly pureEquivalentMg: number
  readonly grossCreditMinor: number
  readonly deductionMinor: number
  readonly netCreditMinor: number
  readonly rateSnapshot: LockedMetalRateSnapshot
}

export function planSecondHandGoldPurchase(
  input: SecondHandGoldPurchaseInput,
): SecondHandGoldPurchasePlan {
  if (!Number.isInteger(input.scrapWeightMg) || input.scrapWeightMg <= 0) {
    throw new Error('GOLD_WEIGHT_INVALID')
  }
  const pureEquivalentMg = Math.round((input.scrapWeightMg * input.scrapKarat) / 24)
  const grossCreditMinor = Number(
    (BigInt(pureEquivalentMg) * BigInt(input.rateSnapshot.rate24kMinorPerGram) +
      BigInt(WEIGHT_SCALE_MG) / BigInt(2)) /
      BigInt(WEIGHT_SCALE_MG),
  )
  const deductionMinor = input.deductionBp
    ? Math.round((grossCreditMinor * input.deductionBp) / 10_000)
    : 0
  const netCreditMinor = Math.max(0, grossCreditMinor - deductionMinor)

  if (
    input.kycThresholdMinor != null &&
    netCreditMinor >= input.kycThresholdMinor &&
    !input.hasIdentityCaptured
  ) {
    throw new Error('GOLD_KYC_REQUIRED')
  }

  return {
    documentType: 'second_hand_gold_purchase',
    pureEquivalentMg,
    grossCreditMinor,
    deductionMinor,
    netCreditMinor,
    rateSnapshot: { ...input.rateSnapshot },
  }
}

export interface MeltScrapResult {
  readonly inputWeightMg: number
  readonly recoveredPureMg: number
  readonly weightLossMg: number
  readonly wasteCostMinor: number
}

export function recordGoldMeltScrapMovement(input: {
  readonly inputWeightMg: number
  readonly recoveredPureMg: number
  readonly rate24kMinorPerGram: number
}): MeltScrapResult {
  if (!Number.isInteger(input.inputWeightMg) || input.inputWeightMg <= 0) {
    throw new Error('GOLD_WEIGHT_INVALID')
  }
  if (!Number.isInteger(input.recoveredPureMg) || input.recoveredPureMg < 0) {
    throw new Error('GOLD_WEIGHT_INVALID')
  }
  if (input.recoveredPureMg > input.inputWeightMg) {
    throw new Error('GOLD_RECOVERED_EXCEEDS_INPUT')
  }
  const weightLossMg = input.inputWeightMg - input.recoveredPureMg
  const wasteCostMinor = Number(
    (BigInt(weightLossMg) * BigInt(input.rate24kMinorPerGram) +
      BigInt(WEIGHT_SCALE_MG) / BigInt(2)) /
      BigInt(WEIGHT_SCALE_MG),
  )
  return {
    inputWeightMg: input.inputWeightMg,
    recoveredPureMg: input.recoveredPureMg,
    weightLossMg,
    wasteCostMinor,
  }
}

export interface GoldReportRowInput {
  readonly karat: Karat
  readonly grossWeightMg: number
  readonly netWeightMg: number
  readonly operationType: 'sale' | 'supplier_purchase' | 'second_hand_purchase' | 'melt'
  readonly revenueMinor: number | null
  readonly costMinor: number | null
  readonly makingChargeMinor: number
}

export function summarizeGoldReportByKarat(rows: readonly GoldReportRowInput[]) {
  const byKarat = new Map<
    Karat,
    {
      grossWeightMg: number
      netWeightMg: number
      makingChargeProfitMinor: number
      profitTotal: number
      allProfitKnown: boolean
      secondHandTotalMinor: number
      operationCount: number
    }
  >()

  for (const r of rows) {
    const acc = byKarat.get(r.karat) ?? {
      grossWeightMg: 0,
      netWeightMg: 0,
      makingChargeProfitMinor: 0,
      profitTotal: 0,
      allProfitKnown: true,
      secondHandTotalMinor: 0,
      operationCount: 0,
    }
    acc.grossWeightMg += r.grossWeightMg
    acc.netWeightMg += r.netWeightMg
    acc.makingChargeProfitMinor += r.makingChargeMinor
    acc.operationCount += 1
    if (r.operationType === 'second_hand_purchase' && r.costMinor !== null) {
      acc.secondHandTotalMinor += r.costMinor
    }
    if (r.revenueMinor === null || r.costMinor === null) {
      acc.allProfitKnown = false
    } else {
      acc.profitTotal += r.revenueMinor - r.costMinor
    }
    byKarat.set(r.karat, acc)
  }

  return [...byKarat.entries()].map(([karat, acc]) => ({
    karat,
    grossWeightMg: acc.grossWeightMg,
    netWeightMg: acc.netWeightMg,
    makingChargeProfitMinor: acc.makingChargeProfitMinor,
    profitMinor: acc.allProfitKnown ? acc.profitTotal : null,
    secondHandTotalMinor: acc.secondHandTotalMinor,
    operationCount: acc.operationCount,
  }))
}

export function reconcileGoldLocationWeights(input: {
  readonly location: GoldStorageLocation
  readonly systemWeightMg: number
  readonly physicalCountedMg: number
}) {
  return {
    location: input.location,
    systemWeightMg: input.systemWeightMg,
    physicalCountedMg: input.physicalCountedMg,
    varianceMg: input.physicalCountedMg - input.systemWeightMg,
  }
}

// ─── Request / snapshot schemas (gold-01) ───────────────────────────────────

export const goldKaratSchema = z.union([
  z.literal(24),
  z.literal(22),
  z.literal(21),
  z.literal(18),
  z.literal(14),
  z.literal(9),
])

export const goldLineSnapshotSchema = z.object({
  karat: goldKaratSchema,
  netWeightMg: z.number().int().positive().max(1e12),
  rate24kMinorPerGram: z.number().int().positive().max(1e15),
  makingChargeMinor: z.number().int().nonnegative().max(1e15),
  capturedAt: z.string().trim().min(10).max(64),
  capturedBy: z.string().trim().min(1).max(120),
})
export type GoldLineSnapshot = z.infer<typeof goldLineSnapshotSchema>

export const metalRateRecordSchema = z.object({
  rateDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rate24kMinorPerGram: z.number().int().positive().max(1e15),
})

export const secondHandGoldPurchaseRequestSchema = z.object({
  karat: goldKaratSchema,
  scrapWeightMg: z.number().int().positive().max(1e12),
  deductionBp: z.number().int().min(0).max(9_999).default(0),
  kycThresholdMinor: z.number().int().positive().max(1e15).nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
  identity: z
    .object({
      fullName: z.string().trim().min(2).max(160),
      idType: z.enum(['national_id', 'passport', 'driving_licence', 'other']),
      idNumber: z.string().trim().min(3).max(60),
    })
    .nullable()
    .optional(),
  note: z.string().trim().max(300).optional(),
})
export type SecondHandGoldPurchaseRequest = z.infer<typeof secondHandGoldPurchaseRequestSchema>

export const goldMeltScrapRequestSchema = z.object({
  karat: goldKaratSchema,
  inputWeightMg: z.number().int().positive().max(1e12),
  recoveredPureMg: z.number().int().nonnegative().max(1e12),
  note: z.string().trim().max(300).optional(),
})
export type GoldMeltScrapRequest = z.infer<typeof goldMeltScrapRequestSchema>

export const goldReconcileLocationRequestSchema = z.object({
  location: z.enum(['showcase', 'safe']),
  karat: goldKaratSchema,
  systemWeightMg: z.number().int().nonnegative().max(1e12),
  physicalCountedMg: z.number().int().nonnegative().max(1e12),
  note: z.string().trim().max(300).optional(),
})
export type GoldReconcileLocationRequest = z.infer<typeof goldReconcileLocationRequestSchema>
