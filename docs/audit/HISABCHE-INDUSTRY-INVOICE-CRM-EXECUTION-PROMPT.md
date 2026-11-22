# HISABCHE — Cross-Domain Integrity, Industry Personalization, Invoice Lifecycle & CRM/Service UX Remediation

**Execution class:** Repository-wide, evidence-driven production-readiness remediation  
**Priority:** P0 — business correctness and customer-facing credibility  
**Target repository:** `hamednourzaei/hisabche`  
**Target branch:** `main` (verify actual checkout before changing anything)  
**Language:** This specification is English. Source code, comments, tests, and technical documentation remain English. User-facing messages must follow the repository's Persian/Dari/English localization rules.  
**Completion rule:** Do not stop after writing an audit or after fixing the visible UI. Trace each issue through the canonical domain, persistence, server, local engine, sync, API hooks, shared UI, notifications, permissions, and tests. Continue through every safe, in-scope remediation until the acceptance gates pass or a concrete external/owner-only blocker is reached.

---

## 0. Mission and non-negotiable outcome

The owner has spent approximately ten months trying to complete Hisabche. This task must reduce real product defects, not create another plan that merely moves work into a future phase.

Perform a complete, scoped-but-cross-domain audit of the reported failures and their shared dependencies. Establish the real root causes from the checked-out source. Fix the causes in the canonical implementation, not only the screenshot or route that exposes them. Ensure that all business types selected during onboarding result in truthful, persisted, profile-aware behavior across Web, Windows Desktop, Android, online, and offline modes.

The outcome must be a coherent operating system:

- One canonical invoice/document lifecycle and one shared table for sales, purchases, pre-sales, and pre-purchases.
- No stock, costing, ledger, tax, receivable/payable, or other final financial effect from a pre-document before it is explicitly finalized.
- One canonical activity/event/audit/notification flow for meaningful business mutations, with reliable persistence and idempotent delivery.
- One accurate customer/supplier role model and one role-aware shared customer table.
- Industry-aware feature availability derived from the persisted business profile and operational DNA, never from a hardcoded retail fallback or a user's personal page-layout preferences.
- A service/session creation experience that can target either customers or internal employees without mixing identity types or corrupting customer, HR, service-delivery, financial, or sync records.
- Consistent primary styling for creation actions, using the existing design tokens and shared components.
- Evidence-backed regression tests for the exact reported scenarios and the cross-platform/shared-core consequences.

Do not claim the product is complete because a route renders, a tab disappears, a test is source-only, or a feature exists in a registry. A capability is complete only when the full real workflow is wired and tested.

## 1. Repository governance — read and obey before editing

1. Read the repository's `AGENTS.md` in full, then the applicable root `CLAUDE.md`, nested agent instructions, architecture decisions, and existing task-specific specifications. The checked-out repository's instructions take precedence over this prompt wherever they impose a stricter safety rule.
2. Preserve all user changes. Before any edit, record:
   - `git status --short`
   - current branch
   - `git rev-parse HEAD`
   - relevant worktree diff summary
3. Never run `git commit`, `git push`, `git reset`, `git rebase`, `git stash`, `git checkout --`, or any destructive command. Leave every change in the working tree for the owner.
4. Never read, print, copy, or edit `.env*` files. Never expose secrets in logs, tests, reports, or output.
5. Never run live Supabase DDL or write queries. Never modify production data. If a schema change is required, author the additive migration, a read-only diagnostic/FINDING query where required, a VERIFY script, and real PostgreSQL tests. The owner applies migrations manually.
6. Do not install, upgrade, remove, or replace dependencies. Do not change lockfiles. Do not run production builds unless explicitly requested. Do not invoke subagents.
7. Do not edit unrelated files, generated coverage files, or code-intelligence graph artifacts. Do not weaken existing tests to force a pass.
8. No `any`, `@ts-ignore`, `eslint-disable`, fake APIs, placeholder UI, invented fixtures presented as production data, dead code, unused imports, or parallel domain engines.
9. English in code and comments; add/update required `fa`, `af`, and `en` localization keys together. Follow Dari glossary and existing terminology guidance.
10. Use logical RTL utilities and design tokens. Do not introduce raw hex colors, directional `left`/`right` styling, or ad-hoc button systems.
11. Do not silently convert unknown data to zero, infer currency/warehouse/branch, or sum across currencies. Preserve integer minor-unit money semantics and the repository's currency-specific precision (including AFN's existing zero-decimal treatment where applicable).
12. Preserve all existing data and stable identifiers. No destructive renames of stored business type IDs, roles, document types, event types, or local-sync command identifiers.
13. Every new write route must be added to the repository's concurrency-safety map. Follow its reversal-ledger and idempotency rules for every financial/inventory mutation.
14. Follow the documented file-edit discipline: inspect each target file and all required ranges before editing; plan all changes for that file; write each file once where practical; batch typechecks/tests after the complete edit set. Do not repeatedly re-read whole files as a substitute for tests.

## 2. Mandatory preflight and evidence collection

### 2.1 Establish repository truth

- Verify that the local checkout is the intended Hisabche repository and branch.
- Read all applicable agent instructions.
- Run `pnpm code-intel status --json` (or the documented equivalent) and record whether the index is `FRESH` or `STALE`.
- Use code-intelligence symbol search, symbol cards, callers/callees, impact analysis, and bounded source retrieval for every affected canonical symbol.
- If code intelligence is unavailable or stale, record the exact result and use scoped `rg`/source inspection. An empty search result is never proof that an implementation does not exist.
- Do not rebuild or manually modify generated code-intelligence data unless repository rules explicitly permit it for this task.

