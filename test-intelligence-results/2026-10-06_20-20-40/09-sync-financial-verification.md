# Sync & Financial Verification

### Sync Status: PARTIAL
- Offline Create: VERIFIED (Enters queue)
- Stale Conflict Rejection: VERIFIED (Server rejects stale version without data loss)
- Idempotency & Retry: VERIFIED (Duplicate mutations deduplicated)
- Timeout-after-success: VERIFIED
- Offline Delete: UNKNOWN (Not covered in canonical integration test)
- Cross-device E2E: BLOCKED (No mobile test infrastructure running)

### Financial Status: PARTIAL
- Double-entry balance (Debit == Credit): VERIFIED structurally
- Ledger posting atomicity: VERIFIED structurally
- Concurrency single-post: VERIFIED structurally
- Stale post lock: VERIFIED structurally
- Live PostgreSQL Constraints: BLOCKED (Migration 42P01 error prevents full DB test execution)
