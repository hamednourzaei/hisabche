// ============================================
// packages/validation/src/schemas/universal-core/warranty.domain.ts
//
// G-11: WARRANTY RECORDS & CLAIMS
//
// Computer parts, consumer electronics, home appliances.
// A warranty record is generated upon sale of products carrying warranty_months.
// Claims track resolution without automatic ledger writes.
// ============================================

export type WarrantyClaimStatus = 'pending' | 'approved' | 'rejected' | 'resolved'

export interface WarrantyRecord {
  readonly id: string
  readonly invoiceId: string
  readonly productId: string
  readonly serialNumber?: string | null | undefined
  readonly startDate: string // YYYY-MM-DD
  readonly endDate: string // YYYY-MM-DD
  readonly warrantyMonths: number
  readonly customerId?: string | null | undefined
}

export interface WarrantyClaim {
  readonly id: string
  readonly warrantyId: string
  readonly claimDate: string
  readonly issueDescription: string
  readonly status: WarrantyClaimStatus
  readonly resolutionNotes?: string | null | undefined
}

/**
 * Calculate warranty end date given start date and duration in months.
 */
export function calculateWarrantyEndDate(startDateIso: string, months: number): string {
  const d = new Date(startDateIso)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().split('T')[0]!
}

/**
 * Check if a warranty is currently active on a given date.
 */
export function isWarrantyActive(warranty: WarrantyRecord, checkDateIso: string): boolean {
  return checkDateIso >= warranty.startDate && checkDateIso <= warranty.endDate
}
