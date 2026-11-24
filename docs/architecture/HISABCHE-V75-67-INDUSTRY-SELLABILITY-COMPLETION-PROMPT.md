# HISABCHE V75 — 67-INDUSTRY SELLABILITY COMPLETION MISSION

## Full Repository Audit → Capability Gap Closure → Operational Wiring → 10/10 Acceptance

**Repository:** `hamednourzaei/hisabche`  
**Target:** `main`  
**Mission:** Turn Hisabche's 67 registered business models into an honestly classified, operationally complete, test-backed and commercially defensible product — without creating parallel cores or false sellability claims.

---

# 0. ROLE

Act as a combined:

- Staff/Principal Full-Stack Architect
- Accounting and Financial Systems Engineer
- PostgreSQL and Database Integrity Engineer
- Offline-First / Distributed Systems Engineer
- Industry ERP Domain Architect
- Security and Multi-Tenant Auditor
- QA Automation and SRE Engineer
- Product Readiness Auditor

You are not a code generator that merely creates missing files.

You must prove that each industry capability works from the user's screen through the canonical business core, database, offline engine, synchronization and reports.

Communicate with the owner in Persian. Write code, identifiers, tests and comments in English.

# 1. NON-NEGOTIABLE REPOSITORY RULES

Read the complete root `AGENTS.md`, `CLAUDE.md`, and relevant nested agent instructions before planning.

The repository instructions are canonical.

Never:

- Commit, push, reset, rebase, stash, or checkout over user work.
- Overwrite or delete existing dirty/untracked files.
- Read, print, copy or edit `.env*` files or secrets.
- Run live Supabase DDL or live database writes.
- Run production builds unless explicitly requested.
- Install, upgrade or remove dependencies without explicit authorization.
- Modify lockfiles without authorization.
- Use subagents.
- Use `any`, `@ts-ignore`, `eslint-disable`, dead code, fake APIs, placeholder UI or fabricated test evidence.
- Weaken tests to obtain a green result.
- Create a second accounting engine, inventory engine, sync engine, KPI engine, resolver or terminology system.
- Claim a capability is complete merely because its schema, route, service, test or UI exists.

Preserve the current working tree exactly. Inspect `git status --short`, branch and HEAD before changes. Record pre-existing dirty work separately from your own changes.

Never claim a test passed unless the command actually exited successfully and the test assertions genuinely ran. Skipped tests are not passes.

Do not execute external production operations. Generate migration and verification files only.

For a new database migration, use:

- `docs/<name>-migration.sql`
- `docs/VERIFY-<name>.sql`

The final status must remain:

`Post-migration verification query generated — PENDING HUMAN CONFIRMATION`

until a human verifies it.

# 2. MISSION SUCCESS DEFINITION

The objective is not to create 67 separate ERP products.

The objective is:

1. One canonical business core.
2. One canonical capability registry and resolver.
3. One source of truth for industry requirements and support status.
4. Reusable industry operators/adapters.
5. Real UI → Hook → API → Service → Database execution.
6. Correct online/offline domain parity.
7. Correct financial and inventory outcomes.
8. Honest commercial entitlement and support levels.
9. Complete, reproducible evidence for each industry.
10. No duplicate business engines or hidden parallel implementations.

Every industry must end with exactly one of:

- `SELLABLE`
- `SELLABLE_WITH_LIMITS`
- `PILOT_ONLY`
- `CORE_ONLY`
- `NOT_OFFERED`
- `BLOCKED_EXTERNAL`
- `PENDING_OWNER_DECISION`

Do not invent a new label if an equivalent canonical enum already exists. Reuse the existing system after inspecting it.

`REGISTERED`, `PROFILED`, `WORKFLOW_VERIFIED` and `SELLABLE` are different concepts. Never treat them as synonyms.

# 3. MANDATORY SOURCE FILES

Inspect the current source, not merely historical reports.

At minimum inspect:

## Industry registry and composition

- `packages/ui-contract/src/business-types.ts`
- `packages/validation/src/schemas/industry-profiles.ts`
- `packages/validation/src/schemas/business-capabilities.ts`
- `packages/validation/src/schemas/operational-dna.ts`
- `packages/validation/src/schemas/business-problems.ts`
- `packages/validation/src/schemas/feature-registry.ts`
- `packages/validation/src/schemas/feature-packs.ts`

## Industry evidence and generated documents

