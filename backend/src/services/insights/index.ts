// ============================================
// backend/src/services/insights/index.ts
//
// The Insights core's public surface — the figures a copilot may talk about.
//
// A model may PHRASE what this produces. It may never produce it. Every number
// here comes from real rows deterministically and carries the inputs it was
// derived from, so a claim can be checked against the invoice list rather than
// believed.
// ============================================

export { InsightsService } from './insights.service'

export {
  buildExplanation,
  compare,
  detectAnomalies,
  explainChange,
  grossMargin,
  grossProfit,
  round2,
  type Anomaly,
  type AnomalyKind,
  type Change,
  type ChangeDirection,
  type Contributor,
  type Explanation,
  type LineForReview,
  type PeriodTotals,
} from './insights.domain'

import { InsightsService } from './insights.service'

export const insights = new InsightsService()
