# HISABCHE V100 — PRINCIPAL ENGINEERING, EDUCATIONAL IMPLEMENTATION & ADMIN CONTROL PLANE COMPLETION

> Repository: `https://github.com/hamednourzaei/hisabche`
> Target branch: `main`
> Canonical status: Prompt recorded under `docs/prompts/` before step-by-step V100 execution.

## MISSION

Transform the existing Hisabche implementation into a verifiably reliable, secure, financially correct, operationally observable, fully integrated Business Operating System.

Target quality: A defensible score of at least 9/10 across every applicable business core and critical cross-cutting engineering dimension, earned strictly by real implementation and verifiable evidence — never by synthetic or inflated scoring.

Core operating principles:

1. **Zero hardcoded currencies or metals:** The user's selected unit can be any currency or metal (`AFN`, `USD`, `XAU`, etc.); no hardcoded currency (e.g., `AFN`, `AFG`) may exist in domain rules, validation defaults, stores, or UI fallbacks (`AGENTS.md` §3).
2. **Teach before coding:** Before implementing each major stage, explain in Persian the existing implementation, defect, root cause, architectural concept, proposed design, alternatives, file impact, DB/API/UI/security/sync impact, test strategy, and rollback plan.
3. **One core engine, never duplicate:** Preserve and extend existing services, hooks, permission guards, sync coordinator, and UI primitives (`packages/ui`).
4. **Admin Control Plane:** Evolve `apps/admin` + `backend/src/routes/admin*.routes.ts` into the authoritative operational control and monitoring plane wired to real backend services, permissions, audit logs, and observability without bypassing tenancy or financial invariants.
5. **Safe repository & database hygiene:** Never execute `git commit`, `git push`, `git reset`, `git rebase`, `git stash`, `git checkout`, `git clean`, or live Supabase DDL. Never run `git short`. Only produce additive `docs/*-migration.sql` + `docs/VERIFY-*.sql` + `*.pg.test.ts` artifacts for human confirmation.

---

## TARGET ARCHITECTURE — HISABCHE UNIFIED BUSINESS OPERATING SYSTEM

1. **Admin Control Plane:** Tenant management, security, operations, health, support, finance, gateway, change orders, backup preview, migrations, workers, release flags, and capabilities.
2. **21 Business Cores:** Operational cores wired end-to-end (`UI → Hook → API → Validation → Permission → Service → Domain → Database → Audit → Sync → Tests`).
3. **Capability Engine:** Universal DNA + Capability Resolver (`SUPPORTED`, `SUPPORTED_WITH_LIMITS`, `NOT_OFFERED`).
4. **Sync & Offline:** Outbox, cursor sync, conflict queue, local SQLite engine, honest multi-state sync outcome.
5. **Financial Integrity:** Double-entry general ledger, integer minor units, unknown-is-not-null, currency separation, cross-core reconciliation.
6. **Shared Infrastructure:** Database, API, RLS, Audit, Permissions, Observability, CI & Tests.

---

## OPERATING & SAFETY RULES

- No `any`, `@ts-ignore`, `eslint-disable`, fake APIs, fake success responses, placeholder UI, silent error swallowing, hardcoded tenant IDs, hardcoded currencies/metals, or dead code.
- Respect `exactOptionalPropertyTypes`.
- Code and code comments in English; explanations and final reports in Persian.
- Status vocabulary only: `VERIFIED_COMPLETE`, `IMPLEMENTED_NOT_LIVE_VERIFIED`, `BLOCKED`, `NOT_IMPLEMENTED`, `PENDING_HUMAN_CONFIRMATION`.
- Do not use subagents. Do not run production builds unless explicitly authorized.

---

## EXECUTION PHASES

