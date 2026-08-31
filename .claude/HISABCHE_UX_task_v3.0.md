# HISABCHE UX ROADMAP v3.0

## PRODUCTION IMPLEMENTATION DIRECTIVE — BUSINESS OS + DATA MIGRATION CENTER

**Project:** Hisabche
**Version:** 3.0
**Date:** 2026-08-31
**Status:** MANDATORY / PRODUCTION IMPLEMENTATION
**Audience:** Claude Code / Senior Product Engineer / UX Architect / Design Systems Engineer / Security Engineer / Data Migration Engineer
**Primary source of truth:** the real Hisabche repository, existing production behavior, existing business logic, existing API contracts, existing database schema, existing i18n, and existing `packages/ui`.

---

# 0. EXECUTIVE DIRECTIVE

Build Hisabche as a coherent **Business Operating System**, not as a collection of isolated ERP screens.

The implementation must preserve what already works and incrementally improve the product through reusable architecture.

```text
ONE BUSINESS TRUTH
+ ONE FINANCIAL TRUTH
+ ONE SECURITY MODEL
+ ONE DATA MODEL
+ ONE SYNC MODEL
+ ONE UX SYSTEM
+ ONE VISUAL SOURCE OF TRUTH
+ INDEPENDENTLY RELEASABLE CAPABILITIES
= HISABCHE OS
```

The target experience:

```text
ERP DEPTH
+ SaaS SIMPLICITY
+ Local-first Resilience
+ Offline-first Workflows
+ Safe Sync
+ Conflict Resolution
+ Multi-company / Multi-branch
+ Organization & Access Control
+ Adaptive Workspaces
+ Full i18n
+ RTL/LTR
+ Accessibility
+ High Performance
+ Data Migration / Import
+ Reconciliation
= PRODUCTION-GRADE HISABCHE
```

Odoo and Frappe/ERPNext are **behavioral and information-architecture benchmarks**, never visual templates. Hisabche's visual source of truth is always the existing design system under:

```text
packages/ui
```

This means:

```text
NO arbitrary colors
NO arbitrary typography
NO arbitrary spacing
NO arbitrary radius
NO arbitrary shadows
NO arbitrary component visuals
NO ad-hoc page CSS
NO duplicated primitives
NO unrelated redesigns
```

---

# 1. ABSOLUTE RULES

## 1.1 Existing Product Is Primary Source of Truth

Inspect the real repository before changing architecture.

Do not invent:

- routes
- entities
- business rules
- backend behavior
- permission semantics
- workflows
- financial behavior
- fake integrations
- fake synchronization
- fake AI
- fake import success

When the repository already contains a working component or pattern, reuse it before creating another one.

## 1.2 `packages/ui` Is the Only Visual Source of Truth

Every feature page, dialog, form, table, drawer, wizard, import step, migration report, notification, empty state, loading state, error state, and responsive variation must use existing `packages/ui` primitives/patterns.

When an interaction is genuinely missing:

```text
1. identify the missing reusable pattern
2. add it to packages/ui
3. document it
4. make the feature consume it
```

Never solve a system-level UX gap with feature-local styling.

## 1.3 Full i18n Is Mandatory

No visible string may be hardcoded inside feature UI.

This includes:

- labels
- buttons
- empty states
- validation messages
- error messages
- toasts
- import warnings
- migration reports
- progress labels
- tooltips
- keyboard shortcut labels
- aria labels
- screen-reader descriptions
- confirmation dialogs
- status labels
- file-format descriptions

All user-facing copy must use the existing i18n architecture.

Long translations must be tested.

RTL and LTR must both be valid.

## 1.4 No Ad-hoc Styling

Do not introduce feature-specific values such as:

```text
custom hex colors
custom font sizes
random margin/padding values
random border radii
one-off shadows
hardcoded animations
inline visual design tokens
```

Use semantic tokens and existing primitives.

## 1.5 Performance Is a Product Requirement

Prefer:

```text
server rendering where appropriate
small client components
lazy loading
virtualized large lists
incremental data loading
stable rendering
memoization only when evidence supports it
minimal JavaScript
minimal hydration
no unnecessary polling
no expensive animation
```

Performance decisions must be evidence-based.

## 1.6 Minimal Motion

Motion exists only when it communicates state or preserves spatial context.

Default:

```text
none > subtle > functional
```

No decorative animation.

Respect `prefers-reduced-motion`.

## 1.7 Accessibility Is Built In

Target:

```text
Keyboard complete
Focus visible
Semantic controls
Correct labels
Meaningful ARIA
Screen-reader states
WCAG AA contrast
Touch targets appropriate for touch
Reduced motion
RTL/LTR correctness
```

## 1.8 Security Must Be Real

UI hiding is never authorization.

Every sensitive operation must be enforced server-side / backend-side.

Import must be authorization-aware.

Search, preview, notifications, exports, realtime, sync, and import reports must respect tenant, company, branch, record, and field security.

---

# 2. PRODUCT NORTH STAR

Hisabche must feel like one product while serving:

```text
Small Merchant
→ Growing Business
→ Medium Company
→ Multi-Branch Organization
→ Multi-Company Group
→ Enterprise
```

without forcing enterprise complexity onto every user.

The system must expose progressive disclosure:

```text
Common path = simple
Advanced path = discoverable
Expert path = powerful
```

---

# 3. CORE UX MODEL

## 3.1 Intent → Action → Business Engine

Users should not be required to understand the accounting engine to perform common work.

Examples:

```text
Sell
Receive
Pay
Transfer
Expense
Buy
Count Stock
Approve
Follow Up
```

The business engine handles:

```text
Ledger
AR/AP
Inventory
Workflow
Audit
Taxes
Reconciliation
```

Advanced accounting remains accessible to expert users.

---

# 4. UNIVERSAL PAGE CONTRACT

Every production page must define:

```text
Purpose
Primary user goal
Primary action
Secondary actions
Data involved
Permissions
Responsive behavior
Loading state
Empty state
Error state
Saved state
Sync state
Offline state where applicable
Conflict state where applicable
Analytics / audit implications
```

