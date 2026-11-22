# Hisabche — Read-Only Codebase Audit Notes

**Repository inspected:** `hamednourzaei/hisabche`  
**Reference branch:** `main`  
**Inspection date:** 2026-11-21  
**Inspection mode:** GitHub connector, read-only source inspection  
**Important limitation:** The local repository working tree was not mounted in this execution environment. The GitHub write API available here creates commits, which conflicts with the repository's explicit no-commit/no-push rule. No source file was changed, no remote write was made, and no test/build command was run. These notes are preliminary source findings, not a claim of runtime or production verification.

## 1. Confirmed findings from the inspected `main` source

### A. Invoice pre-documents are routed into a different view instead of the shared invoice table

**Evidence**

- `packages/ui/src/components/ui/invoices/containers/invoices-container.tsx`
- `packages/ui/src/components/ui/invoices/invoices-view.tsx`
- `packages/ui/src/components/ui/invoices/containers/sales-hub-container.tsx`

The current invoice container reads `pre_sale` and `pre_purchase` as advance kinds and supplies an `AdvancesContainer` through `advancesSlot`. The ordinary invoice table is rendered when no advance kind is active. `InvoiceTypeFilter` contains five values: `all`, `sale`, `purchase`, `pre_sale`, and `pre_purchase`.

The Sales Hub itself currently declares three higher-level tabs (`invoices`, `orders`, `pricing`). Its comments describe the invoice tab as a common list of sale and purchase invoices, while pre-sale/pre-purchase are handled through the invoice page's type-filter/advance slot. This is important: the owner's “five items” appears to refer to the inner invoice type filters, not necessarily the top-level Sales Hub tabs. Confirm against the live deployment before changing the top-level hub.

**Implication**

The correct change is to unify the inner list/read model and the pre-document rows, not simply rename tabs or create another table. Trace the canonical database/document type and the advance ledger before changing lifecycle semantics.

### B. Customer creation exposes a third `both` role

**Evidence**

- `packages/ui/src/components/ui/customers/AddCustomerModal.tsx`

The component defines `initialRole` and local state as `buyer | seller | both`, and its `SegmentedControl` presents all three options. The create request sends the selected value as `declaredRole`.

**Implication**

The requested two-choice UI can be implemented in this shared modal, but first inspect the persisted role schema, imports, API validation, and historical records. Remove `both` from new creation without deleting or silently converting existing dual-role records.

### C. The first shared customer table column is statically labeled “Customer” and does not show a role

**Evidence**

- `packages/ui/src/components/ui/customers/customer-view.tsx`

`useCustomerColumns` currently defines the first column with a fixed `customers.customer` label/fallback and renders the person's name. There is no separate actual role cell in that definition. The role filter is passed from the customer hub/container.

**Implication**

Do not merely relabel the existing name column to “Role”. Add a true role column with the actual buyer/customer, seller/supplier, or preserved legacy dual-role value, and keep the person's name in a separate column. Confirm the API already returns the authoritative role.

### D. Customer hub service subtabs are not gated by business profile capabilities

**Evidence**

- `packages/ui/src/components/ui/customers/containers/customers-hub-container.tsx`

The file defines `SESSION_SECTIONS = ['sessions', 'repairs', 'salonSetup', 'commission']`. The sections are currently filtered by `look.shows(...)`; commission additionally checks `payroll.read`. The page preference is therefore deciding which section is displayed, but the source section shown does not compose a business-profile capability check for Repairs or Salon Setup.

**Implication**

A clothing profile can inherit or display irrelevant sections based on saved page preferences even when those features are not part of its business model. Resolve availability from the canonical profile/capability model first; then apply authorization, plan/runtime gates, and finally personal visibility preferences. Do not delete repair/salon modules globally.

### E. Contracts view is permission-gated but not industry-capability-gated in the inspected hub

**Evidence**

- `packages/ui/src/components/ui/customers/containers/customers-hub-container.tsx`
- `packages/ui/src/components/ui/customers/contracts-section.tsx`

The hub exposes `contracts` when `mayReadContracts` is true, and `mayReadContracts` is currently defined using `capabilities.can('invoice.read') !== false`. The `ContractsSection` independently checks invoice read/create permissions. The inspected hub code does not show a contract-industry capability guard or a direct-query guard.

**Implication**

The feature appears to be exposed to any profile whose actor can read invoices. Add the existing canonical contracts capability/profile check at the hub, direct URL initialization, and backend route. Do not assume Clothing support merely because invoice permission is present.

### F. Session creation is customer-only and contains a booking-time settlement default

**Evidence**

- `packages/ui/src/components/ui/service-delivery/service-session-create-dialog.tsx`
- `packages/validation/src/schemas/universal-core/service-delivery.domain.ts`
- `backend/src/routes/appointment.routes.ts`
- `backend/src/services/crm/appointment.service.ts`

