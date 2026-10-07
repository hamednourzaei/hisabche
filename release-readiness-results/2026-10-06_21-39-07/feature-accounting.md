WHAT IT DOES: Double-entry financial ledger.
WHERE IT EXISTS: `services/accounting/`
WHAT IS VERIFIED: Debit/credit parity, atomicity, idempotency.
WHAT IS NOT VERIFIED: High-concurrency year-end close.

Web: `/accounting`
API: `/api/accounting`
Backend: `journal.service.ts`
DB: `journal_entries`, `journal_lines`
Tests: `journal.pg.test.ts`