Every page should have one dominant responsibility.

---

# 5. MANDATORY STATE MODEL

Every applicable experience must support:

```text
Loading
Empty
Ready
Saving
Saved
Syncing
Offline
Conflict
Error
Forbidden
```

Use shared `packages/ui` state patterns.

No feature may invent its own visual language for these states.

---

# 6. UNIVERSAL VIEW SYSTEM

The target shared View system is:

```text
ListView
DetailView
FormView
BoardView
CalendarView
TimelineView
AnalyticsView
MapView
```

Potential later additions:

```text
GanttView
PivotView
CohortView
```

A business entity should be able to expose multiple views without building separate page-specific interaction systems.

Concept:

```text
Entity
  ↓
Views
  ├── List
  ├── Detail
  ├── Board
  ├── Calendar
  ├── Timeline
  └── Analytics
```

The View system must centralize behavior while allowing domain-specific fields and actions.

---

# 7. APP SHELL

The application shell must provide a coherent global frame:

```text
Sidebar
Header
Breadcrumbs
Workspace Switcher
Organization / Company / Branch Context
Global Search
Command Palette
Notifications
User Context
Save / Sync Status
```

The shell must work across:

```text
Desktop
Tablet
Mobile
Electron Desktop
```

Do not build a separate visual language for each platform.

---

# 8. ORGANIZATION & ACCESS OS — P0

This capability is mandatory for the target architecture.

Hierarchy:

```text
Platform
  ↓
Organization / Tenant
  ↓
Company
  ↓
Branch
  ↓
Department
  ↓
Team
  ↓
Member / User
  ↓
Employee where applicable
```

## 8.1 Members

Support:

```text
Invite
Accept invitation
Resend invitation
Revoke invitation
Deactivate member
Reactivate member
Role assignment
Company assignment
Branch assignment
Permission assignment
```

## 8.2 Roles

Built-in role patterns may include:

```text
Owner
Admin
Manager
Accountant
Sales
Cashier
Warehouse
HR
Viewer
Custom Role
```

Do not expose roles that do not exist in the real authorization model.

## 8.3 Company / Branch Context

The active context must be visible in the app shell.

Example conceptual structure:

```text
Organization
  └── Company
       └── Branch
```

Members can have scoped access.

Example:

```text
Ali
Role: Sales Manager
Company: Trading Co.
Branches: Kabul, Herat
```

## 8.4 Scope-Aware Authorization

Authorization should conceptually resolve:

```text
Subject
+ Resource
+ Action
+ Scope
+ Policy
```

Examples:

```text
Invoice / Read / Company=Trading Co.
Invoice / Edit / Branch=Kabul
Payroll / Read / Department=HR
```

Never rely on frontend filtering as security.

---

# 9. ENTITY 360 SYSTEM

Entity pages must use shared patterns.

Default conceptual structure:

```text
Header
↓
Status / Actions
↓
Overview
↓
Tabs / Sections
↓
Relations
↓
Documents
↓
Activity / Timeline
↓
Audit
```

Optional sidebar:

```text
Assignments
Attachments
Tags
Sharing
Metadata
```

## 9.1 Invoice 360

```text
Header
Overview
Lines
Payments / Accounting
Activity / Timeline
Documents
Relations
Audit
```

Common path must optimize transaction speed.

## 9.2 Customer 360

```text
Overview
Financial
Sales
Invoices
Payments
Activity
Documents
Notes
Insights
```

## 9.3 Employee 360

```text
Overview / Work
Personal / Private
Employment / Contract
Resume / History
Activity / Timeline
Documents
Relations
Audit
```

Sensitive HR fields must be permission-aware everywhere, including search and notifications.

---

# 10. UNIVERSAL LIST ENGINE

Every major list should share the same interaction language.

Required capabilities where applicable:

```text
Search
Filters
Advanced Filters
Sort
Group
Columns
Density
Saved Views
Bulk Actions
Pagination
Export
Import
Keyboard Navigation
View Switcher
```

Density modes:

```text
Comfortable
Compact
Dense
```

Use existing Hisabche table/data-table components first.

Large lists must use appropriate virtualization/pagination/incremental loading based on real performance evidence.

---

# 11. UNIVERSAL WORKSPACE

Each major business domain should have a predictable entry point:

```text
Overview
Quick Actions
Work Queue
Recent
Insights
Reports
```

Examples:

```text
Accounting
Sales
Inventory
Purchasing
HR
POS
```

Adaptive composition may change content based on role/business context, but must be:

```text
Predictable
Reversible
Permission-aware
User-controllable
```

Users can pin/favorite critical destinations.

---

# 12. ACCOUNTING UX

Business-language entry points:

```text
Sell
Receive
Pay
Transfer
Expense
```

Advanced accounting:

```text
Accounting Overview
Chart of Accounts
Journal
General Ledger
AR/AP
Banking
Reconciliation
Budgets
Assets
Reports
```

Accounting UX must not allow presentation logic to become a second financial truth.

Financial posting must follow the actual backend/ledger architecture.

---

# 13. SALES + CRM

```text
Customers
Leads / Opportunities where actually supported
Quotations
Sales Orders
Invoices
Follow-ups
Activities
```

Customer is the center of the relationship experience.

Avoid duplicate Customer/Supplier object systems unless the repository proves separate domain requirements.

---

# 14. INVENTORY / WAREHOUSE

Core areas:

```text
Inventory Overview
Stock
Movements
Warehouses
Batches
Expiry
Valuation
Reports
```

Operational overview prioritizes:

```text
Low Stock
Out of Stock
Expiring
Slow Moving
Stock Value
```

Avoid decorative charts.

---

# 15. PURCHASING

Purchasing must be either a complete workflow or intentionally de-emphasized.

Target flow where supported:

```text
Supplier
↓
Purchase Request
↓
Purchase Order
↓
Receipt
↓
Bill
↓
Payment
```

It must integrate with relevant stock/accounting behavior rather than becoming an isolated page set.

---

# 16. POS

POS has its own interaction model.

