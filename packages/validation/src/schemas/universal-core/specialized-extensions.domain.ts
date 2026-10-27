// ============================================
// packages/validation/src/schemas/universal-core/specialized-extensions.domain.ts
//
// SPECIALIZED EXTENSIONS: Freight, Passenger, Courier, Appointments, Agriculture
//
// Reuses standard invoices, payments, fixed assets and payroll.
// NO parallel accounting or inventory engine.
// ============================================

// ─── 1. Freight & Trips ──────────────────────────────────────────────────
export type TripStatus = 'planned' | 'in_transit' | 'completed' | 'cancelled'

export interface TripLoad {
  readonly id: string
  readonly customerId: string
  readonly cargoDescription: string
  readonly weightKg: number
  readonly freightChargeMinor: number
  readonly invoiceId?: string | null | undefined
}

export interface TripExpense {
  readonly id: string
  readonly category: 'fuel' | 'toll' | 'maintenance' | 'driver_per_diem' | 'other'
  readonly amountMinor: number
  readonly description: string
}

export interface FreightTrip {
  readonly id: string
  readonly vehicleAssetId: string
  readonly driverEmployeeId: string
  readonly origin: string
  readonly destination: string
  readonly startDate: string
  readonly endDate?: string | null | undefined
  readonly status: TripStatus
  readonly loads: readonly TripLoad[]
  readonly expenses: readonly TripExpense[]
}

export function calculateTripSummary(trip: FreightTrip): {
  readonly totalRevenueMinor: number
  readonly totalExpensesMinor: number
  readonly netContributionMinor: number
  readonly totalWeightKg: number
} {
  const totalRevenueMinor = trip.loads.reduce((sum, l) => sum + l.freightChargeMinor, 0)
  const totalExpensesMinor = trip.expenses.reduce((sum, e) => sum + e.amountMinor, 0)
  const totalWeightKg = trip.loads.reduce((sum, l) => sum + l.weightKg, 0)
  return {
    totalRevenueMinor,
    totalExpensesMinor,
    netContributionMinor: totalRevenueMinor - totalExpensesMinor,
    totalWeightKg,
  }
}

// ─── 2. Passenger & Ticketing ────────────────────────────────────────────
export type TicketStatus = 'reserved' | 'paid' | 'boarded' | 'cancelled' | 'refunded'

export interface PassengerTicket {
  readonly id: string
  readonly tripId: string
  readonly seatNumber: string
  readonly passengerName: string
  readonly passengerPhone?: string | null | undefined
  readonly fareAmountMinor: number
  readonly status: TicketStatus
  readonly invoiceId?: string | null | undefined
}

// ─── 3. Courier & COD ────────────────────────────────────────────────────
export type DeliveryStatus =
  'unassigned' | 'assigned' | 'picked_up' | 'delivered' | 'failed' | 'returned'
export type CodStage = 'to_collect' | 'with_driver' | 'with_cashier' | 'banked'

export interface CourierDelivery {
  readonly id: string
  readonly trackingNumber: string
  readonly customerName: string
  readonly destinationAddress: string
  readonly driverEmployeeId?: string | null | undefined
  readonly status: DeliveryStatus
  readonly codAmountMinor: number
  readonly codStage: CodStage
  readonly proofOfDeliveryRef?: string | null | undefined
  readonly deliveryTimestamp?: string | null | undefined
}

export function progressCodStage(current: CodStage): CodStage {
  switch (current) {
    case 'to_collect':
      return 'with_driver'
    case 'with_driver':
      return 'with_cashier'
    case 'with_cashier':
      return 'banked'
    case 'banked':
    default:
      return 'banked'
  }
}

// ─── 4. Delivery Notes ───────────────────────────────────────────────────
export interface DeliveryNoteLine {
  readonly invoiceLineId: string
  readonly productId: string
  readonly quantityDelivered: number
}

export interface DeliveryNote {
  readonly id: string
  readonly invoiceId: string
  readonly noteNumber: string
  readonly deliveryDate: string
  readonly lines: readonly DeliveryNoteLine[]
  readonly carrierNotes?: string | null | undefined
}

