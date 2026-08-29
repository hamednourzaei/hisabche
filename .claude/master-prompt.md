# ================================================================

# HISABCHE — MASTER ENGINEERING & PRODUCT DIRECTIVE

# VERSION 22.0 — ULTIMATE / FINAL CONSTITUTION

# ================================================================

#

# ADAPTIVE ENTERPRISE BUSINESS OPERATING SYSTEM

#

# CONSTITUTION

# + EXECUTION

# + SCOPE FIREWALL

# + CAPABILITY CONTRACT

# + PRODUCTION PRESERVATION

# + INCREMENTAL DELIVERY

# + DEPLOY AUTHORITY

# + EVIDENCE-FIRST ENGINEERING

#

# ================================================================

#

# CORE PHILOSOPHY

#

# DESIGN FOR THE WHOLE

# BUILD ONLY WHAT IS REQUIRED NOW

# PROTECT WHAT ALREADY WORKS

# MAKE BOUNDARIES EXTENSIBLE

# NEVER IMPLEMENT SPECULATION

# TEST THE SLICE COMPLETELY

# SHIP IT

# OBSERVE IT

# THEN BUILD THE NEXT SLICE

#

# ================================================================

# ================================================================

# 0. MISSION

# ================================================================

You are working on the **Hisabche monorepo**.

Hisabche is a production financial/business SaaS.

Your mission is NOT to make Hisabche a larger ERP.

Your mission is to build:

# THE MOST COHERENT ADAPTIVE BUSINESS OPERATING SYSTEM POSSIBLE

Hisabche must be:

- simple for a small merchant
- powerful for a growing business
- structurally capable of serving enterprise organizations
- financially correct
- secure
- reconstructable
- observable
- incrementally releasable

The complexity of the system must exist primarily in the **domain model and infrastructure**, not in the user's initial experience.

```text
CAPABILITY MUST SCALE UP.
CLIENT COMPLEXITY MUST SCALE DOWN.

EVERY COMPLETED CAPABILITY MUST BE ABLE TO SHIP.

FUTURE ARCHITECTURE MUST NEVER BECOME PRESENT SCOPE.

EXISTING PRODUCTION MUST BE PRESERVED.

EVIDENCE MUST SCALE WITH CLAIMS.
```

The system must converge toward:

```text
ONE AUTHORITATIVE BUSINESS SYSTEM
ONE FINANCIAL TRUTH
ONE SECURITY MODEL
ONE DATA MODEL
ONE SYNC MODEL
ONE ADAPTIVE EXPERIENCE
ONE DESIGN SYSTEM
ONE i18n SYSTEM
```

Never optimize for checkbox completion.  
Never build the future merely because the architecture describes it.  
Never wait for the entire platform before releasing useful capabilities.  
Never sacrifice correctness for speed.  
Never sacrifice releaseability for theoretical completeness.  
Never sacrifice working production for architectural elegance.

# ================================================================

# 1. NORTH STAR — THE SEVEN LAWS OF DELIVERY

# ================================================================

```text
1. SMALL SCOPE
   Build the smallest useful domain capability.

2. FULL QUALITY
   Small scope never means incomplete security,
   integrity, validation, testing, migration safety,
   observability, or recoverability.

3. PRODUCTION PRESERVATION
   Existing working behavior is an asset.
   Do not break it to build the future.

4. FUTURE-PROOF BOUNDARIES
   Design contracts and ownership boundaries for extension,
   but do not implement future behavior without a current need.

5. IMMEDIATE RELEASE
   A completed capability must be independently releasable.

6. EVIDENCE FIRST
   Claims must be supported by repository, database,
   test, runtime, or production evidence.

7. CONTINUOUS DELIVERY
   Build → Verify → Release → Observe → Learn → Next Slice.
```

The governing philosophy is:

```text
DESIGN FOR THE WHOLE
        ↓
BUILD ONLY THE NECESSARY PART
        ↓
PROTECT EXISTING PRODUCTION
        ↓
MAKE THE BOUNDARY EXTENSIBLE
        ↓
TEST THE SLICE COMPLETELY
        ↓
SHIP IT
        ↓
OBSERVE IT
        ↓
BUILD THE NEXT SLICE
```

# ================================================================

# 2. CONSTITUTION VS PROJECT STATE VS CAPABILITY

# ================================================================

This document is the **permanent engineering Constitution**.

It is NOT a task checklist that must be blindly executed in full for every change.

The execution hierarchy is:

```text
MASTER CONSTITUTION
        ↓
PROJECT STATE
        ↓
ACTIVE CAPABILITY
        ↓
CAPABILITY CONTRACT
        ↓
IMPLEMENTATION
        ↓
VERIFICATION
        ↓
RELEASE
```

Three levels must never be confused:

### CONSTITUTION

Permanent laws.

### PROJECT STATE

What is actually true about the current repository.

Includes:

```text
.claude/
HANDOFF.md
PROJECT_STATE.md
phase logs
migration state
architecture records
known risks
current production state
```

### CAPABILITY

The single bounded unit currently being built.

The agent must never treat the entire product roadmap as the current task.

# ================================================================

# 3. EXECUTION ARCHITECTURE — MANDATORY

# ================================================================

Every capability follows:

```text
PROJECT STATE
      ↓
CAPABILITY CONTRACT
      ↓
SCOPE FIREWALL
      ↓
AUDIT
      ↓
DESIGN
      ↓
IMPLEMENT
      ↓
VERIFY
      ↓
TEST
      ↓
ATTACK
      ↓
MEASURE
      ↓
DOCUMENT
      ↓
PRODUCTION-READY
      ↓
AUTHORIZED DEPLOY
      ↓
POST-DEPLOY VERIFY
      ↓
RELEASED + VERIFIED
      ↓
NEXT CAPABILITY
```

The agent MUST NOT skip the Capability Contract.  
The agent MUST NOT implement before scope is established.  
The agent MUST NOT expand scope silently.  
The agent MUST NOT classify a capability as production-ready without evidence.

# ================================================================

# 4. SESSION START PROTOCOL

# ================================================================

Before implementation:

1. Read the relevant `.claude/` rules.
2. Read `HANDOFF.md`.
3. Read `PROJECT_STATE.md` if present.
4. Read the latest relevant phase/capability logs.
5. Run:

```bash
git status
git stash list
git branch --show-current
git log -1 --oneline
```

6. Discover the repository's real:

```text
branch workflow
PR workflow
CI workflow
migration workflow
deployment workflow
production environment workflow
```

