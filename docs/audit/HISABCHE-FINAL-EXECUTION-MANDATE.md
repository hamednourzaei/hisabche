# HISABCHE — UNIVERSAL INDUSTRY, INVOICE, CRM & SERVICE DELIVERY REFACTOR

## FINAL EXECUTION MANDATE — ROOT-CAUSE AUDIT, IMPLEMENTATION & ZERO-REGRESSION VERIFICATION

**Repository:** `hamednourzaei/hisabche`
**Target branch:** `main`

**Primary objective:** Eliminate the identified cross-module inconsistencies, industry-profile
failures, onboarding defects, duplicate business concepts, incomplete workflows, and missing
domain-event coverage through evidence-driven implementation.

**Execution mode:** Autonomous, end-to-end, repository-first engineering.
**Communication:** Final report in Persian. All source code, identifiers, comments, tests, and
technical documentation must be in English.

---

# 1. MISSION AND NON-NEGOTIABLE OBJECTIVE

You are assigned to perform a comprehensive engineering audit and remediation of Hisabche.

This is not a UI-only task, a cosmetic refactor, or a documentation-only exercise.

You must investigate the actual implementation, identify root causes, implement corrections in the
existing architecture, connect all affected domain modules, and verify the resulting behavior
through automated tests and available runtime evidence.

The primary problems to eliminate are:

1. Fragmented invoice and advance-document workflows.
2. Incorrect financial and inventory effects before document finalization.
3. Duplicate customer/supplier role concepts.
4. Incorrect CRM table terminology and role rendering.
5. Industry capabilities that remain hardcoded or incorrectly inherited.
6. Onboarding answers that do not consistently control actual application behavior.
7. Industry-inappropriate service-delivery tabs and incomplete workflows.
8. Service sessions that cannot properly represent internal employees.
9. Incomplete domain-event, audit, activity, and notification coverage.
10. Inconsistent primary-action button styling.
11. Other related architectural, integration, authorization, offline, and regression defects discovered during the audit.

**The final outcome must be a coherent, integrated business operating system rather than a collection of independently implemented modules.**

Do not stop after identifying problems. Implement every safe, authorized, and verifiable correction.

---

# 2. EXECUTION GOVERNANCE AND REPOSITORY SAFETY

Before touching source code:

1. Read the root `AGENTS.md` and every applicable nested `AGENTS.md`.
2. Read the existing architecture documentation and relevant implementation specifications.
3. Inspect the actual repository state, current branch, HEAD, and working-tree changes.
4. Identify existing implementations before introducing new abstractions.
5. Run the repository's documented code-intelligence workflow.
6. Build a dependency map for all affected modules.
7. Record existing defects and their reproducible evidence.

## Mandatory safety restrictions

- Never commit or push.
- Never reset, rebase, stash, checkout, or clean the repository.
- Never overwrite or discard existing user changes.
- Never inspect, expose, or modify `.env` files or secrets.
- Never execute live Supabase DDL or production database writes.
- Never install, upgrade, remove, or modify dependencies or lockfiles unless explicitly authorized.
- Never run production builds unless explicitly requested.
- Never introduce `any`, `@ts-ignore`, `eslint-disable`, fake APIs, placeholder implementations, or dead code.
- Preserve `exactOptionalPropertyTypes` and existing TypeScript standards.
- Do not introduce parallel business engines, duplicate resolvers, competing KPI systems, or duplicate terminology registries.
- Do not create unnecessary subagents.
- Follow existing architecture and repository conventions.

If an operation is blocked by these restrictions, identify the blocker and continue with all independent work.

**Do not interpret a blocked operation as permission to bypass repository safety rules.**

---

# 3. PHASE ZERO — COMPLETE CROSS-DOMAIN AUDIT

Before implementation, inspect the following domains and their dependencies.

## 3.1 Invoice and sales domain

