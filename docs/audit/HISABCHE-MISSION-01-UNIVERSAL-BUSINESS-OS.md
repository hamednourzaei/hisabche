# HISABCHE — UNIVERSAL BUSINESS OS

## MASTER AUDIT, ROOT-CAUSE REMEDIATION & CROSS-PLATFORM COMPLETION MISSION

**Repository:** `hamednourzaei/hisabche`
**Target branch:** `main`
**Product:** Hisabche / حسابچه
**Mission:** Universal Business Core Completion
**Scope:** All existing and future industries + Web Online + Web Offline + Windows + Android Mobile
**Execution mode:** Evidence-first, autonomous, incremental implementation, full verification
**Communication:** Persian reports; English code, identifiers, comments, technical documentation and tests.

---

## 0. Mission

Act as the Staff/Principal Engineer responsible for the technical integrity and completion of Hisabche.

The approved product architecture is:

> One Shared Business Core, Multiple Industry Workflows, Multiple Platform Adapters.

Hisabche must become a genuinely universal, local-first Business Operating System for existing and future business models. The objective is **not** another collection of industry dashboards, duplicate accounting engines, parallel inventory systems or isolated workflows. The objective is to make the existing repository behave as one coherent system.

The finished system must provide:

1. One authoritative business and financial domain.
2. One consistent accounting and ledger model.
3. One unified Party model supporting customers, suppliers and multiple simultaneous roles.
4. One inventory and costing authority.
5. One payment and settlement authority.
6. A composable Operational DNA model.
7. A capability resolver that actually controls product behaviour.
8. Industry workflows built on shared domain services.
9. Industry-, role- and permission-aware dashboards.
10. Identical business outcomes across Web, Windows and Mobile.
11. Reliable online and offline execution.
12. Observable and recoverable background operations.
13. Verifiable business outcomes, not merely healthy processes.
14. A truthful industry support matrix based on executed evidence.

Do not replace the architecture wholesale. Discover what exists, preserve working components, and fix the actual causes of incomplete behaviour. Do not stop after producing an audit report. Continue through implementation and verification for every task that can safely be completed within repository rules. Do not ask for permission for ordinary reversible code changes; stop only for an owner decision, external credential, physical device, live database operation or other genuinely unavailable prerequisite. Never invent evidence or claim completion without proof.

---

## 1. Non-negotiable repository governance

### 1.1 Read the repository instructions

Before planning or editing:

1. Read the complete root `AGENTS.md`.
2. Read `CLAUDE.md`.
3. Inspect applicable `.claude/` and `.agents/` instructions and installed skills.
4. Inspect nested `AGENTS.md` files relevant to affected directories.
5. Read relevant architecture contracts and implementation records.
6. Inspect current branch, HEAD and `git status --short`.

The repository's current `AGENTS.md` is authoritative. Do not replace its rules with this mission.

### 1.2 Preserve owner work

Never commit, push, reset, rebase, stash, destructively checkout, or run `git clean`. Never overwrite user modifications. Never modify unrelated files. Never read, print or edit `.env*` files. Never expose credentials. Never install, upgrade, downgrade or remove dependencies or lockfiles. Never run production builds without authorisation. Never run live Supabase DDL or writes. Never create subagents. Never weaken tests. Never introduce `any`, `@ts-ignore` or `eslint-disable`. Never add fake APIs, placeholder functionality or invented business data. Never execute anything under the prohibited infected Python installation documented in `AGENTS.md`.

The owner personally handles commits, pushes and migration application.

### 1.3 Preserve existing architectural constraints

Preserve pnpm and Turborepo, the shared UI architecture, Fastify backend, validation/domain package, local-engine and app-bridge, SQLite/PostgreSQL responsibilities, sync protocol, permission and tenancy boundaries, i18n architecture, and Web/Electron/Expo constraints. Do not upgrade Expo SDK or React Native, and do not enable New Architecture. Mobile must remain compatible with existing Legacy WebView/native bridge constraints. Do not introduce a second domain engine, resolver, accounting calculator, costing engine or sync engine.

### 1.4 Mandatory code-intelligence workflow

Run `pnpm code-intel status`. Use the supported CLI/MCP commands for symbol discovery, definitions, callers/callees, impact analysis, source inspection and test discovery. If the index is stale, record it; never edit `graph.json` or rebuild without authorisation. If unavailable, use scoped source search and record the limitation. Do not assume a symbol or path exists because a document describes it.

---

## 2. Phase Zero — Establish current truth

The previously inspected GitHub HEAD was `f0a69b9b3df56dcf8184987cf07e1d2f0c1dce4f`. This is a reference point, not a guaranteed local HEAD.

At execution time:

