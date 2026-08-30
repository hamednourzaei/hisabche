// ============================================
// backend/src/services/payments/index.ts
//
// The Payments / AR / AP core's public surface.
//
// Other modules ask this core what a party owes and record money through it.
// Nothing else may write `invoices.paid_amount`: that number is a cache kept
// in step with the allocations, and a second writer would make it disagree
// with the only figure that is actually true.
// ============================================

export { PaymentsService } from './payments.service'
export type { RecordPaymentInput } from './payments.service'
export { PaymentsRepository } from './payments.repository'
export type { PaymentRow } from './payments.repository'

export {
  ageInvoices,
  autoAllocate,
  daysBetween,
  emptyAging,
  openInvoices,
  outstandingOf,
  partyBalance,
  round2,
  runningLedger,
  unallocatedOf,
  validateAllocations,
  type AgingBuckets,
  type AllocationRequest,
  type LedgerMovement,
  type OpenInvoice,
  type PartyType,
  type PaymentDirection,
} from './payments.domain'

import { PaymentsService } from './payments.service'

/** The one instance the rest of the backend records money through. */
export const payments = new PaymentsService()
