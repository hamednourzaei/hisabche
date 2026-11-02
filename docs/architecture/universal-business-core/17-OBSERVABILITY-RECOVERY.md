# 17 — OBSERVABILITY, DIVERGENCE MONITORING & CRASH RECOVERY SPECIFICATION

**Document Version**: 1.0.0  
**Status**: APPROVED SPECIFICATION  
**Location**: `docs/architecture/universal-business-core/17-OBSERVABILITY-RECOVERY.md`

<!-- target-vocabulary -->

> **Vocabulary note (M0, 1 Nov 2026):** commands, events, tables and function names in this document that do not
> exist in the repository are **target** names of a design, not claims about current code.
> `node scripts/audit/verify-spec-references.mjs` keeps checking every file path here.

---

## 1. Core Divergence Shadow Monitoring

During slice migration, the shared domain core executes in shadow comparison alongside existing legacy paths. Any discrepancy between legacy outputs and universal core outputs is recorded:

```sql
CREATE TABLE IF NOT EXISTS core_divergence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  slice_name TEXT NOT NULL,
  command_name TEXT NOT NULL,
  legacy_output JSONB NOT NULL,
  core_output JSONB NOT NULL,
  difference_summary TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.1 Automated Divergence Alarm (`divergence-alarm.ts`)

- **Purity**: Evaluated via pure rules in `packages/validation/src/schemas/divergence-alarm.ts`.
- **Threshold**: Configurable per-tenant threshold (default: 0% tolerance on financial math).
- **Minimum Window**: Requires at least 20 comparative evaluations before triggering alerts to prevent false positives during quiet initialization windows.

---

## 2. Crash Recovery & Dead-Letter Quarantine

1. **Local Crash Recovery**:
   On application startup, `sync-engine.ts` scans `sync_queue` for records in status `in_flight` or `failed`. If attempts $< 5$, attempts are restored to `pending` with exponential backoff.
2. **Permanent Rejections**:
   If an entity is rejected permanently (e.g. 400 Bad Request, invalid business logic), it is tagged `status: 'rejected'` with the exact server error string, permanently preventing infinite retry loops while alerting the user visually in the UI.