Never invent a workflow.

7. Identify exactly ONE active capability.
8. Determine its current production status.
9. Create or validate its Capability Contract.
10. Only inspect the code required to establish the capability boundary.

Do not begin implementation from assumptions.

# ================================================================

# 5. CAPABILITY CONTRACT — MANDATORY BEFORE IMPLEMENTATION

# ================================================================

Every capability MUST begin with a Capability Contract.

The contract must contain:

```text
CAPABILITY:
<name>

BUSINESS PURPOSE:
<why this capability exists>

REQUIRED NOW:
<minimum functionality required for this capability>

REQUIRED BOUNDARY:
<interfaces/contracts/schema ownership needed for safe future extension>

FUTURE:
<known future capabilities explicitly NOT implemented now>

OUT OF SCOPE:
<everything intentionally excluded from this capability>

DO NOT TOUCH:
<existing systems/files/behaviors that must remain unchanged unless
evidence proves they must change>

DOMAIN OWNER:
<authoritative domain owner>

SOURCE OF TRUTH:
<authoritative state>

DEPENDENCIES:
<only actual dependencies>

DATABASE IMPACT:
<expected schema/migration changes>

API IMPACT:
<expected API changes>

AUTHORIZATION IMPACT:
<expected security changes>

UI IMPACT:
<expected UI changes>

OFFLINE/SYNC IMPACT:
<if applicable>

AUDIT IMPACT:
<if applicable>

OBSERVABILITY:
<required signals>

TEST STRATEGY:
<required tests>

ROLLBACK / RECOVERY:
<how failure is recovered>

DEPLOYMENT IMPACT:
<how it reaches production>

POST-DEPLOY VERIFICATION:
<what must be checked>

CHANGE BUDGET:
EXPECTED FILES CHANGED:
EXPECTED DATABASE TABLES CHANGED:
EXPECTED MIGRATIONS:
EXPECTED NEW API ENDPOINTS:
EXPECTED NEW DOMAIN CONCEPTS:
EXPECTED EXISTING BEHAVIOR CHANGES:
EXPECTED NEW TESTS:
EXPECTED DEPLOYMENT IMPACT:

BLAST RADIUS:
DIRECTLY AFFECTED:
INDIRECTLY AFFECTED:
POTENTIAL PRODUCTION BEHAVIOR CHANGES:
MIGRATION RISK:
SECURITY RISK:
FINANCIAL RISK:
SYNC/OFFLINE RISK:
ROLLBACK COMPLEXITY:

STATUS:
<current status>
```

Implementation MUST remain inside this contract unless a Scope Change Gate is triggered.

# ================================================================

# 6. SCOPE FIREWALL — NOW / BOUNDARY / FUTURE / OUT OF SCOPE

# ================================================================

Every capability has four scopes:

```text
REQUIRED NOW
REQUIRED BOUNDARY
FUTURE
OUT OF SCOPE
```

## REQUIRED NOW

Must exist for this capability to be production-safe.

## REQUIRED BOUNDARY

Only the contracts required so that future capabilities can extend the system safely.

Examples:

```text
interface
domain boundary
extension point
schema compatibility
stable API contract
event contract
ownership boundary
```

Do NOT implement future business behavior merely to establish a boundary.

## FUTURE

Known future functionality.  
It must NOT be implemented now unless it becomes an actual dependency of REQUIRED NOW.

## OUT OF SCOPE

Anything not necessary for the capability.

The agent must not opportunistically implement:

```text
cleanup
unrelated refactors
future UI
future reports
future engines
future integrations
future workflows
future optimization
architectural rewrites
```

unless evidence proves they are required by the active capability.

# ================================================================

# 7. FUTURE-PROOF DOES NOT MEAN FUTURE-BUILD

# ================================================================

```text
FUTURE-PROOF ≠ FUTURE-IMPLEMENTED
```

The agent may:

```text
design a stable boundary
define an extension point
choose a compatible data model
avoid locking future behavior out
```

The agent must NOT:

```text
build unused abstractions
build unused engines
build speculative tables
build speculative APIs
build speculative UI
build speculative workflows
build future integrations
build future business rules
```

unless required by the active capability.

### No speculative abstraction

Do not create abstractions solely because:

> "we might need this later."

An abstraction requires a real current consumer, unless the abstraction is necessary to preserve an already-established domain boundary.

Prefer:

```text
ONE REAL USE CASE
        ↓
SMALLEST CORRECT ABSTRACTION
```

over:

```text
IMAGINARY FUTURE REQUIREMENTS
        ↓
GENERIC FRAMEWORK
        ↓
UNUSED COMPLEXITY
```

# ================================================================

# 8. CHANGE BUDGET — MANDATORY

# ================================================================

Before implementation, estimate:

```text
EXPECTED FILES CHANGED:
EXPECTED DATABASE TABLES CHANGED:
EXPECTED MIGRATIONS:
EXPECTED NEW API ENDPOINTS:
EXPECTED NEW DOMAIN CONCEPTS:
EXPECTED EXISTING BEHAVIOR CHANGES:
EXPECTED NEW TESTS:
EXPECTED DEPLOYMENT IMPACT:
```

This is a planning budget, not a rigid numerical limit.

If implementation materially exceeds the expected scope:

```text
STOP
↓
EXPLAIN WHY
↓
REASSESS SCOPE
↓
UPDATE CAPABILITY CONTRACT
↓
CONTINUE ONLY IF JUSTIFIED
```

Unexpected scope expansion is evidence that the original boundary may be wrong.  
Do not silently continue.

# ================================================================

# 9. BLAST RADIUS ANALYSIS

# ================================================================

Before changing shared or financial infrastructure, identify:

```text
DIRECTLY AFFECTED:
INDIRECTLY AFFECTED:
POTENTIAL PRODUCTION BEHAVIOR CHANGES:
MIGRATION RISK:
SECURITY RISK:
FINANCIAL RISK:
SYNC/OFFLINE RISK:
ROLLBACK COMPLEXITY:
```

The larger the blast radius, the stronger the evidence and regression coverage required.

A small capability MUST NOT justify a large blast radius unless unavoidable and proven necessary.

# ================================================================

# 10. GIT SAFETY + BRANCH PROTECTION

# ================================================================

NEVER:

```bash
git reset --hard
git checkout -- .
git clean
git stash pop
git stash drop
```

Never destroy uncommitted user work.  
Never overwrite unrelated changes.  
Never push directly to a production branch unless the repository's established workflow explicitly requires it.

Prefer:

```text
feature branch
    ↓
tests
    ↓
PR
    ↓
CI
    ↓
review
    ↓
merge
    ↓
deployment pipeline
```

But always follow the repository's actual workflow.  
Do not assume GitHub Flow.

# ================================================================

# 11. EVIDENCE-FIRST ENGINEERING

# ================================================================

Evidence classes:

```text
FACT
OBSERVED
INFERRED
PROPOSED
UNVERIFIED
```

Rules:

```text
PROPOSED ≠ IMPLEMENTED
TESTED ≠ PRODUCTION-PROVEN
PRODUCTION-READY ≠ DEPLOYED
DEPLOYED ≠ VERIFIED
```

Every capability records:

```text
INSPECTED
FOUND
CHANGED
VERIFIED
UNVERIFIED
COMMANDS
RESULTS
RISKS
DECISIONS
```

Never fabricate evidence.  
Never infer production health from local tests.  
Never claim a migration is safe without verification evidence.

# ================================================================

# 12. NON-NEGOTIABLE LAWS

# ================================================================

1. NEVER delete production/business data.
2. NEVER guess schema relationships.
3. NEVER trust stale documentation over actual code/database.
4. NEVER fabricate financial values.
5. NEVER silently merge business records.
6. NEVER weaken RLS or authorization.
7. NEVER use UI hiding as security.
8. NEVER trust client-supplied tenancy identifiers.
9. NEVER trust client-calculated financial totals or permissions.
10. NEVER allow personalization to grant authorization.
11. NEVER allow realtime or local state to become financial truth.
12. NEVER allow timestamps alone to determine sync order.
13. NEVER use blind last-write-wins for financial mutations.
14. NEVER mutate finalized accounting history directly.
15. Corrections MUST use controlled reversal / adjustment / amendment / correction.
16. Every retryable mutation MUST be idempotent.
17. Every important derived financial value MUST be reconstructable.
18. Every financial state transition MUST be auditable.
19. Every authorization decision MUST be explainable.
20. Every synchronization mutation MUST be traceable.
21. Every migration MUST have a recovery strategy.
22. Every production-readiness claim MUST have evidence.
23. No feature is complete merely because its UI exists.
24. No API is complete merely because it returns 200.
25. No financial engine is complete without invariant tests.
26. No authorization engine is complete without adversarial deny-path tests.
27. No sync engine is complete without crash/retry/reorder/conflict tests.
28. No performance claim is valid without measurement.
29. No scalability claim is valid without load evidence.
30. No AI answer is valid without authoritative source data.
31. Restricted data MUST NEVER enter unauthorized channels.
32. ONE accounting · ONE inventory/cost · ONE payment · ONE profit · ONE tax · ONE authorization · ONE workflow · ONE sync · ONE personalization · ONE i18n · ONE design system.
33. No duplicate domain truths.
34. No temporary production-unsafe implementations.
35. Unrelated incomplete modules must never block an otherwise production-ready capability.
36. Future architecture must never become present scope.
37. Never implement future capabilities merely because they appear in this Constitution.
38. PRODUCTION-READY is not deployment authorization.
39. Existing production behavior must not be changed without evidence and regression protection.
40. No speculative abstraction without a real current need.
41. No unrelated refactor inside a capability.
42. No silent scope expansion.
43. No production migration outside the established migration workflow.
44. No deployment outside the established deployment authority/workflow.
45. No "cleanup" disguised as feature work.

# ================================================================

# 13. INCREMENTAL PRODUCTION DELIVERY

# ================================================================

Hisabche is built as a sequence of independently releasable capabilities.

```text
BIG VISION
    ↓
ONE SMALL CAPABILITY
    ↓
CAPABILITY CONTRACT
    ↓
SCOPE FIREWALL
    ↓
SELF-CONTAINED IMPLEMENTATION
    ↓
MIGRATION-SAFE
    ↓
BACKWARD COMPATIBLE
    ↓
SECURITY VERIFIED
    ↓
TESTED
    ↓
OBSERVABLE
    ↓
RECOVERABLE
    ↓
PRODUCTION-READY
    ↓
AUTHORIZED DEPLOY
    ↓
POST-DEPLOY VERIFICATION
    ↓
RELEASED + VERIFIED
    ↓
NEXT CAPABILITY
```

Never accumulate unrelated completed capabilities for a giant release.

Prefer:

```text
Small Capability → Verify → Release → Observe → Next Capability
```

over:

```text
20 Features → Massive Release → Difficult Diagnosis → Difficult Rollback
```

# ================================================================

# 14. VERTICAL SLICE RULE

# ================================================================

Prefer vertical slices.

BAD:

```text
Entire Accounting Infrastructure
→ Entire Payment Infrastructure
→ Entire Inventory
→ Eventually connect everything
```

GOOD:

```text
Customer Payment
    ↓
Domain
    ↓
DB
    ↓
Existing Accounting Engine
    ↓
Authorization
    ↓
API
    ↓
UI
    ↓
Audit
    ↓
Tests
    ↓
Observability
    ↓
Production
```

Then:

```text
Supplier Payment
    ↓
Reuse existing Payment Engine
    ↓
Extend only required behavior
    ↓
Production
```

Every slice MUST reuse authoritative existing engines.  
Never create parallel engines.

# ================================================================

# 15. CAPABILITY ISOLATION

# ================================================================

A capability must not depend on unrelated unfinished modules.

Allowed:

```text
Feature A → Shared Kernel
Feature A → Stable Existing Feature B Contract
```

Forbidden:

```text
Feature A → Unfinished Feature B Internals
```

If an unfinished dependency is unavoidable:

1. Define a stable interface.
2. Implement a production-safe adapter.
3. Make the dependency explicit.
4. Keep the capability independently deployable.
5. Record the boundary in project state.

# ================================================================

# 16. PRODUCTION-FIRST ARCHITECTURE

# ================================================================

Every implementation must be safe as if it will run in production today.

Forbidden:

```text
temporary authorization
temporary tenant isolation
temporary financial calculation
temporary database model
temporary audit omission
temporary idempotency omission
temporary migration safety
temporary security bypass
temporary duplicate engine
```

Instead:

```text
SMALLEST CORRECT PRODUCTION IMPLEMENTATION
```

Scope may be limited.  
Quality may not be temporary.

# ================================================================

# 17. PRODUCTION COMPLETENESS

# ================================================================

A capability is DONE only when it is production-safe within its defined scope.

Required:

```text
Domain ownership
Source of truth
Scope Firewall
Database constraints
Migration safety
Backward compatibility
API contract
Authorization
Tenant isolation
RLS where applicable
Audit
Idempotency where applicable
Validation
Error handling
Loading state
Empty state
Error state
Offline state where applicable
i18n
RTL
Accessibility
Responsive behavior
Design system compliance
Existing engine reuse
Unit tests
Integration tests
Security deny-path tests
Regression tests
Migration verification
Observability
Performance measurement where relevant
Rollback/recovery strategy
Documentation
HANDOFF
Production verification plan
```

Applicable systems additionally require:

```text
Offline
Sync
Conflict handling
Queue/outbox
Realtime
Background jobs
AI boundaries
Export authorization
Search authorization
```

Only then:

```text
PRODUCTION-READY
```

# ================================================================

# 18. PRODUCTION STATUS MODEL

# ================================================================

Allowed statuses:

```text
NOT STARTED
DESIGNING
IMPLEMENTING
VERIFYING
PRODUCTION-READY
DEPLOYING
RELEASED
RELEASED + VERIFIED
BLOCKED
```

Never use:

```text
almost done
basically complete
mostly finished
should work
probably safe
```

Evidence determines status.

# ================================================================

# 19. PRODUCTION-READY ≠ DEPLOYED

# ================================================================

These are separate states.

```text
PRODUCTION-READY
    =
code + data + security + tests + recovery are ready

DEPLOYED
    =
the authorized production workflow actually deployed it

RELEASED + VERIFIED
    =
deployed + post-deployment evidence confirms healthy behavior
```

The agent MUST NOT assume production deployment authority.

It may deploy only when:

```text
explicit task authority
OR
repository's established CI/CD workflow
```

allows it.

Never:

```text
assume permission
bypass CI
bypass review
run unsafe production migration
push directly to production
```

unless the established workflow explicitly requires it.

# ================================================================

# 20. EXISTING PRODUCTION PRESERVATION

# ================================================================

Existing working behavior is part of the product's value.

A capability MUST NOT change existing production behavior unless:

1. Evidence shows the change is required.
2. Existing behavior has regression coverage.
3. The intended behavior change is documented.
4. Migration/data impact is understood.
5. Rollback or compensating recovery is defined.

Prefer:

```text
ADD
EXTEND
ADAPT
MIGRATE SAFELY
```

over:

```text
REWRITE
REPLACE
DELETE
```

unless evidence proves replacement necessary.

Never sacrifice working production merely for architectural cleanliness.

# ================================================================

# 21. SCOPE CHANGE GATE

# ================================================================

If implementation reveals that the capability needs functionality outside its contract:

```text
STOP
    ↓
IDENTIFY NEW REQUIREMENT
    ↓
CLASSIFY:
  REQUIRED NOW?
  REQUIRED BOUNDARY?
  FUTURE?
  OUT OF SCOPE?
    ↓
ANALYZE BLAST RADIUS
    ↓
UPDATE CAPABILITY CONTRACT
    ↓
RE-EVALUATE CHANGE BUDGET
    ↓
CONTINUE ONLY IF JUSTIFIED
```

Never silently expand scope.

A new dependency is not automatically a reason to build an entire new subsystem.

Ask:

```text
Can the current capability use an existing contract?
Can a small adapter solve it?
Can the boundary remain explicit?
Can the future capability remain unimplemented?
```

Prefer the smallest safe solution.

# ================================================================

# 22. DATABASE EVOLUTION

# ================================================================

Prefer:

```text
EXPAND
→ COMPATIBILITY
→ BACKFILL
→ VERIFY
→ CONTRACT
```

Avoid destructive migration when additive migration is sufficient.

Avoid:

```text
DROP COLUMN
RENAME COLUMN
INCOMPATIBLE TYPE CHANGE
DELETE ENUM VALUE
BREAK OLD CLIENT
```

unless explicitly justified and safely migrated.

Every migration requires:

```text
Precondition
Migration
Backfill if applicable
Compatibility
Verification
Recovery
Postcondition
```

Database rollback must never mean blindly reversing business data mutations.

Prefer:

```text
Forward-compatible schema
+
Compensating business operation
+
Audit trail
+
Deterministic reconstruction
```

# ================================================================

# 23. API EVOLUTION

# ================================================================

Prefer backward-compatible API evolution.

Old clients and new servers may coexist.

Prefer:

```text
additive fields
optional fields
tolerant readers
versioned behavior
compatibility adapters
```

Never knowingly break deployed clients without an explicit migration plan.

# ================================================================

# 24. ZERO-DOWNTIME ASSUMPTION

# ================================================================

Assume deployments may temporarily contain:

```text
old application
+
new application
+
old clients
+
new clients
```

Therefore:

```text
database
API
queues
sync payloads
realtime events
cached projections
```

must tolerate mixed versions where applicable.

# ================================================================

# 25. ROLLBACK + RECOVERY CONTRACT

# ================================================================

Every capability must define:

```text
What can fail?
What has already mutated?
Can application code be rolled back?
Can schema be rolled back?
Can data be reconstructed?
Can queues be replayed?
Can projections be rebuilt?
Can clients recover?
What compensating operation is required?
```

Rollback must be deterministic and auditable.

Never assume:

```text
git revert = data rollback
```

They are different concerns.

# ================================================================

# 26. BUSINESS KERNEL

# ================================================================

Everything must reuse:

```text
Identity
Tenancy
Organization
Company
Branch
Warehouse
Location
Party
Item
Product
Variant
Unit
Document
Accounting
Inventory
Costing
Payment
Receivable
Payable
Profit
Tax
Asset
Project
Workflow
Authorization
Audit
Event
Notification
Sync
Personalization
```

No module may invent another version of these concepts.

# ================================================================

# 27. BUSINESS EVENT → AUTHORITATIVE STATE

# ================================================================

```text
USER INTENT
→ VALIDATION
→ AUTHORIZATION
→ BUSINESS RULES
→ ATOMIC DOMAIN TRANSACTION
→ AUTHORITATIVE STATE
→ ACCOUNTING / INVENTORY / PAYMENT EFFECTS
→ AUDIT EVENT
→ OUTBOX / DOMAIN EVENT
→ ASYNC PROJECTIONS
→ UI
```

The UI is never the source of truth.

# ================================================================

# 28. MASTER DOCUMENT GRAPH

# ================================================================

Documents must be graph-connected.

Lifecycle:

```text
DRAFT → SUBMIT → APPROVE → POST → SETTLE → FINALIZE
```

Corrections:

```text
CANCEL
REVERSE
ADJUST
AMEND
CORRECT
```

No silent historical mutation.

# ================================================================

# 29. ACCOUNTING KERNEL — FINANCIAL GRADE

# ================================================================

ONE accounting engine.

Mandatory where applicable:

```text
Chart of Accounts
Journals
Journal Entries
General Ledger
Trial Balance
P&L
Balance Sheet
Cash Flow
Fiscal Periods
Closing
Controlled Reopening
Dimensions
Cost Centers
Multi-currency
Exchange Rates
FX Gains/Losses
Accruals
Prepayments
Receivables
Payables
Tax
Intercompany
Consolidation
```

Absolute invariant:

```text
SUM(DEBIT) = SUM(CREDIT)
```

Additional invariants:

- Posted journal cannot become unbalanced.
- Finalized period cannot be modified without controlled reopening.
- Posted financial document must have traceable journal impact.
- Every journal entry must have deterministic origin.
- Every reversal must reference its origin.
- Every financial balance must be reconstructable from immutable entries.

No UI calculation can override server accounting.

# ================================================================

# 30. ACCOUNTING RECONSTRUCTION + RECONCILIATION

# ================================================================

Must reconstruct:

```text
Document
→ Business Event
→ Accounting Entries
→ Inventory Entries
→ Payment Allocation
→ Tax Impact
→ Profit Impact
→ Audit Trail
```

Reconciliation modes:

```text
Document ↔ Ledger
Inventory ↔ Ledger
Payments ↔ Receivables
Payments ↔ Payables
Tax ↔ Ledger
Profit ↔ Revenue + Cost
Branch ↔ Company
Company ↔ Consolidation
Local ↔ Server
Projection ↔ Source
```

Reconciliation must DETECT.  
It must NOT silently repair.

# ================================================================

# 31. INVENTORY + COSTING + COST LINEAGE

# ================================================================

ONE inventory/cost engine.

Support architecture for:

```text
FIFO
Moving Average
Standard Cost
Actual Cost
Specific Identification
Serial
Batch/Lot
Expiry
FEFO
Landed Costs
Manufacturing cost
Labor
Overhead
Adjustments
Returns
Transfers
Negative stock policy
Backdated movements
Revaluation
```

Critical distinction:

```text
PICKING STRATEGY ≠ VALUATION METHOD
```

Costing must preserve historical lineage.

Never:

```text
Sale today → current product price → historical COGS
```

Instead:

```text
Inventory Movement
→ Cost Layer / Cost Basis
→ Consumption
→ COGS
→ Remaining Inventory Value
```

Every material cost must be traceable. No unexplained cost.

# ================================================================

# 32. BACKDATED TRANSACTION ENGINE

# ================================================================

Define where applicable:

```text
Effective Date
Posting Date
Creation Timestamp
Sequence
Fiscal Period
Accounting Impact
Costing Impact
Recalculation Boundary
Reconciliation State
```

Never silently rewrite history.

If recalculation is required:

```text
DETECT → LOCK → RECOMPUTE → RECONCILE → AUDIT → RELEASE
```

# ================================================================

# 33. PAYMENT + PROFIT + TAX

# ================================================================

ONE Payment Engine.

Possible methods include:

```text
Cash · Card · Bank · Transfer · Cheque · Installment
Credit · Advance · Partial · Allocation · Settlement
Refund · Chargeback · Unallocated
```

But only required behavior is implemented per capability.  
No payment may disappear between payment and allocation.

ONE Profit Engine:

```text
Revenue − Actual Recognized Cost − Authorized Relevant Costs
```

Must preserve lineage.

ONE Tax Engine:

```text
Jurisdiction + Effective Date + Type + Rate/Formula
+ Eligibility + Exemption + Rounding + Accounting Treatment
```

Historical documents must be reproducible from the transaction's tax configuration snapshot.  
Never hardcode tax logic into invoice UI.

# ================================================================

# 34. MULTI-CURRENCY + MULTI-ENTITY

# ================================================================

Where applicable, support:

```text
Transaction Currency
Functional Currency
Reporting Currency
Rate Source
Rate Snapshot
FX Gain/Loss
Historical Rate Preservation
```

Never recompute historical documents using today's rate.

Entity hierarchy:

```text
Platform → Workspace → Organization → Company → Branch → Warehouse → Location
```

Every cross-entity operation must declare its scope.

# ================================================================

# 35. ZERO-TRUST AUTHORIZATION + TENANCY

# ================================================================

Authorization must consider:

```text
WHO + ACTION + RESOURCE + RECORD + FIELD + SCOPE + CONDITIONS + STATE + CONTEXT
```

Field states may include:

```text
VISIBLE · READ_ONLY · MASKED · REDACTED · HIDDEN · FORBIDDEN
```

Explicit DENY wins.

Authorization must be enforced across:

```text
Database · RLS · Repository · Service · API · Projection
Export · Search · Filter · Cache · Realtime · Sync
Local DB · Jobs · AI
```

Never use UI hiding as authorization.

# ================================================================

# 36. OFFLINE-FIRST + SYNC

# ================================================================

Where offline functionality exists:

```text
UI → Local DB → Durable Outbox → Mutation ID → Server
→ Authoritative DB → Change Log → Cursor → Delta Sync → Local DB
```

Rules:

```text
Server is authoritative.
Outbox is durable.
Mutations are idempotent.
Cursor is monotonic.
Sync is resumable, crash-safe, and observable.
```

Never use timestamp-only ordering.  
Never use blind last-write-wins for financial mutations.  
Unauthorized data must never be downloaded merely because the device is offline.

# ================================================================

# 37. ADAPTIVE UX + PERSONALIZATION

# ================================================================

Runtime pipeline:

```text
Authorization → Entitlement → Business Context → Feature Flag
→ Workspace Defaults → Role Defaults → User Defaults
→ Device → Network → Performance Mode → Render
```

Authorization is always first. `DENY → STOP`.  
Personalization has ZERO authorization power.

Support where appropriate:

```text
Show/Hide · Reorder · Density · Focus Mode · Saved Views
Defaults · Widgets · Shortcuts · Progressive Disclosure
```

Small merchants should see the minimum useful complexity.  
Advanced functionality appears when needed.

# ================================================================

# 38. ADAPTIVE RUNTIME

# ================================================================

Runtime cost should scale with:

```text
Visible Features + Context + Authorization + Device + Network + Current Task
```

not total product size.

Hidden modules should not unnecessarily mount, fetch, subscribe, initialize charts, run timers, or execute background work.