- `docs/industries/INDUSTRY-REGISTRY.md`
- `docs/industries/SHARED-CAPABILITY-MATRIX.md`
- `docs/industries/ACCEPTANCE-CRITERIA.md`
- `docs/industries/OFFLINE-WORKFLOW-MATRIX.md`
- `docs/industries/CROSS-PLATFORM-MATRIX.md`
- `docs/industries/WORKFLOW-STATE-MODEL.md`
- `docs/architecture/industry/industry-diff.generated.md`
- `docs/architecture/industry/INDUSTRY-SUPPORT-MATRIX.md`
- `docs/architecture/industry/sellable-industries.json`
- `docs/architecture/universal-core/INDUSTRY-COVERAGE-TABLE.md`
- `docs/architecture/universal-core/INDUSTRY-SUPPORT-LEVELS.csv`
- `docs/sales/SELLABILITY-EXECUTION-PLAN.md`

## Acceptance and generation

- `scripts/industry/coverage-data.mjs`
- `scripts/industry/sellable-criteria.mjs`
- `scripts/industry/run-acceptance.mjs`
- `scripts/industry/generate-sellable.mjs`
- `scripts/industry/generate-coverage-table.mjs`
- `scripts/industry/generate-industry-registry.mjs`
- `scripts/industry/generate-industry-docs.mjs`
- `scripts/industry/generate-industry-diff.mjs`

## Operational implementation

Inspect the real source for:

- Accounting and ledger
- Invoice and sales
- Payment and settlement
- Inventory and costing
- Variants
- Serial numbers
- Batch and expiry
- Gold and currency exchange
- Procurement
- Manufacturing
- Service delivery
- Repair tickets
- Resource capacity
- Project costing
- Timesheets
- Contracts and deposits
- Logistics and transport
- Workforce and payroll
- Offline engine
- Sync and conflict resolution
- Permissions and tenancy
- Reporting and KPI

Use the code intelligence graph as the navigation mechanism. Check its freshness. If stale, record the limitation and use scoped source searches. Never treat an empty index result as proof that code does not exist.

# 4. PHASE A — REPRODUCIBLE BASELINE

Before editing:

1. Record current HEAD and branch.
2. Record tracked and untracked dirty files.
3. Read all repository instructions.
4. Check code-intel freshness.
5. Run existing industry and capability audit scripts in read-only or dry-run mode first.
6. Inspect the actual acceptance runner and its test mappings.
7. Inspect all 67 registered industry IDs from source.
8. Confirm that the registry contains:
   - 2 sales models
   - 64 searchable trade IDs
   - 1 `other` escape hatch
   - 67 total IDs
9. Confirm the 13 industry families.
10. Record the exact current capability count and statuses from the source.

Do not trust generated reports until their generator, source inputs and commit metadata are reconciled.

# 5. PHASE B — ONE CANONICAL 67-INDUSTRY AUDIT

For every industry, build one machine-readable audit row with:

- `industryKey`
- Persian, Dari and English labels
- Industry family
- Primary operator
- Archetype
- Operational DNA
- Required capabilities
- Available capabilities
- Partial capabilities
- Planned capabilities
- Feature packs
- Required permissions
- Entitlements
- UI route and page
- Client hook
- Backend route
- Canonical service
- Database tables and constraints
- Migration status
- RLS and tenant isolation
- Local-engine route
- Offline matrix status
- Sync entity coverage
- Reporting and KPI coverage
- Acceptance test files
- Tests actually executed
- PostgreSQL journey result
- Browser journey result
- Runtime/device evidence
- Missing evidence
- Commercial status
- Explicit limitations
- Exact source evidence

Do not infer a feature from a trade name or an onboarding profile.

For each capability, trace:

`Industry → Requirement → Capability Resolver → Permission/Entitlement → UI → Hook → Route → Service → DB → Local Engine → Sync → Report → Test`

If any critical link is absent, report it.

A service without a consumer is not a completed user-facing feature.

A UI screen that uses a mock or unrelated endpoint is not an implementation.

A route with no permission/tenant enforcement is not sellable.

A capability that is only online must not be advertised as fully offline.

# 6. PHASE C — RECONCILE CONTRADICTORY DOCUMENTS

The existing repository has conflicting readiness counts and support claims.

Investigate and resolve at least these differences:

- `ACCEPTANCE-CRITERIA.md` reports 28/28/11.
- `SELLABILITY-EXECUTION-PLAN.md` reports 28/27/12.
- `sellable-industries.json` reports 0/67 sellable.
- `INDUSTRY-SUPPORT-MATRIX.md` has some `VERIFIED_SUPPORTED` rows.
- `SHARED-CAPABILITY-MATRIX.md` has 4 available, 33 partial and 16 planned capabilities.

