# HISABCHE PLATFORM ARCHITECTURE & EXECUTION BLUEPRINT 2027

## From a Strong Business Application → a True Enterprise Platform

_Author: 3-agent engineering team — Platform Architect · Database & Data Platform Architect · Offline & Distributed Systems Architect._
_Every recommendation is grounded in the real codebase and classified: **EXISTS NOW · PARTIALLY EXISTS · NEEDS TO BE BUILT**._
_Strategy pre-supplied (see `و/و`). This document turns the vision into a realistic engineering execution blueprint._

---

# SECTION 1 — CURRENT ARCHITECTURE REALITY

All three agents merged. **The single most important finding: there are TWO diverging schemas** (`packages/db-schema` has no tenant column; `backend/src/drizzle-schema.ts` does), and the server sync route filters on a column combination that neither schema cleanly supports. Everything above the schema (event bus, offline engines) is real and good but is _intra-app_, not yet a platform.

| Area              | Current State                                                                                                                                                                                                                                                                                                                                                                                                        | Score /10                  | Problem                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Backend**       | Fastify monolith, ~27 route modules (invoice, product, customer, transaction, warehouse, purchasing, manufacturing, hr, project, workflow, crm, accounting, analytics, ai, audit, billing, sync…). Zod-validated everywhere (`zodToJsonSchema` → Fastify JSON-Schema serialization). Global rate-limit 100/min. Redis cache, job scheduler, PDF queue, websocket activity feed, 1 worker.                            | **7/10**                   | Broad, competent **business** monolith — not a platform. Cross-module effects (stock update, accounting entries, notifications, workflows) are inline procedural chains inside `invoice.service.ts` (~9 hand-wired side-effects per invoice), not event-driven. `eventService.emit` is wired to **zero registered domain handlers** (only hit via `event.routes.ts`). Facts recomputed in JS (N+1 loops) instead of by an engine.         |
| **Database**      | Postgres 17.6 via Supabase, ~54 public tables. **Backend schema** (`backend/src/drizzle-schema.ts`) HAS `workspace_id NOT NULL`, `user_id`, composite FKs on core tables. **Shared schema** (`packages/db-schema/src/drizzle.schema.ts`, used by mobile/web/Dexie) has only 8 tables and **no `workspace_id`/`user_id`** on core tables. RLS present (~69 policies) but undocumented and bypassed by `service_role`. | 4/10                       | **Three sources of truth drift** (packages schema / backend schema / live DB). `user_id` bolted onto `workspace_id` tables creates dual-ownership confusion. RLS unverifiable. `invoice.service.ts` resolves tenant ad hoc via `.limit(1)` membership lookup.                                                                                                                                                                             |
| **Multi-tenancy** | Workspaces/members/roles/invites (owner>admin>member>viewer), billing, entitlements/feature-flags/limits scaffold is **strong and real** (`workspace.service.ts`). Backend schema is tenant-aware.                                                                                                                                                                                                                   | 6/10                       | Shared schema is tenant-blind → a mobile/Dexie build would create tenant-less tables. `sync.routes.ts` filters `.eq('user_id', …)` against tables that, in the shared schema, have no `user_id`. Entitlement counts keyed to user-scoped semantics.                                                                                                                                                                                       |
| **Offline**       | Mobile: durable AsyncStorage outbox (`apps/mobile/.../outbox.store.ts`: ordered, `clientId` idempotency, crash-safe `partialize`), replayed by `sync-runner.ts` (max 5 attempts, permanent-error detect, NetInfo-gated). Desktop: real SQLite `sync_queue` + cursor (`apps/desktop/.../db/database.ts`), `sync-engine.ts`. **Shared `packages/offline` = stubs** (`performSync()` TODO, in-memory queue).            | 3.5/10                     | **Three engines, one shared idea.** Shared package that should be the moat is empty. **No local DB encryption anywhere.** Duplicated `isPermanent()`/`MAX_ATTEMPTS` logic across mobile & desktop (will silently drift).                                                                                                                                                                                                                  |
| **Sync**          | Desktop: incremental pull by `updated_at` cursor, paged 200, **server-wins**, `Idempotency-Key` push, permanent-error detect. Mobile: push-only. Common queue shape (clientId/entity/operation/payload/attempts/status) deliberately mirrors.                                                                                                                                                                        | 2.5/10                     | **The sync server contract is broken**: `sync.routes.ts` filters `.eq('user_id', userId)` but core tables have no `user_id`/`workspace_id` in the shared schema. Pull cursor uses `lt('created_at', cursor)` → **edited rows since cursor are missed**. No tombstones (deletes resurrect on next pull). Desktop pulls via REST routes, not `/api/sync/pull` — an orphaned server endpoint. No conflict resolution beyond last-write-wins. |
| **Events**        | Real durable in-process pub/sub: `event.service.ts` — `handlers: Map`, idempotent `emit`, `Promise.allSettled` fan-out, exponential backoff `2^n`, dead-letter to `error_message`, `processPending()` batch drain + mutex. Backed by Supabase `event_log`/`event_types` (created **out-of-band**, absent from drizzle migrations). Scheduler recovers pending.                                                       | 6/10 (bus) / 2/10 (outbox) | **Not an outbox.** `event_log` written in a _separate_ insert AFTER the business write — a crash between them loses the event. No `workspace_id` on `event_log`. Two rival "event" paths (`event.service.ts` bus vs `logBusinessEvent` activity/notification writer) never reconcile. No outbound webhooks. `cleanupProcessed()` hard-deletes processed events (kills the audit trail).                                                   |
| **API**           | Real REST surface, per-route Zod schemas, genuine `Idempotency-Key` header convention (used by mobile/desktop), JWT via `supabase.auth.getUser`, global rate limit, Swagger UI exposed. `@hisabche/api` is a hand-built Axios client + React Query hooks — genuinely SDK-shaped.                                                                                                                                     | 4/10                       | **Not public and not versioned**: bare `/api/*` (no `/v1`), **no API keys / OAuth / per-key quotas**, no machine-readable OpenAPI export, `@hisabche/api` uses the app token path (not SDK-ready), no independent API auth.                                                                                                                                                                                                               |
| **Integrations**  | `webhook.service.ts` is **inbound, Stripe-billing only** (switch on `checkout.session.completed`/`invoice.paid`/`customer.subscription.*`, idempotency cache + dedupe).                                                                                                                                                                                                                                              | 2/10                       | **No outbound webhook delivery, no outbox→3rd-party fan-out, no connector/provider adapter layer, no OAuth/refresh.** "Connector engine" is aspirational.                                                                                                                                                                                                                                                                                 |