The current Service Session create dialog receives `customerOptions`, keeps a single `customerId`, requires a service offering, and sends `settlementMethod` from local state initialized to `package_credit`. Its “More” summary includes the default settlement text. The shared Service Delivery create schema also requires/defaults a settlement method, while its domain comments state that settlement is selected at delivery and that delivery is a settlement action.

A separate CRM Appointment API already has `customerId`, `staffEmployeeId`, `serviceProductId`, and a date/time range. It is not automatically interchangeable with Service Delivery: the executor/practitioner and the participant/attendee may be different concepts.

**Implication**

A Customer/Staff switch is a typed-domain change, not a visual-only toggle. Trace the appointment and service-delivery callers and data schemas before choosing a canonical schedule representation. Customer multi-select needs a normalized relation/read model, not a comma-separated ID string. Remove booking-time settlement only after safely evolving the shared contract, database constraint/default, server route, local-engine route, sync shape, old rows, and delivery tests.

### G. Event and notification infrastructure exists, but there is evidence of partial coverage and fire-and-forget behavior

**Evidence**

- `backend/src/services/event-log.service.ts`
- `backend/src/services/event.service.ts`
- `backend/src/services/notification.service.ts`
- `docs/product-flow/18-EVENT-SIDE-EFFECT-MAP.md`

The repository has a business event logger, event processor, notification service, activity/audit integration, and an event side-effect map. The map itself labels webhook runtime verification as partial. The event processor emits an event then kicks processing asynchronously. `logBusinessEvent` is documented as a best-effort/fire-and-forget path, and it writes audit/activity records when called.

**Implication**

The issue is likely incomplete wiring of individual mutation paths and/or reliability/recipient coverage, not absence of all event infrastructure. Enumerate every write route/service and compare it to the existing event map. For business mutations that must not lose events, persist a transactional outbox fact with the business operation and process recipient notifications after commit. Keep audit/activity/notification semantics distinct and idempotent.

## 2. Relevant existing architecture and tests discovered

| Area                         | Existing source / test references                                                                                                                                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invoice shared UI            | `packages/ui/src/components/ui/invoices/containers/sales-hub-container.tsx`, `invoices-container.tsx`, `invoices-view.tsx`                                                                                                       |
| Invoice backend              | `backend/src/routes/invoice.routes.ts`, `backend/src/services/invoice.service.ts`, `backend/src/services/accounting/invoice-posting.domain.ts`                                                                                   |
| Invoice local engine         | `packages/local-engine/src/routes/invoices.ts`                                                                                                                                                                                   |
| Invoice regression tests     | `backend/src/__tests__/invoice-*`, `packages/local-engine/src/__tests__/invoice-*`, `packages/ui/src/__tests__/invoice-*`, offline invoice tests                                                                                 |
| Customer roles               | `backend/src/__tests__/customer-declared-role*`, `customer-role-resolution.test.ts`, `packages/validation/src/__tests__/customer-role.test.ts`                                                                                   |
| Customer UI                  | `packages/ui/src/components/ui/customers/containers/customers-hub-container.tsx`, `AddCustomerModal.tsx`, `customer-view.tsx`, `containers/customer-container.tsx`                                                               |
| Industry registry            | `packages/ui-contract/src/business-types.ts`, `packages/validation/src/schemas/industry-profiles.ts`                                                                                                                             |
| Onboarding                   | `packages/ui/src/components/ui/onboarding/containers/onboarding-container.tsx`, `operating-questions.tsx`, `packages/validation/src/schemas/operational-dna.ts`                                                                  |
| Workspace profile            | `backend/src/services/workspace-profile.ts`, `backend/src/middleware/profile-capability.middleware.ts`, `packages/api/src/hooks/workspace-profile.ts`                                                                            |
| Industry docs                | `docs/architecture/industry/INDUSTRY-SUPPORT-MATRIX.md`, `INDUSTRY-ONBOARDING-TAXONOMY.md`, `AUDIT.md`                                                                                                                           |
| Service delivery             | `packages/validation/src/schemas/universal-core/service-delivery.domain.ts`, `packages/ui/src/components/ui/service-delivery/`, `backend/src/services/service-delivery/`, `packages/local-engine/src/routes/service-delivery.ts` |
| CRM appointments             | `packages/validation/src/schemas/crm-appointment.schema.ts`, `backend/src/routes/appointment.routes.ts`, `backend/src/services/crm/appointment.service.ts`                                                                       |
| Repairs / salon / commission | `packages/ui/src/components/ui/business-packs/repair-tickets-section.tsx` (verify exact tree path), `salon-sections.tsx` (verify exact tree path), and current hub lazy imports                                                  |
| Event and notification       | `backend/src/services/event-log.service.ts`, `event.service.ts`, `notification.service.ts`, `activity.service.ts`, `audit.service.ts`                                                                                            |
| Event coverage document      | `docs/product-flow/18-EVENT-SIDE-EFFECT-MAP.md`                                                                                                                                                                                  |
| Notification tests           | `backend/src/__tests__/notification-keys.test.ts`, `notifications-workspace-scoped.test.ts`, `task-notifications.test.ts`                                                                                                        |