1. Read the actual local HEAD.
2. Read the actual working tree and identify uncommitted owner changes.
3. Identify the package manager and installed runtime versions from non-secret project files.
4. Discover application entry points.
5. Identify Web, Desktop, Mobile, Backend, shared UI, validation and local-engine packages.
6. Identify database migration history.
7. Read architecture decisions and owner decisions.
8. Identify completed, partial, unproven, blocked and obsolete specifications.
9. Build a dependency graph of the existing implementation.

Never infer implementation status from a checked box in Markdown. Never treat a target architecture specification as proof that its code exists.

### 2.1 Reconciled architecture documents

Use the existing canonical documents, including:

- `AGENTS.md`
- `docs/architecture/MASTER-EXECUTION-PROMPT.md`
- `docs/architecture/MASTER-EXECUTION-LOG.md`
- `docs/architecture/UNIFIED-CORE-AUDIT.md`
- `docs/architecture/CORE-READINESS.md`
- `docs/architecture/OPERATIONAL-DNA-MATRIX.md`
- `docs/architecture/UNIVERSAL-BUSINESS-ARCHITECTURE.md`
- `docs/architecture/OUTCOME-DRIVEN-INTEGRITY-STANDARD.md`
- `docs/architecture/industry/INDUSTRY-SUPPORT-MATRIX.md`
- `docs/architecture/industry/TRACEABILITY.md`
- `docs/architecture/universal-business-core/00-MASTER-SPEC.md`
- `docs/architecture/universal-business-core/01-CURRENT-STATE.md`
- `docs/architecture/universal-business-core/02-TARGET-ARCHITECTURE.md`
- `docs/architecture/universal-business-core/03-DOMAIN-MODEL.md`
- `docs/architecture/universal-business-core/04-CAPABILITY-MODEL.md`
- `docs/architecture/universal-business-core/07-FINANCIAL-MODEL.md`
- `docs/architecture/universal-business-core/11-ACCOUNTING-MODEL.md`
- `docs/architecture/universal-business-core/12-OFFLINE-EXECUTION.md`
- `docs/architecture/universal-business-core/13-SYNC-CONFLICT-MODEL.md`
- `docs/architecture/universal-business-core/18-TESTING-STRATEGY.md`
- `docs/architecture/universal-business-core/19-PLATFORM-VERIFICATION.md`
- `docs/architecture/universal-business-core/23-ACCEPTANCE-MATRIX.md`
- `docs/architecture/universal-business-core/25-OWNER-DECISIONS.md`

Inspect relevant skills under `.agents/skills/` and `.claude/skills/`. Do not create competing architecture documents. If documents contradict source, record the discrepancy and establish source-grounded truth before deciding what to change.

### 2.2 Baseline record

Record actual HEAD, branch, dirty tree, relevant packages, core ownership, domain boundaries, industry registry, DNA axes, capability registry, dashboards/KPIs, API routes/callers, migrations and verification SQL, tests, and missing runtime/platform evidence. Never include secrets.

---

## 3. Phase One — Complete root-cause audit

Every finding must contain: stable ID, severity (P0–P3), domain, exact evidence (file/symbol/line/caller), expected behaviour, actual behaviour, root cause, blast radius, reproduction, remediation, verification, status.

- **P0:** financial corruption, tenant isolation breach, irreversible data loss, unauthorised access.
- **P1:** core workflow failure, incorrect inventory/accounting, cross-platform corruption, broken sync.
- **P2:** major capability/dashboard/workflow/usability defect.
- **P3:** non-critical polish.

Do not inflate counts or manufacture findings.

### 3.1 Required domain audit

Audit: business identity/workspace lifecycle; Operational DNA; capability registry/resolver; industry profiles/workflows; Party and CRM; products/offerings; sales/invoicing; purchasing/supplier bills; pre-sales/pre-purchases; payments/allocations/refunds/settlement; AR/AP; general ledger/reports; inventory/warehouse; costing/valuation; POS/till; service delivery/package credits; pricing/discounts/contracts; workforce/payroll; manufacturing/WIP; scheduling/resource capacity; branches/multi-location; dashboard/KPI; permissions/authorisation; notifications/background jobs; import/data migration; offline/local persistence; sync/replay/conflicts; monitoring/recovery; Web; Windows; Android; i18n/terminology.

For each domain identify the authoritative implementation and every meaningful duplicate.

---

## 4. Phase Two — Root Cause A: one financial and business core

### 4.1 Establish one source of truth

| Concept                | Required authority                          |
| ---------------------- | ------------------------------------------- |
| Invoice calculation    | Existing canonical invoice domain           |
| Ledger posting         | Existing canonical ledger posting service   |
| Payment and allocation | Existing payment domain                     |
| Profit and margin      | Existing profit-report/costing authority    |
| Inventory valuation    | Existing FIFO/AVCO costing                  |
| Party balances         | Canonical party statement / AR/AP authority |
| Currency precision     | Existing currency metadata and formatting   |
| Capability decisions   | One canonical resolver                      |
| Terminology            | One canonical terminology resolver          |
| KPI definitions        | One canonical KPI registry                  |
| Sync decisions         | Existing sync authority                     |

