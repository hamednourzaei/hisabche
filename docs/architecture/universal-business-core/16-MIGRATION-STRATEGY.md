# 16 — DATABASE MIGRATION & STRANGLER PATTERN SPECIFICATION

**Document Version**: 1.0.0  
**Status**: APPROVED SPECIFICATION  
**Location**: `docs/architecture/universal-business-core/16-MIGRATION-STRATEGY.md`

---

## 1. Migration Protocol (Zero Downtime, Expand & Contract)

Every database modification across PostgreSQL and SQLite adheres to the phased **Expand & Contract** lifecycle:

```
[Phase 1: Expand]
  • Additive columns / tables (NULLABLE or with SAFE DEFAULTS)
  • Indexes created CONCURRENTLY
  • Foreign keys NOT VALID -> VALIDATE

[Phase 2: Dual Write / Dual Read]
  • Adapters populate both legacy and new structures
  • Core divergence shadow harness verifies output parity

[Phase 3: Cutover]
  • Services switch active reads to new universal schema
  • Legacy paths preserved as fallback

[Phase 4: Contract (Human Review Only)]
  • Deprecated columns marked for removal in future major release
  • Zero immediate DROP COLUMN in initial deployment
```

---

## 2. PostgreSQL Server Migration Deliverables Contract

For every server schema change, the agent delivers strictly:

1. `docs/<name>-migration.sql`: Additive, idempotent SQL containing a fully reversible Rollback block.
2. `docs/VERIFY-<name>.sql`: Read-only verification query confirming constraints and data shapes.
3. `<name>.pg.test.ts`: Automated PostgreSQL integration test executing the migration **twice** (idempotency check) against ephemeral Postgres.
4. **Mandatory Rule**: `NEVER RUN DDL AGAINST LIVE SUPABASE DATABASE`. Mark all production executions as `REQUIRES_HUMAN_APPROVAL`.
