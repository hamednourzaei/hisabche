# 12 — LOCAL ENGINE & OFFLINE EXECUTION SPECIFICATION

**Document Version**: 1.0.0  
**Status**: APPROVED SPECIFICATION  
**Location**: `docs/architecture/universal-business-core/12-OFFLINE-EXECUTION.md`

<!-- target-vocabulary -->

> **Vocabulary note (M0, 1 Nov 2026):** commands, events, tables and function names in this document that do not
> exist in the repository are **target** names of a design, not claims about current code.
> `node scripts/audit/verify-spec-references.mjs` keeps checking every file path here.

---

## 1. Local Engine Contract (`@hisabche/local-engine`)

The local engine is a full-featured, zero-network runtime executing in Node.js (Electron main) or browser/WebView SQLite:

```typescript
export interface LocalEngine {
  request<T = unknown>(req: LocalEngineRequest): Promise<LocalEngineResponse<T>>
}

export interface LocalEngineRequest {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  readonly path: string
  readonly headers?: Record<string, string | undefined>
  readonly query?: Record<string, string | undefined>
  readonly body?: unknown
}
```

---

## 2. Injected Determinism (Clock & ID Generation)

To ensure that offline mutations are reproducible and idempotent:

1. **Clock Injection**:
   Every mutating command receives an explicit `createdAt` / `effectiveAt` ISO UTC timestamp. The core never reads un-injected system clocks.
2. **Deterministic ID Derivation**:
   Entities created offline use deterministic IDs:
   $$\text{entityId} = \text{payload.id} \lor \text{payload.clientRequestId} \lor \text{sha256}(\text{workspaceId} + \text{deviceId} + \text{seq})$$
   Random strings (`Math.random()`) are strictly forbidden.

---

## 3. Atomic Outbox Enqueue Contract

When an offline write occurs (e.g. creating an invoice, issuing a return, redeeming a package credit):

```sql
BEGIN TRANSACTION;
  -- 1. Mutate local entity table
  INSERT INTO invoice (...) VALUES (...);
  -- 2. Mutate local operational state
  UPDATE product SET quantity = quantity - ... WHERE id = ...;
  -- 3. Write durable outbox row
  INSERT INTO sync_queue (client_id, entity, operation, payload, workspace_id, created_at)
  VALUES (...);
COMMIT;
```

If the device loses power mid-operation, the SQLite WAL rollback guarantees zero orphaned outbox records or inconsistent stock balances.
