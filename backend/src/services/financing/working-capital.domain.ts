// ============================================
// backend/src/services/financing/working-capital.domain.ts
//
// THE RULE MOVED. The implementation is
// packages/validation/src/schemas/working-capital.domain.ts - one rule, two runtimes
// (the server and the offline device). This file re-exports every name so its
// importers are unchanged. It declares nothing.
// ============================================

export {
  type WorkingCapitalMinor as Minor,
  type WorkingCapitalInput,
  type WorkingCapitalMetrics,
  workingCapital,
  type FacilityKind,
  type Facility,
  accruedInterest,
  instalment,
  dayCount,
  type Holding,
  type PortfolioSummary,
  summarisePortfolio,
} from '@hisabche/validation'
