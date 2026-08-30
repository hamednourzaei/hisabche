// ============================================
// backend/src/services/accounting/index.ts
//
// The accounting core's public surface. Nothing outside this folder imports
// from a file inside it — a module that reaches past this line is coupled to
// how the ledger is stored, and the next change to storage breaks it.
//
// What other modules are meant to use:
//   LedgerPort / ledger     — book and reverse entries for a document
//   AccountingService       — the routes' entry point
//
// What they are NOT meant to use: the repository, or the account codes.
// ============================================

export { AccountingService } from './accounting.service'
export { AccountingRepository } from './accounting.repository'
export type { AccountRow, JournalEntryRow, JournalLineRow } from './accounting.repository'

export type {
  LedgerPort,
  LedgerPostingOutcome,
  LedgerPostingRequest,
  LedgerSourceType,
} from './ledger.port'

export {
  collapseLines,
  dateOnly,
  isPeriodLocked,
  naturalBalance,
  naturalSide,
  nextEntryNumber,
  normaliseLines,
  reverseLines,
  round2,
  validateAccountPlacement,
  validateEntryLines,
  type AccountNode,
  type AccountRootType,
  type DraftLine,
  type LedgerAccountFacts,
} from './accounting.domain'

export {
  toBalanceSheet,
  toIncomeStatement,
  toTrialBalance,
  trialBalanceTotals,
  type LedgerTotals,
} from './accounting.reports'

import { AccountingService } from './accounting.service'

/**
 * The one instance other modules book through, so the ledger has a single
 * cache and a single place to look when a posting does not appear.
 */
export const ledger = new AccountingService()
