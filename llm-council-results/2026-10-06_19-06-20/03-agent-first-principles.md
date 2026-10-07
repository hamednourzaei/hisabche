# Agent Report

## Role
first-principles

## Executive Verdict
Hisabche is marketed as a multi-client offline-first business management platform with a workspace-based tenancy. From first principles, such a system requires a strict tenant boundary (`workspace_id`), an immutable event ledger for financial/stock movements, and a conflict-free or command-based replication protocol for offline-first clients.

The project is currently implementing a hybrid architecture. Tenancy is split: while core domains (invoices) use `workspace_id`, 29 operational tables still rely on `user_id`, violating the shared-book business model. The sync engine is a bespoke HTTP pull/push system using optimistic concurrency and server-side field dropping, rather than CRDTs or true event-sourcing. 

Excellent decisions include decoupling the wakeup stream from the data transport (WebSockets only push "cursor moved"), which gracefully degrades to polling, and using Postgres triggers to guarantee the changelog is atomic with the mutation. Furthermore, enforcing that sync clients cannot write financial totals (only descriptive fields) prevents offline clients from maliciously or accidentally corrupting the ledger.

However, using optimistic concurrency (rejecting stale writes) for an offline-first POS will become extremely expensive. When a client goes offline for days, its state-based writes will be rejected upon reconnection, leading to data loss or complex merge UIs. Additionally, maintaining separate Drizzle and WatermelonDB schemas will cause friction over time.

The missing abstraction is a Command-based sync for financial operations, rather than state-based entity syncing. The smallest architectural correction with the highest leverage is completing the migration to `workspace_id` for the remaining 29 tables, establishing a single, uncompromised source of truth for tenancy.

## Strongest Findings
1. Tenancy is fractured: 29 tables use `user_id` instead of `workspace_id`, breaking the shared workspace model.
2. The sync engine drops financial field updates from clients to protect the ledger, meaning invoices/transactions cannot be fully authored offline through the standard sync path.
3. Sync uses optimistic concurrency (rejecting stale writes) instead of CRDTs or event merging, which undermines offline-first usability.
4. The WebSocket stream carries no data, only a cursor update, which is a brilliant decoupling that prevents data loss on dropped sockets.
5. The changelog is driven by database triggers, guaranteeing atomicity but increasing schema maintenance overhead.

## Repository Evidence
For every important finding:
- file/path: `PROJECT_STATE.md`
- symbol/feature/test/migration if applicable: Remaining-table tenancy
- exact evidence: `Remaining-table tenancy (29 tables) — DESIGNING. projects, employees, warehouses ... still use user_id`
- why it matters: It breaks the fundamental shared-book product requirement.

- file/path: `backend/src/services/sync.service.ts`
- symbol/feature/test/migration if applicable: `WRITABLE` array
- exact evidence: `invoice: ['id', 'notes', 'reference', 'due_date']` ... `NOTHING FINANCIAL. This road writes the row as given — no stock moves, no ledger entry is booked...`
- why it matters: It reveals clients cannot author full financial transactions via the state-based sync push mechanism.

- file/path: `backend/src/services/sync.service.ts`
- symbol/feature/test/migration if applicable: sync architecture comments
- exact evidence: `Optimistic concurrency: the client sends the version it believes, the server rejects a stale write instead of applying it.`
- why it matters: Offline clients will face rejected writes upon reconnecting if another user updated the entity.

- file/path: `packages/sync/src/stream-client.ts`
- symbol/feature/test/migration if applicable: `STREAM_PROTOCOL`
- exact evidence: `It carries no data and owns no correctness. The engine pulls by cursor over HTTP`
- why it matters: It ensures network flakiness only slows down sync without corrupting data.

- file/path: `backend/src/services/sync.service.ts`
- symbol/feature/test/migration if applicable: architecture comments
- exact evidence: `The change log itself is written by a database trigger, in the same transaction as the row it describes`
- why it matters: It avoids dual-write problems but relies on manual trigger maintenance.

## Risk Assessment
- Critical: Fractured tenancy (`user_id` vs `workspace_id`) leaking or hiding data from workspace owners.
- High: Optimistic concurrency rejecting stale writes from offline clients, leading to silent data loss or terrible UX.
- Medium: Dual schema maintenance (Drizzle + WatermelonDB).
- Low: WebSocket stream failures (system degrades gracefully).

## Verified
- 29 tables lack `workspace_id` tenancy (PROJECT_STATE.md).
- Sync push drops financial fields (sync.service.ts).
- Sync push uses optimistic concurrency (sync.service.ts).
- WebSocket stream is data-less (stream-client.ts).

## Partially Verified
- Mobile adapter integration is not started (PROJECT_STATE.md).

## Assumed
- Offline clients will experience high conflict rates and rejected writes due to optimistic concurrency.

## Unknown
- How clients create invoices offline if sync push drops financial fields (perhaps a separate command API exists?).

## Contradictions
- Project claims to be offline-first, yet the sync protocol's reliance on optimistic concurrency and dropping financial fields severely restricts offline authoring capabilities.

## Recommendation
1. Immediately complete the `workspace_id` migration for the remaining 29 tables to establish a uniform tenancy boundary.
2. Introduce a Command-based sync model (e.g., `AddInvoiceLineItem`) rather than state-based entity sync, allowing offline clients to append financial events that the server can deterministically apply.

## Do Not Build / Do Not Change
- Do not change the WebSocket "cursor-only" wakeup architecture. It is an excellent, robust design.
- Do not allow clients to write financial totals directly in the state-based sync push.

## Confidence
95%

## What Would Change My Mind
- Evidence of a separate offline command queue for financial operations that bypasses the restrictive state-based `sync.service.ts` push endpoint.
