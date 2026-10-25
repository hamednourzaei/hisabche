// ============================================
// backend/src/services/accounting/evidence.domain.ts
//
// THE RULE MOVED. The implementation is
// packages/validation/src/schemas/evidence.domain.ts - one rule, two runtimes
// (the server and the offline device). This file re-exports every name so its
// importers are unchanged. It declares nothing.
// ============================================

export {
  explainInvoiceProfit,
  productJourney,
  type EvidenceConsumption,
  type EvidenceLayer,
  type InvoiceEvidence,
  type ProductJourney,
} from '@hisabche/validation'
