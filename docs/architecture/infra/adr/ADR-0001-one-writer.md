# ADR-0001: One Writer per Mutating Aggregate in PostgreSQL

- **Status:** Accepted
- **Date:** 2026-11-12

## Context

Hisabche supports Web, Electron Desktop, and Mobile clients with offline sync. Concurrent mutations to stock, invoices, exchange positions, and GL balances can race if handled in application memory or across multiple service engines.

## Decision

All multi-table financial and inventory writes MUST execute through a single authoritative PostgreSQL writer path (Postgres RPC functions with explicit `FOR UPDATE` locking ordered per `LOCK-ORDER.md`), never through application-level compensating deletes or duplicate shadow services.

## Consequences

- **Positive:** ACID guarantees, zero partial writes, deterministic deadlock avoidance.
- **Negative:** Requires SQL migrations + `*.pg.test.ts` verification for every new multi-table mutation.