Follow `AGENTS.md` ownership rules. Do not insert directly into journal lines when the canonical posting service owns the operation. Do not calculate profit separately in a dashboard. Do not use `products.buy_price` as inventory cost. Do not sum across currencies. Do not convert AFN using a two-decimal assumption. Unknown remains unknown, not zero.

### 4.2 Detect and remove duplicate business calculations

Search for reimplemented invoice totals, independent payment balance calculations, independent customer/supplier balance formulas, duplicate inventory quantity calculations, alternative FIFO/AVCO implementations, separate dashboard profit formulas, industry-specific financial formulas outside the canonical core, inconsistent money rounding, UI-side financial calculations and server/local-engine formula drift.

For each duplicate: identify the authoritative implementation and every consumer, compare behaviour, add equivalence/invariant tests, migrate consumers incrementally, and remove the duplicate only after proving no legitimate callers remain. Never delete an implementation because its name looks redundant. Preserve documented exceptions and policies.

### 4.3 Financial invariants

Enforce and test: integer minor units on money paths; no floating-point financial arithmetic; server-derived totals from lines; currency isolation; balanced double-entry; correct debit/credit direction; fiscal period locking; correct AR/AP allocation; idempotent posting; immutable finalised documents except permitted metadata/sync fields; auditable reversals; no silent deletion; no fabricated cost/profit; correct tax/discount treatment; tenant-scoped persistence.

Every financial mutation must be traceable from source command to persisted document and ledger effect.

---

## 5. Phase Three — Root Cause B: unified Party model

### 5.1 Required behaviour

A Party may simultaneously buy and sell, receive and provide services, have receivables and payables, have payments and refunds, have purchases and sales, hold multiple roles, have a unified activity history, have separate balances by currency, and have a complete audit trail. A supplier is not a read-only purchasing contact; a customer is not a sales-only contact. Role must not determine transaction arithmetic.

### 5.2 Identity and roles

Inspect existing customer, supplier, party, contact and ledger models. Determine whether a shared Party identity exists. Extend it if it does. If not, design a safe migration and compatibility strategy. Do not blindly merge tables or destroy identifiers. Preserve workspace isolation, existing IDs, invoice/payment references, audit history, metadata, permissions and integrations. A Party's role is a relationship/capability, not a separate financial identity.

### 5.3 Required scenarios

Test: customer buys/pays immediately; customer buys on credit; supplier sells/purchase paid immediately; supplier purchase creates payable; same Party is customer and supplier; simultaneous AR and AP; partial/multiple payments; refund; return; credit note; multi-currency; offline transaction; cross-device sync; Party 360 activity aggregation. Prove all role combinations use the same authoritative financial rules.

### 5.4 Party 360

Present a unified history: sales, purchases, pre-sales, pre-purchases, payments received/made, returns, refunds, outstanding receivables/payables, currency-separated balances, last transaction/payment, aging and relevant accounting entries. Never label supplier purchases as customer sales. Use correct terminology.

---

## 6. Phase Four — Root Cause C: document lifecycle and inventory effects

Categories: sale, purchase, pre-sale, pre-purchase, service sale/purchase, mixed goods/services, return, credit note, refund, reversal.

### 6.1 Explicit state machine

Distinguish draft, pro forma/preliminary, awaiting confirmation, finalised, partially paid, paid, partially fulfilled, fulfilled, cancelled and reversed. Do not confuse payment status with document finalisation. An unpaid invoice can be finalised. A preliminary document is not a financial/stock movement. A paid document is not proof of fulfilment.

### 6.2 Pre-sale and pre-purchase finalisation

**Pre-purchase:** validate supplier/Party, offerings, lines, prices, quantities, currency and permissions; create/finalise through the canonical purchase service; apply payable and accounting effects; apply stock receipt only when fulfilment semantics require it; record audited movements; update reports.

**Pre-sale:** validate customer/Party and lines; create/finalise through the canonical sales service; apply receivable/payment effects; apply reservation/delivery/deduction according to actual fulfilment policy; prevent double deduction; update reports.

Do not assume every finalised pre-sale deducts stock. Owner-approved semantics and current domain rules take precedence.

### 6.3 Atomicity and idempotency

Finalisation must be atomic across required financial/operational effects, idempotent, replay-safe, tenant-scoped, auditable and recoverable. A finalised invoice must not exist without its required accounting/stock effects. Retries must not duplicate movements, allocations or postings. Use existing Postgres RPC/transaction boundaries; never fake transactions with multiple independent supabase-js writes.

### 6.4 Payment status correctness