Device intelligence may affect prefetch, animation, sync concurrency, cache strategy, rendering — but NEVER authorization, financial logic, security, or tenant isolation.

# ================================================================

# 39. UI + DESIGN SYSTEM + i18n

# ================================================================

Use the existing design system.

Approved patterns include:

```text
Card · Master–Detail · Kanban · Timeline · Accordion · Split View
Stepper · Widget Grid · Command Center · Tree · Data Table
Calendar · Activity Feed · Comparison View · Reconciliation View
```

Do not invent unnecessary patterns.

Financial numbers require: precision preservation, tabular figures, locale-aware formatting, currency, sign.  
Never round for UI convenience.

Mobile: Body ≥ 16px, Line-height ≥ 1.5, Touch target ≥ 44px, WCAG AA, RTL correctness.  
No critical hover-only interaction.

Exactly ONE i18n system.  
Exactly ONE design system.  
No hardcoded strings.  
No hardcoded design values where design tokens should be used.

# ================================================================

# 40. SEARCH + REPORTING + LINEAGE

# ================================================================

Search must be: Authorization-aware, Tenant-aware, Scope-aware, Field-aware.

Never: search everything → filter unauthorized results in UI.

Reports distinguish: SOURCE · DERIVED · AGGREGATED · ESTIMATED · FORECAST.

Every important KPI must answer: WHERE DID THIS NUMBER COME FROM?  
with an authorized provenance/drill-down path.

# ================================================================

# 41. WORKFLOW + SoD + AUDIT + EVENTS

# ================================================================

Workflow defines state.  
Authorization defines who may act.  
They are independent.

Support where required: Approval, Conditions, Delegation, Escalation, SLA, Rejection, Rework, Segregation of Duties.

Audit must capture where applicable: Actor, Action, Resource, Record, Before, After, Timestamp, Request ID, Correlation ID, Tenant, Company, Branch, Source, Reason, Authorization Decision.

Financial audit trails are immutable.  
Authoritative transactions complete before dependent async side effects are considered successful.

# ================================================================

# 42. IDEMPOTENCY + API CONTRACTS + DATABASE

# ================================================================

Retryable mutations require:

```text
idempotency_key + actor + scope + operation + request fingerprint + result
```

Same key + same request → return original result.  
Same key + different request → REJECT.

APIs must explicitly define: Authentication, Authorization, Tenant, Input/Output/Error schema, Idempotency, Pagination, Sorting, Filtering, Rate limiting, Audit, Caching.

Prefer database enforcement: FK, UNIQUE, CHECK, PARTIAL INDEX, RLS, TRANSACTION, IMMUTABILITY.

# ================================================================

# 43. OBSERVABILITY + PERFORMANCE + RECOVERY

# ================================================================

Trace important operations using: request_id, correlation_id, actor_id, tenant_id, operation, duration, result, error.

Measure where relevant: p50, p95, p99, error rate, availability, queue health, database health, sync health, reconciliation health.

Performance claims require measurement.  
Scalability claims require load evidence.  
Backups are not considered valid until restoration is tested.

# ================================================================

# 44. TESTING PHILOSOPHY

# ================================================================

Testing must prove the capability, not merely execute code.

Required where applicable:

```text
Unit · Integration · Contract · Database · RLS · Authorization
Financial Golden · Property-Based · E2E · Offline · Sync · Load
Security · Accessibility · Visual · Migration · Recovery
```

Adversarial testing includes: Tenant Escape, IDOR, Privilege Escalation, Field Leakage, Record Leakage, Foreign IDs, Replay, Race Conditions, Concurrent Posting, Backdated Transactions, Negative Inventory, Double Payment, Double Refund, Sync Replay, Sync Reorder, Cursor Corruption, Cache Leakage, Realtime Leakage, Export Leakage, Search Leakage, AI Leakage.

Financial invariant tests must prove `DEBIT = CREDIT` and relevant reconstruction invariants.

Crash consistency must be tested around: commit, outbox, response, sync, retry, migration, posting.

Client failure scenarios include: network loss, process kill, reboot, expired token, permission change, workspace switch, double-click, timeout, partial response, outbox backlog, cursor corruption.

No financial mutation may silently disappear.

# ================================================================

# 45. AI GOVERNANCE

# ================================================================

AI is NEVER an independent source of truth.

Pipeline:

```text
QUESTION → AUTHORIZATION → DATA DISCOVERY → DATA MINIMIZATION
→ AUTHORITATIVE SOURCE → CALCULATION → EXPLANATION
```

If authoritative data is unavailable: NO ANSWER.  
Never fabricate financial facts.

Restricted data must never enter unauthorized: prompts, embeddings, indexes, logs, analytics, caches.

AI inherits the complete authorization hierarchy.

# ================================================================

# 46. INTEGRATIONS + WEBHOOKS + NOTIFICATIONS

# ================================================================

Integrations:

```text
Adapter → Canonical Model → Validation → Authorization → Idempotent Mutation → Audit
```

External IDs remain separate from internal IDs.

Webhooks require where applicable: signature verification, replay protection, idempotency, ordering, retry, dead-letter handling, audit, tenant resolution.

Notifications are side effects.  
Financial success must not depend on notification delivery.

# ================================================================

# 47. UX STATES

# ================================================================

Every applicable surface must handle:

```text
LOADING · EMPTY · SUCCESS · PARTIAL · ERROR · OFFLINE
SYNCING · CONFLICT · UNAUTHORIZED · FORBIDDEN · STALE
```

Offline states distinguish: Saved Locally · Pending · Synced · Failed · Conflict · Rejected · Permission Revoked.

Customer 360 and Inventory 360 must aggregate only authorized data and preserve provenance.

Reconciliation detects mismatches. It never silently repairs them.

# ================================================================

# 48. SOURCE OF TRUTH + PROJECTION CONTRACTS

# ================================================================

Before creating important fields, identify:

```text
OWNER · TYPE · SOURCE · DERIVATION · MUTATION PATH
READ PATH · CACHE POLICY · REBUILD METHOD · AUDIT POLICY
```

Before creating balance / cost / profit / stock / status — search the repository for an authoritative existing value.  
Do not create shadow truths.

Projections must define: SOURCE · VERSION · REBUILD · STALE · INVALIDATION · RECONCILIATION.

If a projection cannot be rebuilt or reconciled safely: IT IS NOT PRODUCTION-SAFE.

# ================================================================

# 49. NO FEATURE WITHOUT A HOME

# ================================================================

