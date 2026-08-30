// ============================================
// backend/src/services/banking/index.ts
//
// Matching is a PROPOSAL. Nothing here reconciles on its own: a confident
// automatic match on the wrong payment moves money between two customers'
// accounts.
// ============================================

export { BankingService } from './banking.service'

export {
  scoreMatch,
  statementLineKey,
  suggestMatches,
  summariseReconciliation,
  validateReconcile,
  type BookEntry,
  type MatchCandidate,
  type MatchReason,
  type MatchSuggestion,
  type ReconciliationSummary,
  type StatementLine,
} from './reconciliation.domain'

import { BankingService } from './banking.service'

export const banking = new BankingService()