```text
Products
Cart
Customer
Discount
Payment
Receipt
Offline
Sync
```

Optimize for weak networks and low-powered hardware.

No unnecessary page transitions.

No decorative animation.

---

# 17. WORKFLOW / APPROVALS / GOVERNANCE

Every controlled action should answer:

```text
Where am I?
What can I do?
Why can't I do it?
Who must approve?
What happens next?
```

Workflow status should be visible in business language.

Example:

```text
Draft
↓
Submitted
↓
Waiting for approval
↓
Approved
↓
Posted
```

Permissions must be enforced server-side and reflected clearly in UI.

---

# 18. UNIFIED EVENTS / ACTIVITY / NOTIFICATIONS

Do not build separate conceptual truths for:

```text
Notifications
Activities
Audit
Timeline
```

The target architecture is one underlying event model, with contextual views where the existing backend allows it.

```text
Event
├── Activity view
├── Notification view
├── Timeline view
└── Audit view
```

Do not merge tables blindly. First inspect the actual repository and migration history.

---

# 19. OFFLINE + SYNC + CONFLICT UX

Existing areas include:

```text
offline-banner
offline-queue
sync-center
sync-status
realtime-indicator
conflicts
save-indicator
```

They must converge into one user language:

```text
Saved
Syncing
Offline — changes saved locally
1 change needs review
```

Conflict UX must show business differences, not database merge mechanics:

```text
Your version
Other version
What changed
Choose a version
Review differences
```

Offline state must never override financial authority or server authorization.

---

# 20. DATA & SYNC CENTER — NEW P0 CAPABILITY

This is a major product capability.

The center must distinguish:

```text
Sync
Import
Migration
Export
Backup / Recovery where actually supported
Conflicts
History
```

Do not treat all of these as one operation.

Suggested navigation:

```text
Data & Sync
│
├── Sync Status
├── Offline Queue
├── Conflicts
├── Import & Migration
├── Export
├── Migration History
└── Recovery / Backup where supported
```

---

# 21. DATA MIGRATION CENTER — PRODUCT GOAL

Users must be able to bring existing business data into Hisabche using supported formats without manually recreating their business from zero.

Target user statement:

> "I can move my existing business into Hisabche safely and understand exactly what happened."

This is NOT a generic file upload page.

It is:

```text
UPLOAD
↓
UNDERSTAND
↓
MAP
↓
VALIDATE
↓
SIMULATE
↓
APPROVE
↓
IMPORT
↓
RECONCILE
↓
AUDIT
↓
REPORT
```

Official ERPNext documentation shows a similar important behavioral pattern: upload CSV/Excel, map fields, validate before import, surface row/column warnings, and provide an import log. citeturn993126search0

Odoo likewise treats import as object-aware field mapping and validation rather than blindly inserting arbitrary rows. Use these as behavioral benchmarks, not visual templates.

---

# 22. SUPPORTED IMPORT FORMATS

## P0

```text
XLSX
CSV
PostgreSQL dump / archive where safely supported
SQL source files where safely supported
```

## P1

```text
SQLite
MySQL dump
ZIP bundle of supported source files
```

## P2

```text
JSON
Google Sheets
```

Do not advertise a format until the parser, validator, security controls, and import workflow are actually working.

---

# 23. DATA MIGRATION SECURITY MODEL

## 23.1 Never Execute User SQL Directly Against Production

Absolutely forbidden:

```text
user.sql
↓
production database
```

An SQL or database dump is untrusted input.

PostgreSQL documents that restoring a dump can execute arbitrary code from the source superuser's choice, and current PostgreSQL security advisories further demonstrate why untrusted dumps must be treated as hostile input. citeturn993126search3turn993126search7

Therefore the import pipeline must isolate parsing/inspection from production.

Required architecture concept:

```text
Upload
↓
Quarantine
↓
Type / Signature Validation
↓
Sandbox / Isolated Parser Environment
↓
Schema Inspection
↓
Data Extraction
↓
Normalization
↓
Mapping
↓
Validation
↓
Dry Run
↓
Approval
↓
Transactional Commit
```

The production database must receive only validated application-level mutations through the real domain/service layer or a dedicated controlled migration engine.

## 23.2 File Upload Controls

Follow a strict allowlist and validate more than filename or Content-Type.

Required controls include:

```text
Allowed extensions
Content validation
File signature validation where possible
Size limits
Row/record limits
Safe generated filenames
Authorized uploader
Quarantine storage
Safe archive extraction
Path traversal protection
ZIP bomb protection
Parser isolation
Malware/sandbox scanning when available
Audit log
Retention/deletion policy
```

OWASP explicitly recommends allowlisted extensions, type/content validation, generated filenames, size limits, authorization, safe storage, and malware/sandbox analysis where available. citeturn993126search1turn993126search9

---

# 24. DATA MIGRATION UX — STEP 1: SOURCE

Screen purpose:

```text
Choose where your data comes from.
```

Conceptual options:

```text
Excel
CSV
PostgreSQL
SQL
SQLite
MySQL
ZIP
Other supported source
```

Use existing `packages/ui` upload/dropzone/dialog primitives.

No new visual language.

---

# 25. STEP 2: UPLOAD / SCAN

Show factual progress only.

Example states:

```text
File verified
Scanning structure
Reading sheets
Detecting tables
Detecting relationships
Checking data quality
```

Do not animate fake progress.

If the operation is asynchronous, use real job progress.

---

# 26. STEP 3: DATA DISCOVERY

After parsing, show what was detected.

Example:

```text
Customers       2,841
Products       12,450
Invoices        8,931
Payments       14,270
Employees          82
```

Also show:

```text
Unknown tables
Unknown sheets
Unsupported records
Relationship warnings
Duplicate candidates
```

The system must never imply complete migration if data was skipped.

---

# 27. STEP 4: SOURCE DETECTION

Where confidence permits, detect likely source system.

Example:

```text
Detected source: Odoo
Confidence: High
```

Potential sources:

```text
Odoo
ERPNext
QuickBooks
Zoho
Generic Accounting Export
Generic Excel
Custom Database
```

