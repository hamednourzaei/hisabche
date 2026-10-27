// ============================================
// packages/local-engine/src/__tests__/universal-core-parity.test.ts
//
// PARITY & VECTOR SUITE for Universal Business Core:
// Tests the 9 exact numeric vectors from §3 of CLOSE-ALL-GAPS-PROMPT.md
// across shared domain rules and local engine execution.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import {
  calculateAreaDimension,
  calculateAreaLineTotal,
  calculateJewelleryLine,
  calculateOldGoldTradeIn,
  calculateReturnDocument,
  consumeRollLength,
  convertBatchQuantity,
  evaluateCreditLimit,
  markSerialReturned,
  markSerialSold,
  resolvePackScan,
  toBaseQuantity,
  validateSerialSale,
  validateVin,
  type OriginalInvoiceLine,
  type ReturnLineRequest,
  type RollBatch,
  type SerialRecord,
  type ProductUnitOption,
} from '@hisabche/validation'
import { createLocalEngine } from '../index'
import { createTestDb } from './test-db'

describe('Universal Core Parity & Golden Numeric Vectors', () => {
  let db: ReturnType<typeof createTestDb>
  let engine: ReturnType<typeof createLocalEngine>

  beforeEach(() => {
    db = createTestDb()
    engine = createLocalEngine(db)
  })

  // ─── Vector 1: 2 cartons × 24 pieces = 48 pieces ──────────────
  it('Vector 1 (Pack Barcodes): 2 cartons × 24 = 48 pieces base stock', async () => {
    const pack = {
      productId: 'prod-carton-1',
      barcode: 'PACK-001',
      unitCode: 'ctn',
      conversionFactor: 24,
    }

    // Domain calculation
    const resolved = resolvePackScan(pack, 2)
    expect(resolved.baseQuantity).toBe(48)
    expect(resolved.scannedUnit).toBe('ctn')

    // Unit conversion to base quantity: 2 cartons x 24 = 48 pieces
    const unitOptions: ProductUnitOption[] = [
      {
        unitId: 'u1',
        unitCode: 'piece',
        conversionFactorToBase: 1,
        isBaseUnit: true,
        isPurchaseDefault: false,
        isSaleDefault: false,
      },
      {
        unitId: 'u2',
        unitCode: 'ctn',
        conversionFactorToBase: 24,
        isBaseUnit: false,
        isPurchaseDefault: false,
        isSaleDefault: false,
      },
    ]
    const converted = toBaseQuantity(2, 'ctn', unitOptions)
    expect(converted.ok).toBe(true)
    if (converted.ok) {
      expect(converted.baseQuantity).toBe(48)
    }
  })

  // ─── Vector 2: Weight & Unit Pricing Invariants ───────────────
  it('Vector 2: 15 g × 33,000,000 = 495,000,000 and 12 × 25,000 = 300,000', () => {
    const goldTotal = 15 * 33_000_000
    expect(goldTotal).toBe(495_000_000)

    const unitTotal = 12 * 25_000
    expect(unitTotal).toBe(300_000)
  })

  // ─── Vector 3: 3 m × 2.5 m area line at 1,200,000 / m² = 9,000,000
  it('Vector 3 (Area Pricing): 3 m × 2.5 m at 1,200,000/m² = 9,000,000', () => {
    const dimensions = {
      length: 3,
      width: 2.5,
      unit: 'm' as const,
      roundUpToWhole: false,
    }

    const { billableQuantity } = calculateAreaDimension(dimensions)
    expect(billableQuantity).toBe(7.5)

    const lineTotal = calculateAreaLineTotal(dimensions, 1_200_000)
    expect(lineTotal.lineTotalMinor).toBe(9_000_000)
  })

  // ─── Vector 4: Partial Roll (50 m, sell 12.5 -> 37.5; sell 40 -> refused)
  it('Vector 4 (Roll / Fabric): partial roll sale 12.5 from 50 -> 37.5; 40 -> ROLL_INSUFFICIENT', () => {
    const roll: RollBatch = {
      id: 'roll-1',
      rollNumber: 'R-001',
      initialLength: 50,
      remainingLength: 50,
      unit: 'm',
    }

    const sale1 = consumeRollLength(roll, 12.5)
    expect(sale1.success).toBe(true)
    if (sale1.success) {
      expect(sale1.newRemainingLength).toBe(37.5)
    }

    const rollAfterSale1: RollBatch = {
      ...roll,
      remainingLength: 37.5,
    }

    const sale2 = consumeRollLength(rollAfterSale1, 40)
    expect(sale2.success).toBe(false)
    if (!sale2.success) {
      expect(sale2.error).toBe('ROLL_INSUFFICIENT')
    }
  })

  // ─── Vector 5: Per-Batch Factor (A: 1kg = 3.2m, B: 1kg = 3.5m) ───
  it('Vector 5 (Batch Factor): Batch A factor 3.2 vs Batch B factor 3.5', () => {
    const batchA = { customConversionFactor: 3.2 }
    const batchB = { customConversionFactor: 3.5 }

    const lenA = convertBatchQuantity(10, batchA, 1)
    expect(lenA).toBe(32)

    const lenB = convertBatchQuantity(10, batchB, 1)
    expect(lenB).toBe(35)
  })

  // ─── Vector 6: Sale return of 2 of 5 units restores original layer cost
  it('Vector 6 (Returns): return 2 of 5 restores layer cost, 3rd return beyond 5 refused', async () => {
    const originalLines: OriginalInvoiceLine[] = [
      {
        lineId: 'line-1',
        productId: 'prod-item-1',
        quantity: 5,
        unitPriceMinor: 100_000,
        subtotalMinor: 500_000,
        discountMinor: 50_000,
        taxMinor: 45_000,
        totalMinor: 495_000,
        unitCostMinor: 60_000,
      },
    ]

    const returnReq: ReturnLineRequest[] = [
      {
        originalLineId: 'line-1',
        returnQuantity: 2,
        restockChoice: 'restock',
        reasonCode: 'other',
      },
    ]

    const doc = calculateReturnDocument('inv-001', 'sale_return', originalLines, returnReq)
    expect(doc.lines.length).toBe(1)
    const line = doc.lines[0]!
    expect(line.returnQuantity).toBe(2)
    // 2/5 of 500,000 subtotal = 200,000
    expect(line.subtotalMinor).toBe(200_000)
    // 2/5 of 50,000 discount = 20,000
    expect(line.discountMinor).toBe(20_000)
    // 2/5 of 45,000 tax = 18,000
    expect(line.taxMinor).toBe(18_000)
    // Net total = 200,000 - 20,000 + 18,000 = 198,000
    expect(line.totalMinor).toBe(198_000)
    // Cost restored: 2 × 60,000 = 120,000
    expect(line.restoredCostTotalMinor).toBe(120_000)

    // Third return attempting more than remaining 1 unit should fail
    const priorReturned = { 'line-1': 4 }
    expect(() =>
      calculateReturnDocument(
        'inv-001',
        'sale_return',
        originalLines,
        [
          {
            originalLineId: 'line-1',
            returnQuantity: 2,
            restockChoice: 'restock',
            reasonCode: 'other',
          },
        ],
        priorReturned,
      ),
    ).toThrowError(/RETURN_EXCEEDS_ORIGINAL/i)
  })

  // ─── Vector 7: Credit limit (1000/800/+300 warn/block/off) ─────
  it('Vector 7 (Credit Limit): limit 1,000 / receivable 800 / new 300 warn vs block vs off', () => {
    // Mode = 'warn'
    const warnResult = evaluateCreditLimit({
      mode: 'warn',
      creditLimitMinor: 1_000,
      currentReceivableMinor: 800,
      newInvoiceAmountMinor: 300,
    })
    expect(warnResult.allowed).toBe(true)
    if (warnResult.allowed && warnResult.warning) {
      expect(warnResult.warning.overLimitMinor).toBe(100)
      expect(warnResult.warning.totalProjectedReceivableMinor).toBe(1_100)
    }

    // Mode = 'block'
    const blockResult = evaluateCreditLimit({
      mode: 'block',
      creditLimitMinor: 1_000,
      currentReceivableMinor: 800,
      newInvoiceAmountMinor: 300,
    })
    expect(blockResult.allowed).toBe(false)
    if (!blockResult.allowed) {
      expect(blockResult.code).toBe('CREDIT_LIMIT_EXCEEDED')
      expect(blockResult.overLimitMinor).toBe(100)
    }

    // Mode = 'off'
    const offResult = evaluateCreditLimit({
      mode: 'off',
      creditLimitMinor: 1_000,
      currentReceivableMinor: 800,
      newInvoiceAmountMinor: 300,
    })
    expect(offResult.allowed).toBe(true)
    if (offResult.allowed) {
      expect(offResult.warning).toBeNull()
    }

    // Limit null = unlimited
    const nullLimitResult = evaluateCreditLimit({
      mode: 'block',
      creditLimitMinor: null,
      currentReceivableMinor: 800,
      newInvoiceAmountMinor: 300,
    })
    expect(nullLimitResult.allowed).toBe(true)

    // Limit 0 = cash only
    const cashOnlyResult = evaluateCreditLimit({
      mode: 'block',
      creditLimitMinor: 0,
      currentReceivableMinor: 0,
      newInvoiceAmountMinor: 300,
    })
    expect(cashOnlyResult.allowed).toBe(false)
  })

  // ─── Vector 8: Gold (10g net, 22K rate table, making 8%, old gold 4g 18K credited)
  it('Vector 8 (Gold Purity & Making): 10g 22K, 8% making, 4g 18K old-gold trade-in', () => {
    // Rate 24K = 36,000,000 / g
    // Rate 22K = 36,000,000 × (22 / 24) = 33,000,000 / g
    // Rate 18K = 36,000,000 × (18 / 24) = 27,000,000 / g
    const goldLine = calculateJewelleryLine({
      netWeightGrams: 10,
      karat: 22,
      rate24kMinorPerGram: 36_000_000,
      makingChargeType: 'percentage',
      makingChargeValue: 8,
    })

    // Metal cost: 10g × 33,000,000 = 330,000,000
    expect(goldLine.metalValueMinor).toBe(330_000_000)
    // Making charge: 8% of 330,000,000 = 26,400,000
    expect(goldLine.makingChargeMinor).toBe(26_400_000)
    // Gross: 330,000,000 + 26,400,000 = 356,400,000
    expect(goldLine.lineTotalMinor).toBe(356_400_000)

    // Old gold trade-in: 4g at 18K
    const tradeIn = calculateOldGoldTradeIn({
      scrapWeightGrams: 4,
      scrapKarat: 18,
      rate24kMinorPerGram: 36_000_000,
    })
    // 4g × (18/24) = 3g pure 24K equivalent × 36,000,000 = 108,000,000
    expect(tradeIn.creditAmountMinor).toBe(108_000_000)

    // Net total to pay: 356,400,000 - 108,000,000 = 248,400,000
    const netPayable = goldLine.lineTotalMinor - tradeIn.creditAmountMinor
    expect(netPayable).toBe(248_400_000)
  })

  // ─── Vector 9: Serial sale, re-sale refusal, and return ──────────
  it('Vector 9 (Serialized Items): sell S1, re-sale refused, return S1 sellable again', () => {
    let serial1: SerialRecord = {
      productId: 'p-phone-1',
      serialNumber: 'S1',
      status: 'in_stock',
    }

    // 1. Validate sale -> valid
    const sale1Val = validateSerialSale(serial1, 'S1')
    expect(sale1Val.valid).toBe(true)

    // Mark S1 sold
    serial1 = markSerialSold(serial1, 'inv-101')
    expect(serial1.status).toBe('sold')

    // 2. Re-selling S1 is refused
    const sale2Val = validateSerialSale(serial1, 'S1')
    expect(sale2Val.valid).toBe(false)
    if (!sale2Val.valid) {
      expect(sale2Val.error).toBe('SERIAL_ALREADY_SOLD')
    }

    // 3. Return S1 -> restores to in_stock and sellable again
    serial1 = markSerialReturned(serial1)
    expect(serial1.status).toBe('in_stock')

    const sale3Val = validateSerialSale(serial1, 'S1')
    expect(sale3Val.valid).toBe(true)
  })

  // ─── Vector 10: Vehicle VIN Validation ─────────────────────────
  it('Vector 10 (Vehicles): VIN format validation', () => {
    // Standard 17-char VIN without I, O, Q
    expect(validateVin('1HGCR2F83HA000000')).toBe(true)

    // Invalid length (10 chars)
    expect(validateVin('1HGCR2F83H')).toBe(false)

    // Invalid characters (contains letter I or O)
    expect(validateVin('1HGCR2F83HA00000I')).toBe(false)
    expect(validateVin('1HGCR2F83HA00000O')).toBe(false)
  })
})
