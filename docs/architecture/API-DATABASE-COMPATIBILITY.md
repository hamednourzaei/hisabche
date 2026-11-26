# Hisabche V13 — API & Database Compatibility

## 1. Expand-and-Contract Database Policy

- All migrations (`docs/update-control-plane-01-migration.sql` + `docs/VERIFY-update-control-plane-01.sql`) are additive and idempotent (**Expand phase** only).
- **Contract phase** (dropping legacy columns/RPCs) is gated by `OD-05` (`NEEDS_OWNER_DECISION`) until telemetry confirms all active offline/online devices have crossed the compatibility boundary.
- Clients never initiate production DDL; migrations run server-side only.

## 2. Fastify API Compatibility & Negotiation

- `GET /api/updates/v2/check` evaluates `evaluateApiClientCompatibility`:
  - Clients below `CONTROL_PLANE_MIN_SUPPORTED_CLIENT` (`1.0.0`) receive HTTP `426` with `{ code: 'UPGRADE_REQUIRED', offlineSafe: true, minSupportedClientVersion, coreUpdate }`.
  - Compatible clients receive only artifacts whose `platforms`, `channel`, deterministic cohort bucket, and workspace capabilities match server-verified tenancy (`request.tenancy.workspaceId`).

## 3. Local SQLite Schema (`packages/local-engine`)

- Newer runtimes run additive SQLite migrations only after `LocalDataProbe.hasActiveFinancialTransaction()` is `false` (`I11`).
- Older runtimes encountering a newer `localSchemaVersion` return `SAFE_MODE` (`evaluateCoreCompatibility`) instead of destructively opening or downgrading local data.
