// ============================================
// backend/src/services/accounting/accounting.reports.ts
//
// THE RULE MOVED. The implementation is
// packages/validation/src/schemas/accounting.reports.ts - one rule, two
// runtimes (the server and the offline device). This file re-exports every
// name so its importers are unchanged. It declares nothing.
// ============================================

export {
  toBalanceSheet,
  toIncomeStatement,
  toTrialBalance,
  trialBalanceTotals,
  type LedgerTotals,
} from '@hisabche/validation'
