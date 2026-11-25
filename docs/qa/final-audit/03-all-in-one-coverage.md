# 03 — All-in-One QA Coverage & 67-Industry Isolation Matrix

> **Generated:** 2026-11-25T12:42:23.768Z
> **Source:** `docs/architecture/industry/sellable-industries.json` (67 industries), `docs/qa/final-audit/02-complete-capability-inventory.csv`
> **Architectural Rule:** All-in-One QA runs strictly inside an isolated QA test context (`All-in-One Test Workspace`) using existing contracts and resolvers — real industry profiles are NEVER mutated to make QA pass.

## 1. 67-Industry Coverage Summary

- **Total Registered Industries:** 67
- **Counts by Status:** `{"registered":67,"profiled":67,"workflowVerified":67,"operationsVerified":67,"sellable":0,"notYetSellable":67,"postgresEvidence":0,"browserEvidence":0}`
- **All 67 industries profiled & workflow-verified in Vitest/HTTP:** 67 / 67
- **Postgres Journey Verified:** 0 / 67 (`BLOCKED_EXTERNAL` locally on Windows `initdb` `0xC0000142`; must run in Linux/CI Postgres)
- **Live Browser E2E Verified:** 0 / 67 (`UNVERIFIED_LIVE`)

## 2. Regulated & Specialized Trades Verification

- `currency_exchange`: NOT_FOUND
- `pharmacy`: status=`WORKFLOW_VERIFIED`, workflowComplete=`true`, tests=3, missing=`POSTGRES_JOURNEY, BROWSER_JOURNEY, ACCEPTANCE_EVIDENCE_STALE, EVIDENCE_NOT_ON_COMMITTED_TREE`
- `jewellery`: status=`WORKFLOW_VERIFIED`, workflowComplete=`true`, tests=3, missing=`POSTGRES_JOURNEY, BROWSER_JOURNEY, ACCEPTANCE_EVIDENCE_STALE, EVIDENCE_NOT_ON_COMMITTED_TREE`
- `medical_clinic`: NOT_FOUND
- `manufacturing`: status=`WORKFLOW_VERIFIED`, workflowComplete=`true`, tests=3, missing=`POSTGRES_JOURNEY, BROWSER_JOURNEY, ACCEPTANCE_EVIDENCE_STALE, EVIDENCE_NOT_ON_COMMITTED_TREE`

## 3. All-in-One Capability Isolation Guarantees

1. **No Cross-Industry Leakage:** Verified by `packages/validation/src/__tests__/industry-profile-guard.test.ts` and `sellable-industries.test.ts` (13/13 passed).
2. **No Retail Fallback on Unknown Industries:** Unknown industry keys fail closed or resolve without assuming Retail/Physical-Goods inventory.
3. **Full Per-Industry CSV:** See `docs/qa/final-audit/04-industry-coverage.csv` (67 rows).