Test unpaid, partially paid, fully paid, overpaid per policy, pending, failed, refunded and reversed. If the user selects unpaid, do not demand a payment amount that was never entered. If an amount is entered, validate and allocate through the canonical payment engine. Never silently create a payment from an invoice total.

---

## 7. Phase Five — Root Cause D: Operational DNA and capability resolution

Inspect the actual implementation in `packages/validation/src/schemas/operational-dna.ts`, industry profile schemas, capability registry/resolution, server workspace configuration, local workspace schema, onboarding, dashboard consumers, terminology consumers and permission guards.

The 15 axes: Offering Model; Intake and Delivery; Inventory Behaviour; Billing and Settlement; Workforce Model; Customer/Party Profile; Operational Topology; Terminology and Presentation; Unit Tracking; Pricing Basis; Asset Custody; Execution Site; Recurrence; Approval Depth; Regulated Domain.

Verify each axis is defined, persisted, versioned, validated, resolved, consumed by real workflows, synced, applied consistently on all platforms and tested. A schema definition alone is not an implemented DNA feature.

### 7.1 DNA rules

Axes remain composable. Unknown remains unresolved. No automatic Retail fallback. No physical inventory assumption for service businesses. No staff model inference from incomplete information. Regulated classification does not imply compliance. Industry names are not authorisation gates. Industry profile does not duplicate domain logic.

### 7.2 Capability resolver

Every capability must have a stable identifier, canonical owner, dependencies, required permissions, supported platforms, offline availability, required data, workflow definition, UI/API consumers, tests and explicit support state. Support states: `SUPPORTED`, `SUPPORTED_WITH_LIMITS`, `NOT_OFFERED`, `PLANNED`, `BLOCKED`. A registered capability is not necessarily complete. A route existing is not proof its UI works. A hidden menu is not authorisation. Client checks do not replace server checks. When disabled, UI and API enforce the same policy.

---

## 8. Phase Six — All existing and future industries

Scope is `ALL_PLUS`. Include every registered industry and future composable model. Discover the canonical registry and trade taxonomy; use the real current count.

### 8.1 Per-industry coverage

For every registered industry determine DNA preset, unresolved questions, active capabilities/dependencies, offering types, intake/delivery, inventory behaviour, pricing basis, billing/settlement, workforce, customer/party profile, topology, approval requirements, regulatory constraints, terminology, navigation, dashboard, KPIs, reports, permissions, offline support, platform support and E2E scenarios.

Do not create superficial profiles that all render the same generic retail dashboard.

### 8.2 Industry families

At minimum represent retail/grocery, wholesale/distribution, import/export, gold/jewellery, currency exchange, pharmacy, clinics/healthcare, education/tutoring, beauty/personal care, automotive repair, electronics repair, professional services, consulting, agencies, freelancers, restaurants/food, manufacturing, construction, project businesses, rental/leasing, transport/logistics, warehousing, agriculture, hospitality, subscription businesses, multi-branch enterprises, mixed goods/service businesses.

This is a validation checklist, not permission to invent accounting rules.

### 8.3 Regulated industries

Treat pharmacy, healthcare, financial exchange, gold and other regulated domains as high risk. Do not claim compliance without evidence. Audit required data, access restrictions, audit history, approval rules, sensitive-data exposure, retention, operational constraints and integration boundaries. Unknown requirements are explicit blockers/owner decisions. Do not build fake KYC, prescription or compliance functionality.

### 8.4 Future onboarding

A new industry must be configurable through DNA axes, capability composition, workflow definitions, terminology, dashboard definitions, KPI registry, permission requirements and tests. It must not require a second accounting/inventory/payment/CRM/sync engine.

---

## 9. Phase Seven — Dashboard and KPI engine

The dashboard derives from Business DNA + resolved capabilities + user role + permissions + actual data + preferences → canonical resolver → industry/role experience.

Inspect the existing registry, KPI definitions, routes, widgets, server queries, local aggregates and permission checks. Do not create another dashboard engine.

### 9.1 Required behaviour

Owner, manager, cashier and employee see different permitted operational views. Industry influences presentation but never grants access. Every KPI defines key, name/terminology key, formula or canonical source, currency/unit, time window, filters, permission, freshness, offline behaviour, null/unknown behaviour, tests and owner core.

### 9.2 KPI correctness

Never calculate profit as sales minus raw purchases; never sum currencies; never treat missing data as zero; never use capped reads for totals; never duplicate server financial formulas in UI; never display stale aggregates as real-time unlabelled; never show metrics the role cannot access. Dashboards update from committed outcomes, not button clicks.

### 9.3 Industry examples to validate

