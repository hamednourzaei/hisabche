import { describe, expect, it } from 'vitest'
import {
  calculateAreaDimension,
  calculateAreaLineTotal,
  consumeRollLength,
  convertBatchQuantity,
  evaluateCreditLimit,
  resolveVariantPrice,
  formatVariantTitle,
  canonicalAttributeKey,
  resolvePackScan,
  validateSerialSale,
  markSerialSold,
  markSerialReturned,
  sortBatchesFEFO,
  calculateReturnDocument,
  calculateWarrantyEndDate,
  isWarrantyActive,
  deriveKaratGramRate,
  calculateJewelleryLine,
  calculateOldGoldTradeIn,
  matchesFitment,
  buildCoreDepositLine,
  validateVin,
  calculateDaysInStock,
  calculateTotalVehicleCost,
  calculateVehicleProfit,
  calculateTripSummary,
  progressCodStage,
  explodeKit,
  type RollBatch,
  type SerialRecord,
  type OriginalInvoiceLine,
  type VehicleUnit,
  type FreightTrip,
} from '../schemas/universal-core'
import { threeWayMatch } from '../schemas/purchasing.domain'
import { allocateLandedCost } from '../schemas/costing.domain'
import { buildDeferralSchedule } from '../schemas/deferral.domain'
import {
  calculateExpenseReportTotal,
  canApproveExpenseReport,
} from '../schemas/expense-claims.domain'
import { generateRecoveryCodes, matchRecoveryCode } from '../schemas/mfa.domain'
import { consolidateEntities } from '../schemas/consolidation.domain'
import { formatArdBrtReturn } from '../schemas/tax-return.domain'