### 2.2 Reconcile live UI evidence with the checked-out source

The owner's live URLs and screenshot are acceptance references, not proof that `main` currently deploys the same source. Verify the actual implementation on the local checkout and, where authorized, compare it with the public UI and deployment revision.

Required pages:

- `https://hisabche.com/fa/invoices`
- `https://hisabche.com/fa/customers`
- `https://hisabche.com/fa/customers?view=contracts`
- `https://hisabche.com/fa/customers?tab=sessions`
- Customer outreach/task creation UI used as the multi-customer selector reference.

The uploaded screenshot shows the Customer Hub > Service Sessions area with the `Sessions`, `Repairs`, `Chairs and services`, and `Commission` sections, along with the `New session` action. Preserve this as a visual regression reference.

Record the deployment SHA if it can be obtained without privileged access. If live UI and checked-out `main` differ, do not “fix” the wrong revision. Identify the discrepancy, implement against the repository's actual current contracts, and state what needs deployment or human verification.

### 2.3 Build a traceable defect register before source changes

Create an audit matrix with one row per reported defect and these columns:

- Defect ID and user-visible symptom
- Reproduction path / URL / business profile
- Root-cause evidence (exact file, symbol, and relevant lines or test)
- Canonical domain owner and existing implementation to extend
- Data/schema and migration impact
- Server route/service and authorization/capability gates
- Local engine, offline outbox, and sync impact
- Shared UI, Web, Desktop, and Mobile consumers
- Activity/event/audit/notification coverage
- Regression tests required and tests already present
- Severity, remediation, verification evidence, and final status

Do not write “fixed” or “complete” while any part of the end-to-end chain remains unverified.

## 3. Architecture boundaries — extend the existing canonical cores

The source already contains substantial foundations. Locate and extend the existing implementations rather than creating equivalents beside them. Initial repository evidence includes:

- Invoice shared UI: `packages/ui/src/components/ui/invoices/containers/sales-hub-container.tsx`, `invoices-container.tsx`, `invoices-view.tsx`, plus the canonical backend invoice service and local-engine invoice routes.
- Customer hub and modal: `packages/ui/src/components/ui/customers/containers/customers-hub-container.tsx`, `AddCustomerModal.tsx`, `customer-view.tsx`, and the existing customer containers/hooks/services.
- Industry/business profile: `packages/ui-contract/src/business-types.ts`, `packages/ui/src/components/ui/onboarding/containers/onboarding-container.tsx`, `operating-questions.tsx`, `packages/validation/src/schemas/industry-profiles.ts`, `operational-dna.ts`, and `backend/src/services/workspace-profile.ts` / profile-capability middleware.
- Service delivery: `packages/validation/src/schemas/universal-core/service-delivery.domain.ts`, `packages/ui/src/components/ui/service-delivery/`, `backend/src/services/service-delivery/`, `packages/local-engine/src/routes/service-delivery.ts`.
- Appointment scheduling: `backend/src/routes/appointment.routes.ts`, `backend/src/services/crm/appointment.service.ts`, and the existing CRM appointment validation contract. Determine whether this or Service Delivery is the right existing core for internal staff meetings; do not assume they are interchangeable.
- Event/audit/activity/notifications: `backend/src/services/event-log.service.ts`, `event.service.ts`, `audit.service.ts`, `activity.service.ts`, `notification.service.ts`, corresponding routes/hooks/UI, and `docs/product-flow/18-EVENT-SIDE-EFFECT-MAP.md`.
- Offline/sync: `packages/local-engine`, `packages/app-shell/src/features/sync/`, canonical outbox/sync registries, and existing invoice/session round-trip tests.

A screen must not own a second accounting, inventory, session, customer-role, industry-resolution, or event engine. Respect the canonical architecture and existing ownership map.

## 4. P0 — Unified invoice list and safe pre-document finalization

### 4.1 Exactly three user-facing invoice filters

At `/fa/invoices`, expose exactly these three type filters:

1. **All** — every supported sales/purchase document, including eligible pre-sale and pre-purchase documents.
2. **Sales & Purchases** — regular sale and purchase invoices together in the same list/table.
3. **Pre-Purchases & Pre-Sales** — pre-purchase and pre-sale documents together in the same list/table.

The labels should use the project's translation conventions. The type filter must not create two or more disconnected tables, separate data engines, duplicate pagination, duplicate row actions, or inconsistent totals.

Implementation requirements:

- Keep the persisted canonical document type/direction explicit (`sale`, `purchase`, `pre_sale`, `pre_purchase`, or the checked-out equivalent). The UI grouping must not erase the underlying direction.
- Use one canonical list query/API contract and one shared table renderer. If existing advance/deposit records are currently exposed through a different endpoint, adapt the canonical query/read model so pre-documents are represented in the same table without duplicating source-of-truth rows or financial balances.
- Remove the current behavior where choosing `pre_sale` or `pre_purchase` replaces the invoice table with a separate `AdvancesContainer` view. Reuse existing advance logic as a row/data provider only where appropriate; do not create a second advance ledger.
- All three filters must share search, date/status filters, branch/warehouse scope where applicable, sorting, pagination, saved views, exports, permissions, empty states, loading states, and row-action behavior.
- `All` must include all four directions and never double-count a document.
- Preserve legacy deep links and query parameters by mapping them into the new 3-filter model. Old bookmarks must not produce a broken page or an invisible document.
- Ensure both Web and Desktop resolve to the same shared implementation. Verify Mobile list behavior if the route is available there.

