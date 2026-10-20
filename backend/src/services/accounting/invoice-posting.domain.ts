// ============================================
// backend/src/services/accounting/invoice-posting.domain.ts
//
// ⚠️ THE RULE MOVED. The implementation is
// `packages/validation/src/schemas/invoice-posting.domain.ts` — one rule, two
// runtimes (the server and the offline device). Phase 2 of the offline edition
// moved it and left this file re-exporting every name, so its importers
// (`invoice.service.ts` and the AVCO real-Postgres test) are unchanged.
//
// It declares nothing. `inBooksCurrency` and `invoiceLedgerLines` are in the
// shared file.
// ============================================

export { inBooksCurrency, invoiceLedgerLines } from '@hisabche/validation'

export type { InvoicePostingAccounts } from '@hisabche/validation'
