// ============================================
// backend/src/services/accounting.service.ts
//
// The accounting core moved into ./accounting/ — it is now several files with
// the rules, the statements and the storage kept apart, because a ledger with
// its arithmetic tangled into its queries cannot be tested without a database.
//
// This file stays only so existing imports keep resolving. New code should
// import from './accounting' directly.
// ============================================

export { AccountingService, AccountingRepository, ledger } from './accounting'
export type { AccountRow, JournalEntryRow, LedgerPort, LedgerPostingRequest } from './accounting'
