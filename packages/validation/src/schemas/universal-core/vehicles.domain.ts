// ============================================
// packages/validation/src/schemas/universal-core/vehicles.domain.ts
//
// VEHICLES & RECONDITIONING COSTS
//
// Automobile dealerships, motorcycle sales, heavy equipment.
// Serial-tracked vehicle units with VIN, make, model, year, colour, odometer.
// Add-cost-to-unit (reconditioning) flows into unit profit calculation.
// ============================================

export interface VehicleUnit {
  readonly id: string
  readonly productId: string
  readonly vin: string
  readonly make: string
  readonly model: string
  readonly year: number
  readonly colour: string
  readonly odometer: number
  readonly receivedDate: string // YYYY-MM-DD
  readonly basePurchaseCostMinor: number
  readonly reconditioningCosts: readonly ReconditioningCostEntry[]
  readonly status: 'in_stock' | 'sold'
}

export interface ReconditioningCostEntry {
  readonly id: string
  readonly date: string // YYYY-MM-DD
  readonly description: string
  readonly amountMinor: number
  readonly supplierId?: string | null | undefined
}

/**
 * Validate standard 17-character VIN (chassis number) without letters I, O, Q.
 */
export function validateVin(vin: string): boolean {
  if (typeof vin !== 'string') return false
  const clean = vin.trim().toUpperCase()
  // 17 characters, digits and uppercase letters except I, O, Q
  const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/
  return vinRegex.test(clean)
}

/**
 * Compute days in stock from received date to a reference date.
 */
export function calculateDaysInStock(receivedDateIso: string, referenceDateIso: string): number {
  const d1 = new Date(receivedDateIso)
  const d2 = new Date(referenceDateIso)
  const diffTime = d2.getTime() - d1.getTime()
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)))
}

/**
 * Compute total unit cost including all reconditioning additions.
 */
export function calculateTotalVehicleCost(vehicle: VehicleUnit): number {
  const recondTotal = vehicle.reconditioningCosts.reduce((acc, c) => acc + c.amountMinor, 0)
  return vehicle.basePurchaseCostMinor + recondTotal
}

/**
 * Compute vehicle profit given sale price.
 */
export function calculateVehicleProfit(
  vehicle: VehicleUnit,
  salePriceMinor: number,
): {
  totalCostMinor: number
  salePriceMinor: number
  profitMinor: number
  marginPercent: number
} {
  const totalCostMinor = calculateTotalVehicleCost(vehicle)
  const profitMinor = salePriceMinor - totalCostMinor
  const marginPercent =
    salePriceMinor > 0 ? Math.round((profitMinor / salePriceMinor) * 10000) / 100 : 0
  return {
    totalCostMinor,
    salePriceMinor,
    profitMinor,
    marginPercent,
  }
}