Inspect: invoice types and lifecycle; sales and purchase workflows; advance sales and advance
purchases; proforma and quotation workflows; creation and editing; finalization and cancellation;
inventory movements; accounting entries; receivables and payables; tax and discount calculations;
payment processing; returns and refunds; permissions; offline mutation handling; sync behavior;
notifications and audit events.

Identify every separate or duplicated implementation.

## 3.2 CRM domain

Inspect: customer and supplier entities; business-party relationships; role assignment; creation and
editing; supplier creation and editing; listing and filtering; contracts and agreements; customer
activity and outreach; balances and credit; permissions and visibility; historical data
compatibility.

## 3.3 Industry and onboarding domain

Inspect: business-type registry; industry profiles; operational DNA; onboarding questions; answer
persistence; workspace initialization; capability definitions; capability resolution; industry
overrides; terminology overlays; industry-specific dashboards; navigation and tabs; permission
mappings; backend capability enforcement; mobile and desktop consistency.

## 3.4 Service-delivery domain

Inspect: service sessions; appointments; repairs; service catalogs; chairs and service stations;
commissions; employees and service providers; customer relationships; session identifiers; status
transitions; settlement and payment integration; offline behavior.

## 3.5 Event and notification infrastructure

Inspect: domain events; event producers; event consumers; notification delivery; audit logging;
activity feeds; outbox processing; retry behavior; idempotency; realtime delivery; offline
synchronization; failure recovery.

## 3.6 Deliver an initial evidence-based audit

Create or update `docs/audit/HISABCHE-CROSS-DOMAIN-INTEGRITY-AUDIT.md`.

For every discovered issue, document: unique issue ID; affected module; exact source paths; root
cause; reproduction scenario; business impact; data-integrity impact; security or permission
implications; required correction; regression tests; verification status.

Separate verified defects from suspected issues and unverified assumptions.

Do not invent test results.

---

# 4. P0 — UNIFY THE INVOICE MANAGEMENT EXPERIENCE

Target URL: `/fa/invoices`

The current five invoice filters must become exactly three primary categories:

1. All
2. Purchases & Sales
3. Advance Purchases & Advance Sales

The interface must not expose five independent primary tabs.

## 4.1 One unified invoice table

All four document types must be represented through one shared invoice-management table and a
unified domain model.

Required document categories: Sales; Purchases; Advance Sales; Advance Purchases.

The implementation must use the existing invoice core wherever possible.

Do not create another invoice engine or maintain separate business logic for advance documents.

The shared table must correctly support: document type; document number; customer or supplier;
date; status; total amount; payment status where applicable; relevant financial information;
available operations; search; filtering; sorting; pagination; saved views where supported;
permission-aware actions.

Different document types may have different fields and lifecycle transitions, but they must share
the same underlying management architecture.

## 4.2 Advance documents must have zero premature financial impact

Creating or editing an advance purchase or advance sales document must NOT: increase or decrease
inventory; create finalized accounting entries; create finalized receivables or payables; record
finalized revenue or expenses; trigger settlement; create irreversible financial consequences.

Draft and unfinalized documents must remain operationally separate from finalized financial
transactions.

## 4.3 Add the Finalize operation

In the three-dot operations menu for eligible advance documents, introduce **Finalize**.

When the user selects this action:

1. Verify the user's authorization.
2. Verify document ownership and workspace context.
3. Validate document status and business rules.
4. Validate required customer/supplier and line-item information.
5. Validate quantities, prices, discounts, taxes, and currency precision.
6. Execute finalization through the existing central invoice domain service.
7. Apply the correct inventory consequences only when appropriate for the document type.
8. Generate the required accounting and financial records.
9. Update receivables/payables and other applicable balances.
10. Record domain events and audit information.
11. Make the resulting state visible through the existing synchronization and notification architecture.

All required database operations must be atomic. If any critical operation fails, the transaction
must roll back.

Prevent: double finalization; duplicate stock movements; duplicate journal entries; duplicate
payment records; duplicate receivable/payable records; concurrent finalization races; offline replay
duplication.