**Root cause shared by all three agents:** the tenant-scoping defect (`workspace_id` missing from the shared schema) + the absence of a transactional event outbox. Fix those two and the whole platform story becomes buildable.

---

# SECTION 2 — TARGET ARCHITECTURE

```
┌────────────────────────────────────────────────────────────────┐
│ Developer Marketplace / Extension Layer    (partner SDKs)     │
├────────────────────────────────────────────────────────────────┤
│ Integration Platform Layer   (outbound webhooks, connectors,  │
│   provider adapters, OAuth, dev portal, sandbox, signatures)  │
├────────────────────────────────────────────────────────────────┤
│ Business Core Engine  (modules + command/rules + domain events)│
│  Accounting · Inventory · CRM/Collections · Sourcing · POS    │
│  Workflow/Approval · Payments · Analytics · AI                │
├────────────────────────────────────────────────────────────────┤
│ Event & Data Infrastructure (outbox, event_log bus, dead-     │
│   letter, warehouse/read-replica, audit)                      │
├────────────────────────────────────────────────────────────────┤
│ Offline Sync Engine  (idempotent outbox, cursor pull,         │
│   conflict resolution, schema-synced stores)                 │
├────────────────────────────────────────────────────────────────┤
│ Local Databases   (SQLite Electron · Dexie Web · Watermelon RN)│
└────────────────────────────────────────────────────────────────┘
```

### Layer-by-layer reality

- **Local Databases** — PARTIALLY EXISTS: real SQLite (Electron) + real AsyncStorage outbox (mobile), but shared `packages/offline` is stub. NEEDS unify under one shared-schema mapping.
- **Offline Sync Engine** — PARTIALLY EXISTS: mobile push + desktop pull both work but are duplicated; NEEDS one shared runner + conflict policy + tenant-correct `sync.routes.ts`.
- **Event & Data Infrastructure** — PARTIALLY EXISTS: real event bus, backoff, retry, DLQ-to-field; **the transactional outbox (the crown jewel) is MISSING**; analytics warehouse NEEDS BUILD.
- **Business Core Engine** — PARTIALLY EXISTS: broad, real Zod-validated services, but **no domain-rule/command engine**; all cross-module effects are inline procedural chains. NEEDS BUILD (Section 3).
- **Integration Platform Layer** — GHOST (2/10). Build from ground up. NEEDS BUILD.
- **Developer Marketplace** — 1/10. Defer until Core Engine + Public API are real.

**How layers talk:** UI → one `@hisabche/api` client → versioned/keyed Fastify routes → **`Cmd` (Command) object** → domain service → returns facts → emits `domainEvent` through the **transactional outbox** → local handlers (audit, analytics, AI, workflow) via `.on(...)` + `EventDispatcher` for outbound webhooks.

---

# SECTION 3 — CORE ENGINE DESIGN

The heart of Hisabche = a **Command/Query + Domain Event** engine. Business logic lives **inside bounded domain modules that own their tables**, communicating by **events** — not direct service-to-service calls.

## 3.1 Module map

| Bounded module                   | Owns (existing tables)                                           | Emits (domain events)                                       | Subscribes to                                                       |
| -------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| **Accounting / Ledger**          | `accounts`, `journal_entries`, `journal_lines`, `exchange_rates` | `journal.entry.created`, `invoice.paid`, `invoice.reversed` | `invoice.created`, `payment.received`                               |
| **Invoicing**                    | `invoices`, `invoice_items` (sale/purchase)                      | `invoice.created`, `invoice.paid`, `invoice.cancelled`      | `payment.received`, `workflow.approved`                             |
| **Inventory**                    | `products`, `stock_movements`, `warehouses`                      | `stock.movement.created`, `stock.low`                       | `invoice.created` (sale decrement), `purchase.received` (increment) |
| **Customer / Receivables (CRM)** | `customers` + derived `receivables`                              | `customer.balance.changed`, `invoice.past_due`              | `invoice.created`, `payment.received`                               |
| **Sourcing / Procurement**       | `suppliers`, `purchase_orders`                                   | `supplier.invoice.created`, `low.stock.reorder`             | `stock.low`, `product.updated`                                      |
| **POS**                          | reuses Invoices/Inventory                                        | (thin write API forward)                                    | —                                                                   |
| **Workflow / Approval**          | `workflows`, `workflow_steps`, `workflow_instances`, `actions`   | `approval.state.changed`                                    | `invoice.created` when over threshold                               |
| **Payments** (NEW)               | `payments`, `reconciliations` _(BUILD)_                          | `payment.received`, `reconciliation.completed`              | `invoice.created` (payment link), `webhook:checkout`                |
| **Analytics**                    | snapshot tables _(BUILD)_                                        | `analytics.updated`                                         | all row-change events                                               |
| **AI** (advisory)                | `ai_query_insights`                                              | `ai.recommendation` (rare)                                  | `invoice.changed`, `stock.low`, aggregates                          |