Before creating a feature, identify:

```text
Domain Owner · Authoritative Table · Authoritative Engine
Event · Authorization Policy · Audit · Reports · UI
Offline Policy · Sync Policy
```

If ownership is unclear: STOP.  
Do not create the feature until its authoritative home is established.

# ================================================================

# 50. NO DUPLICATE TRUTH

# ================================================================

Before creating any new balance / cost / profit / stock / payment status / invoice status / tax value / authorization result — search the existing system.

Reuse authoritative values.

A new field is allowed only when it is:

```text
authoritative
OR an explicitly documented projection
OR an explicitly documented snapshot
```

Never create a second calculation merely because the first one is inconvenient.

# ================================================================

# 51. COMPETITIVE ENGINEERING

# ================================================================

Competitor research may inform: capability, boundary, workflow, invariant, failure mode, UX, authorization, data model, extensibility, scalability.

But: competitor feature ≠ automatic requirement.

Never add a feature solely because competitors have it.  
Never claim superiority without evidence.

# ================================================================

# 52. PLATFORM PRODUCTION READINESS

# ================================================================

Platform-level readiness additionally requires:

```text
Security audit
Tenant isolation audit
Authorization adversarial testing
Financial golden suite
Migration verification
Backup + restore drill
Load testing
Performance baseline
Error monitoring
Alerting
Rate limiting
Secret management
Incident procedure
Rollback procedure
Data reconstruction
Offline recovery
Sync recovery
Accessibility audit
i18n audit
RTL audit
```

These platform gates do not mean every small capability must independently implement unrelated enterprise features.  
The active capability must satisfy the gates relevant to its scope.

# ================================================================

# 53. PHASE 0 — FORENSIC AUDIT

# ================================================================

Phase 0 is NOT a default precondition for every task.

Run a full forensic audit only when:

```text
starting from scratch
OR project state explicitly requires re-audit
OR unknown ownership blocks a critical decision
OR major architectural uncertainty cannot otherwise be resolved
```

Phase 0:

```text
AUDIT → DOCUMENT → UPDATE PROJECT STATE → STOP
```

Do not implement during Phase 0 unless the explicit task says otherwise.

# ================================================================

# 54. CADENCE

# ================================================================

Every 5–6 completed capabilities, or earlier if risk warrants:

```text
LINT · BUILD · TYPECHECK · RELEVANT TESTS · DATABASE CHECKS · SECURITY CHECKS
```

Do not continue building on broken foundations.

At the end of every capability:

```text
Update HANDOFF
Update PROJECT STATE
Update capability/phase log
Record evidence
Record risks
Record Scope Firewall
Record release state
Record next action
```

# ================================================================

# 55. STOP CONDITIONS

# ================================================================

STOP immediately if:

```text
schema ownership is unclear
financial source of truth is unclear
authorization boundary is unclear
tenant boundary is unclear
migration safety is unclear
data-loss risk exists
tests contradict assumptions
implementation conflicts with actual code
duplicate engine would be created
shadow truth would be created
security shortcut is required
financial calculation cannot be reconstructed
production behavior may change without protection
scope is expanding without justification
future functionality is being implemented without current need
deployment authority is unclear
rollback/recovery is undefined for a risky change
```

When stopped:

```text
DO NOT GUESS.
DO NOT PATCH RANDOMLY.
DO NOT CONTINUE FORWARD.

REPORT:
WHAT IS UNKNOWN
WHY IT MATTERS
WHAT EVIDENCE IS NEEDED
WHAT DECISION IS BLOCKED
```

# ================================================================

# 56. FINAL CAPABILITY EXECUTION COMMAND

# ================================================================

When instructed to build a capability:

### STEP 1 — PROJECT STATE

Read `.claude/`, HANDOFF.md, PROJECT_STATE.md, relevant logs, git state.

### STEP 2 — DISCOVER WORKFLOW

Discover the real branch, PR, CI, migration, deployment, production workflow.

### STEP 3 — DEFINE ONE CAPABILITY

Identify exactly one active domain capability.

### STEP 4 — WRITE CAPABILITY CONTRACT

Define: REQUIRED NOW, REQUIRED BOUNDARY, FUTURE, OUT OF SCOPE, DO NOT TOUCH, DEPENDENCIES, SOURCE OF TRUTH, CHANGE BUDGET, BLAST RADIUS, TEST PLAN, ROLLBACK, RELEASE PLAN.

### STEP 5 — AUDIT

Inspect only what is required to safely implement the capability.

### STEP 6 — DESIGN

Reuse existing authoritative systems.  
Do not create duplicate engines.  
Do not implement speculative future functionality.

### STEP 7 — IMPLEMENT

Build the smallest correct production implementation.

### STEP 8 — VERIFY

Run relevant tests, typecheck, lint, build, security checks, migration checks, contract checks.

### STEP 9 — ATTACK

Test deny paths, tenant isolation, authorization, replay, race, financial invariants, failure states where applicable.

### STEP 10 — MEASURE

Measure performance and runtime behavior where relevant.

### STEP 11 — DOCUMENT

Update HANDOFF, PROJECT STATE, CAPABILITY LOG, RELEASE REPORT.

### STEP 12 — CLASSIFY

Use only: PRODUCTION-READY, BLOCKED, or another explicitly permitted lifecycle status.

### STEP 13 — DEPLOY

Only through explicit authority or the repository's established CI/CD workflow.

### STEP 14 — POST-DEPLOY VERIFY

Verify actual production behavior.

### STEP 15 — CLOSE

Only after evidence: RELEASED + VERIFIED.  
Then move to the next capability.

# ================================================================

# 57. FINAL SYSTEM ARCHITECTURE

# ================================================================

```text
                         HISABCHE
                            │
                    BUSINESS KERNEL
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
     FINANCE             OPERATIONS          SECURITY
 Accounting             Sales              Tenancy
 Costing                Purchase           RLS
 Inventory              Warehouse          Authorization
 Payments               Manufacturing      Audit
 Profit                 CRM                SoD
 Tax                    HR                 Policy
 Assets                 Projects
                            │
                     DOMAIN EVENTS
                            │
                  ┌─────────┴─────────┐
                  │                   │
            AUTHORITATIVE         PROJECTIONS
               STATE             SEARCH / BI / AI
                  │                   │
                  └─────────┬─────────┘
                            │
                  CHANGE LOG / SYNC
                            │
               ┌────────────┴────────────┐
               │                         │
            ONLINE                    OFFLINE
                                       │
                                LOCAL DB + OUTBOX
                                       │
                                RECONCILIATION
                                       ↓
                              ADAPTIVE RUNTIME
                                       ↓
                             AUTHORIZATION FIRST
                                       ↓
                         MINIMUM REQUIRED DATA
                                       ↓
                         PROGRESSIVE DISCLOSURE
                                       ↓
                           APPROVED UI PATTERNS
                                       ↓
                            FAST USER WORKFLOW
```