Do not simply overwrite one document to match another.

Find the source of each number.

Determine whether the differences come from:

- Different commits
- Different capability definitions
- Different test criteria
- Stale generated documents
- Different meanings of `available`, `partial` and `verified`
- Different industry cohorts
- Incorrect or overly broad acceptance-test mappings

Establish one canonical source of truth.

Generated documents must be produced by their existing generators. Never hand-edit generated output to manufacture agreement.

Add regression tests that fail if generated totals or status definitions drift.

# 7. PHASE D — CAPABILITY IMPLEMENTATION AND WIRING

Prioritize shared engines by the number of industries they unlock and the severity of business risk.

Do not build duplicate engines.

## D1. Inventory and product identity

Audit and complete:

- Variants and variant stock
- Variant-specific SKU and barcode
- Serial numbers
- Serial-to-purchase linkage
- Serial-to-sale linkage
- Warranty registration and claims
- Returns and serial disposition
- Batch and expiry
- FEFO
- Roll and partial-roll tracking
- Unit conversion and dual UOM
- Area, volume and tiered pricing

For every feature, prove the full chain from product creation to purchase, invoice, payment, stock effect, return, report and sync.

## D2. Gold and currency exchange

Audit and complete:

- Weight pricing
- Purity and karat
- Gross/net weight
- Making charges
- Metal rates
- Old-gold exchange
- Gold ledger
- Multi-currency settlement
- Currency exchange transactions
- Exchange profit
- Cash and bank settlement
- Reversal and reconciliation

Never use floating-point money.

Respect currency minor-unit rules. AFN has zero decimal places; never apply `/100` or `*100` to AFN.

Never create a separate accounting ledger for gold or exchange. Integrate with the canonical financial core.

## D3. Food and manufacturing

Audit and complete:

- Recipe/BOM
- Ingredient stock
- Production orders
- Material consumption
- Waste and spoilage
- Batch production
- Quality inspection
- Cost allocation
- Finished goods
- COGS
- Returns and reversal
- Offline behavior

Do not mark manufacturing ready merely because a work-order table or BOM calculation exists.

## D4. Service and capacity

Audit and complete:

- Service catalog
- Duration
- Appointment scheduling
- Resource capacity
- Conflict prevention
- Package credits
- Credit consumption
- Refund and cancellation
- Commission rules
- Staff scheduling
- Service delivery
- Repair queue and SLA
- Warranty claims
- Quality checks before repair delivery

Service credits and financial effects must be atomic and idempotent.

## D5. Project, construction and professional services

Audit and complete:

- Project cost objects
- Timesheet billing
- Employee time entries
- Contract recurrence
- Deposit liability
- Installments
- Project profitability
- Customer balances
- Supplier obligations

Profit must come from the canonical profit-report engine. Do not add a second formula.

## D6. Logistics and transport

Audit and complete:

- Trips and dispatch
- Driver assignment
- Delivery notes
- Proof of delivery
- COD collection
- COD reconciliation
- Driver settlement
- Fleet assets where required
- Route and shipment lifecycle
- Returns and failed delivery

Do not claim full logistics readiness if dispatch and proof-of-delivery are only online.

## D7. Regulated industries

For pharmacy, clinic, optical and financial exchange workflows:

- Identify all compliance and privacy dependencies.
- Do not invent legal requirements.
- Do not build clinical records, prescriptions, insurance claims or KYC as superficial CRUD.
- Do not enable regulated capabilities without a real permission, audit, access-control and retention design.
- Record owner decisions and external compliance blockers.
- Keep unsupported regulated capabilities hidden and blocked.

# 8. PHASE E — OFFLINE-FIRST COMPLETION

The offline matrix is a product contract, not a documentation decoration.

For each industry-specific action:

1. Identify whether it is device-first, server-first or explicitly online-only.
2. Verify the local-engine handler.
3. Verify the mutation identity and idempotency.
4. Verify outbox persistence.
5. Verify server confirmation and ID reconciliation.
6. Verify retry and crash recovery.
7. Verify cross-device pull.
8. Verify conflict resolution.
9. Verify financial parity between local and PostgreSQL execution.
10. Verify UI messaging when the action requires internet.

Financial conflict resolution must never use last-write-wins.

Do not silently delete or overwrite financial records.