## 3.2 The flagship cascade: `InvoiceCreated`

**Today (verified):** `invoice.service.create()` manually does ~9 things inline — insert invoice + line items; if sale → `batchUpdateStock` (+ write `stock_movements`); create activity (AND the route creates it AGAIN → **duplicate**); create notifications (workspace + customer); `createAccountingEntries` (debit receivables 1200 / credit revenue 4000, COGS 5000 / inventory 1000); `tryStartWorkflow`; **never calls `eventService.emit()` once**.

**Target:**

```
Command:  CreateInvoiceCommand (Zod-validated, tenant-scoped)
  ↓ InvoicingModule handler (writes invoice + items in a txn)
  ↓  …and in the SAME txn:  transactional outbox row (invoice.created)
EventBus.post(invoice.created { invoice, items, tenantId, by })

Consumers, non-blocking, each idempotent & own retry:
  InventoryModule.on(invoice.created) → if sale: check & apply stock, write stock_movement
          → qty <= min_stock  ⇒  emit stock.low
  CustomerModule.on(invoice.created) → customer.balance += total − paid → customer.balance.changed
  ReceivablesModule.on(balance.changed) → recompute aging; past due → invoice.past_due
  AnalyticsModule.on(invoice.created) → daily sales/revenue dimension → analytics.updated (async)
  NotificationModule.on(invoice.created) → notify actor + customer
  WorkflowModule.on(invoice.created) → if total >= threshold, open approval instance
  AIService.on(invoice.created) → enrich merchant insight cache (offline-friendly)
  ConnectorService.on(invoice.created) → outbound webhook fan-out (Section 7)
```

**What exists exactly:** `event_log` store with idempotency + backoff (EXISTS); the `event_types` seed list (EXISTS, partial); `stock.adjusted`, accounting, workflow rules (EXISTS but inlined in `invoice.service.ts`).

**NEEDS TO BE BUILT:** command objects (`CreateInvoice`, `RegisterPayment`, `ReceiveStock`) + a `CommandHandlerRegistry` → `{result, events}` (today = `createInvoice()` functions that mutate directly); the **transactional outbox** (union of business INSERT + event write); **cross-module event contracts in a shared package** (e.g. shared `InvoiceCreatedEvent ↔ StockAdjust ↔ CustomerBalanceDelta` shapes — currently each domain has its own Zod); and `tenant_id` on every event + every handler (derive from the Command, not re-querying membership per event).

## 3.3 Module-boundary guardrails

1. **CRM = a read-view over accounting events**, never a second contact DB.
2. **AI/Analytics are event-consumer-only** — they write only their own projections, never core tables.
3. **Workflows/Approval are a cross-cutting gate** that _subscribe_ to status changes; no command duplication.

This is what finally makes the "plugin/extension" and "schema-driven" claims true: plugins plug into the **event bus**, not into the business logic.

---

# SECTION 4 — DATABASE EVOLUTION (User-based → Tenant-based)

## 4.1 The honest current state (verified)

There is **no single truth — three schema sources disagree**:

1. `packages/db-schema/src/drizzle.schema.ts` (exported to web/mobile): core tables have **no `workspace_id`/`user_id`**.
2. `backend/src/drizzle-schema.ts` + migrations `0000`/`0001`: same tables carry `workspace_id` (NOT NULL, indexed) _and_ a nullable `user_id`.
3. The live Supabase DB has both columns.

Meanwhile every server query filters on `user_id` (`sync.routes.ts`, `invoice.service.ts`, `accounting.service.ts`, `analytics.service.ts`), and `invoice.service.ts` resolves the tenant ad hoc via `resolveWorkspaceId(userId)` — a `.limit(1)` membership lookup that silently falls back to `?? userId`. **Rows are written with `user_id` and the owner's `workspace_id` is never populated on insert.**

## 4.2 Target state — the tenant-based core

