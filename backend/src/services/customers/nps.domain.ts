// ============================================
// backend/src/services/customers/nps.domain.ts
//
// THE RULE MOVED. The implementation is
// packages/validation/src/schemas/nps.domain.ts - one rule, two runtimes
// (the server and the offline device). This file re-exports every name so its
// importers are unchanged. It declares nothing.
// ============================================

export {
  type NpsCategory,
  type SurveyResponse,
  type NpsResult,
  categorise,
  netPromoterScore,
  normaliseScore,
  type HealthBand,
  type HealthInput,
  type CustomerHealth,
  MIN_MONTHS_FOR_A_TREND,
  customerHealth,
  type LoyaltyTier,
  type LoyaltyFacts,
  loyaltyTier,
  LOYALTY_TIERS,
} from '@hisabche/validation'