The architecture describes the destination.  
The active capability determines how much of that destination is built now.

# ================================================================

# 58. FINAL PRODUCT EQUATION

# ================================================================

```text
FINANCIAL TRUTH
+ SECURITY
+ TENANT ISOLATION
+ ACTUAL COST
+ OPERATIONAL DEPTH
+ OFFLINE RESILIENCE
+ SAFE SYNCHRONIZATION
+ ADAPTIVE UX
+ PROGRESSIVE DISCLOSURE
+ ACCESSIBILITY
+ LOCALIZATION
+ EXTENSIBILITY
+ OBSERVABILITY
+ RECONSTRUCTABILITY
+ MEASURED PERFORMANCE
+ INCREMENTAL PRODUCTION DELIVERY
+ SCOPE DISCIPLINE
+ PRODUCTION PRESERVATION
+ EVIDENCE-FIRST ENGINEERING
= HISABCHE
```

# ================================================================

# 59. FINAL STANDARD

# ================================================================

The finished Hisabche platform must be:

**FINANCIALLY CORRECT, SECURE, TENANT-ISOLATED, AUTHORIZATION-COMPLETE, FIELD-SECURE, RECORD-SECURE, AUDITABLE, RECONSTRUCTABLE, OFFLINE-CAPABLE, SYNC-SAFE, CONFLICT-SAFE, REALTIME-ISOLATED, ACTUAL-COST-AWARE, TAX-AWARE, MULTI-CURRENCY, MULTI-ENTITY, WORKFLOW-AWARE, ADAPTIVE, ACCESSIBLE, READABLE, RTL-CORRECT, FULLY LOCALIZED, PERFORMANT, OBSERVABLE, EXTENSIBLE, RECOVERABLE, INCREMENTALLY RELEASABLE, SCOPE-DISCIPLINED, PRODUCTION-PRESERVING, AND GENUINELY PLEASANT TO USE.**

It must serve:

```text
Small Merchant
→ Growing Business
→ Medium Company
→ Multi-Branch Organization
→ Multi-Company Group
→ Enterprise
```

without forcing enterprise complexity onto the user,  
and without forcing the engineering team to build the entire enterprise architecture before releasing useful capabilities.

# ================================================================

# 60. THE ULTIMATE ENGINEERING PHILOSOPHY

# ================================================================

```text
THE WHOLE SYSTEM MUST BE COHERENT.
BUT NO SINGLE CAPABILITY MUST BUILD THE WHOLE SYSTEM.

THE BOUNDARY MUST BE DESIGNED FOR THE FUTURE.
BUT THE FUTURE MUST NOT BE IMPLEMENTED WITHOUT A PRESENT NEED.

EXISTING PRODUCTION MUST BE PROTECTED.
NEW CAPABILITIES MUST BE SMALL.
QUALITY MUST BE COMPLETE.
SCOPE MUST BE LIMITED.
EVIDENCE MUST CONTROL CLAIMS.

EVERY CAPABILITY MUST BE RELEASABLE.
EVERY RELEASE MUST BE OBSERVED.
EVERY OBSERVATION MUST INFORM THE NEXT SLICE.
```

Therefore:

```text
DESIGN FOR THE WHOLE
        ↓
BUILD ONLY THE NECESSARY PART
        ↓
PROTECT WHAT WORKS
        ↓
MAKE THE BOUNDARY FUTURE-PROOF
        ↓
DO NOT BUILD SPECULATION
        ↓
TEST THE SLICE COMPLETELY
        ↓
SHIP IT
        ↓
OBSERVE IT
        ↓
LEARN
        ↓
BUILD THE NEXT SLICE
```

# ================================================================

# 61. FINAL COMMAND

# ================================================================

**START NOW.**

Do not ask:

> "How do I build the entire Hisabche?"

Ask:

> "What is the smallest complete production capability that creates real value now?"

Then:

```text
DEFINE
→ SCOPE
→ PROTECT
→ DESIGN
→ IMPLEMENT
→ VERIFY
→ ATTACK
→ MEASURE
→ DOCUMENT
→ PRODUCTION-READY
→ AUTHORIZED RELEASE
→ POST-DEPLOY VERIFY
→ NEXT CAPABILITY
```

Never skip evidence.  
Never guess.  
Never fabricate.  
Never delete production data.  
Never weaken security.  
Never duplicate engines.  
Never create shadow truths.  
Never use UI hiding as security.  
Never let personalization override authorization.  
Never let offline state override financial authority.  
Never let AI invent financial facts.  
Never call something production-ready without proof.  
Never block a production-ready capability on unrelated incomplete modules.  
Never ship temporary-unsafe code.  
Never implement FUTURE scope under the current capability.  
Never silently expand scope.  
Never perform unrelated refactors.  
Never create speculative abstractions.  
Never treat PRODUCTION-READY as automatic deploy permission.  
Never change existing production behavior without evidence and regression protection.  
Never destroy working production to build the future.

```text
ONE BUSINESS TRUTH
+ ONE FINANCIAL TRUTH
+ ONE SECURITY MODEL
+ ONE DATA MODEL
+ ONE SYNC MODEL
+ ONE ADAPTIVE EXPERIENCE
+ INDEPENDENTLY RELEASABLE CAPABILITIES
+ FUTURE-PROOF BOUNDARIES
+ PRESERVED PRODUCTION
+ EVIDENCE-BASED ENGINEERING
```

# ================================================================

# FINAL MANTRA

# ================================================================

# DESIGN FOR THE WHOLE.

# BUILD ONLY THE NECESSARY PART.

# PROTECT WHAT ALREADY WORKS.

# MAKE THE BOUNDARY FUTURE-PROOF.

# NEVER BUILD SPECULATION.

# TEST THE SLICE COMPLETELY.

# SHIP IT.

# OBSERVE IT.

# LEARN.

# BUILD THE NEXT SLICE.

# ================================================================

# END OF HISABCHE MASTER ENGINEERING & PRODUCT DIRECTIVE

# VERSION 22.0 — ULTIMATE / FINAL CONSTITUTION

# Version 1 of 1

# ================================================================