Retail sales/margin/stock/reorder/receivables; wholesale turnover/debt/payables/fulfilment; gold weight/purity/metal value/making charges/margin; exchange positions/rates/settlement/reconciliation; pharmacy expiry/batch/stock/purchasing/dispensing where supported; education students/sessions/attendance/package credits/tuition; repair open jobs/parts/labour/turnaround; manufacturing WIP/raw materials/production/scrap/cost; restaurant orders/consumption/waste/food cost; services hours/bookings/utilisation/revenue; projects milestones/hours/costs/revenue/receivables. These are product outcomes, not permission to invent formulas.

---

## 10. Phase Eight — Online, offline, Windows and mobile parity

### 10.1 Platform inventory

Discover actual runtime/adapter architecture for Web Online, Web Offline, Windows Electron, Android Expo/RN, local SQLite, server PostgreSQL, shared UI, API hooks, local engine, app shell and native bridges. Do not trust stale docs.

### 10.2 One domain, multiple adapters

Business rules stay in the canonical shared domain. Platform code may own navigation, hardware, local database access, native printing, barcode scanning, file access, notifications, lifecycle, connectivity and presentation. It must not implement financial/business rules independently.

### 10.3 Offline guarantees

Verify initial hydration, workspace isolation, device readiness, local durability, local mutation atomicity, outbox persistence, idempotent push, incremental pull, cursor integrity, replay protection, conflict classification, human conflict resolution, crash recovery, network recovery, version compatibility, multi-device convergence, local backup and offline permission/licence enforcement.

The server remains authoritative. Local data is an authorised operational mirror and local draft/execution state. Do not overwrite newer local data with stale hydration. Do not lose outbox mutations. Do not use LWW for financial records. Do not silently delete. Do not treat HTTP success as sync success.

### 10.4 Financial conflict policy

Use the existing conflict architecture. Descriptive fields may auto-resolve per approved policy. Inventory/credit conflicts use business rules. Financial reversals, duplicate payouts and sensitive conflicts require human review. Every unresolved conflict is visible, actionable and auditable.

### 10.5 Web Offline

Verify whether the runtime supports offline mutations. Do not label browser caching as full offline execution. If SQLite/IndexedDB exists, prove it. Online-only capabilities are labelled and explained.

### 10.6 Windows

Verify Electron main/renderer boundaries, local DB, offline operations, sync, hardware adapters, printing, barcode, crash recovery, upgrade compatibility and shared-domain parity. Do not change packaging/native dependency architecture unnecessarily.

### 10.7 Android

Preserve Expo/RN and Legacy WebView constraints. Verify native bridge, local DB, background sync, connectivity recovery, restart, lifecycle, low memory, touch, RTL, offline workflows and data integrity. Report physical-device verification as blocked when unavailable. Never claim a physical Android device passed if only source/Jest was inspected.

---

## 11. Phase Nine — End-to-end outcome integrity

Follow `docs/architecture/OUTCOME-DRIVEN-INTEGRITY-STANDARD.md` and the canonical skill.

Verify outcomes, not process health:

- **Layer 1 — Availability:** handler exists, dependency reachable, correct endpoint responds, permission checks execute.
- **Layer 2 — Execution:** correct domain handler runs, mutation commits, replay prevented, background job processes the intended record.
- **Layer 3 — Outcome correctness:** correct record, amounts, accounting entries, inventory movements, Party balance and workflow state exist.
- **Layer 4 — Durability and consistency:** PostgreSQL persistence, tenant isolation, constraints, idempotency, outbox, sync convergence, offline persistence, crash recovery.
- **Layer 5 — User-visible proof:** correct state, values, currency, terminology, role permissions, loading/empty/error/unknown states.

Every critical capability records: Capability, Owner Core, Dependencies, Expected Outcome, Persistence Proof, Replay Proof, Offline Proof, User Proof, Failure Recovery, Alert Owner. No capability is complete while critical outcome evidence is missing.

---

## 12. Phase Ten — Admin, monitoring and background operations

Extend the existing monitoring architecture; do not create a second platform. The owner must understand every core's operational health from the existing admin experience.

### 12.1 Core monitoring

Verify core registry, metric registry, latency, error/timeout rate, concurrency, dependency wait, DB pool pressure, lock contention, cache behaviour, queue backlog, stuck jobs, sync/conflict backlog, alert lifecycle, reconnect behaviour and data freshness. A green process does not prove a healthy business system.

### 12.2 Outcome-oriented alerts

Every alert defines severity, core owner, trigger, business impact, first diagnostic step, recovery procedure, deduplication, raise/resolve behaviour and audit history. No ownerless alerts. GET endpoints must not produce hidden side effects.

### 12.3 Background jobs

Verify actual outputs of scheduled jobs, notifications, exports, backups, sync workers, cleanup and reconciliation. A job marked successful must have evidence the intended output was produced.

### 12.4 Backup and restore

Keep export and restore distinct. Verify generation, integrity, version metadata, required data, corruption detection, restore prerequisites, outbox safety and recovery. Do not claim restore support because export exists. Respect owner decisions requiring human confirmation for dangerous restore behaviour.

