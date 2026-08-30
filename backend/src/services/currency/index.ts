// ============================================
// backend/src/services/currency/index.ts
//
// Realised and unrealised exchange differences are different facts and post
// differently. Netting them produces a figure that is neither.
// ============================================

export { CurrencyService } from './currency.service'

export {
  rateFor,
  realisedDifferenceMinor,
  revalue,
  runRevaluation,
  type ForeignBalance,
  type RateQuote,
  type RateRuleCode,
  type RevaluationLine,
  type RevaluationRun,
  type SettlementInput,
} from './revaluation.domain'

import { CurrencyService } from './currency.service'

export const currency = new CurrencyService()
