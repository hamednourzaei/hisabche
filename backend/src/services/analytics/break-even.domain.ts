// ============================================
// backend/src/services/analytics/break-even.domain.ts
//
// THE RULE MOVED. The implementation is
// packages/validation/src/schemas/break-even.domain.ts - one rule, two runtimes
// (the server and the offline device). This file re-exports every name so its
// importers are unchanged. It declares nothing.
// ============================================

export {
  type BreakEvenRow,
  type FixedCosts,
  type BreakEvenResult,
  breakEven,
  type ScenarioChange,
  type ScenarioResult,
  runScenario,
} from '@hisabche/validation'