1. **Phase 0 — Baseline & Discovery:** Record HEAD (`git.exe`), branch, dirty/untracked files, prepare `code-intel`, map Admin Control Plane (`apps/admin` + `admin*.routes.ts`), verify 21 cores & cross-cutting dependencies, check currency/metal neutrality, and run baseline tests.
2. **Phase 1 — Critical P0 Fixes:**
   - **4.1 Payment Gateway Webhook & Admin/Till Separation:** Separate external raw-body HMAC provider callback (never browser-signed, never trusting client `workspaceId`, strict timestamp replay window, idempotent event persistence, currency/amount/state validation) from authenticated internal reconciliation/status controls.
   - **4.2 Project Change Orders Atomicity:** Require atomic transactional RPC with `FOR UPDATE` row lock, server-authoritative baseline check, optimistic project version check, currency exponent validation (`FRACTION_DIGITS`, AFN=0, never `/100`), atomic audit recording, and remove unsafe non-atomic client-trusted fallback.
   - **4.3 Cross-Core Reconciliation:** Extend `/api/accounting/reconcile-cross-core` with full ledger-level invariants (`missingPostings`, `duplicatePostings`, `advanceLiabilityMismatch`, `currencyMismatch`, `roundingDifference`, `reversalMismatch`, debits/credits, structured exceptions).
   - **4.4 Support Ticket Atomicity & Automated SLA Worker:** Make ticket mutations + immutable event recording transactional/consistent, wire automated SLA evaluation into existing scheduled job infrastructure (`scheduler.service.ts` / `claim_scheduled_run`), prevent duplicate escalation, and emit persistent delivery records.
   - **4.5 Restore Preview Completeness:** Include `missingIdTables`, propagate DB query errors instead of swallowing them, check unbounded conflicts safely in chunks, validate FK targets accurately, compute exact `wouldUpdate`/`wouldSkip`/`wouldCreate`/`rejectedRows`, and keep `restoreExecutionSupported: false`.
   - **4.6 Sync UI Result Propagation:** Surface full 6-state lifecycle outcome (`success`, `partial`, `failed`, `offline`, `conflict`, `running`, retries/auth errors) across Sync Center and status consumers; advance `lastSyncedAt` only on complete `success`.
3. **Phase 2 — Shared Foundation & Hardening:** Enforce tenant isolation, server RBAC, minor-unit math, idempotency, audit logging, `/live` / `/ready` / `/api/health/db`, worker safety, and migration checks.
4. **Phase 3 — Admin Control Plane Completion:** Complete and wire all 15 admin operational areas (`Overview`, `Workspaces`, `Identity & Access`, `Capabilities`, `Sync Operations`, `Financial Integrity`, `Gateway Operations`, `Project Control`, `Support & SLA`, `Backup & Recovery`, `Jobs & Notifications`, `Security & Audit`, `Release Management`, `Migration Center`, plus UI loading/empty/error/RTL/fa-af-en parity) strictly onto existing core services and permissions.
5. **Phase 4 — 21 Business Cores Audit & Completion:** Verify `UI → Hook → API → Validation → Permission → Service → Domain → Database → Audit → Sync → Tests` across all 21 cores, fix identified defects (including invoice drafts visibility/persistence and unit/currency/metal neutrality), and keep capability matrices strictly honest.
6. **Phase 5 — Frontend & Onboarding Verification:** Verify `Signup → Auth → Workspace Discovery/Creation → Industry Profile → Capability Resolution → Initial Setup → Dashboard`, i18n (`fa`/`af`/`en`), RTL, mobile/desktop responsiveness.
7. **Phase 6 — Database, Security & Migrations:** Author additive idempotent SQL + `VERIFY-*.sql` + `*.pg.test.ts` + security IDOR/RBAC tests without running live Supabase DDL.
8. **Phase 7 — Performance & Scale:** Run reproducible small/medium/large SQLite and backend query/sync benchmarks and eliminate N+1/unbounded reads.
9. **Phase 8 — Final Independent Verification & Persian Engineering Report:** Review git diff cleanly, re-run all verification gates (`type-check`, `eslint`, unit/API/local-engine/desktop/ui/validation suites, CI freshness scripts, `pnpm code-intel update`), calculate evidence-based core and cross-cutting scorecards honestly (Sections A–J), and state every live/PG/hardware blocker accurately.