### 4.2 Pre-sale and pre-purchase lifecycle: no final effects before explicit finalization

A pre-sale and a pre-purchase document is a proposal/commitment, not a completed sale/purchase. Creating, editing, saving, or viewing one must not trigger final stock, costing, or financial posting.

Before explicit finalization, enforce all applicable invariants:

- No sale stock decrement, reservation, stock issue, or available/on-hand quantity change.
- No purchase stock increment, receipt, shelving, or available/on-hand quantity change.
- No final inventory cost-layer creation/release, AVCO/FIFO recalculation, or product buy-price refresh.
- No revenue, expense, COGS, tax payable/receivable, accounts receivable/payable, invoice payment allocation, or general-ledger posting attributable to the pre-document.
- No finalized invoice number/state semantics unless the current domain explicitly requires a proposal number distinct from the final invoice number.
- No downstream sales performance/profit/KPI inclusion as a completed transaction.
- Preserve proposal totals as informational values, not posted accounting balances.
- If money is actually received as a deposit before finalization, it must use the existing deposit/advance liability model and its approved accounting treatment. Never silently book it as revenue or as a fully finalized sale. Confirm the existing owner decisions and financial model before changing that path.

Add a row overflow (`...`) action named **Finalize** (localized in all active languages) for eligible pre-sale and pre-purchase rows.

Finalize behavior:

1. Only authorized users with the correct transaction permission and any required workflow approval can see/execute it. A business capability never grants a person's permission.
2. Show a clear confirmation dialog that identifies whether this will finalize a sale or purchase, which party/document is affected, and the stock/financial consequences.
3. Execute one atomic, server-authoritative state transition. Use the existing canonical invoice posting/finalization service and the repository's required Postgres RPC for multi-table atomic writes. Do not create a second finalizer.
4. Enforce valid source states and reject invalid/cancelled/already-finalized documents.
5. Be idempotent under double click, retry, duplicate HTTP delivery, offline replay, and concurrent finalization from two devices. A document can be finalized exactly once.
6. For a finalized pre-sale, apply the normal sale effects exactly once: stock issue, cost release, tax/ledger/payment effects and relevant caches/KPIs.
7. For a finalized pre-purchase, apply normal purchase effects exactly once: stock receipt, cost layers, accepted buy-price refresh and corresponding financial/ledger treatment.
8. Update the canonical document state so every list, report, detail, sync consumer, and notification sees the same result.
9. Append an immutable audit/activity/event fact containing actor, workspace, document ID, prior state, final state, direction, timestamp, and correlation/idempotency information.
10. Emit the appropriate notification(s) only after the state transition is durably committed. A notification failure must not roll back a correctly committed transaction or cause the financial operation to be replayed; it must be recoverable from the outbox.
11. Provide a safe, explicit error when the finalization is blocked by validation, approval, capability, credit, stock, or missing prerequisites. Do not silently convert a failure to success.

### 4.3 Invoice acceptance tests

Add or extend focused tests proving:

- All four document directions render in one list with exact totals and no duplicates.
- The three filters group documents correctly and retain search, status, sorting, pagination, and deep-link compatibility.
- Create/edit/save a pre-sale does not change stock, costing layers, ledger, tax, AR, revenue, or sales KPIs.
- Create/edit/save a pre-purchase does not change stock, costing layers, ledger, tax, AP, expense, or purchase KPIs.
- An explicitly received deposit is represented only by the canonical advance/liability pathway.
- Finalize pre-sale applies sale side effects exactly once.
- Finalize pre-purchase applies purchase side effects exactly once.
- Double click, retry, idempotency replay, simultaneous requests, sync replay, and crash recovery cannot duplicate effects.
- Unauthorized roles and profiles cannot bypass the route-level permission/capability checks.
- Cancelled/invalid documents cannot be finalized.
- Reversal/return paths after finalization preserve existing financial and inventory invariants.
- Test at least two currencies, multiple branches/warehouses where relevant, more than one workspace, and the existing integer-minor-unit conventions.
- Web and Desktop use identical behavior; offline behavior queues the exact canonical mutation and never locally fabricates a posted ledger.

## 5. P0 — Customer / supplier role integrity and role-aware table

### 5.1 Remove the duplicate “Both” option for new records

On the Add Customer modal at `/fa/customers`, leave exactly two creation choices:

- **Customer** (canonical buyer/customer role)
- **Supplier** (canonical seller/supplier role)

Remove the **Buyer and Seller / Both** option from the new-record UI and from new-create payload defaults. Do not create a new record with a `both` role through this modal.

Compatibility requirements:

- Inspect all stored role representations, API schemas, imports, existing customer records, offline records, and role-resolution logic before editing the enum.
- Preserve pre-existing `both` rows. Do not silently rewrite historical records into customer-only or supplier-only records.
- If historic `both` remains a valid read model, render it as both roles (or the approved localized equivalent) while keeping new creation restricted to the two requested choices.
- Ensure existing customer/supplier filtering, invoice party selection, payments, balances, and imports continue to work.
- Do not break legacy values during sync, migration, or export.

### 5.2 Correct the shared table's Role column

The shared table shown for All, Customer, and Supplier currently renders a first column whose header is statically “Customer”. Correct the model rather than only changing its label:

