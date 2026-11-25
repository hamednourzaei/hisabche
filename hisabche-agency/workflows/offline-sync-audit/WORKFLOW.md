# Workflow 3 — Offline & Sync Audit

**Default Profile:** `CRITICAL`

## Sequence

1. **`Realtime Sync Engineer` (`hisabche-realtime-sync-engineer`)** inspects local SQLite schema (`packages/local-engine`), atomic `claimQueue`, idempotency keys, cursor-based pull, FSM transitions (`SyncStateMachine`), and `next_retry_at` backoff (`SyncBatchExecutor`).
2. **`Security Architect` (`hisabche-security-architect`)** audits `per-user-partition.ts` secret-bound derivation (`deviceMasterSecret` + CSPRNG salt + AES-256-GCM / SQLCipher) and multi-cashier shared terminal isolation.
3. **`Financial Controller` (`hisabche-financial-controller`)** verifies financial immutability (no LWW overwriting money/stock/credit; local payment parity against server `bookPayment`).
4. **`API Tester` (`hisabche-api-tester`)** runs `offline-matrix-consistency.test.ts`, `no-node-builtins-on-device.test.ts`, and `packages/local-engine` + `packages/sync` full suites.
5. **`Evidence Collector` (`hisabche-evidence-collector`)** compiles offline vs server parity evidence.

## Non-Negotiable Rule

Agents must **never** introduce Redis or background polling loops into client sync, and must **never** replace `@hisabche/local-engine` with a parallel engine.