Detection must be evidence-based.

Never claim source detection if the evidence is weak.

---

# 28. STEP 5: ENTITY MAPPING

Map source schema into Hisabche business objects.

Example:

```text
customer_name → Customer.name      ✓
mobile        → Customer.phone     ✓
address       → Customer.address   ✓
cust_code     → ?                  ⚠
```

Statuses:

```text
Matched
Needs Review
Unsupported
```

Automatic mapping may be confidence-scored.

AI-assisted mapping may be used only as a suggestion layer.

The user or deterministic rules remain authoritative.

---

# 29. STEP 6: RELATIONSHIP RECONSTRUCTION

This is mandatory.

The import engine must preserve logical relationships where source data provides enough evidence.

Examples:

```text
Customer
   ↑
Invoice
   ↑
Payment
```

and:

```text
Product
   ↑
Invoice Line
   ↑
Invoice
```

Maintain an internal source-to-target mapping ledger during migration:

```text
source_entity_type
source_external_id
hisabche_entity_type
hisabche_id
migration_id
```

Do not rely on source IDs being valid Hisabche primary keys.

---

# 30. STEP 7: DUPLICATE DETECTION

The system must detect likely duplicates before commit.

Possible signals:

```text
Exact external ID
Phone
Email
Normalized name
Invoice number
SKU
Composite business key
```

Example actions:

```text
Merge
Use Existing
Create New
Skip
Review
```

Merge must follow the actual domain rules and must never silently overwrite sensitive/financial records.

---

# 31. STEP 8: VALIDATION

Validation must distinguish:

```text
Fatal Errors
Warnings
Informational Findings
```

Example:

```text
41,902 valid
421 possible duplicates
38 invalid dates
20 missing currencies
0 fatal errors
```

Every issue must identify its source record, field, and actionable resolution where possible.

---

# 32. STEP 9: ACCOUNTING VALIDATION

Financial imports require additional controls.

Validate as applicable:

```text
Currency
Amounts / precision
Dates
Debits / Credits
Opening balances
Accounts
AR/AP
Payments
Tax references
Inventory valuation
```

Never blindly convert arbitrary rows into ledger entries.

The actual Hisabche financial architecture remains authoritative.

---

# 33. STEP 10: DRY RUN / SIMULATION

Before commit, produce a non-mutating simulation.

Example:

```text
DRY RUN

Customers       +2,841
Products       +12,450
Invoices        +8,931
Payments       +14,270

Estimated AR impact: ...
Estimated Cash impact: ...

Production data changed: NO
```

Simulation must be truthful.

---

# 34. STEP 11: USER APPROVAL

Before commit, show a clear summary:

```text
Records to create
Records to update
Records to skip
Records requiring review
Financial impact
Warnings
Unsupported data
```

The commit action must be explicit.

No destructive or irreversible action should happen merely from closing a wizard.

---

# 35. STEP 12: TRANSACTIONAL IMPORT

The import engine must support:

```text
Migration ID
Idempotency
Batching
Retry safety
Partial progress tracking
Failure isolation
Audit
```

Use the repository's existing transactional/idempotency architecture where available.

Do not create a second financial transaction engine.

---

# 36. STEP 13: RECONCILIATION

Reconciliation is mandatory for financial migrations.

Example:

```text
Invoice totals
Source:   1,284,440
Hisabche: 1,284,440
Difference: 0
```

Also reconcile as applicable:

```text
Payments
AR
AP
Cash
Inventory quantities
Inventory valuation
Opening balances
Record counts
```

A migration is not considered fully successful merely because database rows were inserted.

---

# 37. STEP 14: MIGRATION REPORT

Every migration must create a report containing:

```text
Migration ID
Source type
Original filename
Started at
Completed at
Actor
Company / Branch scope
Records scanned
Records created
Records updated
Records skipped
Duplicates
Warnings
Errors
Financial reconciliation
Unsupported data
```

The report must be exportable where permitted.

---

# 38. MIGRATION HISTORY

Provide a reusable history view:

```text
Migration
Date
Source
Records
Status
Warnings
Reconciliation
Actor
```

Statuses should be evidence-based:

```text
Scanning
Mapping
Validating
Ready for Import
Importing
Reconciling
Completed
Completed with Warnings
Failed
Cancelled
```

Do not use vague status language such as "almost done".

---

# 39. ROLLBACK / RECOVERY

Where technically and financially safe, migration records must be grouped by migration ID/batch so recovery is possible.

Never implement rollback as an unsafe blanket delete.

Any rollback capability must:

```text
identify exact migration scope
respect dependencies
respect audit requirements
avoid deleting pre-existing records
be authorization-protected
be tested
```

If safe rollback is not possible for a given entity, the UI must state that clearly and provide the supported recovery path.

---

# 40. IMPORT PROFILES

After successful mapping, allow saving a deterministic mapping profile where appropriate.

Example:

```text
Odoo Customers → Hisabche Customer
```

Later:

```text
Upload
↓
Detect source
↓
Apply saved mapping
↓
Validate
↓
Preview
↓
Import
```

Never apply a stale mapping silently when schema or field semantics have changed.

---

# 41. EXPORT SYMMETRY

The data system should make it possible to export supported data and, where designed, re-import it predictably.

ERPNext explicitly treats export and import as complementary data-management workflows; this behavioral idea is useful for Hisabche. citeturn993126search6

Hisabche must preserve its own internal identifiers and relationship semantics where exports are intended for re-import.

---

# 42. AI RULES FOR IMPORT

AI may assist with:

```text
Column mapping suggestions
Source detection suggestions
Duplicate similarity suggestions
Data quality explanations
User-facing explanations
```

AI may NOT autonomously decide:

```text
financial truth
ledger posting
destructive merges
authorization
tenant scope
company scope
branch scope
irreversible financial transformations
```

All AI suggestions must have confidence and deterministic validation.

---

# 43. MOBILE UX

Mobile is not "desktop shrunk with CSS".

Design intentional mobile interaction:

```text
Cards where appropriate
Bottom actions / sheets where appropriate
Primary action emphasis
Compact information hierarchy
Touch-friendly targets
Responsive tables
```

The underlying visual system remains `packages/ui`.

No separate visual identity.

---

# 44. DESKTOP / ELECTRON UX

Desktop must remain the same product with a better desktop interaction surface, not a new product.

Reuse:

```text
Shared UI
Shared business logic
Shared i18n
Shared validation
Shared permissions
Shared data contracts
```

Desktop may improve:

```text
Keyboard navigation
Window density
Multi-panel workflows
Command actions
Large-screen productivity
```

---

# 45. KEYBOARD UX

Use shortcuts only for real functionality.

Core behaviors may include:

```text
Ctrl/Cmd + K → Command palette
Esc → Close
Enter → Confirm / Open according to context
Arrow keys → Navigation
Tab → Form navigation
```

Do not invent shortcuts for features that do not exist.

Every shortcut must be discoverable.

---

# 46. COMMAND OS

Command palette must support the actual product capabilities through structured categories:

```text
Navigate
Create
Search
Actions
Recent
AI where actually implemented
```

Examples:

```text
Create Invoice
Create Customer
Record Expense
Transfer Money
Open Warehouse
Find Invoice
Open Reports
```

No command may be shown unless it is actually executable for the user.

---

# 47. SEARCH

Global Search must be permission-aware and entity-aware.

Search may cover:

```text
Customers
Invoices
Products
Payments
Orders
Employees
Accounts
Warehouses
```

Never leak sensitive fields through search previews.

Search permissions must align with backend authorization.

---

# 48. ADAPTIVE WORKSPACE

Role/business-aware workspace composition may be introduced after shared UX contracts are stable.

Examples:

```text
Retail
Sales / POS / Inventory / Customers / Cash

Accountant
Ledger / Bank / Reconciliation / Reports / Tax

Manager
Overview / Approvals / Cashflow / Performance / Risks
```

Adaptation must be:

```text
Predictable
Reversible
Permission-aware
Pinned/favorited by user
```

Personalization must never override authorization.

---

# 49. OBSERVABILITY

Measure real product quality.

Track where technically appropriate:

```text
Page performance
Interaction latency
Import duration
Import failure rate
Migration reconciliation failures
Sync failures
Conflict rate
Command usage
Search success
Error rate
```

Never collect data that is not justified by product/security requirements.

---

# 50. PERFORMANCE CONTRACT

Targets should be evidence-driven. Existing Hisabche engineering goals include strong Lighthouse performance/accessibility targets; preserve them where applicable.

Minimum principles:

```text
No unnecessary client component
No unnecessary animation
No duplicate API calls
No uncontrolled polling
Large lists optimized
Images optimized
Progressive loading
Stable layouts
Production build tested
```

For migration:

```text
Large files → background job
Large imports → chunked processing
UI → progress from real backend state
No giant in-memory parse when avoidable
```

Do not promise instant processing for work that is actually asynchronous.

---

# 51. DATA MIGRATION BACKEND ARCHITECTURE

Implement as a bounded capability.

Conceptual modules:

```text
MigrationController
MigrationService
SourceDetector
FileValidator
SchemaInspector
EntityMapper
RelationResolver
DuplicateDetector
DataValidator
DryRunEngine
ImportEngine
ReconciliationService
MigrationReportService
MigrationAuditService
```

Adapt names to the real repository architecture. Do not blindly create this exact file structure.

The capability should use the existing backend conventions for:

```text
authentication
tenancy
authorization
validation
idempotency
transactions
logging
observability
```

---

# 52. MIGRATION JOB MODEL

Long-running imports should be represented as jobs with states such as:

```text
UPLOADED
SCANNING
MAPPING
VALIDATING
READY
IMPORTING
RECONCILING
COMPLETED
COMPLETED_WITH_WARNINGS
FAILED
CANCELLED
```

Persist sufficient metadata to recover UI state after refresh.

Do not use local memory as the authoritative job state.

---

# 53. IDENTITY / RELATION MAPPING MODEL

Maintain deterministic mapping during an import:

```text
Migration ID
Source entity type
Source external identifier
Target entity type
Target identifier
Mapping status
```

This prevents accidental use of foreign IDs as Hisabche primary keys.

---

# 54. IMPORT IDEMPOTENCY

Repeated submission of the same migration step must not duplicate records unexpectedly.

Use:

```text
migration_id
source_identity
idempotency_key
business uniqueness rules
```

according to repository conventions.

---

# 55. TENANCY AND SCOPE

Imports must be scoped to an authorized tenant/organization/company/branch context.

The migration engine must never allow:

```text
cross-tenant import
cross-company leakage
cross-branch unauthorized writes
```

The user must understand the target scope before commit.

Example:

```text
Import into:
Company: Trading Co.
Branch: Kabul
```

---

# 56. IMPORTING SENSITIVE DATA

Sensitive information may include:

```text
Employee personal data
Payroll-related fields
Identification data
Bank information
Customer financial data
```

The importer must respect field-level authorization where applicable.

Never put sensitive records into preview, logs, analytics, or notifications beyond what the authorized user needs.

---

# 57. ERROR UX

Errors must explain:

```text
What happened?
Why?
What can I do?
```

Bad:

```text
ERR_IMPORT_17
```

Good:

```text
38 rows contain invalid dates.
Review these rows before importing.
[Review rows]
```

Technical identifiers may be available in an advanced diagnostic area for operators.

---

# 58. EMPTY STATES

Empty states should explain the purpose and provide one useful next action.

Examples:

```text
No migrations yet
Import your existing business data to get started.
[Start import]
```

No decorative illustrations unless they already exist in `packages/ui` and improve comprehension.

---

# 59. DESIGN SYSTEM GOVERNANCE

Before creating any new UI component:

```text
Search packages/ui
↓
Search existing patterns
↓
Reuse
↓
If missing, extend packages/ui
↓
Document usage
↓
Consume from feature
```

Do not create:

```text
components imported from arbitrary UI libraries
feature-local button variants
feature-local dialog styles
feature-local typography
feature-local colors
feature-local spacing systems
```

