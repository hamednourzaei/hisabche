// ============================================
// backend/src/services/payments/payments.domain.ts
//
// ⚠️ THE RULE MOVED. The implementation is
// `packages/validation/src/schemas/payments.domain.ts` — one rule, two runtimes
// (the server and the offline device). Phase 2 of the offline edition moved it
// and left this file re-exporting every name, so the eleven existing importers
// (`services/payments/index.ts`, `payments.service.ts`, `customer.service.ts`,
// the routes, the tests) are unchanged.
//
// It declares nothing. If you are looking for `settlesInCurrency`,
// `paymentPosting` or `partyBalancesByCurrency`, they are in the shared file.
// ============================================

export {
  ageInvoices,
  autoAllocate,
  cashMovedOf,
  daysBetween,
  emptyAging,
  majorToTillMinor,
  minor,
  moneyAccountRole,
  monthlyActivity,
  openInvoices,
  outstandingOf,
  partyBalance,
  partyBalancesByCurrency,
  paymentPosting,
  rankPartyProducts,
  round2,
  runningLedger,
  settlesInCurrency,
  summarizeParty,
  summarizePartyByCurrency,
  tillAmountMinor,
  tillMinorToMajor,
  unallocatedOf,
  validateAllocations,
} from '@hisabche/validation'

export type {
  AgingBuckets,
  AllocationRequest,
  AllocationRuleCode,
  AutoAllocation,
  CurrencyBalance,
  LedgerMovement,
  MonthlyActivity,
  OpenInvoice,
  PartyProduct,
  PartySummary,
  PartyType,
  PaymentDirection,
  PaymentPosting,
  SummaryInvoice,
  SummaryPayment,
} from '@hisabche/validation'
