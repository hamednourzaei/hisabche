// ============================================
// packages/validation/src/schemas/universal-core/auto-parts.domain.ts
//
// G-15: AUTO PARTS — OEM, FITMENT & CORE CHARGE
//
// Auto parts, industrial machinery spares, electronics replacement modules.
// Alternate part numbers (OEM, aftermarket, supersedes), vehicle fitment search,
// and refundable core deposit charges.
// ============================================

export type AlternateNumberKind = 'oem' | 'aftermarket' | 'supersedes'

export interface AlternatePartNumber {
  readonly productId: string
  readonly number: string
  readonly kind: AlternateNumberKind
  readonly brand?: string | null | undefined
}

export interface VehicleFitment {
  readonly productId: string
  readonly make: string // e.g. "Toyota"
  readonly model: string // e.g. "Corolla"
  readonly yearStart: number // e.g. 2010
  readonly yearEnd: number // e.g. 2015
  readonly notes?: string | null | undefined
}

export interface CoreChargeItem {
  readonly productId: string
  readonly hasCoreCharge: boolean
  readonly coreDepositMinor: number
}

/**
 * Check if a part fits a specific vehicle specification.
 */
export function matchesFitment(
  fitments: readonly VehicleFitment[],
  make: string,
  model: string,
  year: number,
): boolean {
  const normMake = make.trim().toLowerCase()
  const normModel = model.trim().toLowerCase()

  return fitments.some(
    (f) =>
      f.make.toLowerCase() === normMake &&
      f.model.toLowerCase() === normModel &&
      year >= f.yearStart &&
      year <= f.yearEnd,
  )
}

/**
 * Generate separate core deposit invoice line for core-tracked parts.
 * Posts to liability role 'core_deposit'.
 */
export function buildCoreDepositLine(
  productId: string,
  productName: string,
  quantity: number,
  depositPerUnitMinor: number,
): {
  productId: string
  description: string
  quantity: number
  unitPriceMinor: number
  totalMinor: number
  accountRole: 'core_deposit'
} {
  return {
    productId,
    description: `Core Deposit: ${productName}`,
    quantity,
    unitPriceMinor: depositPerUnitMinor,
    totalMinor: Math.round(quantity * depositPerUnitMinor),
    accountRole: 'core_deposit',
  }
}

/**
 * WP-16 — the promise to refund a core when the old part comes back.
 * The deposit LINE is a liability (`core_deposit`), not revenue; returning the
 * core clears that liability. This rule only decides the refund amount — it
 * never posts money. An unknown/zero deposit stays unknown, never invented.
 */
export function planCoreRefund(input: {
  readonly depositPerUnitMinor: number
  readonly returnedQuantity: number
  readonly alreadyRefundedQuantity: number
}): { refundMinor: number | null; doubleRefundBlocked: boolean } {
  const { depositPerUnitMinor, returnedQuantity, alreadyRefundedQuantity } = input
  if (
    !Number.isSafeInteger(depositPerUnitMinor) ||
    depositPerUnitMinor < 0 ||
    !Number.isSafeInteger(returnedQuantity) ||
    returnedQuantity < 0 ||
    !Number.isSafeInteger(alreadyRefundedQuantity) ||
    alreadyRefundedQuantity < 0
  ) {
    return { refundMinor: null, doubleRefundBlocked: false }
  }
  // Refunding the same core twice is refused by returning zero, never a
  // negative (which would silently write a payment the shop cannot explain).
  if (alreadyRefundedQuantity >= returnedQuantity) {
    return { refundMinor: 0, doubleRefundBlocked: true }
  }
  return {
    refundMinor: Math.round((returnedQuantity - alreadyRefundedQuantity) * depositPerUnitMinor),
    doubleRefundBlocked: false,
  }
}