Use idempotency keys and existing document-version mechanisms.

Finalized documents must respect existing immutability rules.

Do not invent accounting policies. Follow the existing approved financial model and explicitly
document unresolved business-policy questions.

## 4.4 Finalization tests

Test at minimum: advance sales creation; advance purchases creation; editing an unfinalized
document; inventory unchanged before finalization; accounting unchanged before finalization; correct
effects after finalization; repeated finalization; concurrent finalization; failed finalization and
rollback; permission denial; offline finalization and retry; duplicate synchronization; cancellation
and return behavior.

---

# 5. P0 — FIX CRM CUSTOMER AND SUPPLIER ROLE DUPLICATION

Target URL: `/fa/customers`

The current creation interface exposes: Customer; Supplier; Buyer and Seller.

The third option duplicates the existing business-party model.

## 5.1 Remove the duplicate option

The new customer/supplier creation interface must expose exactly: Customer; Supplier.

Remove the redundant Buyer and Seller option from the creation UI and new role-assignment workflow.

Do not blindly delete historical data. If existing records contain a legacy `both` or equivalent
role, preserve compatibility and map it safely to the canonical domain model.

Define a migration or compatibility strategy only when necessary. Historical relationships must not
be silently lost.

## 5.2 Correct the shared table heading

The first column currently displays a fixed Customer title.

Rename the column to **Role**. It must correctly render the actual role of each record: Customer;
Supplier; any legitimate legacy dual-role representation, if retained for historical compatibility.

The column must remain correct when switching between: All; Customers; Suppliers.

Do not use a hardcoded translated label. Use the existing centralized i18n and terminology system.

## 5.3 Verify CRM consistency

Inspect: customer creation; supplier creation; customer editing; supplier editing; search and
filters; customer balances; supplier balances; receivables and payables; contracts; customer
activity; permissions; API validation; offline database representation; sync conflict resolution.

Ensure that one business party cannot accidentally become two unrelated records simply because the
user acts in a different CRM tab.

---

# 6. P0 — FIX INDUSTRY ONBOARDING AND CAPABILITY RESOLUTION

This is one of the highest-priority architectural requirements.

The application must never assume that every business is a clothing store, retail shop, or
physical-goods business.

A completed onboarding process must produce a consistent business profile that actually controls
the application's behavior.

## 6.1 Audit the entire onboarding lifecycle

Trace: `Onboarding UI → Validation → API → Database → Workspace Profile → Capability Resolver →
Navigation → Module UI → Backend Authorization`.

Verify that every relevant answer: is captured correctly; is validated; is persisted; is restored
after refresh; is synchronized correctly; is available to backend services; affects the actual
workspace capabilities.

A completed onboarding form must not be treated as proof that every module is correctly configured.

## 6.2 Eliminate hardcoded industry fallbacks

Search the entire repository for: retail defaults; clothing-specific defaults; physical-goods
assumptions; hardcoded service modules; hardcoded contracts; hardcoded inventory assumptions;
industry-specific route visibility; static navigation conditions; incorrect default terminology.

Unknown or incomplete profiles must never silently fall back to Retail or Physical Goods.

Use explicit support states: `SUPPORTED`; `SUPPORTED_WITH_LIMITS`; `NOT_OFFERED`.

Do not equate registered industry names with completed industry workflows.

## 6.3 Capability-driven application behavior

Use the existing central capability model and resolver. Do not introduce a competing capability
engine. Industry-specific functionality must be controlled through properly defined capabilities.

The same resolved capability information must be respected by: navigation; dashboard; tabs; forms;
actions; backend APIs; permission checks; reports; mobile interfaces; desktop interfaces; offline
workflows.

Hiding a tab is not sufficient authorization. Backend services must independently enforce the
relevant capability and permission requirements.

## 6.4 Contracts must be industry-appropriate

Investigate `/fa/customers?view=contracts`.

The contracts interface must not appear in an industry where the workflow is not offered or
supported. For example, a clothing business must not automatically receive an irrelevant
contract-management workflow simply because it has access to invoice functionality.

