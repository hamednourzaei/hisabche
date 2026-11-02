# 14 — VERSION COMPATIBILITY & MIGRATION SKEW SPECIFICATION

**Document Version**: 1.0.0  
**Status**: APPROVED SPECIFICATION  
**Location**: `docs/architecture/universal-business-core/14-VERSION-COMPATIBILITY.md`

---

## 1. Tri-Partite Versioning Envelope

Every command envelope and sync payload carries three distinct version counters:

```typescript
export interface VersionTuple {
  readonly schemaVersion: number // Structural SQLite / Postgres schema (Current = 9)
  readonly rulesVersion: number // Financial calculation logic version (Current = 1)
  readonly configVersion: number // Tenant capability & feature configuration
}
```

---

## 2. Multi-Day Offline Skew & App Upgrade Contract

### 2.1 The Scenario

A sales agent creates 50 invoices offline on Day 1. On Day 3, while still offline, the application binary updates to a newer version containing schema version 10. On Day 5, the device connects to the internet.

### 2.2 Guarantees & Protocols

1. **Never Drop Pending Outbox Rows**:
   Local database migrations (`packages/app-bridge/src/local-migrations.ts`) **MUST NEVER** clear or invalidate the `sync_queue` table during an upgrade.
2. **Server Backward Compatibility Window**:
   The backend server accepts incoming commands with $\text{rulesVersion} \ge (\text{CURRENT\_RULES\_VERSION} - 2)$. Older versions are translated through backward-compatibility adaptors before domain execution.
3. **Idempotent Local Migrations**:
   Every statement in `LOCAL_MIGRATIONS` is safe to run multiple times (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`).