- Add a stable **Role** column whose header is “Role” in every tab.
- Render the actual persisted/resolved role on each row: Customer, Supplier, or both for legacy records where the existing model supports both.
- Keep the person's/business's name in its own **Name** column. Do not replace names with role text.
- All, Customer, and Supplier must use the same data contract, role rendering, table configuration, and row identity.
- The Customer filter must not show supplier-only rows; the Supplier filter must not show customer-only rows. Legacy dual-role rows must follow the existing role-resolution contract and be tested.
- Do not infer role from debt, sales totals, invoice direction, or display tab.
- Confirm the backend response contains the role field before rendering it. Do not fabricate client-side roles when the server has not returned them.

### 5.3 Customer acceptance tests

- Add modal offers only Customer and Supplier.
- New customer persists the canonical buyer/customer role; new supplier persists seller/supplier role.
- Existing `both` data remains readable and is not destructively migrated.
- All three table views show the same Role header and correct per-row values.
- Name remains a separate column.
- Role filters are correct for new and legacy records.
- Server schema, local database, offline queue, imports, and API response remain compatible.

## 6. P0 — Business-profile-aware industry behavior and onboarding correctness

The user reports that even after answering all onboarding operating questions, certain service/contract features remain visible for a clothing business and some cores behave as if the business were still a generic or hardcoded retail shop. Treat this as a cross-layer data-resolution and capability-wiring defect until evidence establishes otherwise.

### 6.1 One canonical business profile and one feature-availability decision

Audit and use the existing persisted profile source (`business_types` / workspace profile and the approved resolver), primary-industry rule, operational DNA, capability registry, and current industry support matrix. Do not add a parallel industry list or one-off conditional logic to individual pages.

For each feature, distinguish the following independent decisions:

1. **Industry/profile support:** Is this business model meant to use the capability?
2. **Operational DNA/configuration:** Does the business's persisted operating setup require/show this feature (for example, physical resources, branches, staff, warehouses, service delivery)?
3. **Actor authorization:** Does the signed-in person have the required permission?
4. **Plan/entitlement:** Is this feature included in the workspace's plan?
5. **Platform/runtime availability:** Is the action available online/offline on this host?
6. **Personalization:** Has the user hidden/reordered an otherwise available feature in page preferences?

These gates must be composed in one reusable decision path. A preference may hide an available feature; it must never make an unsupported feature available. A permission may authorize a person; it must never activate a capability missing from the business. A business profile must never grant a permission or bypass a plan.

Do not default unknown, missing, stale, or undeclared businesses to Clothing, Retail, or Physical Goods. Do not infer the business profile from route name, product count, stock rows, translated labels, or current menu state. Do not conflate a generic profile with a supported one.

Respect existing multi-industry and primary-industry ADR semantics. Do not invent a union/intersection policy for selected trades. Find and apply the canonical documented resolver behavior; add tests for multi-selected trades and explicit primary-trade selection.

### 6.2 Verify onboarding persistence end to end

- Trace every business model/trade selection and every question returned by the current `operatingQuestionsFor(...)` into store state, save payload, backend validation/route, persisted workspace/profile state, read-back hook, and profile resolver.
- Do not assume there are exactly nine fields based only on the owner's description. Test every currently defined onboarding question and the nine-answer completion scenario the owner described.
- Complete onboarding, hard-refresh, log out/in, open on a second device, and verify the same selected trades, primary industry, currency, and operating answers are restored from server state.
- Ensure stale local state cannot overwrite newer persisted profile answers. Ensure a failed save is visible and retryable; never show “complete” if the server did not persist the profile.
- Verify the existing `OnboardingContainer` path actually persists all collected answers to the canonical workspace profile and that the profile capability resolver reads those values.
- Test a brand-new workspace, a pre-provisioned workspace, an incomplete onboarding state, a restored session, a multi-trade workspace, and the generic/Other path.

### 6.3 Repair the specific contracts exposure

`/fa/customers?view=contracts` must not be available in the Clothing profile merely because the user has `invoice.read`.

- Gate the Contracts section through the canonical contract capability and the actor's independent permission/plan checks.
- Gate the tab in both the normal segmented control and direct URL/query-parameter initialization. A hidden tab must not remain reachable by manually entering `?view=contracts`.
- Apply the same check to backend APIs; UI hiding is not authorization.
- Preserve access for business profiles whose support matrix and actual workflow evidence say contracts are supported.
- If the owner expects a Clothing-specific supplier agreement or garment-job contract, that must be an explicitly supported workflow with evidence, not the generic contract engine leaking into the menu.

### 6.4 Make Service Sessions sections industry-aware

The current `CustomersHub` has these sections:

- Sessions
- Repairs
- Chairs and services (salon setup/resources)
- Commission

Use the existing feature capability/profile registry to determine which sections are offered. Never let `pageLook` alone decide business support.

Expected behavior to prove and implement:

- **Clothing retail/wholesale:** show the generic session area only if its canonical business workflow is supported; hide Repairs and salon Chairs/Services. Do not delete those feature implementations globally.
- **Mechanic / repair businesses:** show repair-ticket workflows only when the profile capability is supported and wired.
- **Mobile-phone / electronics repair businesses:** show repair workflows only when their specific supported profile allows them.
- **Barber / beauty salon businesses:** show service sessions and the appropriate chairs/rooms/service catalogue; show commissions only where the existing payroll/commission capabilities and permissions permit them.
- **Other industries:** only show the sections supported by their actual capability rows and operational DNA. Do not infer support just because a section exists in code.

The above are profile expectations to verify against current registry/support documentation. If the current support matrix says a workflow is not implemented, do not falsely label it supported. Either complete the in-scope workflow end to end or report a precise implementation blocker and mark it unsupported rather than exposing a broken tab.

Update the page preferences/customizer so it lists only sections that are available to the active profile and person. A stale saved preference for a now-unsupported tab must not force-render it. Profile changes must cause menus, deep links, and section states to re-resolve.

