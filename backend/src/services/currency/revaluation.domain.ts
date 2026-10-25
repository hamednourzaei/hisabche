// ============================================
// backend/src/services/currency/revaluation.domain.ts
//
// Revaluation and the rate rule. Now in `@hisabche/validation`
// (schemas/revaluation-rules.ts) so the offline engine applies the SAME rule as
// the server. This file keeps the old import path working.
// ============================================

export {
  type ForeignBalance,
  type RevaluationLine,
  revalue,
  type RevaluationRun,
  runRevaluation,
  type SettlementInput,
  realisedDifferenceMinor,
  type RateQuote,
  type RateRuleCode,
  rateFor,
} from '@hisabche/validation'
