// ============================================
// packages/validation/src/schemas/universal-core/logistics-and-fleet.domain.ts
//
// Wave 5 Shared Core:
//   - G14: COD Courier Reconciliation
//   - G72: Supplier Scorecard
//   - G49 / G50 / G100: Fleet Fuel, Maintenance & Insurance Compliance
// ============================================

export interface CodParcelSettlement {
  readonly parcelId: string
  readonly collectedMinor: number
  readonly courierFeeMinor: number
  readonly delivered: boolean
}

export function reconcileCodBatch(parcels: readonly CodParcelSettlement[]): {
  deliveredCount: number
  returnedCount: number
  grossCollectedMinor: number
  totalFeesMinor: number
  netMerchantPayoutMinor: number
} {
  let deliveredCount = 0
  let returnedCount = 0
  let grossCollectedMinor = 0
  let totalFeesMinor = 0
  for (const p of parcels) {
    if (p.delivered) {
      deliveredCount += 1
      grossCollectedMinor += p.collectedMinor
      totalFeesMinor += p.courierFeeMinor
    } else {
      returnedCount += 1
    }
  }
  return {
    deliveredCount,
    returnedCount,
    grossCollectedMinor,
    totalFeesMinor,
    netMerchantPayoutMinor: grossCollectedMinor - totalFeesMinor,
  }
}

export function scoreSupplierPerformance(input: {
  totalOrders: number
  onTimeOrders: number
  defectiveOrders: number
}): { score: number | null; tier: 'A' | 'B' | 'C' | 'UNKNOWN' } {
  if (input.totalOrders <= 0) return { score: null, tier: 'UNKNOWN' }
  const onTimeRate = (input.onTimeOrders / input.totalOrders) * 100
  const defectRate = (input.defectiveOrders / input.totalOrders) * 100
  const score = Math.max(0, Math.min(100, Math.round(onTimeRate - defectRate * 2)))
  const tier = score >= 85 ? 'A' : score >= 65 ? 'B' : 'C'
  return { score, tier }
}

export function evaluateFleetCompliance(input: {
  currentKm: number
  nextServiceKm: number
  insuranceExpiresAt: string
  asOfIso: string
}): { serviceDue: boolean; insuranceExpired: boolean; compliant: boolean } {
  const serviceDue = input.currentKm >= input.nextServiceKm
  const insuranceExpired = input.insuranceExpiresAt < input.asOfIso
  return {
    serviceDue,
    insuranceExpired,
    compliant: !serviceDue && !insuranceExpired,
  }
}