---

## 13. Phase Eleven — Migration and data safety

Treat owner statements that migrations were applied as operational statements, not proof every file is correct. Never execute migrations or write to live Supabase.

Inspect naming, applied-migration tracking where safely available, schema definitions, SQL files, verification SQL, constraints, RLS, foreign keys, indexes, backfills and compatibility. For every required change provide `docs/<name>-migration.sql` and `docs/VERIFY-<name>.sql`, plus real PostgreSQL tests where relevant.

### 13.1 Quality requirements

Each migration must be safe for existing data, idempotent where appropriate, tenant-safe, compatible with existing IDs, explicit about preconditions/transformations, correctly constrained/indexed/RLS-protected, and reversible or have documented forward recovery. Do not invent backfill values. Do not convert unknown to zero. Do not assume completeness. Do not add redundant tables to avoid understanding the model. Do not mark applied/verified because SQL exists.

Use exactly: `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`.

---

## 14. Phase Twelve — Security and tenancy

Audit `workspace_id` filtering, RLS, tenant isolation, role from `request.tenancy.role`, capability guards, server-side enforcement, user/workspace ID misuse, cross-tenant references, sensitive exposure, unauthorised financial mutations, audit integrity and offline authorisation limits.

A client-supplied workspace ID is not authorisation. A hidden UI action is not a boundary. Industry profile is never an authorisation gate. Every mutation is server-authorised or governed by the approved local offline contract. Never weaken security to make a workflow pass.

---

## 15. Phase Thirteen — Internationalisation and UX

All user-facing changes work in `fa`, `af`, `en`. Follow Dari glossary rules. Preserve RTL and logical CSS. Add keys in all locales. Verify labels, errors, empty states, tooltips, status names, forms, tables, cards, industry terminology, dates, currency and numbers. Customer/supplier/student/client/service/purchase/sale terminology resolves from the canonical terminology system. Use shared select components rather than raw browser selects. Do not show contradictory online/offline messages. If an operation genuinely needs the server, explain why.

---

## 16. Phase Fourteen — Testing and proof

Tests must exercise real business rules. Mocking the entire behaviour under investigation is insufficient. Use existing tooling.

### 16.1 Required layers

Domain unit tests, golden vectors, property-based invariants, architecture boundary tests, local SQLite tests, Fastify HTTP integration tests, real PostgreSQL transaction tests, API/hook contract tests, UI component tests, browser E2E, Windows tests, Android tests, cross-platform parity, offline chaos/crash recovery, security/tenancy, migration idempotency.

### 16.2 Critical acceptance scenarios

Existing goods business; new goods business with unknown cost; service business; education/package credits; mixed goods/service invoice; no-inventory business; multi-branch; multi-currency; partial payments; customer returns; supplier purchases; dual-role Party; full offline; two-device stock conflict; capability disablement; multi-day version skew; migration idempotency; cross-tenant isolation; accounting failure recovery; sync interruption. Extend with discovered root causes.

### 16.3 Cross-platform parity

Compare actual resulting state for create invoice, finalise purchase/sale, record payment, return/refund, inventory movement, Party balance, accounting result, dashboard and conflict resolution across Web Online, Web Offline, Windows and Android. Unsupported operations are reported honestly; never silently substitute a different financial rule.

### 16.4 Regression proof

Demonstrate guards catch intended regressions; restore temporary injections byte-for-byte; never leave injected defects; never weaken tests.

### 16.5 Execution discipline

Identify exact scripts/projects, record baseline failures, run focused then package suites, type-checks, lint and safe integration tests. Do not run production builds without authorisation. Do not claim tests passed without exit codes. Do not report mock/PGlite/in-memory tests as real PostgreSQL evidence.

---

## 17. Phase Fifteen — Implementation strategy

After the audit, build an evidence-backed remediation dependency graph. Prioritise P0 → P1 → P2 → P3; within severity: financial correctness, data integrity, tenant security, shared-core ownership, customer/supplier parity, inventory/document lifecycle, DNA/capability resolution, industry workflow completeness, cross-platform parity, monitoring/recovery, dashboard/UX, performance/polish.

### 17.1 Vertical slices

Every slice includes business requirement → domain rule → validation → persistence/transaction → backend service → API route → API hook → permission guard → shared UI → Web/Windows/Mobile adapters → offline/sync → dashboard/reporting → tests/outcome proof.

Do not mark a capability complete because an endpoint exists. Do not create a screen without real data. Do not add a capability that cannot be authorised, tested and observed.

### 17.2 Completion rules

Continue all safe, clearly specified work. If an owner decision is necessary: record it, explain alternatives/impact, use the documented safe default, do not invent policy, continue independent work. If PostgreSQL, a physical device, credentials or an integration are unavailable: finish source work, add runnable tests, generate verification artefacts, record exact prerequisites, and do not falsely mark the blocked portion complete.