### 6.5 Repair incomplete Repairs and Commission workflows

Audit `RepairTicketsSection` and `CommissionSection` end to end:

- create/read/update/status changes
- proper customer and device/item identity for repairs
- technician/practitioner assignment
- parts/consumables and inventory effects, if the approved workflow supports them
- estimates, deposits, completion and handover
- commission calculation basis, eligible staff, period, reversals, payroll linkage, and audit trail
- workspace/branch scope, role permissions, capability and plan gates
- offline/outbox/sync behavior if advertised for those modules
- activity/event/notification coverage
- responsive/RTL/i18n UI and empty/error/loading states

Reuse existing service, repair, payroll, inventory, and accounting cores. Do not add a second repair ticket engine or a second commission formula. A module is not “available” merely because its tab renders.

### 6.6 Industry acceptance matrix

Add evidence-backed tests for at least:

- Clothing
- Retail and wholesale
- Barber
- Beauty salon
- Mechanic
- Mobile-phone repair
- General service business
- Other/unknown profile
- One multi-trade business with an explicit primary trade

For each, assert the feature list, contract access, sessions subtabs, repairs, salon resources, commissions, and direct-URL behavior. Assert both positive and negative cases. Test reload/persistence and permission separation. Do not copy expected capability values into a second hardcoded registry; derive the test expectations from the canonical capability matrix or a test fixture that validates that source.

## 7. P1 — Customer and employee sessions / appointments

### 7.1 A top-level participant switch

At the top of the “New Session” form, add a clear, accessible switch/segmented control:

- **Customer**
- **Staff**

This selection changes the participant identity and the valid form fields. It is not merely a visual filter.

Customer mode:

- Allow selecting multiple customers using the same accessible multi-select interaction already used by the customer selector in the existing task/outreach creation flow.
- Keep the selection searchable and keyboard/touch accessible.
- Render selected customers as removable chips/tokens and support no-results, loading, error, and retry states.
- Preserve tenant scoping and only expose customers the current workspace can access.

Staff mode:

- Select the relevant internal employee(s) from the canonical employee/HR directory, scoped to the workspace and any applicable branch/department/permission rules.
- Never write an employee ID into `customer_id`, a customer ID into `employee_id`, or rely on the UUID alone to guess identity type.
- Use an explicit typed participant discriminator and correct foreign keys/relationships in the canonical scheduling model.
- Ensure the UI's Customer/Staff switch maps to distinct persisted identity fields and distinct participant display labels.

### 7.2 Choose the correct existing domain before modifying schema

Trace the existing Appointment/CRM scheduler and the Universal Service Delivery core, along with calendar/HR scheduling functionality. Determine which core represents:

- a customer-facing service session,
- an internal employee meeting/session,
- a staff member/practitioner assigned to deliver a customer service.

Do not confuse the session participant with the practitioner/executor. A meeting attendee is not automatically the employee who performs a service. Do not create a parallel `meeting`, `session`, or `appointment` system if one canonical scheduler can safely represent the distinction.

If the existing domain cannot represent a multi-participant customer or staff event, extend it with a typed, normalized participant relationship and explicit constraints. Do not store multiple IDs as comma-separated strings or an unvalidated JSON blob. Preserve old records and provide a safe additive migration if needed.

### 7.3 Customer/session form design

In Customer mode, update the title/help text to the owner-requested copy, using natural localized Persian equivalent of:

> «جلسه‌ای که مدنظرتون هست رو ثبت بکنید.»

The top form section must contain the **Customer** and **Service** fields. Visually group them inside a clean, modern, accessible section, then add a distinct divider/border before the lower scheduling details. Use consistent spacing, clear labels, responsive behavior, and RTL-safe layout. Keep the same design language as the rest of Hisabche; do not add generic glass/neon styling.

- Customer picker: multi-select, based on the existing task/outreach customer picker pattern.
- Service: preserve the actual canonical offering/service relationship where it exists. Do not replace a required accounting/service reference with arbitrary text merely to simplify the UI.
- **Session Type:** find the exact current field shown as a fixed/select control and change that field to a free-text input. Users must be able to enter their own session type; there must be no fixed business-type enum/options list in this field. Use appropriate text validation for storage/security, but no restrictive predefined option list. If “session type” and “service offering” are separate fields in source, keep them separate.
- Keep date, start time, duration, and derived end time behavior consistent with the existing shared domain validation.
- If customer mode permits more than one customer, the persistence/read/list/detail/notification and sync flows must correctly represent all selected customers. Do not silently keep only the first selected customer.

### 7.4 Remove settlement from session creation

The “More” accordion summary must be:

> **More — executor, branch, note**

Remove “default settlement” from this creation form. A booking is not a delivery or an accounting settlement.

- Do not show a settlement selector in the create form.
- Do not persist a misleading preselected settlement merely because the current UI has a default value such as `package_credit`.
- Keep settlement choice and any related credit consumption/invoice linkage in the correct delivery/fulfillment flow, where the actual service completion is recorded.
- Preserve `practitioner/executor`, `branch`, and `note` in More. Keep them available only when appropriate to the selected participant and industry profile.
- Audit whether the current domain schema or database requires `settlement_method` at session creation. If it does, evolve it safely to an explicitly undecided/pre-delivery state where appropriate, rather than silently assigning a settlement. Inspect all old rows, constraints, server/local-engine schemas, sync compatibility, and tests before deciding.
- Do not change the established delivery invariant: a delivered service that consumes package credit, links an invoice, or is complementary must settle through the canonical delivery action and its audit/reversal rules.