The existing Hisabche visual identity must remain intact. This includes the project's current color system and style choices even when benchmark systems use different visual patterns.

---

# 60. I18N / RTL / LTR CONTRACT

Every implementation must verify:

```text
Dari / Persian
English
RTL
LTR
Long strings
Short strings
Numbers
Currency
Dates
Pluralization where applicable
```

Important:

```text
Do not reverse numbers manually.
Do not hardcode date formats.
Do not assume currency symbol direction.
Do not assume icon direction.
Do not assume breadcrumb direction.
```

Use the repository's existing localization and formatting utilities.

---

# 61. JALALI / GREGORIAN DATE UX

Use existing date components and localization behavior.

Do not introduce a new date format library only for one feature if the existing project already has a canonical date system.

Import normalization must make date interpretation explicit when ambiguity exists.

Example:

```text
31/12/2024
```

must not be silently interpreted without a known locale/source rule.

---

# 62. CURRENCY AND NUMBER SAFETY

Migration must preserve numerical meaning.

Never use floating-point assumptions for authoritative financial values where the project uses integer/decimal-safe arithmetic.

Validate:

```text
Currency
Scale
Precision
Negative values
Thousands separators
Decimal separators
Localized numerals
```

The importer must normalize into the repository's actual money representation.

---

# 63. IMPORT DATA NORMALIZATION

Normalize before entity mapping where appropriate:

```text
Whitespace
Unicode normalization
Phone formatting
Email normalization
Date parsing
Currency parsing
Decimal separators
Boolean representations
Empty/null values
```

Never destroy original source values before they are auditable where retention is required.

---

# 64. SOURCE FILE RETENTION

Define a controlled retention policy for uploaded migration sources.

Store only what the product/security requirements justify.

Do not expose raw source files publicly.

Delete/quarantine according to policy after the import lifecycle where appropriate.

All deletion behavior must be explicit and auditable.

---

# 65. ZIP / ARCHIVE SAFETY

For archive uploads:

```text
inspect before extraction
validate entry paths
limit file count
limit uncompressed size
limit nesting depth
reject path traversal
reject suspicious files
```

Never extract an untrusted archive directly into a sensitive application path.

---

# 66. TESTING STRATEGY

Every capability must be verified through:

```text
Unit tests
Integration tests
API tests
UI tests where infrastructure exists
Security deny-path tests
Migration fixture tests
Reconciliation tests
RTL tests
i18n tests
Accessibility tests
Performance verification
```

For migration specifically test:

```text
empty file
large file
malformed file
wrong extension
spoofed content type
duplicate records
missing relationships
invalid financial data
invalid dates
currency mismatch
partial failure
retry
re-run same migration
authorization denial
tenant mismatch
branch mismatch
rollback/recovery behavior where supported
```

---

# 67. ADVERSARIAL SECURITY TESTING

At minimum consider:

```text
Tenant escape
IDOR
Privilege escalation
Foreign IDs
Cross-company access
Cross-branch access
Field leakage
Record leakage
Search leakage
Export leakage
Realtime leakage
Sync leakage
Replay
Duplicate commit
Race conditions
Malicious upload
Parser vulnerability
ZIP bomb
Path traversal
Oversized file
```

The migration system must fail closed on authorization errors.

---

# 68. QUALITY GATES FOR EVERY NEW PAGE

## UI

```text
[ ] Uses packages/ui
[ ] No arbitrary visual tokens
[ ] No duplicate primitive
[ ] Existing Hisabche visual identity preserved
[ ] Responsive behavior defined
[ ] Minimal motion
```

## i18n

```text
[ ] No hardcoded visible strings
[ ] Translations exist
[ ] Long translations tested
[ ] RTL tested
[ ] LTR tested
[ ] aria labels translated
```

## UX states

```text
[ ] Loading
[ ] Empty
[ ] Ready
[ ] Saving where applicable
[ ] Saved where applicable
[ ] Syncing where applicable
[ ] Offline where applicable
[ ] Conflict where applicable
[ ] Error
[ ] Forbidden
```

## Accessibility

```text
[ ] Keyboard
[ ] Focus
[ ] Labels
[ ] Dialog semantics
[ ] Menu semantics
[ ] Screen-reader states
[ ] Contrast
[ ] Reduced motion
```

## Performance

```text
[ ] No unnecessary client component
[ ] No unnecessary animation
[ ] No duplicate request
[ ] Large datasets optimized
[ ] Images optimized
[ ] Production build verified
```

---

# 69. DEFINITION OF DONE

A capability is complete only when:

```text
Business logic works
+
Actual backend contract works
+
UX pattern is reusable
+
packages/ui owns presentation
+
i18n is complete
+
RTL/LTR work
+
Accessibility works
+
Offline behavior defined where relevant
+
Mandatory states exist
+
Performance verified
+
Mobile behavior intentional
+
Security deny paths verified where applicable
+
Auditability exists where required
+
No ad-hoc styling exists
+
No fake feature remains visible
+
Tests pass
+
Documentation updated
```

---

# 70. IMPLEMENTATION ORDER

Do not rewrite the repository.

Proceed in controlled capability slices.

## PHASE 0 — REPOSITORY / PRODUCT TRUTH

```text
Inspect actual routes
Inspect packages/ui
Inspect existing design tokens
Inspect i18n
Inspect existing state components
Inspect business entities
Inspect accounting engine
Inspect organization/workspace model
Inspect auth/permission model
Inspect database schema
Inspect sync/offline architecture
Inspect existing import/export capabilities
```

Only document/block where necessary. Do not perform unrelated refactors.

## PHASE 1 — DESIGN SYSTEM HARDENING

```text
Consolidate existing primitives
Standardize shared states
Lock semantic tokens
Lock RTL/LTR rules
Lock i18n rules
Lock performance/motion budget
```

## PHASE 2 — APP SHELL

```text
Sidebar
Header
Breadcrumbs
Organization context
Company context
Branch context
Search
Command palette
Notifications
Save/sync state
```

