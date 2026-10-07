# Financial Ledger Verification Report

## Status: VERIFIED

### Invariants Proven in Postgres Runtime
1. **Double-Entry Balance**:
   - Structural and domain rules enforce Debit == Credit balance.
2. **Finalization Immutability**:
   - Once finalized, document lines cannot be edited (PL/pgSQL error 55000: `INVOICE_FINALIZED`).
3. **Concurrency & Versioning**:
   - Stale document mutations rejected with code 40001 (`INVOICE_VERSION_CONFLICT`).
4. **Atomicity / Rollback**:
   - A malformed item row (e.g. null quantity in purchase order items) causes the entire transaction to abort, leaving no header or partial rows.
5. **Idempotency**:
   - Replaying the same keyed submission results in constraint violation (23505) rather than duplicate financial entries.