### 7.5 Session acceptance tests

- Switch Customer/Staff changes the typed participant flow and validation.
- Customer mode can choose multiple customers and persists/reloads all of them.
- Staff mode selects valid employees and never writes their IDs to customer columns.
- A practitioner/executor can be distinct from the meeting/session participant.
- Customer and Service fields are grouped with the divider in the correct order.
- Session Type is free text and accepts a value absent from any former enum.
- “More” contains only executor, branch, and note; no settlement UI or silent settlement default is stored at booking time.
- The schedule flow does not create invoice, ledger, stock movement, or package consumption before the actual delivery/fulfillment action.
- Customer session delivery and cancellation retain current accounting/package credit/reversal behavior.
- Test conflict detection, multiple participants, workspace scoping, branch scope, roles, offline creation, sync replay, and cross-device hydration.

## 8. P1 — Complete event, activity, audit, and notification coverage

The owner reports that many business actions never appear in notifications. Audit every write path across every business core; do not fix only invoice notifications.

### 8.1 Separate four concerns and make them consistent

- **Domain event:** durable fact that a business state transition occurred.
- **Audit trail:** immutable actor/action/before-after evidence for accountability and record history.
- **Activity feed:** readable business timeline for users/admins.
- **Notification:** recipient-facing inbox/push/email signal for a meaningful event.

They are related, but they are not interchangeable. A notification row alone is not an audit trail. A console log is not durable event storage. A UI toast is not a persisted notification.

Every meaningful successful business mutation must have a durable, workspace-scoped event and the expected audit/activity record. Every user-relevant event must produce the correct notification for the correct recipients according to the product's notification policy. Do not send noisy notifications for reads, focus changes, page navigation, or harmless local UI preferences. Do not silently omit business state changes.

### 8.2 Audit the full mutation surface

Enumerate routes/services and domain mutation entry points across, at minimum:

- customer/supplier creation, update, archive, role changes, and balance/credit changes
- invoice create/update/finalize/cancel/return and all purchase/sale/pre-document actions
- payment receipt, allocation, refund/cancellation, and till/cash operations
- inventory adjustments, transfers, stock receipts, stock issues, counts, and costing-affecting changes
- products, variants, units, pricing, price lists, and promotions
- purchase orders/receiving where still supported
- service session/appointment create, assignment, check-in, progress, delivery, cancellation, no-show, and reschedule
- repairs, repair status, parts/consumables, technician assignment, and handover
- employee create/update/termination, attendance, shifts, payroll, commission, and leave
- contracts, contract billing, termination, SLA breach, and lease/asset return
- data import/migration, sync conflict resolution, and owner-approved corrections

Use the existing `docs/product-flow/18-EVENT-SIDE-EFFECT-MAP.md` as a starting point, not as proof of complete coverage. Reconcile it against the real route/service graph and update its status and evidence after implementation.

### 8.3 Reliable event/outbox semantics

- Use the existing `logBusinessEvent`, EventService, activity/audit services, notification service, and canonical event types/registry. Extend them; do not create a parallel logger.
- Identify all successful mutation paths that fail to call the canonical event path and all handlers that can fail after the business write.
- For multi-table financial/inventory changes, persist the domain mutation and a durable outbox/event record atomically in the same approved Postgres RPC/transaction. Never rely on an unawaited best-effort call as the only evidence that the event exists.
- Process notifications after commit from the durable outbox/claim mechanism. Use bounded retries, lease/recovery, dead-letter/attention state, and observable failure records as the existing architecture supports.
- Use deterministic idempotency/correlation keys derived from the business command/document transition. Do not generate a new unrelated event for the same command on every retry.
- Ensure one business action produces one logical event/notification even with duplicate HTTP requests, retries, offline replay, worker concurrency, or process restarts.
- Keep workspace and actor scope explicit on every record. Never invent a workspace ID or resolve an ambiguous active workspace by selecting the first membership.
- Select recipients from the relevant workspace/branch/role/assignment and notification rules. The actor, owner, affected assignee, and other recipients must not be guessed.
- Invalidate notification/activity caches only after correct persistence. Verify unread counts, pagination, realtime refresh, and deep links.
- Ensure notification text is localized and accurately describes the action, entity, direction, and status. No false “success” if the write failed.
- If notification delivery fails after a successful domain mutation, the durable event must remain recoverable and observable; never replay the financial mutation to retry its notification.

### 8.4 Notification/event acceptance tests

Create a mutation-to-event coverage table and tests that prove each in-scope mutation:

- writes exactly one durable event,
- writes the expected audit record and activity entry,
- creates the correct notification(s) for the intended recipient(s),
- uses the correct workspace and branch scope,
- updates unread counts and activity/notification views,
- survives worker failure/retry/restart,
- is idempotent during offline replay and duplicate requests,
- does not emit notifications for failed or rolled-back transactions,
- does not leak records across workspaces or users,
- preserves event records when the notification subsystem is temporarily unavailable.

Test representative flows end to end and add a guard test that discovers unregistered mutating routes or business writes without event coverage. Do not claim 100% coverage without a measured route/mutation inventory.

## 9. P1 — Consistent green primary create/add actions

The owner wants actions that create/add business records to use the same green primary treatment as the existing “New Invoice” action.

Audit the shared component variants and every relevant creation entry point (customer, supplier, invoice, employee, product, warehouse, session, repair, contract, task, payment where creation is a primary action, and other actual add/create forms).