Do not fix this by hiding the route alone. Implement the correct capability-based visibility,
routing, authorization, and empty-state behavior. Preserve contracts for industries where they are
legitimate.

## 6.5 Test across multiple industries

At minimum, exercise: clothing and apparel; general retail; beauty salon; automotive repair; mobile
phone retail and repair; professional services; education and training; manufacturing; wholesale
and distribution.

For every industry, verify: onboarding persistence; correct capability resolution; correct
navigation; correct module visibility; correct terminology; correct backend authorization; correct
workflow availability; correct offline behavior.

Do not claim industry support merely because a screen can be opened. A workflow must be usable from
beginning to completion.

---

# 7. P1 — REFACTOR SERVICE DELIVERY BY INDUSTRY

The current service-delivery area exposes: Sessions; Repairs; Chairs and Services; Commissions.

These tabs must be evaluated against the actual business profile.

Do not delete reusable functionality globally. Do not simply hide incomplete modules.

## 7.1 Industry-specific behavior

### Clothing and Apparel

Do not display salon-specific chairs, service stations, or repair workflows unless the business
profile explicitly enables a legitimate corresponding capability. Do not force irrelevant
service-delivery concepts into a clothing business.

### Beauty Salons

Support the appropriate workflows: service sessions; appointments; service catalog; chairs or
service stations; employee/service-provider assignment; commission calculation where supported;
customer history.

### Automotive Repair

Support relevant workflows: repair orders; vehicle-related service information; assigned
technicians; repair status; required parts where applicable; service history; relevant customer
relationships.

### Mobile Phone Retail and Repair

Support the appropriate repair and service workflows without inheriting irrelevant salon-specific
functionality.

### Other Industries

Use explicit capability definitions and evidence-based support classifications.

## 7.2 Repair incomplete modules

Investigate the existing implementations of repairs, chairs and services, and commissions. Identify
incomplete screens, disconnected APIs, missing permissions, incorrect data models, and missing
workflow transitions. Implement the missing integration where the underlying capability is already
intended to be supported. If a workflow is not yet genuinely supported, classify it honestly rather
than exposing a misleading, partially functional module.

---

# 8. P1 — REBUILD THE SERVICE SESSION CREATION WORKFLOW

The existing new-session form is insufficient because it only supports customer-based sessions.

The form must support two distinct participant types.

## 8.1 Add a participant-type switch

At the top of the form, add a clear, accessible switch: Customer; Employee.

The switch must determine the correct entity selector, validation, identifiers, and domain
relationships.

## 8.2 Customer session mode

When Customer is selected, display:

**Form title:** New Service Session
**Description:** Register the service session you want to schedule.

The form must include: customer selection; service selection; session type; other applicable
service information.

### Multiple customer selection

The customer selector must support selecting multiple customers. Use the existing multi-selection
patterns from `/fa/customers?tab=outreach`. Reuse the shared selection component or its established
architecture. Do not create a second unrelated multi-select implementation.

Selected customers must be clearly visible and removable.

The Customer and Service sections must be visually separated from the lower form fields using a
clear divider.

The form should have a modern, accessible, consistent layout.

## 8.3 Employee session mode

When Employee is selected: use the existing employee domain; display the appropriate employee
selector; support selecting the relevant internal employee; validate the employee's workspace
membership and eligibility; store the employee relationship using a correctly typed identifier.

Customer and employee IDs must never be interchangeable.

## 8.4 Session identifiers and domain relationships

Customer sessions and employee sessions must be distinguishable in the domain model. Implement
explicit participant typing. Preserve referential integrity. Do not generate ambiguous IDs or infer
participant types from identifier formats.

Review database constraints, API schemas, local database representation, and synchronization
behavior. If schema changes are required, create proper migration and verification artifacts.

## 8.5 Session type must be free text

