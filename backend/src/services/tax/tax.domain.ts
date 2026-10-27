// ============================================
// backend/src/services/tax/tax.domain.ts
//
// ⚠️ THE RULE MOVED. The pure implementation is
// `packages/validation/src/schemas/tax.domain.ts` — one rule, two runtimes
// (the server and the offline local engine).
//
// This file re-exports every name so all existing backend importers are unchanged.
// ============================================

export {
  computeDocument,
  computeLine,
  footingError,
  resolveRule,
  roundHalfAwayFromZero,
  toMajor,
  toMinor,
  validateComponents,
  type ComputedComponent,
  type ComputedDocument,
  type ComputedLine,
  type ResolutionRequest,
  type RoundingPolicy,
  type TaxComponent,
  type TaxComputation,
  type TaxRule,
  type TaxRuleCode,
  type TaxSummaryRow,
  type TaxTreatment,
  type TaxableLine,
} from '@hisabche/validation'