- Prefer the existing shared `Button`/`ActionButton` primary variant and the established primary design token (`hsl(var(--color-primary))`). Do not hardcode a new green.
- Align size, weight, radius, hover, focus, disabled, loading, and icon treatment with the existing “New Invoice” CTA.
- Primary create/add/save actions should be green and visually consistent across Web/Desktop and mobile shells.
- Secondary navigation, cancel, filters, refresh, and neutral actions remain neutral. Destructive actions remain destructive; do not turn every button green.
- Fix the customer header's current outlined/muted Add button through the shared component/variant where appropriate.
- Do not create a second button component or change every button in the product indiscriminately.
- Test that all in-scope create actions resolve to the same primary variant/token and remain accessible in RTL, keyboard, and mobile layouts.

## 10. Cross-cutting requirements

### 10.1 Permissions, capabilities, and tenant isolation

- Workspace ID is the security boundary.
- Every tenant data read/write is scoped to `workspace_id`.
- Read the role from `request.tenancy.role`.
- Keep role authorization, business capability, plan entitlement, and runtime availability separate.
- Direct URLs, API calls, local-engine routes, and UI visibility must agree.
- Do not use UI hiding as a security boundary.

### 10.2 Offline-first behavior

- Preserve the canonical local-first domain core and outbox ownership.
- A local pre-document draft may be stored offline, but finalization must use the approved idempotent command and must not create a fabricated posted ledger locally.
- Maintain deterministic IDs/command identity through sync; do not overwrite newer local work with stale server hydration.
- Conflict resolution for finance is explicit; no last-write-wins for money or finalized invoice effects.
- Ensure typed session participants and profile capability state hydrate and sync consistently.
- Preserve the existing mobile framework/runtime constraints; do not upgrade Expo/React Native or enable the New Architecture as part of this task.

### 10.3 Localization and terminology

- All new/changed labels, helper text, toast messages, statuses, row actions, notifications, and error messages must be present in `fa`, `af`, and `en`.
- Use the Dari glossary for `af`; do not simply copy Persian.
- Keep terminology distinct and consistent (customer vs supplier; pre-sale vs pre-purchase; draft/proposal vs finalized; session participant vs executor/practitioner).
- Missing i18n keys must be caught by automated tests.

### 10.4 Accessibility and responsive behavior

- RTL-correct layout and logical CSS properties.
- Keyboard-accessible tabs, switches, multi-select, action menu, confirmation dialog, and form validation.
- Meaningful labels, descriptions, `aria-*` semantics, focus management, visible focus, and reduced-motion support.
- Test desktop and narrow mobile layouts without clipped menus or inaccessible selected tokens.

## 11. Required implementation phases — execute in order, do not stop at documentation

### Phase 0 — Preflight and baseline

Record repository state, applicable rules, code-intelligence state, baseline focused test results, and live-vs-source discrepancy. Protect all pre-existing work.

### Phase 1 — Root-cause audit and acceptance map

Build the defect register and cross-core dependency map. Identify canonical owners and exact source/test paths. Write the audit result before code changes. Do not duplicate the codebase map or existing architecture specifications; reference and update the correct source documents.

### Phase 2 — Invoice list and pre-document financial safety

Implement the 3-filter shared list; move pre-documents into the same shared query/table; implement explicit idempotent finalize transaction; add stock/ledger/financial/event tests.

### Phase 3 — Customer/supplier role and table correction

Remove “Both” only from new creation; preserve historical values; add a real Role column and keep Name separate; test role resolution and all filters.

### Phase 4 — Industry/onboarding capability wiring

Fix the single canonical profile/capability resolution path; persist and restore all onboarding answers; gate Contracts and service subtabs by true business capability plus permission/plan/runtime; finish or honestly disable incomplete repairs/commission workflows by supported status.

### Phase 5 — Customer/staff session creation

Extend the right existing scheduling core; add typed Customer/Staff switch; customer multi-select; staff participant selection; free-text Session Type; separated Customer/Service section; remove booking-time settlement and verify delivery-time settlement.

### Phase 6 — Event and notification completeness

Audit all business mutations, connect missing paths to the canonical durable outbox/event/audit/activity/notification pipeline, and add coverage guards.

### Phase 7 — Shared CTA consistency and final UX pass

Standardize in-scope create/add primary actions on the existing green primary token and verify RTL/responsive/accessibility behavior.

### Phase 8 — Regression, cross-platform, and release-readiness gates

Run the focused and package-level checks required by repository instructions. Run relevant real HTTP/DB tests and local-engine/sync tests. Inspect all diffs. Record every remaining blocker; do not manufacture a clean result.

## 12. Required verification commands and proof

Run only commands permitted by the repository. From each changed package, use the repository's prescribed equivalents of:

- `npx tsc --noEmit`
- `npx vitest run <focused-test-files>`
- `npx eslint <each-modified-file>`
- `git diff --check`
- `git status --short`
- `git diff --stat`
- `pnpm code-intel status --json`

For backend business logic, run the relevant `buildServer()` + `app.inject` HTTP tests and real PostgreSQL (`*.pg.test.ts`) tests where available. A source-assertion test alone is not proof of database behavior. Do not run a production build unless explicitly authorized.

Minimum test areas (find the actual current filenames first; extend rather than duplicate):