The current session-type selector must become a text input. Users must be able to enter the type of
session they need without being restricted to a predefined list. Preserve validation and reasonable
length constraints without imposing an unnecessary enum restriction.

## 8.6 Remove default settlement from the creation form

The current lower section includes: More — Assignee, Branch, Default Settlement, Notes.

Change it to: More — Assignee, Branch, Notes.

Remove Default Settlement from the session creation form. Do not remove legitimate financial
settlement capabilities from the accounting or payment domains. Settlement must occur through the
appropriate business workflow, not through an irrelevant default field in the session creation form.

## 8.7 Service session acceptance tests

Test: creating a customer session; creating a multi-customer session; creating an employee session;
switching participant types; editing existing sessions; invalid customer IDs; invalid employee IDs;
cross-workspace access prevention; session permissions; offline creation; sync conflict handling;
correct display of participant identity; free-text session types; absence of the default settlement
field.

---

# 9. P1 — COMPLETE DOMAIN EVENT, AUDIT AND NOTIFICATION COVERAGE

A major problem in Hisabche is that numerous important user actions do not appear in notifications
or activity records. This must be addressed systematically across the entire application.

## 9.1 Build a mutation-to-event registry

Inspect every meaningful write operation across: invoices; purchases; sales; inventory; payments;
accounting; CRM; employees; payroll; service delivery; repairs; commissions; contracts; tasks;
permissions; workspace settings; data imports; sync operations.

For every meaningful mutation, document: domain; action; API route; service method; permission;
domain event; audit requirement; activity requirement; notification policy; offline behavior;
idempotency strategy; test coverage.

Create or update `docs/audit/HISABCHE-MUTATION-EVENT-COVERAGE.md`.

## 9.2 Distinguish events, audit logs, activity and notifications

These are related but different responsibilities.

**Domain Events** represent meaningful business state transitions.
**Audit Logs** record security-sensitive and business-critical actions with actor, timestamp,
target, and relevant context.
**Activity Feed** provides useful historical information to authorized users.
**Notifications** alert relevant users when an action requires their attention.

Do not blindly send a notification to every workspace member for every database mutation. Define
appropriate recipients, severity, preferences, and delivery policies.

## 9.3 Reliable event delivery

Use the existing event and outbox infrastructure. Ensure: atomic event creation where required;
durable event persistence; idempotent processing; retry handling; failed-event visibility;
duplicate prevention; correct authorization; realtime delivery where supported; offline
synchronization compatibility; no silent event loss.

A successful business mutation must not appear complete while its required event or audit record is
silently discarded.

## 9.4 Verify end-to-end event coverage

Test important actions from UI to persistence and delivery. Do not consider an event covered merely
because an event type exists in a TypeScript enum.

Verify the complete chain: `User Action → API → Domain Service → Database Transaction →
Event/Outbox → Consumer → Audit/Activity/Notification`.

---

# 10. P2 — STANDARDIZE PRIMARY CREATE ACTIONS

All primary create actions must use the same green primary-action design language already
established by the New Invoice button.

Examples: new customer; new supplier; new invoice; new employee; new service session; add product;
add warehouse; add task; other equivalent creation actions.

## Requirements

- Use the existing design tokens.
- Reuse shared button components.
- Maintain accessible contrast.
- Preserve loading and disabled states.
- Maintain consistent icon placement.
- Preserve destructive and secondary button semantics.
- Respect RTL and LTR layouts.
- Avoid introducing one-off CSS solutions.

Do not turn every button green. Only genuine primary creation or confirmation actions should use the
primary-action style. Audit all affected screens for consistency.

---

# 11. CROSS-DOMAIN ARCHITECTURAL INTEGRITY

The implementation must preserve one authoritative business core for each domain.

In particular: one invoice engine; one CRM business-party model; one industry capability resolver;
one terminology system; one KPI definition system; one authoritative permission model; one coherent
event and outbox architecture; one service-delivery domain model.

Modules must integrate through existing shared domain contracts and approved service boundaries.