## PHASE 3 — ORGANIZATION & ACCESS OS

```text
Members
Invitations
Roles
Permissions
Companies
Branches
Scoped access
Member 360
Company switcher
Branch switcher
```

Do not build UI-only authorization.

## PHASE 4 — UNIVERSAL VIEWS

```text
List
Detail
Form
Board
Calendar
Timeline
Analytics
Map where justified
```

## PHASE 5 — LIST ENGINE

```text
Search
Filter
Sort
Group
Columns
Density
Saved Views
Bulk Actions
Paging
Export
Import hooks
Keyboard
```

## PHASE 6 — ENTITY 360

Pilot:

```text
Invoice
Customer
Employee
```

Then refactor other domains onto the shared patterns.

## PHASE 7 — WORKSPACES

Pilot:

```text
Accounting
Sales
Inventory
HR
```

## PHASE 8 — DOMAIN CONSOLIDATION

Priority sequence:

```text
Accounting
Sales / CRM
Inventory
Purchasing
POS
HR / Payroll
Manufacturing
Assets
Budgets
Banking
```

Use existing repository scope and business logic. Do not invent missing modules.

## PHASE 9 — DATA & SYNC CENTER

Consolidate:

```text
Sync
Offline
Conflicts
Import
Export
History
```

## PHASE 10 — DATA MIGRATION CENTER

Implement end-to-end:

```text
Upload
Scan
Detect
Map
Resolve relations
Detect duplicates
Validate
Dry run
Approve
Import
Reconcile
Report
History
```

P0 for the full capability.

## PHASE 11 — MOBILE / DESKTOP / ACCESSIBILITY HARDENING

Do not create separate design systems.

## PHASE 12 — WORK QUEUE

Turn notifications into actionable work.

```text
3 invoices overdue
2 approvals waiting
1 bank transaction unmatched
```

## PHASE 13 — INTELLIGENCE

Only after data truth, permissions, workflows, and shared UX are stable.

---

# 71. REPOSITORY-SAFE EXECUTION RULES FOR CLAUDE CODE

This section is an execution contract.

## 71.1 Start With the Active Capability

Determine the current capability from this document and the current session context.

Do not ask the user which part to implement when the active scope is already established.

## 71.2 Inspect Before Modifying

For the active capability:

```text
Inspect relevant files
Inspect related routes
Inspect existing components
Inspect API contract
Inspect database model if relevant
Inspect i18n
Inspect tests
```

Do not perform a repository-wide forensic audit unless necessary to resolve a blocking uncertainty.

## 71.3 Small Safe Iterations

Prefer small atomic changes.

After each implementation slice:

```text
Implement
↓
Typecheck
↓
Lint
↓
Tests
↓
Build / focused verification
↓
Inspect result
↓
Continue
```

## 71.4 No Unrelated Refactors

When an unrelated bug is discovered:

```text
UNRELATED FINDING
ACTION: NOT TOUCHED
REASON: Outside active capability scope
```

Interrupt only when it is an actual blocker such as:

```text
security
financial correctness
tenancy/data leakage
data loss
migration safety
production preservation
```

## 71.5 Do Not Manufacture Completeness

Never report:

```text
complete
secure
production-ready
working
successfully migrated
```

without evidence.

---

# 72. MIGRATION-SPECIFIC EXECUTION RULES

When implementing Data Migration Center:

1. Inspect the real Hisabche entity model first.
2. Identify existing import/export code before adding another importer.
3. Reuse existing validation and accounting services.
4. Reuse existing authorization and tenant scope logic.
5. Build file intake in quarantine.
6. Parse untrusted data outside the production write path.
7. Normalize and map into business entities.
8. Validate before commit.
9. Dry-run before commit.
10. Make commit idempotent.
11. Record source-to-target identity mappings.
12. Reconcile financial totals where applicable.
13. Produce an audit report.
14. Keep unsupported data visible.
15. Never silently drop records.

---

# 73. COMMANDS / VERIFICATION

Use the repository's actual package manager and scripts.

Do not invent commands.

At minimum, where scripts exist:

```text
Typecheck
Lint
Unit tests
Integration/API tests
Build
Relevant e2e tests
```

For migration:

```text
Parser fixtures
Mapping fixtures
Validation fixtures
Dry-run fixtures
Import fixtures
Retry fixtures
Reconciliation fixtures
Security fixtures
```

---

# 74. PRODUCTION STATUS MODEL

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

Evidence controls status.

`PRODUCTION-READY` does not mean deployed.

---

# 75. REQUIRED FINAL REPORT PER CAPABILITY

At completion of each capability, report:

```text
1. Executive Summary
2. Scope
3. Backend implemented
4. Frontend/UI implemented
5. Database/migrations
6. Files changed/created
7. APIs added/changed
8. Authorization / tenancy / RLS status
9. i18n / RTL / accessibility status
10. Offline / sync status where applicable
11. Import/migration status where applicable
12. Tests run + results
13. Security deny-path results
14. Reconciliation results where applicable
15. Remaining gaps / blockers
16. Exact current state
```

Every PASS requires evidence.

Every incomplete item requires the exact reason.

---

# 76. FINAL HISABCHE UX ARCHITECTURE

```text
                         HISABCHE OS
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    NAVIGATION               WORK                INSIGHT
         │                    │                    │
 Sidebar / Search       Create / Edit        Analytics / AI
 Command / Recent       Approvals             Alerts / Forecast
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                       ORGANIZATION OS
                              │
             Organization / Company / Branch
                              │
                  Member / Role / Permission
                              │
                        ENTITY LAYER
                              │
       Customer / Invoice / Product / Employee / Account
                              │
                       UNIVERSAL VIEWS
                              │
     List / Detail / Form / Board / Calendar / Timeline
                              │
                       BUSINESS ENGINE
                              │
       Accounting / Sales / CRM / Inventory / POS / HR
                              │
                       DATA & SYNC OS
                              │
    Offline / Sync / Conflicts / Import / Export / History
                              │
                     MIGRATION CENTER
                              │
 Upload → Map → Validate → Simulate → Import → Reconcile
                              │
                          AUDIT
```