- Invoice and finalization: `backend/src/__tests__/invoice-*`, `packages/local-engine/src/__tests__/invoice-*`, `packages/ui` invoice and sales hub tests, API invoice hooks, offline invoice round-trip tests.
- Customer roles: `backend/src/__tests__/customer-declared-role*`, `customer-role-resolution.test.ts`, `packages/ui/src/__tests__/customers-hub.test.ts`, customer role switch tests.
- Industry/onboarding: `packages/ui/src/__tests__/industry-profile-registry.test.ts`, onboarding composition/bootstrap tests, `packages/validation/src/__tests__/industry-profiles.test.ts`, operational DNA and workspace-profile tests.
- Service delivery/sessions: `packages/ui/src/__tests__/service-delivery-screen.test.tsx`, `service-delivery-model.test.ts`, service session wiring tests, validation service-delivery tests, backend service-delivery HTTP/PG/sync-roundtrip tests, appointment conflict tests.
- Events/notifications: `backend/src/__tests__/notification-keys.test.ts`, workspace-scoped notification tests, task notification tests, event claim tests, activity/audit tests, and each domain mutation test added by this task.

The exact test list must be grounded in the checked-out tree; the examples above are navigation hints, not guarantees that every filename exists in every revision.

## 13. Required deliverables in the repository

Create/update only task-relevant files, with clear ownership and no duplicate documentation. At minimum produce:

1. `docs/audit/HISABCHE-CROSS-DOMAIN-INTEGRITY-AUDIT.md` — defect register, exact root causes, source evidence, severity, ownership, and before/after status.
2. `docs/audit/HISABCHE-MUTATION-EVENT-COVERAGE.md` — route/service mutation inventory and event → audit → activity → notification coverage with exact verification evidence.
3. `docs/audit/HISABCHE-INDUSTRY-CAPABILITY-REGRESSION-MATRIX.md` — profile × capability × route × permission × runtime matrix and tests.
4. `docs/audit/HISABCHE-REMEDIATION-VERIFY.md` — commands, exact exit codes/counts, test scenarios, migrations and human-run verification steps.
5. For every required database change: additive `docs/<feature>-migration.sql`, read-only diagnostics/FINDING SQL where required, `docs/VERIFY-<feature>.sql`, rollback instructions, and a real `*.pg.test.ts` that runs the migration twice and verifies both allowed and refused writes.

If equivalent canonical documents already exist, update those rather than creating near-duplicates. Keep generated coverage documents generated by their canonical scripts.

## 14. Definition of Done — every gate must be evidenced

The task is not done until all applicable rows below have evidence:

| Gate                    | Required evidence                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Repository integrity    | Existing work preserved; no prohibited Git operations; exact `git status`/diff summary                                         |
| Invoice UI              | Exactly 3 type filters; one table; all 4 directions; shared filters/actions/pagination                                         |
| Pre-document safety     | No stock/costing/final financial effects before finalize, proven by tests and real DB assertions                               |
| Finalization            | Atomic, authorized, idempotent sale/purchase transitions with correct side effects and audit/event                             |
| Customer roles          | Only Customer/Supplier for new records; legacy Both preserved; correct Role and Name columns                                   |
| Industry profile        | Server-persisted onboarding answers survive reload/device; no retail/clothing fallback; capability/permission separation       |
| Contracts               | Clothing profile cannot render or call unsupported contracts; supported profiles can use verified contracts                    |
| Session tabs            | Clothing hides Repairs and salon-specific resources; other profiles show only evidenced capabilities                           |
| Repairs/commission      | Full workflow verified or section honestly unavailable; no false support status                                                |
| Session participant     | Customer/Staff are typed correctly; multi-customer and employee records persist/reload; no identity collision                  |
| Session form            | Correct copy, Customer/Service grouping/divider, free-text Session Type, More excludes settlement                              |
| Event pipeline          | Full mutation inventory; durable idempotent event/audit/activity and correct notifications for meaningful successful mutations |
| CTA design              | All in-scope create actions use established green primary token/variant; secondary/destructive remain correct                  |
| i18n/accessibility      | `fa`, `af`, `en`; RTL, keyboard, screen-reader, responsive acceptance                                                          |
| Cross-platform/offline  | Web/Desktop/shared UI/local engine/sync behavior remains consistent; no duplicate offline or server writes                     |
| Automated verification  | Relevant typechecks, lint, unit, HTTP, PG, sync and regression tests with exact results                                        |
| Production verification | Clearly separate code/test evidence from live production verification; never claim live DB verified if it was not              |
| Documentation           | Audit, event matrix, industry matrix, migration/verify docs and final evidence are current                                     |

## 15. Final report format (Persian report; English artifacts)

Report in Persian using the repository's standardized statuses. Do not claim `VERIFIED_COMPLETE` without the exact real HTTP/DB verification that supports it. Report separate statuses for:

1. Implementation
2. Automated tests
3. Runtime/device verification
4. Production/database verification
5. Harness/MCP access
6. Code-intelligence index freshness

Then list:

- Every changed file and why it changed
- Exact commands run and their observed exit codes/results/counts
- Tests not run and why
- Defects not fixed and the precise blocker
- Any assumptions and migration/run order for the owner
- Remaining human-run production verification

Include `files edited: N, total edit operations: M`. Do not use invented test totals, guessed runtime behavior, or a general “all done” statement.

## 16. Execution instruction

Start with the preflight, then write the full audit register before touching source. Once the audit is documented, immediately proceed with the implementation phases in order. Do not stop after the report, do not ask the owner to repeat details already specified here, and do not request routine confirmation for safe in-scope work. Make the best evidence-backed implementation possible within the repository's governance. Stop only for a genuine owner-only decision, missing external credential, unsafe live operation, or schema/financial ambiguity that cannot be resolved from approved architecture decisions; document the exact blocker and complete all independent safe work.

**The goal is a verified and coherent product, not a larger backlog or another superficial UI patch.**
