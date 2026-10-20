// ============================================
// backend/src/services/accounting/accounting.domain.ts
//
// ⚠️ THE RULE MOVED. The implementation is
// `packages/validation/src/schemas/accounting.domain.ts` — one rule, two
// runtimes (the server and the offline device). Phase 2 of the offline edition
// moved it and left this file re-exporting every name, so its importers
// (`accounting.service.ts`, `accounting.repository.ts`, `accounting.reports.ts`,
// `operational-reports.ts`, `year-end.domain.ts`, `ledger.port.ts`, the
// aggregates and the tests) are unchanged.
//
// It declares nothing. `round2` is re-exported from the shared package's one
// implementation, and `AccountRole` from the accounting schema.
// ============================================

export {
  collapseLines,
  dateOnly,
  dayBefore,
  entryNumberSequence,
  entryNumberYear,
  evaluatePeriodLock,
  isBalanceSheetType,
  isPeriodLocked,
  naturalBalance,
  naturalSide,
  nextEntryNumber,
  normaliseLines,
  reverseLines,
  round2,
  sumMinorUnits,
  toMinorUnits,
  validateAccountPlacement,
  validateEntryLines,
} from '@hisabche/validation'

export type {
  AccountNode,
  AccountRole,
  AccountRootType,
  ChartRuleCode,
  DraftLine,
  LedgerAccountFacts,
  LedgerRuleCode,
  LedgerRuleViolation,
  // ⚠️ `PeriodLock` in this package is the API payload of `periodLockSchema`
  // (no `branchId`). The ledger's rule needs the branch-aware lock, whose
  // permanent name is `LedgerPeriodLock` (owner decision, 19 Oct 2026) — kept
  // as-is here so the ledger call sites read what they mean.
  LedgerPeriodLock,
  PeriodLockDecision,
  PeriodLockScope,
} from '@hisabche/validation'
