# Workflow 5 — Production Readiness Certification

**Default Profile:** `CRITICAL`

## Sequence (Strict Order)

1. **Architecture Check (`hisabche-software-architect`):** Confirm single-core integrity & zero parallel engines.
2. **Security Check (`hisabche-security-architect` + `hisabche-ai-code-security-auditor`):** Confirm zero tracked `.env*` leaks, RBAC/Step-Up, tenant scoping, Fail-Closed JWT/partition crypto.
3. **Database & HA/DR Check (`hisabche-database-reliability-engineer`):** Confirm `MIGRATIONS-PENDING.md` truth, writer fencing (`ha-writer-fencing-01`), fail-closed replica routing, complete catalog fingerprint parity, and DR restore drill health.
4. **API & Contract Check (`hisabche-api-tester`):** Confirm `client-route-contract`, `hook-routes-exist`, `concurrency-safety-map`, and `offline-endpoint-matrix` parity.
5. **Offline & Sync Check (`hisabche-realtime-sync-engineer`):** Confirm `local-engine` + `sync` invariants and zero LWW on money.
6. **Desktop & Mobile Check (`hisabche-desktop-app-engineer` + `hisabche-mobile-app-builder`):** Confirm Jest suites & dual `tsconfig` typechecks.
7. **Test Suite Verification (`hisabche-test-results-analyzer`):** Run all 15 packages (`--maxWorkers=8`) + check `SELLABLE-INDUSTRIES.md`.
8. **Observability & SRE Check (`hisabche-sre`):** Verify `/api/health`, `/api/health/db`, divergence alarms, and honest `edgeControlMode` telemetry.
9. **Infrastructure Check (`hisabche-devops-automator`):** Verify reference Nginx configs, webhook rollback semantics, and explicit `NOT_DEPLOYED` disclosures.
10. **Independent Sign-off (`hisabche-reality-checker`):** Issue final verdict using strict status vocabulary (`VERIFIED_COMPLETE` only if live Postgres/HTTP/Browser executed over clean tree; otherwise `IMPLEMENTED_NOT_LIVE_VERIFIED` / `BLOCKED`).
