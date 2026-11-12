# ADR-0002: SQLite Schema & Sync Contract Stay in Core

- **Status:** Accepted (V62)
- **Date:** 2026-11-12
- **Deciders:** Hisabche Architecture / Engineering

## Context

Users can install feature packs after onboarding or remove unused feature packs from a specific device (`Settings -> Modules on this device`). We considered whether each feature pack should own and run/drop its own local SQLite tables when installed or removed on Desktop/Mobile.

## Decision

1. **The entire local SQLite migration chain stays in `core`** (`packages/app-bridge/src/local-migrations.ts`). Feature packs NEVER register new tables or alter SQLite DDL at pack-install time.
2. **All 27 sync entity definitions stay registered in `core`** (`packages/validation/src/schemas/sync-protocol.schema.ts`), while **network sync is filtered** by `entityTypes` derived from `syncEntitiesForPacks(installedPacks)` via `sync_pull_changes_v2` (`docs/sync-scope-01-migration.sql`).
3. **Removing a pack removes only executable UI/feature code chunks**, never customer rows, invoices, manufacturing orders, HR records, or local SQLite tables.
4. When a user installs an additional pack later on a device that already holds a cursor `C > 0`, the pure backfill planner (`planPackBackfill` in `packages/validation/src/schemas/sync-backfill.ts`) pulls **only that pack's entity types** from cursor `0` up to `C` (or from `/api/sync/snapshot` if behind the commit horizon), then resumes normal incremental sync from `C` across the expanded `entityTypes` set.

## Consequences

- **Positive:** Zero schema migration races when packs are toggled offline or across app upgrades. Zero accidental customer data loss when freeing UI space on a device.
- **Positive:** Re-enabling a previously installed pack does not break foreign keys or corrupt existing local SQLite tables.
- **Negative / Trade-offs:** Empty schema tables for uninstalled packs remain present in SQLite (~negligible fixed DDL overhead compared to multi-megabyte JS chunks and unneeded sync traffic).