Do not duplicate business rules inside UI components. Do not implement financial logic in React
components. Do not allow local database state to bypass domain validation. Do not use last-write-wins
for financial records. Do not silently overwrite newer local data during hydration or
synchronization. Preserve finalized-document immutability. Preserve auditability and
conflict-resolution requirements.

---

# 12. OFFLINE-FIRST AND MULTI-PLATFORM VERIFICATION

All affected workflows must be checked across the supported application environments.

Required platforms: Next.js web; Electron desktop; Expo / React Native where supported by the
existing architecture; local engine; backend API; Supabase persistence and synchronization.

Respect the existing React Native / Expo compatibility constraints. Do not upgrade Expo, React
Native, or enable New Architecture as part of this task.

Verify:

1. Create an advance document offline.
2. Edit it offline.
3. Synchronize it.
4. Finalize it under the correct authorization.
5. Verify that financial and inventory effects occur exactly once.
6. Retry synchronization.
7. Verify no duplicate effects.
8. Simulate a failure during processing.
9. Verify rollback or recoverable state.
10. Resolve conflicting edits without losing financial integrity.

The local database is a local-first operational store, not permission to bypass server-authoritative
business rules.

---

# 13. TESTING AND REGRESSION ELIMINATION

Do not rely on a small number of happy-path tests. Build a traceable test matrix covering every
changed domain.

## Required test layers

### Unit tests

Domain rules; lifecycle transitions; role resolution; capability resolution; session participant
typing; event mapping; idempotency.

### Integration tests

API to service; service to database; invoice to inventory; invoice to accounting; CRM to
receivables/payables; session to employee/customer; mutation to outbox; outbox to notifications.

### PostgreSQL tests

Verify: constraints; transaction boundaries; unique indexes; foreign keys; workspace isolation; RLS
policies; rollback; concurrent operations; migration correctness.

Never execute live production DDL.

### UI tests

Verify: correct invoice tabs; unified document table; finalize operation; CRM role selector; role
table heading; industry-specific navigation; contract visibility; service-delivery tabs;
customer/employee session switch; multi-customer selection; free-text session type; removed default
settlement field; primary button consistency.

### Regression tests

Existing functionality must remain intact. Test representative industries and workflows before and
after the changes. Do not delete, weaken, skip, or rewrite failing tests merely to obtain a passing
result.

---

# 14. DOCUMENTATION AND REQUIRED DELIVERABLES

Create or update:

1. `docs/audit/HISABCHE-CROSS-DOMAIN-INTEGRITY-AUDIT.md`
2. `docs/audit/HISABCHE-MUTATION-EVENT-COVERAGE.md`
3. `docs/audit/HISABCHE-INDUSTRY-CAPABILITY-REGRESSION-MATRIX.md`
4. `docs/audit/HISABCHE-REMEDIATION-VERIFY.md`

Also provide: required migration SQL files; migration verification SQL; PostgreSQL integration
tests; unit and integration tests; UI regression tests; updated architecture documentation; updated
capability and workflow coverage records; exact list of modified files; evidence for each resolved
issue; explicit list of remaining blockers.

All technical documentation must be written in English. Do not duplicate existing documentation
unnecessarily. Update the authoritative existing document where appropriate.

---

# 15. STRICT COMPLETION CRITERIA

A task is complete only when its acceptance criteria have been verified.

Use these statuses: `VERIFIED_COMPLETE`; `IMPLEMENTED_NOT_LIVE_VERIFIED`; `BLOCKED`;
`NOT_IMPLEMENTED`; `PENDING_HUMAN_CONFIRMATION`.

Never use `VERIFIED_COMPLETE` when only source code has been modified.

Never claim that a workflow is complete merely because its UI exists.

Never claim that an industry is supported without end-to-end workflow evidence.

Never claim that notifications are fully covered without mutation-to-event traceability.

Never claim that offline behavior is correct without relevant offline tests.

## Required completion gates

### Gate A — Invoice Integrity