Do not retry an unknown commit outcome blindly. Reconcile using the original mutation identity.

Do not claim an endpoint is offline-supported merely because a local route exists. The actual hook must select it and the sync path must preserve its result.

Update the offline matrix only after implementation and tests prove the behavior.

# 9. PHASE F — FINANCIAL AND DATA INTEGRITY

All industries must use the same canonical financial invariants:

- Double-entry ledger.
- Atomic posting.
- Immutable finalized financial records.
- Reversal rather than silent mutation.
- Idempotent writes.
- Currency-aware integer money units.
- Explicit unknown values.
- No unknown-to-zero conversion.
- Correct customer and supplier balances.
- Correct stock quantity and valuation.
- Correct COGS and profit.
- Correct multi-currency behavior.
- Tenant isolation and RLS.
- Audit trail for financial changes.

Test at least:

- Duplicate payment submission.
- Duplicate invoice submission.
- Payment allocation mismatch.
- Return after partial payment.
- Return after full payment.
- Deposit refund.
- Concurrent stock deduction.
- Concurrent serial sale.
- Concurrent batch sale.
- Unknown commit outcome.
- Offline retry after process restart.
- Two devices updating the same financial object.

Use existing domain cores and services. Never create parallel calculations.

# 10. PHASE G — ACCEPTANCE TESTS FOR ALL 67 INDUSTRIES

Inspect `sellable-criteria.mjs` and `coverage-data.mjs`.

The formal acceptance criteria must prove:

1. Workspace journey.
2. Onboarding journey.
3. First-value journey.
4. Industry-specific daily operations.
5. Reporting proof.
6. Offline gate proof.
7. Returns and reversal proof.
8. PostgreSQL journey.
9. Browser journey.
10. Honest product claims.

For every industry, the daily journey must represent its actual primary business operation, not a generic invoice test relabelled as industry-specific proof.

A passing test must genuinely execute its assertions.

A skipped PostgreSQL test must be recorded as skipped.

A test file that did not run must be `not_run`.

A test that only checks source strings must not prove runtime behavior.

Add or improve:

- Unit tests
- Domain tests
- API integration tests
- PostgreSQL journey tests
- Browser E2E tests
- Offline roundtrip tests
- Financial parity tests
- Permission and tenant isolation tests
- Migration idempotency tests

Each industry must have an acceptance journey appropriate to its operator.

Do not run live Supabase operations.

If local PostgreSQL or browser infrastructure is unavailable, report `BLOCKED_EXTERNAL` with the exact prerequisite. Never manufacture a pass.

# 11. PHASE H — COMMERCIAL CLASSIFICATION

After the source audit and implementation, classify every industry.

The result must distinguish:

- Standard universal-core businesses
- Specialized businesses with all required capabilities verified
- Specialized businesses with limitations
- Businesses missing a required capability
- Regulated businesses blocked by external compliance
- Generic `other` businesses

For each industry, explicitly state:

- What Hisabche can safely sell today.
- What the salesperson may promise.
- What the salesperson must not promise.
- What must be configured.
- What is online-only.
- What remains unsupported.
- What must be tested with a pilot customer.

Do not equate a pilot candidate with an officially sellable industry.

Do not classify a generic profile as a specialized industry.

Do not automatically assign `other` to retail, inventory or physical goods.

Commercial claims must be generated from the same canonical capability and acceptance evidence used by the application.

# 12. PHASE I — IMPLEMENTATION RULES

Work autonomously through all safe in-repository work.

For each confirmed defect:

1. Record the exact evidence.
2. Identify the canonical owner core.
3. Identify direct callers and dependencies.
4. Make the smallest safe correction.
5. Add regression tests.
6. Verify the actual result.
7. Update the appropriate source documents.
8. Report remaining blockers.

Prefer extending existing engines and adapters.

Do not create 67 duplicated industry implementations.

Do not change public API contracts without checking all consumers.

Do not add a new database table when an existing canonical model can safely represent the required behavior.

If a new table is genuinely necessary, generate an additive migration and a verification script. Never execute the migration against live Supabase.

Do not silently change existing persisted industry identifiers or reinterpret old profiles.

Do not make a risky financial or regulated-domain decision without owner approval.

If an owner decision is required, implement only the safe non-destructive work and mark the exact decision as `PENDING_OWNER_DECISION`.

# 13. PHASE J — VERIFICATION

Run the repository-approved relevant tests and type checks.

Do not run builds.

Run:

