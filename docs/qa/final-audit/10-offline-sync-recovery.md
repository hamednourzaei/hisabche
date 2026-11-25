# 10 — Offline, Sync & Recovery Audit Evidence

> **Standards:** ISO/IEC 25010:2023 (Reliability), ISO 22301 (Business Continuity)
> **Execution Date:** 2026-11-25

## 1. Verified Offline & Sync Controls

- `backend/src/__tests__/sync-invariants.test.ts` (38 tests `PASS`) & `sync-unsupported-fields.test.ts` (`PASS`): Rejects unknown writable fields with `UNSUPPORTED_FIELD` while preserving `SYNC_ENVELOPE_METADATA_FIELDS`.
- `packages/local-engine/src/__tests__/sync-chaos.test.ts` (6 tests `PASS`), `per-user-local-first-and-failover-replay.test.ts` (11 tests `PASS`), `viewer-cannot-write.test.ts` (22 tests `PASS`): Proves AES-256-GCM sealing, cross-user decryption blocking, SQLCipher PRAGMA checks, and outbox/sync resilience.
- `packages/sync`: `3/3` files, `42/42` tests (`PASS`).
- `scripts/dr-restore-drill.mjs`: Real SQLite restore verification completed in 2ms (`Trial Balance: Total Debit = 170000, Total Credit = 170000`, `0` validation errors).
- `scripts/audit-local-engine.mjs`: `153` local mutating routes, `0` DB writes without outbox queue.

## 2. Offline Endpoint Matrix Completeness

- `QA-002` fixed: Added `POST` & `DELETE /workspaces/:x/brand-assets/:x` to `offline-endpoint-matrix.ts` under `settings.business_profile_edit` (`online_required`), bringing `@hisabche/api` `44/44` (`320/320`) and `@hisabche/validation` `106/106` (`1277/1277`) to 100% pass.
