# Hisabche V13 — Rollback & Recovery

## 1. Slot Model & Crash-Loop Guard

- Each updatable layer maintains `currentVersion`, `previousVersion`, `lastKnownGoodVersion`, `bootAttempts`, and `badVersions[]` in `SlotLedger`.
- `recordBootAttemptAndGuard` increments `bootAttempts` on unconfirmed boots; if `bootAttempts > maxBootAttempts` (default `3`), it automatically rolls back to `previousVersion`, adds the failing version to `badVersions`, and refuses re-installing that version until a newer SemVer release is published.
- **External vs Local Failure:** `simulateLocalStartupHealth === 'BACKEND_DOWN'` does **not** roll back a healthy local runtime; only local startup/contract failures trigger rollback.

## 2. Schema-Safe Rollback & Safe Mode

- Before switching to `previousVersion` or applying a `SignedHaltDirective`, `UpdateOrchestrator` checks `localSchemaByVersion[target] >= currentLocalSchemaVersion`.
- If the rollback target cannot read the newer local schema, destructive rollback is **refused**, `ledger.safeMode = true` is set (`ROLLBACK_SCHEMA_INCOMPATIBLE_SAFE_MODE`), and local business data/outbox remain byte-identical (`I1–I4`).
- Native layers (Electron shell, Android native binary) are never rolled back by JS; native recovery relies on platform installers/distribution.