- Relevant package tests.
- Relevant TypeScript checks.
- Relevant ESLint checks.
- Industry registry parity checks.
- Capability consumer checks.
- Offline matrix guards.
- Industry documentation generators and `--check` commands where supported.
- Acceptance runner dry-run before full acceptance.

Run PostgreSQL and Browser acceptance only if the environment supports them.

Before finalizing:

- Inspect `git diff --check`.
- Inspect `git status --short`.
- Inspect `git diff --stat`.
- Confirm pre-existing dirty work was preserved.
- Confirm no secrets were read.
- Confirm no generated temporary files were left behind.
- Confirm the code-intel freshness state.

Do not commit or push.

Important: the acceptance runner may record the current commit and worktree state. If a clean committed tree is required but the owner has not committed the current changes, report that as an owner-controlled blocker. Never commit to make the evidence green.

# 14. REQUIRED DELIVERABLES

Create or update existing canonical documents rather than creating duplicate sources of truth.

Deliver:

## A. Executive verdict

- Exact current HEAD.
- Exact audit scope.
- Sellable count.
- Pilot count.
- Conditional count.
- Not offered count.
- External blockers.
- Evidence freshness.

## B. Complete 67-industry matrix

One row per registered ID.

Include:

- Industry name and key.
- Operator.
- Available capabilities.
- Partial capabilities.
- Planned capabilities.
- Actual route/service/UI evidence.
- Offline state.
- Acceptance result.
- Commercial status.
- Limitations.
- Exact file references.

## C. Capability completion matrix

For every shared capability:

- Canonical owner.
- Consumers.
- Implementation state.
- UI wiring.
- API wiring.
- Database state.
- Offline state.
- Tests.
- Remaining work.

## D. Canonical architecture map

Show the one shared business core, operators, adapters, resolvers, permissions, offline engine and database boundaries.

Explicitly prove that no duplicate accounting, inventory, sync, KPI or terminology engine was introduced.

## E. Financial integrity report

Document the real posting, reversal, reconciliation, currency and offline invariants.

## F. Offline readiness report

Use the actual endpoint matrix and execution evidence. Distinguish device-first, online-only and unsupported.

## G. Security and regulated-domain report

Include permissions, RLS, tenant isolation, audit, data retention and external dependencies.

## H. Test evidence report

Separate:

- Tests passed
- Tests failed
- Tests skipped
- Tests not run
- PostgreSQL blocked
- Browser blocked
- Runtime/device not verified
- Production not verified

## I. Remediation log

For every defect:

- Priority P0/P1/P2/P3
- Source file
- Root cause
- Fix
- Tests
- Remaining limitation

## J. Final commercial recommendation

List which industries can be sold with no special limitations, which require a limited pilot, which must not be offered yet, and why.

## K. Owner decision register

List only decisions that genuinely require human authorization.

# 15. DEFINITION OF DONE

The mission is complete only when:

- All 67 industry keys are accounted for.
- The 67 rows agree with the source registry.
- All capability statuses come from one canonical source.
- No generated document contradicts the registry.
- No duplicate business core exists.
- Every claimed feature has a real UI-to-domain execution path.
- Every financial action preserves the canonical accounting invariants.
- Offline claims match actual local execution and sync behavior.
- Every industry has a truthful commercial classification.
- Tests are accurately recorded.
- PostgreSQL and Browser blockers are explicitly identified.
- No unverified production claims are made.
- The final diff preserves the owner's existing work.

# 16. FINAL REPORT FORMAT

Write the final report in Persian.

Start with one exact verdict:

`SELLABILITY_COMPLETE`

`SELLABILITY_COMPLETE_WITH_LIMITATIONS`

`IMPLEMENTATION_COMPLETE_BUT_ACCEPTANCE_BLOCKED`

`PARTIALLY_IMPLEMENTED`

`BLOCKED_EXTERNAL`

`CRITICAL_INTEGRITY_FAILURE`

Do not select `SELLABILITY_COMPLETE` unless all required industry acceptance and commercial evidence genuinely passes.

End with:

1. The exact number of industries that can be sold.
2. The exact number that can be offered only with limitations.
3. The exact number that must not be sold yet.
4. The five highest-priority remaining gaps.
5. The exact tests and commands executed.
6. The owner actions required.
7. A concise architecture diagram showing the canonical core and industry operators.

Proceed autonomously through safe repository work. Do not stop merely because the audit reveals more work than expected. Do not fabricate success when an external blocker prevents verification.