### 17.3 Avoid unnecessary changes

Extend services, reuse shared components/hooks/schemas/guards/sync routes/KPI and terminology systems. Avoid unrelated refactoring, new dependencies and new engines. A smaller proven fix is preferable to a large rewrite.

---

## 18. Industry acceptance gate

Support every registered and future composable industry, but registration is not readiness. Update the canonical support matrix with actual evidence. Each industry is `SUPPORTED`, `SUPPORTED_WITH_LIMITS`, `NOT_OFFERED`, `PLANNED` or `BLOCKED`, showing core capabilities, completed/incomplete workflows, offline/platform/regulatory limits, test/database/browser evidence and owner decisions.

Only mark fully supported with sufficient critical end-to-end evidence. Do not chase a count. A profile, preset, navigation entry or dashboard is not support. A service business must not inherit retail inventory behaviour. A regulated business must not inherit a generic compliance claim. A mixed business must correctly combine workflows.

---

## 19. Required deliverables

Use existing canonical documents; do not duplicate reports.

- Executive audit report (Persian): `docs/architecture/UNIVERSAL-BUSINESS-OS-FINAL-AUDIT.fa.md`
- Root-cause remediation matrix: `docs/architecture/UNIVERSAL-BUSINESS-OS-REMEDIATION-MATRIX.md`
- Updated cross-platform parity matrix
- Updated industry support matrix (existing registry only)
- Updated outcome-integrity coverage
- Migration SQL + VERIFY + PostgreSQL tests only when schema changes are necessary, with human-application status
- Test evidence: exact commands, exit codes, counts, skips, failures, environment blockers
- Final Persian report: fixed/already-correct/incomplete/verified/not-verified, tests run/failed, external prerequisites, files changed, final working tree, HEAD and code-intelligence freshness.

---

## 20. Strict status vocabulary

`VERIFIED_COMPLETE`, `IMPLEMENTED_NOT_LIVE_VERIFIED`, `VERIFIED_WITH_LIMITATIONS`, `SOURCE_CONFIRMED`, `TEST_CONFIRMED`, `RISK`, `TEST_GAP`, `BLOCKED`, `NOT_IMPLEMENTED`, `PENDING_HUMAN_CONFIRMATION`, `OWNER_DECISION`.

Never use `VERIFIED_COMPLETE` because code compiles, a route/schema exists, a mock passes, a dashboard is green, a migration file exists, a job started, a backup exported or an industry is registered. Report implementation, automated tests, runtime/device verification, production verification, migration confirmation and index freshness separately.

---

## 21. Final execution order

1. Read governance and instructions.
2. Establish actual HEAD and working-tree state.
3. Verify code-intelligence availability.
4. Read architecture contracts.
5. Build source-grounded subsystem inventory.
6. Root-cause audit.
7. Severity/dependency matrix.
8. Fix P0.
9. Fix P1 shared financial/business core defects.
10. Fix Party/customer/supplier parity.
11. Fix invoice lifecycle, pre-sale/pre-purchase, payment, inventory consistency.
12. Fix DNA/capability resolver wiring.
13. Fix industry workflows and support classification.
14. Fix dashboard/KPI ownership/correctness.
15. Fix Web/Windows/Mobile parity.
16. Fix offline/sync/recovery.
17. Fix monitoring/outcome observability.
18. Fix security/tenancy.
19. Add migrations only where necessary.
20. Add regression/acceptance tests.
21. Run verification gates.
22. Update canonical architecture/evidence documents.
23. Produce the final Persian report.

After each slice: inspect the diff, run relevant tests/type-checks/lint, check tenant and financial invariants, confirm no unrelated files changed.

Do not stop after the first successful suite or after fixing a visible symptom. Continue until every safe, actionable finding is addressed or explicitly blocked.

---

## 22. Final acceptance criteria

**Architecture:** one authoritative business domain; no duplicate financial engines; no conflicting Party balance engines; one canonical capability resolver; one terminology resolver; one KPI ownership model; no industry-name authorisation logic.

**Business correctness:** customers/suppliers use identical financial rules; a Party can have both roles; sales/purchases produce correct accounting; pre-sales/pre-purchases have correct lifecycle; inventory effects occur at the right event; payments/balances correct; returns/reversals auditable; currency precision correct; unknown remains unknown.

**Industry completeness:** every existing industry has a truthful support state; new industries compose without parallel cores; workflows are real; dashboards/KPIs use canonical definitions; regulated workflows have honest limits.

**Platform parity:** Web Online, Web Offline (supported operations), Windows and Android work; equivalent outcomes; restrictions documented; physical verification never fabricated.