- **Single authority: `packages/db-schema` becomes the one source of truth.** Server and clients import the same tables (import the backend's `workspace_id`/indexes/FKs into it; delete/alias the duplicate).
- Every core table gets `workspace_id uuid NOT NULL REFERENCES workspaces(id)`: `invoices`, `products`, `customers`, `transactions` (already in migration 0000 — make authoritative), plus `invoice_items` (inherit), `accounts`, `journal_entries`, `journal_lines`, `stock_movements`, `suppliers`, `purchase_orders`, `warehouses`, `event_log` (missing today).
- `workspace_id` NOT NULL everywhere; `user_id` demotes to an **audit/actor column**, never a scoping column.
- Composite indexes `(workspace_id, created_at)` and `(workspace_id, updated_at)` on every tenant table — the RLS key, sync-cursor key, and partition key.
- `workspace_members` is the **only membership authority**; a user sees a workspace's data iff a `(workspace_id, user_id, role)` row exists.

## 4.3 RLS: `user_id` → `tenant_id`

```sql
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_invoices_select ON public.invoices
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workspace_members m
            WHERE m.workspace_id = invoices.workspace_id
              AND m.user_id = auth.uid())
  );
-- mirror INSERT (WITH CHECK), UPDATE, DELETE
```

- Backend keeps `service_role` for internal services, but every route asserts on `workspace_id` (from `authenticate` middleware, which already resolves `request.workspaceId`).
- **Viewer role must be enforced server-side via RLS** (read-only) — currently not enforced anywhere.
- **Rewrite `ledger_entries_view` to expose + filter on `workspace_id`** or it leaks cross-tenant financials through `getFinancialSummary`.

## 4.4 Soft delete, audit, retention

- **Soft delete:** `deleted_at timestamptz` on all tenant tables (exists on `workflows` today). Delete = `deleted_at = now()`; sync emits a tombstone so clients purge locally; hard-delete only via admin after retention. **Sync compatibility:** cursor extends to `deleted_at`.
- **Audit system (app to-end, append-only, tamper-evident):**
  ```sql
  audit_log (
    id uuid PK, workspace_id uuid NOT NULL, actor_user_id uuid,
    entity_type text, entity_id uuid, action text, changed_fields jsonb,
    before jsonb, after jsonb, client_id text, ip inet, created_at timestamptz
  )
  ```
  Written **in the same transaction** as the business row (see outbox), never deleted, partitioned by month, **rolling hash chain** (each row hashes the previous) so an auditor can prove integrity — the artifact behind "Hisabche-verified cash flow."
- **Retention:** `event_log`/`notifications` partition by `created_at`; retention = **partition drop**, never `DELETE FROM` (current `cleanupProcessed()` is destructive to the audit story). Financial records: permanent (regulatory). PII: right-to-erasure = anonymize columns, keep aggregates.

## 4.5 Migration phases

- **Phase 0 — Freeze one schema truth (1 wk, 0 data change):** collapse `backend/src/drizzle-schema.ts` into `packages/db-schema`; one authoritative source.
- **Phase 1 — Backfill the tenant column (wk 2-3):** derive `workspace_id` for any NULL row from `workspace_members` via `user_id` (earliest membership, deterministic); add `CHECK (workspace_id IS NOT NULL)`; set `workspace_id` on **every write path** (`invoice.service.ts` create + items inherit); reconcile `workspaces` columns (`owner_id`/`logo_url`) against the service.
- **Phase 2 — Move reads to `workspace_id` (wk 3-4):** replace `.eq('user_id', …)` with `.eq('workspace_id', request.workspaceId)` in sync/invoice/accounting/analytics/activity/notification; `user_id` stays = audit on writes. Drop `user_id`-only indexes after composite covers them.
- **Phase 3 — Fix sync route (wk 4):** the named gap. Pull on `.eq('workspace_id', wsId).gt('updated_at', cursor)` (fix the broken `lt('created_at')`); return created/updated/**deleted_at**; keyset pagination. Push: stamp `workspace_id` server-side from authenticated tenant (never trust payload), dedupe on `client_id`/`Idempotency-Key`.
- **Phase 4 — RLS rollout (wk 5-6):** enable tenant policies per table, audit the 69 legacy policies, keep `service_role` but require `workspace_id` scoping there too.
- **Phase 5 — Audit + retention + partitions (wk 4):** land `audit_log`, transactional outbox, `event_log` partitioning, soft-delete tombstones, retention jobs.

## 4.6 Event sourcing — recommerded decision: **hybrid, ledger-core only**

- **Full event sourcing = NOT worth it.** 54 tables of mutable current-state ERP (inventory counts, settings). Replaying a shopkeeper's offline outbox to reconstruct `products.quantity` is absurd and breaks the server-wins sync model.
- **Hybrid (recommended): current-state tables = source of truth + transactional outbox + immutable ledger-event log.**
  - **Outbox:** write the event row **in the same DB transaction** as the business row → crash-safe. Workers relay outbox → `event_log` → handlers/webhooks/analytics.
  - **Event log as audit for the money tables only:** `invoices`, `transactions`, `journal_entries`, `ledger_entries` get an append-only log of each mutation (before/after, actor, clientId, workspaceId) — gives the "highest-fidelity ledger" its teeth.
  - **Why hybrid:** fast/simple offline sync (what the real code already does well) + atomicity + audit/credit-bureau artifact. The log is a _projection source_, never the write source.

---

# SECTION 5 — OFFLINE PLATFORM ARCHITECTURE (`packages/offline-engine`)

## 5.1 Package layout

```
packages/offline-engine/src/
  core/
    sync-engine.ts        // unified pull+push loop (replaces the two in-app engines)
    outbox.ts             // generic durable queue (replaces mobile outbox + desktop sync_queue)
    conflict-resolver.ts  // §5.3 policy matrix
    retry-policy.ts       // exponential backoff, shared (replaces duplicated isPermanent/MaxAttempts)
    network-detector.ts   // platform-agnostic subscription interface
    background-sync.ts    // lifecycle orchestration (start/stop/wake/interval)
    encryption.ts         // at-rest keys + row cipher (§5.5)
  storage/
    storage-adapter.ts    // THE interface
    sqlite.adapter.ts     // Desktop (better-sqlite3 — existing database.ts)
    watermelon.adapter.ts // Mobile (existing database.native.ts)
    dexie.adapter.ts      // Web (existing database.web.ts)
  event/
    localOutbox.ts        // mirrors the server transactional outbox
```

**Principle:** one engine, three adapters. The two existing engines (`sync-runner.ts`, `sync-engine.ts`) become _instances_ of this engine, not separate code. The mobile outbox/store maps to `core/outbox` + `watermelon.adapter` (using the real `invoices/products/customers` Watermelon tables for reads); desktop `database.ts` implements `sqlite.adapter` directly; web `database.web.ts` becomes `dexie.adapter` with full tables (today it has only `activities`).

## 5.2 How Mobile / Desktop / Web share the same engine

Each app boots `createSyncEngine(adapter, apiTransport)`:

- **API transport injected** (not a hard import): each passes its HTTP client with `Idempotency-Key` logic; `@hisabche/api` becomes transport-agnostic.
- **Network detection injected:** mobile `@react-native-community/netinfo` (exists), desktop `electron.net.isOnline`/`nativeTheme`, web `navigator.onLine` + `on/online/offline` events.
- **Background sync orchestrated per platform, same core:** mobile on foreground + NetInfo reconnect; desktop on launch + interval + sync button; web on `online` (sync on visibility change).

**Why this is the moat:** one conflict/mvcc/encryption engine across three surfaces — the "2-3 year engineering moat" is only real if the shared engine IS the product.

## 5.3 Conflict resolution

1. **Per-tenant version column (immediate):** add `version: integer` to core tables (same migration as tenant). Server rejects/merges on base-version mismatch — strictly better than server-wins-last-overwrite.
2. **Per-field merge rules (conflict-resolver.ts):** classify fields:
   - money/quantity (`paid_amount`, `quantity`) → **incremental merge, NEVER last-write-wins**; flag on divergence (protects the ledger invariant — a shopkeeper's stock must not silently drop).
   - identity/ref → last-write-wins, immutable after create.
   - text/labels → last-write-wins (timestamp).
   - lifecycle/status → state-machine merge (pending→completed orderings only).
3. **Tombstones for delete:** `deleted_at`/tombstone rows so deletes propagate on pull (today a deleted entity can resurrect).
4. **Later (2.5+):** version vectors/CRDTs only for low-contention fields (address, display name); accounting totals stay versioned-merge. **Do NOT build full CRDTs now.**

## 5.4 How `sync.routes.ts` must change

- `POST /sync/pull` — filter on `workspace_id` (= tenant), not `user_id`; return created/updated/deleted buckets + `version`; cursor for pagination.
- `POST /sync/push` — accept `base_version`; run conflict resolver; return `applied` vs `conflict`; dedupe on `Idempotency-Key` → `client_id` (server today has no push dedup → a retried push double-inserts).
- All server writes stamp `workspace_id` from the authenticated session (never trust the payload).

## 5.5 Encryption at rest (local store)

- **Desktop (SQLite):** SQLCipher via `better-sqlite3`, or column-level vault over the adapter write path. Derive key from user passphrase + existing `secure-store.ts` IPC-backed secure store. Version a `key_derivation_context`.
- **Mobile (Watermelon/SQLite):** encrypted adapter; key in react-native keychain.
- **Web (Dexie/IndexedDB):** WebCrypto AES-GCM, per-vault key released after auth/unlock.
- Single `encryption.ts` interface, platform key source injected per adapter. **NEEDS BUILD — no at-rest encryption anywhere today.** This turns offline from a reliability feature into a _trust_ feature.

---

# SECTION 6 — EVENT ARCHITECTURE

## 6.1 Target design

```
[Business write in a service]
  ─ writes entity row + event_log row in the SAME DB transaction  ← outbox
      ▼
event_log (durable, versioned, tenant-scoped)
  │
  ├── class EventBus (current event.service.ts, hardened):
  │      invoice.created → Inventory, Payment, Notification, Analytics, AI
  └── OutboundDispatcher → webhook fan-out to ecosystem (Section 7)
```

**Event schema — typed & versioned** (replace `payload: any`):

```ts
interface DomainEvent<P> {
  id: string
  type: string // "invoice.created"
  version: number // per-type schema version
  tenantId: string // workspace scope
  entityType: string
  entityId: string
  idempotencyKey: string // client-supplied, dedupes
  aggregateVersion: number // ties into the sync `.version`
  actor: string | null
  data: P // Zod-validated PER TYPE, not `any`
  timestamp: string
}
```

**Idempotency:** change `emit()` to accept the **client/aggregate `idempotencyKey`** (dedupe by `(type, idempotencyKey)` unique constraint) instead of generating a fresh random each call — today a retried emit is not actually idempotent against itself.

**Retry / backoff:** keep the existing exponential `2^n` + `next_retry_at` (solid). **Dead-letter:** today only writes `error_message` on the same row; add a dedicated `dead_letter` table for retention/audit.

**THE FIX — Transactional outbox (critical):** today `emit()` inserts into `event_log` _after_ the business write, in its own request — a crash in between loses the event. **Fix:** wrap the entity insert + `event_log` insert in **ONE transaction** in each high-value domain service (`invoice.service.ts`, `product.service.ts`). `invoice.created` becomes atomic with the invoice row.

**Consumption model:** each consumer keeps its own read cursor and can rebuild (inventory, analytics). `logBusinessEvent` (activity/notifications) should become a _subscriber_ of bus events, promoting one authoritative event path instead of two rival ones.

| Component                                   | Classify        | Today                                                 |
| ------------------------------------------- | --------------- | ----------------------------------------------------- |
| In-process pub/sub, retries, backoff, stats | **EXISTS NOW**  | `event.service.ts`                                    |
| Durable `event_log`/`event_types`           | **EXISTS NOW**  | Supabase SQL (absent from drizzle migrations — drift) |
| Crash-recovery `processPending` scheduler   | **EXISTS NOW**  | `backend/src/scheduler/index.ts`                      |
| Typed/versioned event schema                | **NEEDS BUILD** | `payload: any`                                        |
| Transactional outbox                        | **NEEDS BUILD** | separate insert in `emit()`                           |
| Domain services emitting bus events         | **NEEDS BUILD** | domain uses `logBusinessEvent`, not the bus           |

---

# SECTION 7 — CONNECTOR PLATFORM (Hisabche Connect)

**Model:** Shopify Apps / Salesforce AppExchange. What exists: **inbound-only Stripe webhook** (`webhook.service.ts`), a `PaymentProvider` abstraction in `checkout.service.ts` (set to `null` → simulated). **No outbound webhook infra, no API keys/OAuth/permissions for third parties.**

## 7.2 Outbound webhook platform (NEEDS BUILD — reuse `event.service` patterns)

1. **Per-tenant endpoint registry** (`webhook_endpoints` table): tenant_id, url, secret, subscribed events, enabled, format.
2. **Delivery worker:** when a bus event matches an endpoint, queue a delivery into a dedupe keyed `webhook_deliveries (endpoint_id, event_id, idempotency_key)`. Retry with exponential backoff (reuse `processPending` batch pattern).
3. **Signature + secrets:** per-endpoint `secret`, HMAC-SHA256 `sigmature`, timestamp for replay protection (Stripe-style).
4. **Replay/idempotency:** deliveries table + `Idempotency-Key` so redelivery is deduplicable; an admin/API replay endpoint for sync holes.
5. **DLQ:** `webhook_deliveries.status='dead'` after max attempts, surfaced to connectors.

```
event_log (outbox) ─► OutboundDispatcher ─► webhook_deliveries ─► tenant endpoint
```

## 7.3 SDK + auth + permissions + marketplace

- **Connector SDK** (`packages/connectors`, new): a Connector ABI — `install(ctx)` (OAuth handshake), `sync(data)`, `subscribe(events)`, `uninstall()`. First-party connectors (`woocommerce`, `shopify`, `stripe`, `bank-feed`, `delivery`, `payment-gateway`) implement a shared `Connector` interface over `PaymentProvider`.
- **API keys / OAuth:** per-tenant-scoped API keys (machine-to-machine) + OAuth 2.0 flows for consumer connectors (refresh tokens in a tenant-scoped secure store). Both NEED BUILD.
- **Permissions:** reuse `@hisabche/auth-core` and the `sessionCan(capability)` model already used in desktop IPC — a connector install grants a scoped set of capabilities (`record.read`, `invoice.update`).
- **Marketplace:** an `app` catalog table (id, name, category, icon, requiredCapabilities, price). **NEEDS BUILD.**

| Capability                                                             | Classify        | Today                      |
| ---------------------------------------------------------------------- | --------------- | -------------------------- |
| Event-bus patterns (backoff, DLQ via, idempotency)                     | **EXISTS**      | `event.service.ts` (reuse) |
| Inbound webhook receiver (billing)                                     | **EXISTS**      | `webhook.service.ts`       |
| Payment-provider abstraction (null→simulated)                          | **EXISTS**      | `checkout.service.ts`      |
| Outbound webhook infra (registry, dispatcher, signatures, replay, DLQ) | **NEEDS BUILD** | —                          |
| Connector SDK / OAuth / API keys / quotas                              | **NEEDS BUILD** | —                          |
| Marketplace / install / billing                                        | **NEEDS BUILD** | —                          |

---

# SECTION 8 — PUBLIC API STRATEGY (Hisabche API v1)

**What exists (map 1:1) and the gap:**

| Capability  | State                               | Gap to public v1                                               |
| ----------- | ----------------------------------- | -------------------------------------------------------------- |
| Transport   | Fastify + JSON + Swagger UI         | Add versioned namespace                                        |
| Validation  | Zod + `zodToJsonSchema` per module  | Derive versioned OpenAPI contract from it                      |
| Auth        | JWT (app path)                      | **Add scoped API keys for server/partner**                     |
| Idempotency | `Idempotency-Key` convention exists | Formalize server-side dedupe + `409` reuse + `Retry-After`     |
| Rate limit  | global 100/min per user             | **Per-API-key quotas** + burst                                 |
| SDK         | `@api` client + React Query hooks   | Publish versioned as `@v1`/`@sdk`, `createApiClient({apiKey})` |

**v1 contract:**

- **Auth tiers:** JWT for interactive (desktop/mobile/web); **API keys per-tenant/per-scope/rotating** (`sk_live_…`) for servers & partners. **No OAuth2 in v1** — the merchant ecosystem priority is B2B partner/merchant data pull + webhooks; OAuth only when a developer marketplace actually has third parties (defer).
- **Versioning:** route-level `/v1` prefix (logical Fastify prefix, not multiple deploys); keep `/api/*` = v0 internal.
- **Rate/quotas:** per-API-key monthly quota (`QuotaService`, analog of entitlement but keyed on API key) + burst rate; Redis-backed counters (have `memoryCache`).
- **Idempotency:** `Idempotency-Key` + server-side marker → return `idempotency: reused`.
- **Webhooks-out:** required for push (Section 7).
- **Docs/contract:** promote Swagger to a **versioned OpenAPI spec generated from the Zod schemas** (the `zodToJsonSchema` step is already the right primitive), served at `/v1/openapi.json` + a developer console.
- **SDK:** re-export `@api` as `@sdk`; allow `createApiClient({ apiKey } | { accessToken })`; publish to npm with typed hooks.

**v1 missing (NEEDS BUILD):** `api_keys` table + middleware; per-key rate/quotas; server-side idempotency resolution; webhook delivery (part of Section 7); a generated OpenAPI file; published SDK; and tenant/purpose-gated partner access (consent from Section 9).

---

# SECTION 9 — AI ARCHITECTURE (Merchant Intelligence Engine)

**The AI layer is NOT a chatbot.** The real targets: **cash-flow prediction, inventory/stock-out prediction, fraud detection, business recommendations, natural-language queries grounded in the ledger.** All five are **structured-data ML over the merchant's own tenant-scoped ledger**. The data foundation matters more than the model.

## 9.1 Capability → signal data

| Capability               | Required signal data                                                         | Existing table                                         |
| ------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| Cash-flow prediction     | invoice date/due/status/paid/payment_method; transactions; customer debt     | `invoices`, `transactions` (once `workspace_id` fixed) |
| Inventory prediction     | `products.quantity` + `min_stock`; `stock_movements`                         | `products`, `stock_movements`                          |
| Fraud detection          | invoice velocity, discount anomalies, payment-method shifts, overnight sales | `invoices` + NEW `audit_log` + `event_log`             |
| Business recommendations | buy/sell margins, category mix, supplier history                             | `products`, `invoice_items`, `customers`, `suppliers`  |
| NL (Persian/RTL) queries | a **merchant data graph** — structured, tenant-scoped                        | read-replica warehouse                                 |

## 9.2 The required data foundation — 6 layers

1. **Tenant-isolated current state** (prereq — §4). All features are per-`workspace_id`.
2. **Transactional outbox → append-only event stream** (§4.6). `event_log` is the ingestion point: add `workspace_id`, `client_id`, full `payload`; never hard-delete (partition-drop only).
3. **Read replica + warehouse (NEEDS BUILD).** Supabase logical WAL (already enabled) streams `event_log` + changed rows to a columnar warehouse (ClickHouse, then Forged/parquet Postgres, or BigQuery). **Every warehouse table keyed by `workspace_id` first** — the compliance bound.
4. **Feature tables (NEEDS BUILD):**
   - `merchant_daily_summaries (workspace_id, date, sales, expenses, cash_balance, receivables, payables, top_product_id, orders_count)` — cash-flow forecast input, nightly job (`job-scheduler` already exists).
   - `inventory_daily_summaries (workspace_id, date, product_id, qty, reorder_qty, velocity_7d, dead_stock_days)`.
   - `customer_credit_profile (workspace_id, customer_id, avg_payment_days, overdue_days, credit_utilization, returned_ratio)`.
   - `anomaly_scores (workspace_id, entity, date, score, feature_vector, reason)`.
     Aggregation is deterministic SQL; forecast models (ARIMA/prophet-class or GBM) run on those tables.
5. **Merchant data graph (NEEDS BUILD):** normalize `merchant → customers → invoices → products → suppliers → purchases → transactions → payments → accounts → journal_lines` per workspace. This powers: Persian/RTL NL queries that **cite their ledger lines** (the trust guardrail); and the **B2B trade graph** (supplier-A ↔ customer-B), where **only anonymized/edge aggregates cross tenant boundaries**. A `pgvector` embedding layer can sit on the graph later — do NOT do RAG over OLTP.
6. **Consent + purpose boundary (non-negotiable pre-L4):**
   ```sql
   consent_grant (id, workspace_id, partner_id, purpose, scope_jsonb, granted_at, expires_at, revoked_at)
   ```
   Every fintech/AI export checks an active `consent_grant`; `partner_id` (lender vs insurer vs AI) is **purpose-bound**. Anonymization pipeline (PII stripped, aggregates only, noise on small cohorts) for market benchmarking.

## 9.3 Trust through the AI layer

- **Feature tables are derived, never authoritative.** A wrong model prediction can never mutate `invoices`/ledger. **High-stakes AI actions route through the existing `workflows`/`workflow_instances` approval engine** (already tenant-scoped).
- **Lineage:** every feature-row carries the event ids it was built from, so an auditor can walk prediction → event → ledger row.
- **Tamper-evidence:** `audit_log` shipping hashed, append-only — the artifact shown to a lender.
- **Offline parity:** because offline writes go through the outbox with `clientId`, the server-side audit records device-originated mutations identically to online ones — the audit is complete even after two weeks offline.

---

# SECTION 10 — ENGINEERING ROADMAP

## Phase 0 — Foundation fixes (0-3 months)

- **Features:** none user-facing; this is paying down the schema debt.
- **Architecture:** unify the two schemas into one `packages/db-schema` truth (import backend definitions); backfill `workspace_id` everywhere preventing new drift.NULLs; add `CHECK (workspace_id NOT NULL)`.
- **Database:** tenant column backfill; `workspaces` columns reconciled.
- **Priority:** CRITICAL — nothing builds right on a drifting schema.
- **Risk:** live-data migration; must be 0-downtime. Highest-risk phase; go slow, add a CHECK and green/red tests.

## Phase 1 — Platform preparation (3-12 months)

- **Features:** typed/versioned events; transactional outbox in high-value services; unified `packages/offline-engine` (outbox + sync + conflict + encryption); tenant-correct `sync.routes.ts`; tombstone deletes; public `/v1` API + per-key quotas + `Idempotency-Key`; outbound webhook discipline; first auditable `audit_log` hash-chain.
- **Architecture:** command/query engine (CommandHandlerRegistry) extracts the inline `invoice.service` chain into domain events.
- **Database:** event_log gets `workspace_id` + partitioning; audit_log table; warehouse read-replica start.
- **Priority:** HIGH — this is the beachhead: offline moat + platform footing.
- **Risk:** medium — every change touches the sync contract; introduce feature-flags and a migration gate. Do not ship frozen writes.

## Phase 2 — Business OS (12-24 months)

- **Features:** payments/reconciliation modules; merchant data graph v1; AI Merchant Intelligence comes online (cash-flow forecast, stock-out predffvoices, anomaly scores) as _derived_ features routing high-stakes actions + payment links + collections.
- **Architecture:** every module is now event-driven; POS reuses invoicing/inventory core; the first real connector (WhatsApp/Tax) proves the pattern; marketplace catalog behind webhooks.
- **Database:** feature tables land; partitions stable; retention policy runs.
- **Priority:** HIGH for payments + first connector; MEDIUM for AI (behind feature tables).
- **Risk:** fintech/AI data-quality; require `workspace_id` correctness everywhere first.

## Phase 3 — Ecosystem (24-36 months)

- **Features:** open the developer ecosystem: publishers install `@sdk`, OAuth2 (once real third parties exist), sandbox, app-review; marketplace commission/billing; B2B trade graph edges anonymized.
- **Architecture:** `EventDispatcher` at scale a dedicated long-running worker queue (still one repo/build); warehouse → analytics productised.
- **Database:** scale, data residency, regional expansion.
- **Priority:** LOW-MEDIUM — only after Offline + Engine + Platform are real (else marketplace dies the click).
- **Risk:** ecosystem before foundation = sprawl. Defer if Phases 0-2 not proven.

---

# SECTION 11 — WHAT NOT TO BUILD

- 🚫 **Microservices.** The Fastify monolith is the correct boundary; services already module. A network-split of 30 services quadruples cost, earns zero correctness, and breaks offline-first/sync. One build, one deploy.
- 🚫 **Kubernetes / heavy deployment.** One container (`backend` + managed Supabase). Only later add a single long-running `worker` for the outbox/webhook/AI-delivery queue — still in the same repo.
- 🚫 **Full event sourcing.** Don't re-model the business as pure event-sourced aggregates. Keep current-state tables + outbox + ledger event-log (hybrid). Rewriting = break offline-first + conflict policy (the moat).
- 🚫 **Schema-driven UI runtime / plugin marketplace too soon.** Don't build a runtime schema→UI engine now. Invest in the event-driven Core. No third-party plugin marketplace until one first-party webhook + API v1 + adapter is stable.
- 🚫 **Generic "connector war" (30 vendors at once).** One high-value adapter at a time, bidirectionally with the ledger, behind the outbox. Don't build the connector _framework_ before one adapter proves the pattern.
- 🚫 **A second true schema.** Close the drift. Unify `packages/db-schema` with the backend tenants-correct shapes + `event_log`/`webhook_events`. Never build against a schema that contradicts offline.
- 🚫 **OAuth2 in v1.** API keys first. OAuth only when real third-party developers exist.
- 🚫 **Separate "data warehouse / BI as a company" product.** Analytics = curated projections + reporting package fed from the event log + ledger — a value prop, not a company.
- 🚫 **Deep multi-tenant-first for the consumer store.** pdu / tenant migration is the base; don't over-engineer residency before you have volume.

**Priority build order the three agents converge on:** ① unify tenant-correct core schema → ② bring the event bus to the domain (wire handlers + atomic outbox) → ③ public versioned API + per-key quotas + webhooks-out → ④ packaging (`@sdk` npm) + the first provider adapter → ⑤ marketplace/third-party only then.

---

# SECTION 12 — FINAL CTO RECOMMENDATION

## "If you had $5M funding and 24 months, what exactly would you build?"

**Spend 70% on software foundations, 30% on one proving connector. Do this, in order:**

1. **Months 0-3 — Close the schema + event debt (≈$0.5M).** Collapse the two schemas into one tenant-correct source; backfill `workspace_id`; land the **transactional outbox**; wire the existing event bus to the domain services so `invoice.created` actually fans out to inventory/customer/analytics/workflow. This turns the current app's manual side-effect chain into a market: the single highest-leverage shift.There is no new revenue yet — this is platform debt repayment.

2. **Months 3-6 — Unify the offline engine (≈$0.5M).** Which `packages/offline-engine`: one outbox + sync + conflict resolver + at-rest encryption across Mobile/Desktop/Web. Fix `sync.routes.ts` to be workspace-correct with tombstones. This converts offline-first from two duplicated hacks into the claimed 2-3 year moat.

3. **Months 6-12 — Public API v1 + webhooks (≈$0.75M).** Scoped API keys, per-key quotas, `/v1` namespace, `Idempotency-Key`, generated OpenAPI, `@hisabche/sdk` on npm. Plus the outbound webhook platform (Hisabche Connect) → this is the first partner-facing money: one connector (payment gateway or tax export) that closes the loop, proves the pattern.

4. **Months 12-18 — Tenant + audit hardening (≈$0.75M).** RLS to `workspace_id`, append-only hash-chained `audit_log`, soft-delete + retention, `event_log` partition. Enable loans/insurance/fintech — the audit artifact that becomes a revenue file.

5. **Months 18-24 — Merchant Intelligence Engine + marketplace catalog (≈$0.5M).** `merchant_daily_summaries` + `inventory_daily_summaries` + `anomaly_scores` → cash-flow forecasting, stock-out alert, fraud signal — all derived, all routed through the existing approval engine. Ship the app catalog behind webhooks; keep third-party OAuth open for when real developers appear (no earlier).

**What $5M explicitly is NOT for:** microservices, Kubernetes, full event sourcing, a generic plugin marketplace, a separate BI product, OAuth2 in v1.

**Exit KPI,** in roughly $1.5-3M ARR (the 24-month foundation) as a platform-ready, tenant-correct `engine` with live connectors — a company that is no longer "an accounting app" but sits between merchants and the lenders/partners/marketplaces it will connect.

> **Bottom line:** the ledger is the moat, but **today it is a three-way-drifting schema, a user-first query layer over workspace-scoped tables, an orphaned sync route, and an event bus that isn't an outbox.** Fix the schema truth → scope writes → scope reads → fix sync → land RLS/audit/outbox → and the warehouse, feature tables, merchant graph, consent AI, and partner marketplace all compile directly on top. The ledger becomes the defensible asset the moment `workspace_id` is real, atomic, and audited — everything after that is derived.

---

_HISABCHE PLATFORM ARCHITECTURE & EXECUTION BLUEPRINT 2027 — prepared 2026-08-07 · Platform Architect × Database/Data Platform Architect × Offline/Distributed Systems Architect_