All four document types use the unified management architecture. Unfinalized advance documents have
no premature finalized financial or inventory effects. Finalization is atomic and idempotent.

### Gate B — CRM Integrity

Only the canonical Customer and Supplier options are exposed for new records. The Role column
displays correct values. Historical data remains compatible.

### Gate C — Industry Integrity

Onboarding answers are persisted and resolved correctly. Industry capabilities control actual
application behavior. No accidental retail or clothing fallback exists.

### Gate D — Service Delivery

Service-delivery features are correctly capability-gated. Customer and employee sessions are
supported. Multiple customers can be selected. Session types accept free text. Default settlement
is absent from the creation form.

### Gate E — Event Integrity

Meaningful mutations have documented event and audit coverage. Required notifications are delivered
according to policy. Idempotency and failure recovery are tested.

### Gate F — Regression Integrity

All relevant existing and new tests pass, or every remaining failure is documented with evidence. No
existing user changes have been discarded. No unauthorized dependency or production changes have
been made.

---

# 16. EXECUTION STRATEGY — DO NOT STOP AFTER THE AUDIT

Execute in this order:

**Phase 1:** Repository inspection, code intelligence, architecture mapping, and evidence-based audit.
**Phase 2:** Root-cause analysis and implementation planning.
**Phase 3:** P0 invoice, CRM, and industry/onboarding corrections.
**Phase 4:** Service-delivery and session workflow corrections.
**Phase 5:** Cross-domain events, audit, activity, and notifications.
**Phase 6:** Design-system consistency and primary-action corrections.
**Phase 7:** Offline, multi-platform, integration, and regression verification.
**Phase 8:** Documentation, traceability, and final evidence report.

Work incrementally. After each logical change: inspect the diff; run the smallest relevant test;
verify architecture compatibility; check for regressions; continue to the next task.

Do not wait until the end to discover that foundational changes broke dependent modules.

If an implementation is blocked, continue all independent tasks.

If a business-policy decision is genuinely necessary, do not invent the answer. Document the exact
decision, its consequences, and the smallest required human input.

Do not stop merely because the task is large. Do not stop after generating a plan. Do not stop after
fixing the first visible issue. Do not stop when the UI appears correct while the underlying domain
remains broken.

---

# 17. FINAL REPORT FORMAT

At completion, produce a Persian executive report with the following sections:

1. Executive Summary.
2. Initial Repository State.
3. Root Causes Discovered.
4. Implemented Corrections.
5. Invoice and Financial Integrity.
6. CRM and Business-Party Integrity.
7. Industry and Onboarding Integrity.
8. Service-Delivery Integrity.
9. Notification and Event Coverage.
10. Offline and Synchronization Results.
11. Test Results.
12. Database and Migration Results.
13. Files Changed.
14. Remaining Blockers.
15. Items Requiring Human Confirmation.
16. Production Readiness Assessment.

For every completed item, provide: exact file paths; implementation evidence; test names; test
execution results; relevant migration references; remaining limitations.

Include numerical coverage metrics only when they are computed from actual repository data or
executed test results. Do not fabricate percentages.

---

# FINAL ENGINEERING DIRECTIVE

Treat this assignment as a senior/staff-level cross-domain architecture and implementation mission.

Your responsibility is not to make Hisabche look complete. Your responsibility is to make its
underlying workflows, business rules, industry behavior, financial integrity, synchronization, and
user-facing operations actually work together.

**Fix root causes, not symptoms.**
**Integrate existing cores, do not duplicate them.**
**Preserve existing user work.**
**Verify every important claim.**
**Continue until every safely actionable requirement has been implemented and tested, and every
remaining blocker has been explicitly documented.**

The definition of success is a reliable, coherent, industry-aware, offline-first Business Operating
System whose modules behave consistently across the entire application.

A polished interface with broken business logic is a failure. A completed report without
implemented corrections is a failure. An implementation without regression evidence is not verified.

**Begin with repository inspection and the complete audit. Then execute the remediation plan through
completion.**
