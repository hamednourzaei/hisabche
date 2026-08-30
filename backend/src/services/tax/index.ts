// ============================================
// backend/src/services/tax/index.ts
//
// The Tax core's public surface.
//
// Two rules callers must not work around:
//
//   1. Nothing outside this core computes tax. A `total × 0.15` anywhere else
//      is a second answer to what the tax was, and the day it disagrees with
//      this one, the return is wrong while the invoice looks right.
//
//   2. A document stores the SNAPSHOT it was computed with. Re-resolving a
//      rate at read time would change what an already-issued invoice says.
// ============================================

export { TaxService } from './tax.service'
export type { TaxSettings } from './tax.service'

export {
  computeDocument,
  computeLine,
  footingError,
  resolveRule,
  roundHalfAwayFromZero,
  toMajor,
  toMinor,
  validateComponents,
  type ComputedDocument,
  type ComputedLine,
  type ComputedComponent,
  type ResolutionRequest,
  type RoundingPolicy,
  type TaxComponent,
  type TaxComputation,
  type TaxRule,
  type TaxRuleCode,
  type TaxSummaryRow,
  type TaxTreatment,
  type TaxableLine,
} from './tax.domain'

export {
  detectDrift,
  recomputeFromSnapshot,
  verifyAgainstSnapshot,
  type DriftKind,
  type FrozenTax,
  type TaxDrift,
  type TaxSnapshot,
} from './tax.snapshot'

import { TaxService } from './tax.service'

/** The one instance documents are taxed through. */
export const tax = new TaxService()