// ─── 5. Appointments & Service Booking ───────────────────────────────────
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'

export interface Appointment {
  readonly id: string
  readonly customerId: string
  readonly staffEmployeeId: string
  readonly serviceProductId: string
  readonly startTime: string // ISO timestamp
  readonly endTime: string // ISO timestamp
  readonly status: AppointmentStatus
  readonly invoiceId?: string | null | undefined
}

export function hasAppointmentConflict(
  existing: readonly Appointment[],
  candidate: {
    readonly startTime: string
    readonly endTime: string
    readonly staffEmployeeId: string
    readonly ignoreId?: string | undefined
  },
): boolean {
  const candStart = new Date(candidate.startTime).getTime()
  const candEnd = new Date(candidate.endTime).getTime()
  if (isNaN(candStart) || isNaN(candEnd) || candStart >= candEnd) {
    return true
  }
  return existing.some((appt) => {
    if (candidate.ignoreId && appt.id === candidate.ignoreId) return false
    if (appt.staffEmployeeId !== candidate.staffEmployeeId) return false
    if (appt.status === 'cancelled' || appt.status === 'no_show') return false
    const existingStart = new Date(appt.startTime).getTime()
    const existingEnd = new Date(appt.endTime).getTime()
    return Math.max(candStart, existingStart) < Math.min(candEnd, existingEnd)
  })
}

// ─── 6. Agriculture & Livestock ──────────────────────────────────────────
export interface CropCycle {
  readonly id: string
  readonly landUnitId: string
  readonly cropName: string
  readonly plantingDate: string
  readonly expectedHarvestDate?: string | null | undefined
  readonly actualHarvestDate?: string | null | undefined
  readonly harvestedQuantityKg?: number | null | undefined
  readonly harvestedProductId?: string | null | undefined
}

export interface LivestockGroup {
  readonly id: string
  readonly category: string // e.g. "Sheep", "Cattle", "Poultry"
  readonly headCount: number
  readonly birthOrAcquisitionDate: string
  readonly locationWarehouseOrBarnId: string
}

export function calculateCropYieldSummary(cycles: readonly CropCycle[]): {
  readonly totalHarvestedKg: number
  readonly completedCyclesCount: number
} {
  let totalHarvestedKg = 0
  let completedCyclesCount = 0
  for (const c of cycles) {
    if (typeof c.harvestedQuantityKg === 'number' && c.harvestedQuantityKg > 0) {
      totalHarvestedKg += c.harvestedQuantityKg
      completedCyclesCount++
    }
  }
  return { totalHarvestedKg, completedCyclesCount }
}

// ─── 7. Made-To-Order & Order Deposits ───────────────────────────────────
export interface OrderDeposit {
  readonly id: string
  readonly orderId: string
  readonly customerId: string
  readonly amountMinor: number
  readonly paymentMethod: string
  readonly appliedInvoiceId?: string | null | undefined
}

export function calculateOrderDepositBalance(
  orderTotalMinor: number,
  deposits: readonly OrderDeposit[],
): {
  readonly totalDepositedMinor: number
  readonly remainingBalanceMinor: number
} {
  const totalDepositedMinor = deposits.reduce((sum, d) => sum + d.amountMinor, 0)
  const remainingBalanceMinor = Math.max(0, orderTotalMinor - totalDepositedMinor)
  return { totalDepositedMinor, remainingBalanceMinor }
}

// ─── 8. Kits & Product Bundles (Option 14) ─────────────────────────────────
export interface KitComponent {
  readonly productId: string
  readonly quantityPerKit: number
}

export interface ExplodedKitLine {
  readonly productId: string
  readonly quantity: number
}

/**
 * Pure kit explosion: explodes a sold kit into individual component quantities.
 * Vector: kit of 3 components sold as one line; stock moves per component; no work order.
 */
export function explodeKit(
  components: readonly KitComponent[],
  soldQuantity: number,
): readonly ExplodedKitLine[] {
  if (soldQuantity <= 0) return []
  return components.map((comp) => ({
    productId: comp.productId,
    quantity: comp.quantityPerKit * soldQuantity,
  }))
}
