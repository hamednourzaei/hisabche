# Hisabche Agency Governance & Single Ownership Matrix

## 1. Non-Negotiable Binding to Repository Law

All 27 specialized agents operate strictly subordinate to:

1. Root [AGENTS.md](../AGENTS.md) (Canonical operational rules, Error-First §0.5, Code Intelligence §0.6, Outcome-Driven Integrity §0.7, Five Rules §1, One-of-Everything §2, Never Invented Values §3)
2. Root [CLAUDE.md](../CLAUDE.md) (Session rules, five pitfalls, platform technical traps)
3. [SECURITY-POLICY.md](./SECURITY-POLICY.md) and [EVIDENCE-STANDARD.md](./EVIDENCE-STANDARD.md)

Whenever an upstream persona prompt conflicts with Hisabche repository rules, **Hisabche repository rules win unconditionally**.

---

## 2. Explicit Single-Ownership Matrix (Zero Ambiguity)

No cross-team ambiguity or parallel engine creation is permitted on core domains:

| Critical Domain                              | Primary Owner Role (Design/Guard)                          | Permitted Implementer Role(s)                                            | Independent Verifier                                        | Canonical Repo Target                                                        |
| -------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Database Architecture & Migrations**       | `Database Optimizer` + `Software Architect`                | `Database Optimizer` / `Database Reliability Engineer`                   | `Security Architect` + `Reality Checker`                    | `docs/*-migration.sql`, `VERIFY-*.sql`, `*.pg.test.ts`                       |
| **Business & Accounting Logic**              | `Financial Bookkeeper & Controller` + `Software Architect` | `Backend Architect` / `Minimal Change Engineer`                          | `Code Reviewer` + existing `.claude/agents/domain-reviewer` | `backend/src/services/accounting/`, `packages/validation`                    |
| **Financial Integrity & Minor Units**        | `Financial Bookkeeper & Controller`                        | `Backend Architect`                                                      | `AI-Generated Code Security Auditor` + `Reality Checker`    | `profit-report.domain.ts`, `payments/`, `inventory-costing/`                 |
| **Permission Enforcement & Tenancy**         | `Security Architect`                                       | `Application Security Engineer` / `Backend Architect`                    | `Penetration Tester` + `.claude/agents/security-reviewer`   | `workspace.middleware.ts`, `admin-rbac.middleware.ts`, RLS policies          |
| **Offline Sync, SQLite & Partition Crypto**  | `Realtime Sync Engineer` + `Security Architect`            | `Realtime Sync Engineer` / `Desktop App Engineer` / `Mobile App Builder` | `Evidence Collector` + `Test Automation Engineer`           | `packages/local-engine/`, `packages/sync/`, `apps/desktop/electron/main/db/` |
| **Industry Capabilities (67 Trades DNA)**    | `Product Manager` + `Software Architect`                   | `Backend Architect` + `UI Designer`                                      | `Reality Checker` + `Test Results Analyzer`                 | `packages/validation/src/schemas/universal-core/`, `industry-profiles`       |
| **KPI & Financial Report Formulas**          | `Financial Bookkeeper & Controller`                        | `Backend Architect`                                                      | `Code Reviewer` + `.claude/agents/domain-reviewer`          | `profit-report.domain.ts`, `analytics/` (zero duplicate formulas)            |
| **UI Components, Hubs, Design Tokens & RTL** | `UX Researcher` + `UI Designer`                            | `UI Designer` / `i18n Engineer`                                          | `.claude/agents/parity-reviewer` + `Evidence Collector`     | `packages/ui/`, `packages/i18n/`, `apps/web/`, `packages/app-shell/`         |
| **Release & Production Readiness Approval**  | `Reality Checker` _(Veto Authority)_                       | `SRE` / `DevOps Automator` _(Remediation only)_                          | Owner Human Confirmation for live DB/Build/Deploy           | [RELEASE-POLICY.md](./RELEASE-POLICY.md)                                     |

---

## 3. Prohibited Actions Across Every Agent

Every specialized agent prompt enforces:

1. Never run `git commit`, `git push`, `git reset`, `git checkout -- <file>`, `git stash`, or `rebase`.
2. Never execute DDL or write queries against live Supabase databases (`docs/*-migration.sql` + `VERIFY-*.sql` files only).
3. Never read, copy, print, or modify `.env*` files or secrets.
4. Never install, upgrade, or remove npm/Expo/Gradle/Electron dependencies without explicit owner authorization.
5. Never upgrade Expo SDK 51, React Native 0.74, enable RN New Architecture, or remove Legacy WebView.
6. Never introduce polling or Redis into client synchronization (`packages/local-engine`, `packages/sync`), or apply Last-Write-Wins (LWW) to money, ledger, inventory, or customer credit conflicts.
7. Never create a second ledger, costing, tax, permission, sync, KPI, or UI component engine.
8. Never introduce `any`, `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, fake APIs, placeholder UI, or weakened tests.
9. Never run production builds (`next build`, `electron-builder`, `gradle`) unless explicitly requested.
10. Never invoke subagents automatically inside normal tasks without explicit workflow/task authorization.

---

## 4. Mandatory Inputs & Outputs Contract

Every agent invocation **must** specify:

- **Inputs:** Goal, target file/symbol paths (from `code-intel` / `CODEBASE_MAP.md`), task profile (`LIGHTWEIGHT` | `STANDARD` | `CRITICAL`), and active workflow phase.
- **Outputs:** Structured response citing exact verified file paths, line numbers, command outputs, status tag ([RELEASE-POLICY.md](./RELEASE-POLICY.md)), and separation of Facts vs Assumptions.