---

# 77. COMPETITIVE BENCHMARK RULE

Use Odoo and ERPNext to learn:

```text
View architecture
List/Form behavior
Workflow patterns
Workspace information architecture
Dense business-data handling
Import validation patterns
```

Do not copy:

```text
colors
fonts
spacing
visual components
branding
page styling
motion language
```

Use other leading SaaS/ERP products as comparative references for:

```text
SaaS simplicity
financial depth
role-based dashboards
inventory operations
mobile UX
reporting
automation
```

The product decision remains Hisabche-specific.

---

# 78. STRATEGIC PRODUCT DIFFERENTIATORS

The target differentiated combination is:

```text
ERP depth
+ SaaS UX
+ Local-first
+ Offline-first
+ Safe Sync
+ Conflict Resolution
+ Multi-company
+ Multi-branch
+ Scoped Access
+ Entity 360
+ Universal Views
+ Data Migration
+ Reconciliation
+ Adaptive Workspace
+ Progressive Disclosure
```

This should not become feature bloat.

Every new capability must pass:

```text
Does it solve a real user problem?
Does the existing product need it?
Can it reuse existing architecture?
Can it be released independently?
Can it be tested?
Can it be secured?
Can it be localized?
Can it perform well?
```

---

# 79. FINAL ANTI-PATTERNS

Never:

```text
Copy Odoo UI
Copy ERPNext UI
Build arbitrary page styling
Create duplicate primitives
Create duplicate entities
Create duplicate navigation paths
Create duplicate auth systems
Create duplicate event truths
Create duplicate financial engines
Execute user SQL against production
Trust file extension alone
Trust Content-Type alone
Silently skip records
Silently merge financial records
Hide authorization problems in UI
Show fake AI
Show fake sync
Show fake migration progress
Call a migration successful without reconciliation evidence
Treat UI hiding as security
Ask unnecessary confirmation questions when scope is already known
Perform unrelated refactors
Destroy working production behavior
```

---

# 80. FINAL EXECUTION COMMAND

**START NOW.**

The active implementation must follow this order:

```text
INSPECT REAL PRODUCT
↓
IDENTIFY ACTIVE CAPABILITY
↓
PROTECT EXISTING PRODUCTION
↓
REUSE packages/ui
↓
REUSE i18n
↓
REUSE AUTH / TENANCY / BUSINESS LOGIC
↓
IMPLEMENT SMALLEST COMPLETE SLICE
↓
VERIFY
↓
TEST
↓
ATTACK DENY PATHS
↓
DOCUMENT
↓
REPORT EVIDENCE
↓
CONTINUE TO NEXT SLICE
```

Do not restart the entire product.

Do not invent a replacement architecture without evidence.

Do not create a generic ERP.

Do not create a generic SaaS dashboard.

Create the **actual Hisabche product** using the actual repository and the design system already built for it.

---

# 81. FINAL PRODUCT STANDARD

The finished Hisabche platform must be:

**FINANCIALLY CORRECT, SECURE, TENANT-ISOLATED, AUTHORIZATION-COMPLETE, FIELD-SECURE, RECORD-SECURE, AUDITABLE, RECONSTRUCTABLE, OFFLINE-CAPABLE, SYNC-SAFE, CONFLICT-SAFE, REALTIME-ISOLATED, TAX-AWARE, MULTI-CURRENCY, MULTI-ENTITY, MULTI-COMPANY, MULTI-BRANCH, WORKFLOW-AWARE, ACCESSIBLE, RTL-CORRECT, LTR-CORRECT, FULLY LOCALIZED, PERFORMANCE-MEASURED, EXTENSIBLE, RECOVERABLE, MIGRATION-SAFE, RECONCILABLE, ADAPTIVE, PRODUCTION-PRESERVING, SCOPE-DISCIPLINED, AND GENUINELY PLEASANT TO USE.**

---

# 82. FINAL MANTRA

```text
DESIGN FOR THE WHOLE.

BUILD ONLY THE NECESSARY PART.

PROTECT WHAT ALREADY WORKS.

USE packages/ui AS THE VISUAL SOURCE OF TRUTH.

LOCALIZE EVERYTHING.

KEEP MOTION MINIMAL.

MEASURE PERFORMANCE.

AUTHORIZE BEFORE EXPOSING.

TREAT IMPORT DATA AS UNTRUSTED.

NEVER EXECUTE USER SQL AGAINST PRODUCTION.

PREVIEW BEFORE COMMIT.

RECONCILE AFTER COMMIT.

AUDIT WHAT HAPPENED.

NEVER INVENT FINANCIAL TRUTH.

NEVER CALL A FEATURE COMPLETE WITHOUT EVIDENCE.

DESIGN FOR THE WHOLE.
BUILD THE SMALLEST COMPLETE SLICE.
PROTECT PRODUCTION.
VERIFY.
SHIP.
OBSERVE.
LEARN.
BUILD THE NEXT SLICE.
```

---

# 83. OFFICIAL BEHAVIORAL REFERENCES

These references are behavioral/technical benchmarks only:

- Odoo 19 View Architectures: https://www.odoo.com/documentation/19.0/developer/reference/user_interface/view_architectures.html
- Odoo 19 Users / Companies: https://www.odoo.com/documentation/19.0/applications/general/users.html
- Odoo 19 Companies / Branches: https://www.odoo.com/documentation/19.0/applications/general/companies.html
- Frappe Desk: https://docs.frappe.io/framework/user/en/desk
- Frappe Workspace: https://docs.frappe.io/framework/user/en/desk/workspace
- ERPNext Data Import: https://docs.frappe.io/erpnext/data-import
- ERPNext Data Export: https://docs.frappe.io/erpnext/data-export
- PostgreSQL 19 pg_restore: https://www.postgresql.org/docs/19/app-pgrestore.html
- PostgreSQL Security Advisory: https://www.postgresql.org/support/security/CVE-2026-18408/
- OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html

---

# END OF HISABCHE UX ROADMAP v3.0
