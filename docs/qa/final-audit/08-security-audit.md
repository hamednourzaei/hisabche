# 08 — Security Audit Evidence (OWASP ASVS 5.0.0 · WSTG · API Top 10 · NIST SSDF)

> **Execution Date:** 2026-11-25

## 1. Executed Security Controls & Tests

- **Authorization & Capability Matrix:** `viewer-authorization-contract.test.ts`, `authorization-explain.test.ts`, `viewer-cannot-write.test.ts` (`PASS`).
- **Workspace Membership & Fail-Closed Role Resolution:** `workspace-membership-integrity.test.ts`, `tenancy-isolation.test.ts` (`PASS` — unknown/NULL roles fail closed with `ForbiddenError`).
- **Platform Admin Gate & Step-Up:** `admin-gate.test.ts` (`11/11 PASS`).
- **Sync Security & Field Allowlist:** `sync-security.test.ts`, `sync-unsupported-fields.test.ts` (`PASS` — rejects unknown writable fields with `UNSUPPORTED_FIELD`).
- **Concurrency Safety Map:** `concurrency-safety-map.test.ts` (`PASS` — all 13 `workspace.routes.ts` mutating routes mapped after `QA-003` fix).

## 2. Open Security / Hygiene Findings

- **Undeclared Dependencies (`QA-006`, P2):** `scripts/check-undeclared-deps.mjs` reports 6 undeclared imports in `@hisabche/{app-shell,auth,db-schema,ui}` (blocked by Rule 0.5 manifest freeze).
- **Live RLS & Postgres Policy Verification:** `BLOCKED_EXTERNAL` locally on Windows (`initdb` `0xC0000142`); must execute `*.pg.test.ts` on Linux/CI.
