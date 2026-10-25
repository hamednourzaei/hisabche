// ============================================
// backend/src/services/analytics/cohort.domain.ts
//
// THE RULE MOVED. The implementation is
// packages/validation/src/schemas/cohort.domain.ts - one rule, two runtimes
// (the server and the offline device). This file re-exports every name so its
// importers are unchanged. It declares nothing.
// ============================================

export {
  type CohortRow,
  COHORT_WINDOW_MONTHS,
  buildCohorts,
  type SegmentOperator,
  type SegmentRule,
  type SegmentFacts,
  evaluateSegment,
  type FunnelStep,
  type Funnel,
  buildFunnel,
} from '@hisabche/validation'