**Data integrity:** tenant isolation; transactional PostgreSQL writes; durable SQLite mutations; idempotent outbox; safe sync convergence; financial conflicts not silently overwritten; safe independently verifiable migrations.

**Operational integrity:** jobs prove output; monitoring measures outcomes; alerts have owners/recovery; backup and restore distinguished; critical workflows have user-visible proof.

**Engineering quality:** relevant tests pass; no weakened tests; no forbidden TS escape hatches; no unnecessary dependencies; no unrelated changes; no lost user modifications; no commit/push.

---

## 23. Final instruction

Do not deliver a beautiful report while the code remains broken. Do not deliver a beautiful dashboard while its KPIs are wrong. Do not claim universal industry support while workflows are untested. Do not claim offline support while mutations disappear after a crash. Do not claim financial correctness while customer and supplier calculations disagree. Do not claim platform parity because the same component is imported by multiple apps.

**Make the actual business outcomes consistent. Fix root causes, not symptoms. Preserve one shared architecture. Use evidence for every completion claim. Complete all safe implementation and verification work autonomously.**

When the mission ends, leave the working tree ready for the owner to inspect, commit and push. The final result must be a truthful, auditable and operationally coherent Hisabche Business Operating System — not a collection of implemented-looking features.

---

## Execution log — 23 Nov 2026

### Industry registry reconciliation (WP-17 input)

Measured, not assumed:

```
node -e "…"   # compares INDUSTRY_KEYS with docs/architecture/industry/sellable-industries.json
code 67  registry 67
in code not registry: []
in registry not code: []
dupes: []
```

`packages/validation/src/__tests__/sellable-industries.test.ts` already asserts the set equality
(`report.industries.map(r => r.key).sort()` equals `[...INDUSTRY_KEYS].sort()`, and
`counts.registered === INDUSTRY_KEYS.length`) → 13/13 passed. No second guard was written: a duplicate
list would be exactly the second source of truth this repository forbids.

### WP-12 — inventory and costing

Twelve guard files executed together: **12 files / 124 tests passed**. One acceptance proof (the real
PostgreSQL half of `invoice-write-document.pg.test.ts`) is blocked by the host's embedded-PostgreSQL
shared-memory failure, and is recorded as such in `HISABCHE-CROSS-DOMAIN-INTEGRITY-AUDIT.md` §10,
together with observation WP-12-O1 (analytics inventory value uses `buy_price`; owner decision).

### WP-13 — function security

`.pgtest/audit-rpc-security.mjs` now follows grants across the whole migration chain and reports
**10 callable functions, 2 trigger functions, 0 failing at least one control**. Two real defects were
found and repaired with `docs/stock-reservations-02-grants-and-scope-migration.sql`; both were proven
on PostgreSQL 18.4 (`17/17` assertions). See `HISABCHE-MULTITENANCY-SECURITY-AUDIT.md` §6.

### WP-14 — offline and conflict classification

`backend/src/__tests__/always-local-two-devices.test.ts`,
`offline-conflict-rules.test.ts`, `order-deposit-sync-pull.test.ts` and
`appointment-conflict-sql.test.ts` → **4 files / 42 tests passed**. The deposit kind travels as its own
`source_type` on the device (schema v39), so a pre-purchase is never re-read as a pre-sale after a
restart.

### WP-15 — session slice

The rule "an employee session cannot spend a customer package" existed on both sides (server and
device domain) but under the token `SETTLEMENT_PACKAGE_REQUIRES_CUSTOMER`; the owner's decision table
names `SETTLEMENT_CUSTOMER_REQUIRED`. Both definitions now use the decision's token, and
`service-delivery-settlement.domain.test.ts` proves the refusal **and** that `complementary` stays
allowed → **2 files / 37 tests passed**. The one-subject rule is enforced by
`EMPLOYEE_SESSION_HAS_CUSTOMER` / `CUSTOMER_SESSION_HAS_EMPLOYEE` in `ServiceDeliveryService.create`,
and `undecided` is refused at delivery (`SETTLEMENT_METHOD_REQUIRED`).

### WP-16 — mutation events

Every domain named in the package emits through the one `logBusinessEvent` path: repair tickets (11
call sites), salon sessions (11), customers (7), products (7), contracts (10), deposits (5). Replay
guards keep a replay branch silent: `invoice-return-retry-and-audit`, `warranty-claim-idempotency`,
`contracts-service-writes`, `customer-payout-is-a-refund`, `payment-auto-allocate-flag`,
`audit-row-branch`, `payroll-idempotency-and-booking` → **7 files / 47 tests passed**.

### WP-17 — ledger

`node scripts/migrations/pending-ledger.mjs` → `docs/MIGRATIONS-PENDING.md`: **302 migrations, 183
with VERIFY, 193 with a PG test**. The three new files (advances-05, order-deposit-balances-01,
stock-reservations-02) each appear with their VERIFY and PG test.
