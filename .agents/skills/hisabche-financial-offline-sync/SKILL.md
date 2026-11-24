---
name: hisabche-financial-offline-sync
description: Use when changing offline financial workflows, local database persistence, outbox, sync mutations, conflict resolution, retry semantics, multi-device convergence, or recovery after connectivity/provider outages.
---

# Hisabche Financial Offline Sync

## Mission

Preserve financial correctness when devices are offline, requests are retried, connections fail mid-commit, multiple devices edit the same workspace, or the server/provider becomes unavailable.

## Required context

- Read `AGENTS.md`.
- Read existing sync, local-engine, database, backend and architecture skills.
- Locate the canonical outbox, mutation envelope, cursor/pull protocol, conflict queue, local schema, server mutation handlers and tests.
- Confirm current mobile runtime constraints from the repo. Do not upgrade Expo/RN or enable New Architecture without explicit approval.
- Do not create a second sync engine or separate financial queue.

## Invariants

- Local DB is authoritative for immediate local UX/drafts; server/Postgres remains canonical shared state after accepted synchronization, consistent with the existing architecture.
- Every mutation has stable identity, idempotency key, workspace identity, actor/device context, schema/version metadata and deterministic payload semantics.
- A retry with the same mutation identity must not duplicate invoices, payments, journal entries, inventory movements or allocations.
- No last-write-wins for financial entities.
- Conflicts are explicit, durable, inspectable and resolved by authorized owner/user action or deterministic domain rule.
- Posted/finalized financial records are immutable except explicitly allowed sync metadata.
- A timeout after commit is an unknown outcome, not proof of failure. Resolve by idempotency key/source identity.
- Do not overwrite newer local data with an older server snapshot. Compare versions/cursors according to the canonical sync contract.
- Never silently delete financial records. Tombstones and deletion policy must preserve audit semantics.
- Pull cursor advances only after all changes in the page are durably applied.
- Outbox item is acknowledged only after server acceptance is durably known.
- Offline permission checks must not grant authority that the server would reject; server revalidates actor, membership and capability at sync time.
- Currency and integer minor-unit semantics must be identical online/offline. AFN remains zero-decimal.

## Mutation lifecycle

Use the actual current state machine, but verify that it covers:

1. Created locally.
2. Persisted locally with stable mutation ID.
3. Pending upload.
4. In flight.
5. Accepted with server version/receipt.
6. Rejected with actionable domain reason.
7. Conflict requiring resolution.
8. Unknown outcome requiring idempotent status reconciliation.
9. Applied to local canonical mirror.
10. Retired/compacted only under safe retention policy.

Do not add these states blindly if the existing protocol uses a different equivalent model.

## Conflict classes

- Same record edited on two devices.
- Payment allocation race.
- Duplicate invoice number or sequence race.
- Stock/cost-layer over-consumption.
- Customer balance/credit limit race.
- Permission revoked while device is offline.
- Workspace membership changed.
- Server committed but response lost.
- Local app crash before outbox acknowledgement.
- Partial pull page application.
- Schema version mismatch.
- Device clock skew.

Financial conflicts must not be resolved by last-write-wins. Preserve both intent and audit evidence; use a domain-specific resolution.

## Required tests

- Offline create → restart app → mutation still pending.
- Reconnect → exactly one server mutation.
- Server commit then lost response → retry yields one financial effect.
- Process crash before and after local acknowledgement.
- Process crash during pull page application.
- Two devices create conflicting financial mutations.
- Two devices consume same stock/cost layer.
- Payment allocation races.
- Old server version cannot overwrite newer local version.
- Cursor does not skip unapplied changes.
- Rejected mutation remains inspectable and can be corrected safely.
- Permission revocation is enforced at server acceptance.
- No financial LWW.
- No duplicate journal, payment, stock movement or invoice number.
- Cross-workspace mutation rejected.
- AFN values round-trip exactly without scaling.
- Large outbox and weak-network retry behavior measured on supported low-memory Android device.

## Performance discipline

Measure before optimizing. Capture:

- local write latency;
- sync batch size and duration;
- retry/backoff count;
- queue age and depth;
- conflict rate;
- payload bytes;
- memory use on supported device;
- server transaction duration;
- replica lag if reads use replicas.

Do not add polling, Redis, a second event bus, or another database merely to improve a benchmark. Preserve current architecture unless evidence demonstrates a bottleneck.

## Output

Provide a mutation state diagram, conflict matrix, evidence for idempotency, crash/restart test results, device constraints, and five-layer outcome proof. Separate local tests, real Postgres tests, device tests and production verification.
