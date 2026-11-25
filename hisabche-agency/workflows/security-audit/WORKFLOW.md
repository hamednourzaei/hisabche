# Workflow 2 — Security & Financial Integrity Audit

**Default Profile:** `CRITICAL`

## Sequence

1. **`Security Architect` (`hisabche-security-architect`)** maps trust boundaries (`workspace_id`, `request.tenancy.role`, `adminRoute`, `SUPABASE_SERVICE_KEY` isolation, local JWT/partition crypto).
2. **`Application Security Engineer` (`hisabche-appsec-engineer`)** inspects routes, middleware, storage providers, CORS headers, and client bundles (`NEXT_PUBLIC_*`/`EXPO_PUBLIC_*`).
3. **`Database Security & Ledger Check`** (`hisabche-database-optimizer` + `hisabche-financial-controller`) inspects RLS policies, `REVOKE ALL`, `SECURITY DEFINER SET search_path`, minor-unit math, and ledger balance invariants.
4. **`Security & AI Code Auditor` (`hisabche-ai-code-security-auditor`)** + **`Penetration Tester` (`hisabche-penetration-tester`)** independently verify exploitability (`app.inject()` / IDOR / replay).
5. **`Evidence Collector` (`hisabche-evidence-collector`)** records reproducible findings under `EVIDENCE-STANDARD.md`.

## Required Outputs

- Vulnerability inventory with Severity (`P0`–`P3`) and Exploitability
- Exact affected files, line ranges, and tenant/money blast radius
- Concrete remediation plan extending canonical guards
- Regression security tests (`*.test.ts` / `*.pg.test.ts`)