## 3. Existing industry model — guardrails

The inspected code/docs indicate:

- Business types are stable IDs stored on the workspace/profile; do not rename stored IDs casually.
- Onboarding supports multiple selected trades and a canonical primary-industry rule.
- Operational questions are produced by shared `operatingQuestionsFor(...)` and inferred using the shared operational DNA model.
- Industry selection configures behavior and defaults; it does not grant a user permission, plan entitlement, or capability that the registry says is missing.
- `requireProfileCapability(...)` is a server-side profile gate separate from `requireCapability(...)` user authorization.
- The published support matrix distinguishes verified supported, partially supported, and unsupported. Selectability alone is not proof of workflow readiness.

Do not create a second industry taxonomy or derive features from hardcoded labels in individual pages. Respect the existing primary-industry and multi-trade ADRs.

## 4. Initial discrepancy/uncertainty register

| Item                      | What is known                                                                                            | What still requires local checkout/runtime evidence                                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Five invoice items        | Shared inner filter currently has five canonical values.                                                 | Verify that the production UI screenshot/state corresponds to this component and not another route revision.                                                                 |
| Single table              | `AdvancesContainer` replaces the invoice table when pre-sale/pre-purchase is selected.                   | Inspect its endpoint and data model, then prove one unified query/read model can represent all rows without duplicate balances.                                              |
| Pre-document side effects | Existing invoice pipeline has stock/costing/ledger effects; user requires those only after finalization. | Trace exact create/edit/confirm code for pre-sale and pre-purchase, their database states and any advance/deposit handling. No runtime verification was performed here.      |
| Customer “Both”           | The modal offers a `both` role and sends it in create payload.                                           | Confirm API/schema compatibility and historical data distribution before changing writes/migrations.                                                                         |
| Role header               | Current first column is a fixed Customer label and has no explicit role cell.                            | Confirm exact live table and customer data response fields.                                                                                                                  |
| Contracts in Clothing     | Hub's visible gate is `invoice.read`, without a shown business-profile gate.                             | Find the authoritative contracts capability key and verify backend route gating and live deep-link behavior.                                                                 |
| Session tabs              | Hub section list uses saved page-look visibility plus payroll permission for commission.                 | Derive exact capability keys/profile support per repair, salon resource, and service-session module; verify support matrix.                                                  |
| Staff sessions            | Separate CRM appointment schema includes staff employee ID; service delivery requires customer ID.       | Decide from existing product semantics whether internal staff meetings belong in Appointment/calendar or need typed participants in the canonical service-delivery schedule. |
| Multi-customer session    | User explicitly requests multiple customers.                                                             | Trace current task/outreach multi-picker and determine normalized schema/API/local engine representation.                                                                    |
| Session type text         | User says current session type is a select and should be free text.                                      | Locate the exact visible field in the current live form. Do not confuse it with a required service offering/catalog reference.                                               |
| Settlement removal        | UI and service-delivery schema currently default settlement to package credit.                           | Inspect database constraints, old sessions, sync payloads, and delivery invariants before changing schema.                                                                   |
| Notifications             | Existing event/audit/activity/notification services exist; event side-effect map has partial coverage.   | Build a complete mutation inventory and prove exact missing mutation paths and intended recipients.                                                                          |
| Green CTAs                | `customer-view.tsx` contains an outlined/muted add button; `AddCustomerModal` has a primary color token. | Audit every create/add button in the actual shared components and match the canonical New Invoice treatment.                                                                 |
| Onboarding persistence    | Existing onboarding writes workspace profile and operational DNA through shared hooks.                   | Run full new-workspace, pre-provisioned workspace, reload, multi-device, and all-operating-question persistence journeys.                                                    |

## 5. What was not done in this inspection

- No source changes were made.
- No project file was written to the GitHub repository because the available GitHub contents write API creates a commit, prohibited by `AGENTS.md`.
- No local worktree was available for a safe uncommitted edit.
- No TypeScript, ESLint, Vitest, HTTP, PostgreSQL, device, or production tests were run.
- No live database or Supabase data was accessed or modified.
- No claim is made that the reported production bugs are fixed.

The companion execution prompt is the implementation contract for the local coding agent/checkout. Copy it into the repository only after the owner or local agent has the working tree available, and keep the required no-commit/no-push rules.