describe('Universal Business Core — Comprehensive Invariant Tests', () => {
  describe('G-06: Area & Dimension Pricing', () => {
    it('exact area vector: 3m × 2.5m at 1,200,000 / m² = 9,000,000', () => {
      const dim = { width: 3, length: 2.5, unit: 'm' }
      const res = calculateAreaDimension(dim)
      expect(res.area).toBe(7.5)
      expect(res.billableQuantity).toBe(7.5)

      const line = calculateAreaLineTotal(dim, 1_200_000)
      expect(line.quantity).toBe(7.5)
      expect(line.lineTotalMinor).toBe(9_000_000)
    })

    it('area with count multiplier: 2 pieces of 2m × 3m = 12 m²', () => {
      const dim = { width: 2, length: 3, count: 2, unit: 'm' }
      const res = calculateAreaDimension(dim)
      expect(res.area).toBe(12)
      expect(res.billableQuantity).toBe(12)
    })

    it('roundUpToWhole policy is applied only when requested', () => {
      const dimNoRound = { width: 1.2, length: 2.1, roundUpToWhole: false }
      expect(calculateAreaDimension(dimNoRound).billableQuantity).toBe(2.52)

      const dimRound = { width: 1.2, length: 2.1, roundUpToWhole: true }
      expect(calculateAreaDimension(dimRound).billableQuantity).toBe(3)
    })
  })

  describe('G-07: Roll & Per-Batch Unit Factor', () => {
    it('partial roll: 50m roll, sell 12.5m -> 37.5m remaining; sell 40m -> ROLL_INSUFFICIENT', () => {
      const roll: RollBatch = {
        id: 'roll-1',
        rollNumber: 'R-100',
        initialLength: 50,
        remainingLength: 50,
        unit: 'meter',
      }

      const sale1 = consumeRollLength(roll, 12.5)
      expect(sale1.success).toBe(true)
      if (sale1.success) {
        expect(sale1.consumedLength).toBe(12.5)
        expect(sale1.newRemainingLength).toBe(37.5)

        const updatedRoll: RollBatch = { ...roll, remainingLength: sale1.newRemainingLength }
        const sale2 = consumeRollLength(updatedRoll, 40)
        expect(sale2.success).toBe(false)
        if (!sale2.success) {
          expect(sale2.error).toBe('ROLL_INSUFFICIENT')
          expect(sale2.availableLength).toBe(37.5)
          expect(sale2.requestedLength).toBe(40)
        }
      }
    })

    it('per-batch factor: batch A (3.2m/kg) vs batch B (3.5m/kg) consumes by own factor', () => {
      const batchA = { customConversionFactor: 3.2 }
      const batchB = { customConversionFactor: 3.5 }

      expect(convertBatchQuantity(10, batchA, 3.0)).toBe(32)
      expect(convertBatchQuantity(10, batchB, 3.0)).toBe(35)
    })
  })

  describe('G-08: Credit Limit Enforcement', () => {
    it('vector: limit 1,000 / receivable 800 / invoice 300', () => {
      // warn mode -> shows 100 over, allows sale
      const warnResult = evaluateCreditLimit({
        mode: 'warn',
        currentReceivableMinor: 800,
        newInvoiceAmountMinor: 300,
        creditLimitMinor: 1000,
      })
      expect(warnResult.allowed).toBe(true)
      if (warnResult.allowed) {
        expect(warnResult.warning).toEqual({
          overLimitMinor: 100,
          totalProjectedReceivableMinor: 1100,
          creditLimitMinor: 1000,
        })
      }

      // block mode -> refuses sale with coded error
      const blockResult = evaluateCreditLimit({
        mode: 'block',
        currentReceivableMinor: 800,
        newInvoiceAmountMinor: 300,
        creditLimitMinor: 1000,
      })
      expect(blockResult.allowed).toBe(false)
      if (!blockResult.allowed) {
        expect(blockResult.code).toBe('CREDIT_LIMIT_EXCEEDED')
        expect(blockResult.overLimitMinor).toBe(100)
      }

      // off mode -> ignores limit
      const offResult = evaluateCreditLimit({
        mode: 'off',
        currentReceivableMinor: 800,
        newInvoiceAmountMinor: 300,
        creditLimitMinor: 1000,
      })
      expect(offResult.allowed).toBe(true)
      if (offResult.allowed) {
        expect(offResult.warning).toBeNull()
      }
    })

    it('limit null (unlimited) vs limit 0 (cash-only) differ', () => {
      const unlimited = evaluateCreditLimit({
        mode: 'block',
        currentReceivableMinor: 50_000,
        newInvoiceAmountMinor: 10_000,
        creditLimitMinor: null,
      })
      expect(unlimited.allowed).toBe(true)

      const cashOnly = evaluateCreditLimit({
        mode: 'block',
        currentReceivableMinor: 0,
        newInvoiceAmountMinor: 5_000,
        creditLimitMinor: 0,
      })
      expect(cashOnly.allowed).toBe(false)
      if (!cashOnly.allowed) {
        expect(cashOnly.code).toBe('CASH_ONLY_CUSTOMER')
      }
    })
  })

  describe('G-16: Pack Barcodes', () => {
    it('vector: 2 cartons × 24 pieces = 48 pieces', () => {
      const barcodeRecord = {
        barcode: '890123456789',
        productId: 'prod-cup',
        unitCode: 'carton',
        conversionFactor: 24,
      }

      const scanResult = resolvePackScan(barcodeRecord, 2)
      expect(scanResult.packCount).toBe(2)
      expect(scanResult.scannedUnit).toBe('carton')
      expect(scanResult.baseQuantity).toBe(48)
    })
  })

  describe('G-10: Serial Number & Batch Allocation at Sale', () => {
    it('vector: sell S1 -> valid; sell S1 again -> refused; return S1 -> valid again', () => {
      const serial: SerialRecord = {
        serialNumber: 'S1',
        productId: 'prod-phone',
        status: 'in_stock',
      }

      const check1 = validateSerialSale(serial, 'S1')
      expect(check1.valid).toBe(true)

      const soldSerial = markSerialSold(serial, 'inv-101')
      expect(soldSerial.status).toBe('sold')

      const check2 = validateSerialSale(soldSerial, 'S1')
      expect(check2.valid).toBe(false)
      if (!check2.valid) {
        expect(check2.error).toBe('SERIAL_ALREADY_SOLD')
      }

      const returnedSerial = markSerialReturned(soldSerial)
      expect(returnedSerial.status).toBe('in_stock')

      const check3 = validateSerialSale(returnedSerial, 'S1')
      expect(check3.valid).toBe(true)
    })

    it('FEFO batches are sorted by expiry ascending', () => {
      const batches = [
        { batchNumber: 'B3', productId: 'p1', expiryDate: '2026-12-31', remainingQuantity: 10 },
        { batchNumber: 'B1', productId: 'p1', expiryDate: '2026-06-01', remainingQuantity: 5 },
        { batchNumber: 'B2', productId: 'p1', expiryDate: '2026-09-15', remainingQuantity: 8 },
        { batchNumber: 'B0', productId: 'p1', expiryDate: '2026-05-01', remainingQuantity: 0 }, // exhausted
      ]
      const sorted = sortBatchesFEFO(batches)
      expect(sorted.map((b) => b.batchNumber)).toEqual(['B1', 'B2', 'B3'])
    })
  })

  describe('G-12: Returns Document & Proportional Reversal', () => {
    it('vector: return of 2 of 5 units restores 2 units at original layer cost, reverses 2/5 of revenue and tax', () => {
      const originalLines: OriginalInvoiceLine[] = [
        {
          lineId: 'line-1',
          productId: 'prod-shoes',
          quantity: 5,
          unitPriceMinor: 100_000, // 500,000 subtotal
          subtotalMinor: 500_000,
          discountMinor: 50_000, // 10,000 discount per unit
          taxMinor: 45_000, // 9,000 tax per unit
          totalMinor: 495_000,
          unitCostMinor: 60_000,
        },
      ]

      const returnDoc = calculateReturnDocument(
        'inv-orig-1',
        'sale_return',
        originalLines,
        [
          {
            originalLineId: 'line-1',
            returnQuantity: 2,
            restockChoice: 'restock',
            reasonCode: 'defective',
          },
        ],
        { 'line-1': 0 },
      )

      expect(returnDoc.lines[0]?.returnRatio).toBe(0.4) // 2 / 5
      expect(returnDoc.lines[0]?.subtotalMinor).toBe(200_000)
      expect(returnDoc.lines[0]?.discountMinor).toBe(20_000)
      expect(returnDoc.lines[0]?.taxMinor).toBe(18_000)
      expect(returnDoc.lines[0]?.totalMinor).toBe(198_000)
      expect(returnDoc.lines[0]?.restoredCostTotalMinor).toBe(120_000) // 2 × 60,000

      // Refusal when exceeding remaining quantity
      expect(() => {
        calculateReturnDocument(
          'inv-orig-1',
          'sale_return',
          originalLines,
          [
            {
              originalLineId: 'line-1',
              returnQuantity: 4,
              restockChoice: 'restock',
              reasonCode: 'defective',
            },
          ],
          { 'line-1': 2 }, // already returned 2 of 5 -> only 3 remain
        )
      }).toThrow(/RETURN_EXCEEDS_ORIGINAL/)
    })
  })

  describe('G-13: Gold Purity, Making Charge & Old-Gold Trade-In', () => {
    it('vector: 10g net, 22K rate table, making 8% of metal, old gold 4g at 18K credited', () => {
      // 24K rate: 36,000,000 minor per gram
      const rate24k = 36_000_000
      // 22K rate = 36,000,000 * 22 / 24 = 33,000,000 minor per gram
      const derived22k = deriveKaratGramRate(rate24k, 22)
      expect(derived22k).toBe(33_000_000)

      // 10g net 22K: metal value = 10 * 33,000,000 = 330,000,000
      // making 8% = 26,400,000
      // sale line total = 356,400,000
      const sale = calculateJewelleryLine({
        netWeightGrams: 10,
        karat: 22,
        rate24kMinorPerGram: rate24k,
        makingChargeType: 'percentage',
        makingChargeValue: 8,
      })
      expect(sale.metalValueMinor).toBe(330_000_000)
      expect(sale.makingChargeMinor).toBe(26_400_000)
      expect(sale.lineTotalMinor).toBe(356_400_000)

      // Old gold 4g at 18K credited:
      // pure equivalent = 4 * 18 / 24 = 3g pure
      // credit = 3g * 36,000,000 = 108,000,000
      const tradeIn = calculateOldGoldTradeIn({
        scrapWeightGrams: 4,
        scrapKarat: 18,
        rate24kMinorPerGram: rate24k,
      })
      expect(tradeIn.pureEquivalentGrams).toBe(3)
      expect(tradeIn.creditAmountMinor).toBe(108_000_000)

      // Net invoice payable = 356,400,000 - 108,000,000 = 248,400,000
      const netPayableMinor = sale.lineTotalMinor - tradeIn.creditAmountMinor
      expect(netPayableMinor).toBe(248_400_000)
    })
  })

  describe('G-05: Product Variants', () => {
    it('variant price override falls back to template price when null', () => {
      expect(resolveVariantPrice(100_000, null)).toBe(100_000)
      expect(resolveVariantPrice(100_000, undefined)).toBe(100_000)
      expect(resolveVariantPrice(100_000, 120_000)).toBe(120_000)
    })

    it('formats title and generates canonical attribute key regardless of order', () => {
      const attrs = [
        { name: 'Color', value: 'Blue' },
        { name: 'Size', value: 'XL' },
      ]
      expect(formatVariantTitle('Shirt', attrs)).toBe('Shirt (Color: Blue, Size: XL)')

      const key1 = canonicalAttributeKey(attrs)
      const key2 = canonicalAttributeKey([
        { name: 'Size', value: 'XL' },
        { name: 'Color', value: 'Blue' },
      ])
      expect(key1).toBe('color:blue|size:xl')
      expect(key1).toBe(key2)
    })
  })

  describe('G-11: Warranty', () => {
    it('calculates warranty end date and checks active window', () => {
      const end = calculateWarrantyEndDate('2026-01-15', 12)
      expect(end).toBe('2027-01-15')

      const warranty = {
        id: 'w1',
        invoiceId: 'inv-1',
        productId: 'prod-laptop',
        startDate: '2026-01-15',
        endDate: '2027-01-15',
        warrantyMonths: 12,
      }
      expect(isWarrantyActive(warranty, '2026-06-01')).toBe(true)
      expect(isWarrantyActive(warranty, '2027-02-01')).toBe(false)
    })
  })

  describe('Auto Parts & Vehicles', () => {
    it('matches vehicle fitment by make, model and year range', () => {
      const fitments = [
        {
          productId: 'brake-pad-1',
          make: 'Toyota',
          model: 'Corolla',
          yearStart: 2012,
          yearEnd: 2018,
        },
      ]
      expect(matchesFitment(fitments, 'toyota', 'corolla', 2015)).toBe(true)
      expect(matchesFitment(fitments, 'toyota', 'corolla', 2020)).toBe(false)
      expect(matchesFitment(fitments, 'honda', 'civic', 2015)).toBe(false)
    })

    it('builds core deposit liability line', () => {
      const line = buildCoreDepositLine('starter-1', 'Alternator 120A', 2, 50_000)
      expect(line.accountRole).toBe('core_deposit')
      expect(line.totalMinor).toBe(100_000)
    })

    it('validates VIN and computes days in stock + vehicle profit with reconditioning', () => {
      // 17 characters alphanumeric without I, O, Q
      expect(validateVin('1HGCR2F83HA123456')).toBe(true)
      expect(validateVin('1HGCR2F83HI123456')).toBe(false) // contains I
      expect(validateVin('SHORTVIN')).toBe(false)

      expect(calculateDaysInStock('2026-01-01', '2026-01-21')).toBe(20)

      const vehicle: VehicleUnit = {
        id: 'v1',
        productId: 'p-car',
        vin: '1HGCR2F83HA123456',
        make: 'Honda',
        model: 'Accord',
        year: 2017,
        colour: 'Silver',
        odometer: 85000,
        receivedDate: '2026-01-01',
        basePurchaseCostMinor: 10_000_000_000,
        reconditioningCosts: [
          {
            id: 'rc1',
            date: '2026-01-05',
            description: 'Brakes & detailing',
            amountMinor: 250_000_000,
          },
        ],
        status: 'in_stock',
      }
      expect(calculateTotalVehicleCost(vehicle)).toBe(10_250_000_000)

      const profit = calculateVehicleProfit(vehicle, 12_000_000_000)
      expect(profit.profitMinor).toBe(1_750_000_000)
      expect(profit.marginPercent).toBe(14.58)
    })
  })

  describe('Specialized Extensions: Freight & Courier', () => {
    it('summarizes freight trip revenue, expenses and net contribution', () => {
      const trip: FreightTrip = {
        id: 'trip-1',
        vehicleAssetId: 'truck-1',
        driverEmployeeId: 'emp-1',
        origin: 'Kabul',
        destination: 'Herat',
        startDate: '2026-10-01',
        status: 'completed',
        loads: [
          {
            id: 'l1',
            customerId: 'c1',
            cargoDescription: 'Flour',
            weightKg: 10000,
            freightChargeMinor: 15_000_000,
          },
          {
            id: 'l2',
            customerId: 'c2',
            cargoDescription: 'Cooking oil',
            weightKg: 5000,
            freightChargeMinor: 9_000_000,
          },
        ],
        expenses: [
          { id: 'e1', category: 'fuel', amountMinor: 8_000_000, description: 'Diesel' },
          { id: 'e2', category: 'toll', amountMinor: 1_200_000, description: 'Highway toll' },
        ],
      }
      const summary = calculateTripSummary(trip)
      expect(summary.totalRevenueMinor).toBe(24_000_000)
      expect(summary.totalExpensesMinor).toBe(9_200_000)
      expect(summary.netContributionMinor).toBe(14_800_000)
      expect(summary.totalWeightKg).toBe(15000)
    })

    it('progresses COD stage through the lifecycle', () => {
      expect(progressCodStage('to_collect')).toBe('with_driver')
      expect(progressCodStage('with_driver')).toBe('with_cashier')
      expect(progressCodStage('with_cashier')).toBe('banked')
      expect(progressCodStage('banked')).toBe('banked')
    })
  })

  describe('Option 5: Three-Way Match Vector', () => {
    it('detects quantity variance, price variance, and passes exact match', () => {
      const matchExact = threeWayMatch({
        poQuantity: 10,
        poUnitPriceMinor: 100_000,
        receivedQuantity: 10,
        invoiceQuantity: 10,
        invoiceUnitPriceMinor: 100_000,
      })
      expect(matchExact.passed).toBe(true)
      expect(matchExact.variance).toBe('none')

      const qtyMismatch = threeWayMatch({
        poQuantity: 10,
        poUnitPriceMinor: 100_000,
        receivedQuantity: 8,
        invoiceQuantity: 10,
        invoiceUnitPriceMinor: 100_000,
      })
      expect(qtyMismatch.passed).toBe(false)
      expect(qtyMismatch.variance).toBe('quantity_variance')

      const priceMismatch = threeWayMatch({
        poQuantity: 10,
        poUnitPriceMinor: 100_000,
        receivedQuantity: 10,
        invoiceQuantity: 10,
        invoiceUnitPriceMinor: 110_000,
      })
      expect(priceMismatch.passed).toBe(false)
      expect(priceMismatch.variance).toBe('price_variance')
    })
  })

  describe('Option 13: Landed Cost Allocation Vector', () => {
    it('vector: 100 split by value 3:1 -> 75/25, layers repriced', () => {
      const lines = [
        { lineId: 'l1', valueMinor: 75, quantity: 1 },
        { lineId: 'l2', valueMinor: 25, quantity: 1 },
      ]
      const allocated = allocateLandedCost(100, lines, 'value')
      expect(allocated[0]?.allocatedLandedCostMinor).toBe(75)
      expect(allocated[0]?.newUnitCostMinor).toBe(150)
      expect(allocated[1]?.allocatedLandedCostMinor).toBe(25)
      expect(allocated[1]?.newUnitCostMinor).toBe(50)
    })
  })

  describe('Option 14: Kits Explosion Vector', () => {
    it('vector: kit of 3 components sold as 2 units -> 6 components, no work order', () => {
      const components = [
        { productId: 'c1', quantityPerKit: 1 },
        { productId: 'c2', quantityPerKit: 2 },
        { productId: 'c3', quantityPerKit: 3 },
      ]
      const exploded = explodeKit(components, 2)
      expect(exploded).toHaveLength(3)
      expect(exploded[0]?.quantity).toBe(2)
      expect(exploded[1]?.quantity).toBe(4)
      expect(exploded[2]?.quantity).toBe(6)
    })
  })

  describe('Option 4: Deferred Revenue Vector', () => {
    it('vector: 1,200 over 12 months: 12 recognitions, last absorbs rounding', () => {
      const schedule = buildDeferralSchedule(1_200, 12, '2026-01-01')
      expect(schedule).toHaveLength(12)
      expect(schedule[0]?.amountMinor).toBe(100)
      expect(schedule[11]?.amountMinor).toBe(100)
      const sum = schedule.reduce((acc, l) => acc + l.amountMinor, 0)
      expect(sum).toBe(1_200)

      // Test with odd remainder: 1,000 over 3 months -> 333, 333, 334
      const oddSchedule = buildDeferralSchedule(1_000, 3, '2026-01-01')
      expect(oddSchedule[0]?.amountMinor).toBe(333)
      expect(oddSchedule[1]?.amountMinor).toBe(333)
      expect(oddSchedule[2]?.amountMinor).toBe(334)
      expect(oddSchedule.reduce((a, b) => a + b.amountMinor, 0)).toBe(1_000)
    })
  })

  describe('Option 9: Expense Claims', () => {
    it('computes total and gates approval', () => {
      const report = {
        lines: [
          { id: '1', category: 'travel', amountMinor: 50_000, currency: 'AFN' },
          { id: '2', category: 'meals', amountMinor: 20_000, currency: 'AFN' },
        ],
      }
      expect(calculateExpenseReportTotal(report)).toBe(70_000)
      expect(canApproveExpenseReport('submitted')).toBe(true)
      expect(canApproveExpenseReport('approved')).toBe(false)
    })
  })

  describe('Option 47: Customer MFA Recovery Codes', () => {
    it('generates 8 recovery codes and validates formatting', () => {
      const codes = generateRecoveryCodes(8)
      expect(codes).toHaveLength(8)
      expect(codes[0]).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/)
      expect(matchRecoveryCode(codes[0]!.toLowerCase(), codes[0]!)).toBe(true)
    })
  })

  describe('Option 2: Multi-Entity Consolidation', () => {
    it('consolidates two entities and subtracts intercompany elimination', () => {
      const entities = [
        {
          workspaceId: 'w1',
          workspaceName: 'Entity A',
          currency: 'AFN',
          fxRateToBase: 1,
          balances: {
            cash: { debitMinor: 100_000, creditMinor: 0 },
            icDue: { debitMinor: 20_000, creditMinor: 0 },
          },
        },
        {
          workspaceId: 'w2',
          workspaceName: 'Entity B',
          currency: 'AFN',
          fxRateToBase: 1,
          balances: {
            cash: { debitMinor: 50_000, creditMinor: 0 },
            icPayable: { debitMinor: 0, creditMinor: 20_000 },
          },
        },
      ]
      const eliminations = [
        { accountCode: 'ic', amountMinor: 20_000, description: 'Intercompany elimination' },
      ]
      const consolidated = consolidateEntities(
        'Group X',
        'AFN',
        '2026-10-26',
        entities,
        eliminations,
      )
      expect(consolidated.totals.totalDebitMinor).toBe(150_000) // (120k + 50k) - 20k
    })
  })

  describe('Option 29: ARD BRT Return', () => {
    it('calculates Afghan BRT return with 4% standard rate', () => {
      const ret = formatArdBrtReturn({
        tin: '9001234567',
        businessName: 'Kabul Trading Ltd',
        quarter: 'Q3',
        solarYear: 1405,
        grossReceiptsMinor: 1_000_000,
        exemptReceiptsMinor: 200_000,
      })
      expect(ret.taxableReceiptsMinor).toBe(800_000)
      expect(ret.brtOwedMinor).toBe(32_000) // 4% of 800,000
    })
  })
})
