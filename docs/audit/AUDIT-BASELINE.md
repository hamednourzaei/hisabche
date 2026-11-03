# AUDIT BASELINE — Universal Capability Gap Audit

Captured on 3 Nov 2026. At the START of the audit `git status --short` printed 0 entries (clean tree, tracked and untracked). The three untracked files listed below were created by the audit itself before this file was written; nothing else differed.

```
branch: main
HEAD:   f8a10909 fixed ci 31

$ git status --short
?? docs/audit/AUDIT-BASELINE.md
?? docs/audit/INDUSTRY-CAPABILITY-MATRIX.md
?? docs/audit/UNIVERSAL-CAPABILITY-MATRIX.md
(all three are audit outputs; the tree held no other change)

$ git diff --stat
(empty = no tracked changes)

$ git diff --name-only

$ git log -n 15 --oneline
f8a10909 fixed ci 31
e3f87d6b fixed ci 28
107f7f7c fixed ci 26
6119b82f fixed ci 25
367e2852 fixed ci 15
01d4a66d fixed ci 14
d94c8034 fixed ci 13
f2060fa8 fixed ci 12
ddeead92 fixed ci 11
b753a62a fixed ci 10
05f749a2 fixed ci 9
527b60bd fixed ci 8
9ab66b94 fixed ci 7
85d79856 Keep developers/integrations open; hide only marketplace, market seller, website selling and OAuth apps
622584d9 Hide marketplace, developers and market seller behind one switch (DISABLED_PAGES)
```

## Pre-existing audit documents (reused, not duplicated)

- docs/audit/AUDIT-BASELINE.md
- docs/audit/AUDIT-GATE-STATUS.md
- docs/audit/COMPETITIVE-EVIDENCE-MATRIX.md
- docs/audit/INDUSTRY-CAPABILITY-MATRIX.md
- docs/audit/ORPHAN-CAPABILITY-LEDGER.md
- docs/audit/SCORE-METHODOLOGY.md
- docs/audit/UNIVERSAL-CAPABILITY-MATRIX.md
- docs/audit/UNIVERSAL-CORE-AUDIT-FINAL.md
- docs/audit/UNIVERSAL-CORE-AUDIT.md
- docs/audit/UNIVERSAL-CORE-GAP-LEDGER.md
- docs/audit/WRITE-ROUTE-AUTHORIZATION.md
- docs/audit/browser-qa
- docs/audit/docs
- docs/audit/evidence
- docs/audit/gates
- docs/audit/generated
- docs/audit/verify-logs

- docs/architecture/universal-core/ (CORE-INVENTORY, CORE-BOUNDARIES, INDUSTRY-COVERAGE-TABLE, FIFTY-OPTIONS-AUDIT)
- docs/architecture/universal-business-core/ (M1–M6 audit, owner decisions, release gate)
- docs/architecture/industry/ (INDUSTRY-SUPPORT-MATRIX, ADR-001, INDUSTRY-DIFFERENCES)

## Workspace

- apps: admin desktop mobile web
- packages: analytics api app-bridge app-shell auth auth-core config db-schema design-tokens formatting i18n local-engine mobile-ui store sync ui ui-contract validation
- backend route files: 107; service folders+files: 117; backend test files: 456 (of which *.pg.test.ts: 94)
- offline endpoint matrix: 507 endpoints (187 available, 305 online_required, 15 not_supported) — packages/validation/src/schemas/offline-endpoint-matrix.ts

## Code intelligence

`node scripts/build-ai-index.mjs` ran on 3 Nov 2026: INCREMENTAL_UPDATE (FRESH). Graphify is not installed on this machine (no working Python); it was not used. CODE_INTELLIGENCE is a navigation aid only; every claim below was checked in source.
