# HISABCHE UI & UX RECONSTRUCTION V1

## COMPLETE ROUTE DISCOVERY → DESIGN SYSTEM → APPROVAL-GATED ROUTE-BY-ROUTE UI + UX REDESIGN

You are acting as a Principal Product Designer, Senior UI/UX Architect, Design Systems Engineer, Frontend Architect, Accessibility Specialist, and QA Engineer.

Your mission is to progressively transform **both the visual UI and the UX** of the existing Hisabche application from its original small ERP/sales-oriented interface into a coherent, polished, Linear/Stripe/Ramp-grade Business Operating System experience.

This is NOT a documentation-only audit and NOT a UX-only reorganization.
Every Phase 2 and Phase 3+ route MUST deliver **real, visible visual UI refactoring** (layout composition, visual hierarchy, card/table density, typography, alignment, spacing, empty/loading/error/offline states, light/dark polish using existing `@hisabche/design-tokens`) **alongside UX/IA improvements** across both desktop and mobile.

The existing application is already implemented.
You MUST improve and extend its actual architecture.
Do not build a parallel application, duplicate routes, create a second design system, or replace existing business functionality.

The user has approved the following five implementation methods:

1. Route & Information Architecture Audit
2. Design System & Page Blueprint
3. Progressive Route-by-Route Redesign
4. Shared Core UI + Industry Composition
5. Responsive UX & Interaction Validation

Execute them in this exact order.

---

# 0. ABSOLUTE PRODUCT RULES

## 0.1 Existing Header and Sidebar Are Locked

The existing global Header and Sidebar must remain unchanged.

Do not:

- Redesign their visual appearance.
- Change their dimensions, spacing, colors, typography, or structure.
- Replace their components.
- Change their navigation behavior.
- Introduce alternative global navigation.
- Move global navigation into page-specific layouts.

You may inspect their contracts and integration points.

You may modify a page's content layout underneath them, but the Header and Sidebar are outside this project's redesign scope.

If an existing technical issue makes an integration change unavoidable, document it and request explicit owner approval before modifying the locked components.

## 0.2 Existing Project Is the Source of Truth

Before implementing anything, inspect the actual repository.

Do not assume:

- Route names.
- Page names.
- Existing modules.
- Existing permissions.
- Industry coverage.
- API behavior.
- Data availability.
- Component ownership.
- Existing design tokens.
- Mobile implementation status.

Discover these from source code.

Never claim a page exists merely because it appears in a document.

## 0.3 No Parallel Architecture

Extend existing:

- Routing.
- Shared components.
- UI packages.
- Design tokens.
- Localization.
- Permissions.
- Industry configuration.
- Feature/module registry.
- Data access.
- Offline and synchronization infrastructure.

Do not introduce a competing implementation.

Before creating any component, search for an existing equivalent and determine whether it can be reused or extended.

## 0.4 Business Logic Is Protected

This is a UI/UX reconstruction.

Do not casually modify:

- Accounting calculations.
- Financial ledger behavior.
- Invoice numbering.
- Inventory valuation.
- Stock transactions.
- API contracts.
- Database schemas.
- Synchronization.
- Offline outbox.
- Authentication.
- Authorization.
- Tenant isolation.
- Licensing.
- Trial logic.
- Payment processing.

If a UI improvement appears to require business-logic changes, investigate the existing contracts first.

If the required change cannot be safely made within the approved scope, record NEEDS_OWNER_DECISION.

Never replace real data with mock data to make a page look complete.

## 0.5 Existing Technology Constraints

Respect the actual repository architecture and all existing project instructions.

In particular:

- Do not upgrade Expo SDK or React Native.
- Do not enable React Native New Architecture.
- Do not add arbitrary native dependencies.
- Do not introduce unnecessary packages.
- Strict TypeScript.
- No `any`.
- No `@ts-ignore`.
- No `eslint-disable`.
- No hardcoded colors.
- No hardcoded user-facing strings.
- Use existing translation infrastructure.
- Use logical CSS properties.
- Preserve RTL.
- Preserve Persian, Afghan Dari/Pashto, and English localization.
- Use existing UI package boundaries.
- Do not create a second token system.

Follow CLAUDE.md, AGENTS.md, and package-specific instructions.

---

# 1. EXECUTION MODEL: APPROVAL-GATED

The most important rule of this entire mission:

YOU MUST NOT REDESIGN ALL ROUTES IN ONE UNCONTROLLED BATCH.

The workflow is sequential.

Each phase has an explicit completion gate.

The owner must approve the output before the next phase begins.

The workflow is:

PHASE 0: Repository discovery and complete route inventory.
STOP and request approval.

PHASE 1: Design system audit and page blueprint.
STOP and request approval.

PHASE 2: Dashboard desktop and mobile redesign.
STOP and request approval.

PHASE 3+: Continue through the approved Route Registry, one Route at a time.

For every Route:

1. Inspect its existing implementation.
2. Inspect all its tabs and sub-tabs.
3. Understand its business purpose.
4. Identify its shared core.
5. Identify industry-specific capabilities.
6. Design desktop experience.
7. Design mobile experience.
8. Implement the page.
9. Validate its real interactions and data.
10. Run relevant tests.
11. Present before/after evidence.
12. STOP and request owner approval.

Do not begin the next Route until the owner explicitly approves the current one.

Approval must not be inferred from silence, previous approvals, or the initial authorization to start the project.

If the owner requests revisions, revise the current Route only.

---

# 2. PHASE 0 — COMPLETE ROUTE & PRODUCT DISCOVERY

NO UI MODIFICATIONS ARE ALLOWED IN THIS PHASE.

Your first task is to discover the complete existing product.

Inspect the repository using CLI-first techniques.

Suggested tools:

- `git status`
- `git rev-parse HEAD`
- `tree`
- `rg`
- package scripts
- route definitions
- layout definitions
- navigation registries
- feature registries
- permission registries
- localization files
- industry configuration
- existing tests

Inspect all relevant applications:

- Web.
- Desktop.
- Mobile.
- Shared application shell.
- Shared UI packages.
- Feature packages.
- Backend contracts where necessary to understand page behavior.

Do not limit discovery to visible navigation links.

Discover hidden routes, dynamic routes, role-protected routes, nested routes, internal tabs, dialogs, drawers, wizards, and page-level workflows.

## 2.1 Route Discovery Requirements

Create a complete inventory of:

A. All primary routes.

B. All nested routes.

C. All page-level tabs.

D. All nested tabs.

E. All important drawers, dialogs, and wizards.

F. All dynamic route patterns.

G. All routes that share the same business core.

H. All industry-dependent routes and features.

I. All role-dependent routes and actions.

J. All routes that appear duplicated or functionally overlapping.

K. All incomplete, inaccessible, orphaned, or undocumented routes.

L. All pages that exist in mobile but not web, or vice versa.

M. All routes with responsive implementations already present.

Do not invent missing pages.

Clearly distinguish:

- Verified existing route.
- Verified nested tab.
- Verified modal/drawer workflow.
- Proposed future improvement.
- Unverified route.
- Duplicate candidate.
- Orphaned implementation.

## 2.2 Required Route Registry

Create:

`docs/ux/ROUTE-REGISTRY.md`

Also create a machine-readable registry using an existing project-supported format, preferably JSON or TypeScript, only if it fits the existing architecture.

Every route entry must include:

- Stable route ID.
- Actual path or route pattern.
- Actual page/component source.
- Parent route.
- Page title and translation keys.
- Business purpose.
- Primary user tasks.
- Relevant business core.
- Child tabs and nested routes.
- Important page-level interactions.
- Required permissions.
- Relevant roles.
- Relevant industry capabilities.
- Data sources and existing API contracts.
- Offline requirements.
- Desktop implementation status.
- Mobile implementation status.
- Current design status.
- Shared components.
- Duplicate candidates.
- Known UX issues.
- Existing tests.
- Evidence paths.

Do not put unverified assumptions into verified fields.

## 2.3 Build the Complete Product Hierarchy

Represent the actual product hierarchy.

Example only:

Dashboard

- Overview
- Financial Summary
- Cash Flow
- Inventory Summary
- Activity

Invoices

- Sales Invoices
- Purchase Invoices
- Drafts
- Returns
- Recurring Invoices
- Invoice Settings

Inventory

- Products
- Categories
- Warehouses
- Stock Movements
- Transfers
- Stocktaking

The example is not a specification of existing Hisabche routes.

Use actual source code to build the real hierarchy.

## 2.4 Route Relationship and Duplication Audit

Identify routes that:

- Share the same underlying core.
- Display similar information.
- Duplicate forms or tables.
- Implement the same workflow in multiple places.
- Have industry-specific variations.
- Have role-specific differences.

Do not merge routes merely because their names are similar.

First establish whether they share the same business purpose and underlying contracts.

Recommend consolidation only when supported by source evidence.

## 2.5 Phase 0 Deliverables

Create:

- `docs/ux/ROUTE-REGISTRY.md`
- `docs/ux/ROUTE-RELATIONSHIP-MAP.md`
- `docs/ux/ROUTE-DUPLICATION-AUDIT.md`
- `docs/ux/INDUSTRY-CAPABILITY-MAP.md`
- `docs/ux/UX-RECONSTRUCTION-BASELINE.md`
- `docs/ux/UX-OWNER-APPROVALS.md`

The baseline must include:

- Current route count.
- Current nested tab count.
- Current page component count where measurable.
- Desktop coverage.
- Mobile coverage.
- Shared component reuse.
- Duplicate candidates.
- Existing responsive problems.
- Known accessibility issues.
- Existing token usage.
- Missing evidence.

Use actual measurements, not estimates presented as facts.

## PHASE 0 STOP CONDITION

When Phase 0 is complete:

1. Run consistency checks on the Route Registry.
2. Verify that every discovered route has an evidence path.
3. Identify unresolved discovery gaps.
4. Present the complete route hierarchy.
5. Present the industry/core relationship map.
6. Present the duplication findings.
7. Present the recommended implementation order.

Then STOP.

Do not modify UI components.

Do not begin Phase 1.

Ask the owner to approve the discovered Route Registry and execution order.

---

# 3. PHASE 1 — DESIGN SYSTEM & PAGE BLUEPRINT

Start only after explicit approval of Phase 0.

This phase establishes the design contract for all future pages.

## 3.1 Audit Existing Design Tokens

Inspect actual project tokens and component foundations.

Identify:

- Color tokens.
- Typography tokens.
- Font families.
- Font weights.
- Spacing scale.
- Border radius.
- Border styles.
- Elevation and shadows.
- Component sizes.
- Breakpoints.
- Responsive conventions.
- RTL rules.
- Dark/light theme support if implemented.
- Existing motion and transition rules.

Use existing tokens.

Do not invent a new palette or typography system.

If the existing token system has genuine gaps, document them and request approval before introducing new tokens.

## 3.2 Existing Component Audit

Inspect reusable components for:

- Buttons.
- Inputs.
- Selects.
- Search.
- Filters.
- Tables.
- Cards.
- Tabs.
- Dialogs.
- Drawers.
- Dropdowns.
- Menus.
- Tooltips.
- Pagination.
- Charts.
- Form layouts.
- Empty states.
- Loading states.
- Error states.
- Notifications.
- Offline indicators.
- Permission-denied states.

Identify which components are reusable and which need improvement.

Do not replace components that already satisfy the requirements.

## 3.3 Define Page Layout Blueprints

Define reusable page composition patterns.

Potential patterns include:

- Dashboard.
- Data listing.
- Data detail.
- Create/edit form.
- Multi-step workflow.
- Financial workspace.
- Analytics/reporting.
- Inventory workspace.
- Configuration/settings.
- Approval/review workspace.
- Calendar/scheduling workspace.

These are layout patterns, not new routes.

Each pattern must specify:

- Page hierarchy.
- Content density.
- Primary action.
- Secondary actions.
- Information priority.
- Filter placement.
- Table/list behavior.
- Detail presentation.
- Responsive transformation.
- Empty/error/loading/offline behavior.

## 3.4 UX and Accessibility Standards

Use established standards as implementation references:

- WCAG 2.2 AA where applicable.
- WAI-ARIA Authoring Practices.
- Material responsive/adaptive layout guidance.
- GOV.UK user-centered design principles.
- Existing project conventions.

Do not claim compliance without testing.

Validate:

- Keyboard navigation.
- Visible focus.
- Contrast.
- Accessible labels.
- Input errors.
- Semantic structure.
- Touch target sizes.
- Screen reader behavior where testable.
- Reduced motion where applicable.

## 3.5 Phase 1 Deliverables

Create:

- `docs/ux/DESIGN-SYSTEM-AUDIT.md`
- `docs/ux/PAGE-LAYOUT-BLUEPRINTS.md`
- `docs/ux/RESPONSIVE-UX-STANDARD.md`
- `docs/ux/ACCESSIBILITY-STANDARD.md`
- `docs/ux/COMPONENT-REUSE-MAP.md`

Then STOP and request owner approval.

No full Route redesign yet.

---

# 4. PHASE 2 — DASHBOARD FIRST

Start only after Phase 1 approval.

The Dashboard is the first implementation target.

Do not begin invoices or any other Route before Dashboard approval.

## 4.1 Dashboard Discovery

Inspect the existing Dashboard:

- Components.
- Data queries.
- API contracts.
- Permissions.
- Workspace configuration.
- Role-based content.
- Industry capabilities.
- Offline data.
- Existing widgets.
- Existing settings and personalization.
- Tests.

Understand which information is genuinely available.

Do not invent dashboard metrics.

## 4.2 Dashboard Information Architecture

Organize the Dashboard around real user tasks and information priority.

Evaluate:

- Critical business indicators.
- Cash and financial position.
- Sales and purchase activity.
- Inventory warnings.
- Receivables and payables.
- Recent transactions.
- Operational tasks.
- Approvals.
- Notifications.
- Role-specific information.
- Industry-specific widgets.

Do not show every possible widget to every user.

Only show information relevant to the user's:

- Role.
- Permissions.
- Enabled modules.
- Industry capabilities.
- Available data.
- Workspace configuration.

A Dashboard must remain useful even when optional capabilities are disabled.

## 4.3 Dashboard Desktop

Design the full desktop composition.

Consider:

- Content hierarchy.
- Grid layout.
- Widget priority.
- Information density.
- Charts.
- Data cards.
- Lists.
- Actions.
- Filters.
- Personalization if supported by existing architecture.

Do not modify the global Header or Sidebar.

## 4.4 Dashboard Mobile

Design a separate mobile composition.

Do not simply scale the desktop layout down.

Evaluate:

- Priority ordering.
- Vertical information flow.
- Compact cards.
- Charts.
- Lists.
- Touch interactions.
- Action accessibility.
- Widget visibility.
- Navigation integration with the unchanged global shell.

Mobile must remain fully functional, not merely visually responsive.

## 4.5 Dashboard States

Implement and verify:

- Initial loading.
- Refreshing.
- Empty workspace.
- No transactions.
- Partial data availability.
- API failure.
- Offline mode.
- Stale local data.
- Permission restrictions.
- Disabled modules.
- Industry-specific composition.

No blank card placeholders for unavailable features.

No empty grid spaces created by disabled widgets.

## 4.6 Dashboard Acceptance Gate

Before requesting approval, verify:

- Desktop layout.
- Mobile layout.
- Real data integration.
- No fake metrics.
- No duplicate widgets.
- Correct permissions.
- Correct industry composition.
- RTL.
- All localization keys.
- Accessibility basics.
- Loading/error/empty/offline states.
- No regression in existing workflows.
- No Header/Sidebar changes.

Provide:

- Screenshots or preview evidence where available.
- Changed file list.
- Component reuse report.
- Desktop/mobile comparison.
- Tests executed.
- Known limitations.
- Remaining issues.

Then STOP.

Do not start invoices until the owner explicitly approves Dashboard.

---

# 5. PHASE 3+ — ONE ROUTE AT A TIME

After Dashboard approval, continue through the approved Route Registry.

Process exactly one primary Route at a time.

For example, if the approved order is:

1. Dashboard
2. Invoices
3. Inventory
4. Accounting
5. Customers
6. Remaining routes

Then follow that order.

Do not skip a Route or redesign several unrelated Routes in parallel.

## 5.1 Route Pre-Implementation Inspection

Before touching a Route, inspect:

- Actual route implementation.
- Nested tabs.
- Child components.
- Existing UI patterns.
- API/data contracts.
- Permissions.
- Role restrictions.
- Industry capabilities.
- Offline behavior.
- Existing tests.
- Shared components.
- Existing duplicate implementations.

Write a short route-specific implementation plan.

## 5.2 Desktop and Mobile UI + UX Design

Every Route requires **both a real visual UI upgrade and UX/workflow improvement** across two complete experiences:

A. Desktop/laptop (clean visual hierarchy, intentional spacing, crisp tables/cards, Linear/Stripe/Ramp-grade polish using `@hisabche/design-tokens`).

B. Mobile (adaptive cards, bottom sheets, >=44px touch targets, readable minor-unit amounts).

Also validate intermediate widths and responsive transitions.

Use adaptive composition rather than blindly shrinking desktop layouts. Do not stop at IA/UX notes — modify the actual UI components of the route.

## 5.3 Route-Level Content Architecture

Every page must establish:

- Clear page purpose.
- Page title.
- Relevant description or context.
- Primary action.
- Secondary actions.
- Information hierarchy.
- Content groups.
- Filters.
- Search.
- Tables or cards.
- Detail views.
- Contextual actions.
- Empty states.
- Loading states.
- Error states.
- Offline states.
- Permission states.

Do not add decorative sections that do not help the user accomplish a task.

Do not hide important operations behind excessive menus.

Do not overload pages with unnecessary cards and metrics.

## 5.4 Route-Level Functional Preservation

Preserve existing:

- Forms.
- Validation.
- API requests.
- Mutations.
- Query invalidation.
- Permissions.
- Navigation.
- Offline behavior.
- Data synchronization.
- Financial invariants.

Every existing action must continue working.

Do not replace functional UI with static mockups.

## 5.5 Route Approval Gate

A Route is not complete merely because it compiles.

The following must be true:

1. Desktop UI implemented.
2. Mobile UI implemented.
3. Nested tabs inspected and handled.
4. Shared components reused.
5. No duplicate route implementation introduced.
6. Existing business logic preserved.
7. Real data connected.
8. Responsive behavior verified.
9. RTL and localization verified.
10. Loading, empty, error, and offline states handled.
11. Accessibility checked.
12. Relevant tests pass.
13. No prohibited Header/Sidebar modifications.
14. Before/after evidence prepared.

Then present the completed Route and request approval.

Do not start the next Route before explicit approval.

If the owner rejects the Route:

- Record the feedback.
- Revise the current Route.
- Re-run relevant tests.
- Request approval again.

Never treat a rejected Route as complete.

---

# 6. SHARED CORE UI + INDUSTRY COMPOSITION

This is a foundational requirement across all Routes.

Hisabche serves multiple business types.

The same business core may be used by many industries.

The system must avoid duplicated page implementations.

## 6.1 Single Shared Core

Where multiple industries use the same capability, implement one shared page and shared business UI.

Examples:

- Customers.
- Products.
- Invoices.
- Payments.
- Inventory.
- Accounting.
- Employees.
- Reports.

Do not create separate copies of the same page for every industry.

## 6.2 Industry Capability Composition

Industry differences must be expressed through existing supported configuration or a properly designed extension of existing architecture.

Separate:

1. Shared core capability.
2. Industry-specific capability.
3. User permission.
4. Workspace module availability.
5. Optional feature state.

These are not interchangeable.

Do not use industry configuration as a substitute for authorization.

Do not allow a UI visibility setting to grant permission.

## 6.3 No Empty Space

When an industry does not have a capability:

- Do not render an empty card.
- Do not render an empty tab.
- Do not render an empty column.
- Do not leave a reserved blank section.
- Do not show a disabled control without a clear reason.

Recompose the page naturally.

The remaining content should use the available space.

## 6.4 Industry-Specific Extensions

If a specific industry requires additional information:

- Use a defined extension contract.
- Keep the shared core intact.
- Isolate industry-specific components.
- Reuse shared components.
- Preserve localization.
- Preserve permissions.
- Preserve responsive behavior.
- Avoid forking the entire page.

Before implementing a new extension mechanism, inspect the existing module/industry architecture.

Do not create a second industry registry.

## 6.5 Industry Verification

For each affected Route, validate:

- At least one generic industry configuration.
- Relevant industry-specific configurations.
- Missing optional capabilities.
- Different role permissions.
- Responsive composition.
- No empty layout regions.
- No duplicated business logic.

Do not claim coverage of all 67 industries unless each has actually been inspected and verified.

---

# 7. RESPONSIVE DESIGN REQUIREMENTS

Every Route must be validated across:

- Compact mobile.
- Larger mobile.
- Tablet.
- Small laptop.
- Standard desktop.
- Large desktop.

Use the project's existing responsive breakpoints if they exist.

Do not introduce conflicting breakpoint systems.

## 7.1 Tables

For each table, choose an appropriate responsive strategy:

- Carefully prioritized columns.
- Horizontal scrolling only when genuinely appropriate.
- Card/list transformation.
- Row detail view.
- Responsive column visibility.
- Alternative mobile workflow.

Never simply shrink every column until text becomes unreadable.

Financial values and identifiers must remain understandable.

## 7.2 Forms

Forms must have:

- Clear grouping.
- Logical field order.
- Accessible labels.
- Useful validation messages.
- Correct keyboard behavior.
- Appropriate input types.
- Responsive layout.
- RTL-safe alignment.

Long forms must be structured into meaningful sections.

Do not introduce multi-step wizards unless the workflow benefits from them.

## 7.3 Charts and Analytics

Charts must:

- Use real data.
- Have readable labels.
- Support responsive sizing.
- Have accessible alternatives where appropriate.
- Respect locale and currency.
- Avoid misleading visual scales.

Do not use decorative charts with fabricated data.

## 7.4 RTL and Localization

All pages must support existing project locales.

Verify:

- RTL direction.
- Logical margins and padding.
- Text alignment.
- Icons and directional controls.
- Number formatting.
- Currency formatting.
- Date formatting.
- Long translations.
- Mixed-language content.

Do not hardcode Persian text in components.

Do not assume English text length.

---

# 8. DUPLICATION PREVENTION

Before adding any new:

- Page.
- Route.
- Component.
- Table.
- Form.
- Drawer.
- Dialog.
- Workflow.
- Industry extension.

Search the repository for an existing equivalent.

Use a shared component when:

- The responsibility is the same.
- The data contract is compatible.
- The interaction behavior is the same.

Use separate components only when the actual behavior or domain responsibility differs.

Maintain a reuse map.

If two implementations appear similar but cannot safely be unified, document why.

Do not force abstraction that makes the system harder to understand.

---

# 9. DESIGN QUALITY REQUIREMENTS

The design must feel like a mature, professional enterprise Business Operating System.

Use the project's actual visual identity.

The desired quality characteristics are:

- Clear visual hierarchy.
- Strong information architecture.
- Professional data density.
- Consistent spacing.
- High readability.
- Predictable interaction patterns.
- Calm and purposeful visual styling.
- Clear primary actions.
- Minimal unnecessary decoration.
- Consistent feedback.
- Responsive composition.
- Accessible interactions.
- Appropriate empty states.

Do not blindly imitate another product.

Do not introduce:

- Generic AI dashboard styling.
- Excessive gradients.
- Unnecessary glassmorphism.
- Excessive rounded cards.
- Decorative charts.
- Random animations.
- Oversized headings.
- Excessive whitespace that harms operational efficiency.

If the user later supplies a visual reference, evaluate it against the existing design tokens and product requirements before adopting it.

The term `onslop` is not a sufficiently defined design specification in this task. Do not invent a visual interpretation for it. Record it as NEEDS_OWNER_DECISION and continue with the approved existing Hisabche design language until the owner clarifies it.

---

# 10. TESTING AND VALIDATION

For each Route, run relevant existing project checks.

At minimum, where applicable:

- TypeScript.
- ESLint.
- Unit tests.
- Component tests.
- Integration tests.
- Existing UI tests.
- Responsive tests.
- Accessibility checks.
- Localization checks.
- Permission checks.
- Offline behavior checks.

Use existing test infrastructure.

Do not create a parallel test framework.

Do not create fake tests that merely assert that a component exists.

Test actual behavior and user interactions.

If browser/device automation exists, use it.

If it does not exist, document the limitation and do not claim visual/device validation that was not performed.

Never report a test as passed unless it was actually executed.

---

# 11. VISUAL REGRESSION AND APPROVAL EVIDENCE

For each Route, produce a before/after comparison when screenshot tooling is available.

Capture:

- Desktop.
- Mobile.
- Important tabs.
- Important interactions.
- Empty state.
- Error state.
- Relevant industry variations.

Store evidence in an organized project-supported location.

Do not commit generated screenshots unless they belong in the repository according to project conventions.

For every Route approval, provide:

1. Route name and path.
2. Business purpose.
3. Desktop screenshot/preview.
4. Mobile screenshot/preview.
5. Important UX decisions.
6. Shared components reused.
7. Industry behavior.
8. Token compliance.
9. Accessibility checks.
10. Functional tests.
11. Changed files.
12. Known limitations.

---

# 12. PROGRESS TRACKING

Create and maintain:

`docs/ux/UX-RECONSTRUCTION-PROGRESS.md`

For each Route, record:

- Route ID.
- Route path.
- Discovery status.
- Design status.
- Desktop status.
- Mobile status.
- Implementation status.
- Functional validation.
- Responsive validation.
- Accessibility validation.
- Localization validation.
- Industry validation.
- Owner approval.
- Evidence references.

Allowed statuses:

- NOT_STARTED
- DISCOVERED
- BLUEPRINT_READY
- DESKTOP_DESIGNED
- MOBILE_DESIGNED
- IMPLEMENTED
- TESTING
- NEEDS_REVISION
- WAITING_FOR_OWNER_APPROVAL
- APPROVED
- BLOCKED
- NEEDS_OWNER_DECISION

Never mark a Route APPROVED without explicit owner approval.

Maintain a clear history of feedback and revisions.

---

# 13. QUALITY GATES

Before completing any phase, verify:

- No global Header changes.
- No global Sidebar changes.
- No duplicate routes.
- No duplicate design system.
- No unnecessary new dependencies.
- No hardcoded colors.
- No hardcoded user-facing strings.
- No broken RTL.
- No fake data.
- No broken existing business workflows.
- No permission regression.
- No offline regression.
- No unnecessary business-logic modifications.
- No unexplained layout gaps.
- No inaccessible controls.
- No missing mobile implementation.
- No false test claims.

If any gate fails, fix it before requesting approval.

---

# 14. SAFETY AND CHANGE CONTROL

Do not:

- Commit.
- Push.
- Deploy.
- Change production data.
- Execute production DDL.
- Modify `.env` files.
- Introduce destructive migrations.
- Change real financial data.
- Delete existing user functionality.
- Remove existing routes without explicit approval.
- Modify Header or Sidebar.
- Continue to the next Route without approval.

Before every implementation phase:

- Inspect Git status.
- Record current HEAD.
- Identify unrelated existing changes.
- Preserve the user's working tree.
- Avoid overwriting unrelated work.

Do not revert user changes.

Keep modifications scoped to the approved phase.

---

# 15. FINAL EXECUTION INSTRUCTIONS

Start NOW with PHASE 0 ONLY.

Your first actions:

1. Read CLAUDE.md and AGENTS.md.
2. Inspect repository structure.
3. Inspect all application route definitions.
4. Inspect navigation and module registries.
5. Inspect shared UI and industry configuration.
6. Inspect localization and permission contracts.
7. Build the complete Route Registry.
8. Build the route relationship map.
9. Identify duplicate candidates.
10. Build the industry capability map.
11. Measure the existing UI baseline.
12. Validate the completeness of the discovery results.
13. Update UX reconstruction progress.
14. Present the findings and recommended Route order.

Do not redesign the Dashboard yet.

Do not modify any existing UI.

STOP after Phase 0 and request approval.

After the owner approves, continue to Phase 1.

After Phase 1 approval, implement the Dashboard.

After Dashboard approval, continue to the next approved Route.

Repeat until all verified Routes have been reconstructed and approved.

The goal is not to produce a large amount of code quickly.

The goal is to produce a coherent, professional, maintainable, fully responsive, industry-aware Hisabche experience without sacrificing existing functionality, data integrity, or architectural consistency.

FINAL RULE:

ONE ROUTE.
TWO COMPLETE EXPERIENCES (DESKTOP + MOBILE).
ONE OWNER APPROVAL.
THEN THE NEXT ROUTE.

---

# 16. RADICAL VISUAL REDESIGN MANDATE (NO MINOR PATCHES)

Every route redesign MUST be a **visibly recognizable visual transformation**, not a minor CSS patch:

- Do NOT stop at changing font sizes, grid columns, border radius, shadows, or moving one card.
- Rethink composition, visual hierarchy, asymmetric proportions (e.g. Hero Metric + Trend Canvas paired with a Structured Financial Position Ledger), data storytelling, and operational clarity using references like Linear, Stripe, Ramp, and Shopify.
- Use existing `@hisabche/design-tokens`, real data hooks, and `fa-IR` / `fa-AF` / `en` localization. Never modify Header/Sidebar or invent mock data.
- **Zero Overlap Rule:** Never use `position: absolute` for toolbar buttons, customizers, or export actions beside centered tabs or `SegmentedControl` switches. All controls must flow in responsive `flex`/`grid` layouts so zero overlap can occur at any viewport width (including split-pane 500–700px widths).
- **Full-Hub Scope Rule:** Every tab, sub-tab (`SegmentedControl`), button, card, and table inside a route must be included in the UI+UX redesign (e.g. for `/invoices`: `فاکتورها`, `سفارش‌ها`, `قیمت و تخفیف`, and `همه / خرید و فروش / پیش‌خرید و پیش‌فروش`). Primary `HubTabs` and top `SegmentedControl` bars must be cleanly centered.

---

# 17. VERTICAL SPACE OPTIMIZATION & LAPTOP-FIRST DENSITY (1366 × 768)

Every page in Hisabche MUST be designed for laptop viewports (`1366 × 768`, `1440 × 900`, `1536 × 864`) as a first-class target, not just 1080p+ monitors. Every vertical pixel must justify its existence.

## Vertical Space Budget (Desktop Target Heights)

| Element              | Target Desktop Height                 |
| -------------------- | ------------------------------------- |
| KPI Card             | 96–120px                              |
| Financial Summary    | 120–170px                             |
| Main Chart           | 220–280px (Compact Laptop: 180–230px) |
| Toolbar              | 40–52px                               |
| Table Header         | 44–52px                               |
| Gap Between Sections | 12–20px                               |

## Mandatory Rules

1. **Above-the-Fold Priority at 1366 × 768:** Title + primary actions, key performance indicators, financial overview, and main trend/chart (or primary table) must be visible without immediate scrolling.
2. **Compact Progress & Inline Comparisons:** Never dedicate a tall standalone block to a simple progress percentage or comparison; keep it compact/inline inside the summary header.
3. **No Fixed-Height Clipping:** Use content-aware sizing and responsive spacing (`gap-3` / `gap-4`), never arbitrary fixed heights that clip Persian/Dari numbers.
4. **Budget Before Implementation:** Define the page's `Vertical Space Budget` for `768px` height before editing UI components.

---

# 18. CROSS-DEVICE ADAPTIVE UI ENGINE & ACCEPTANCE SCORING

1. **Three Distinct Compositions:** Design explicitly for **Desktop/Windows (`1366×768`, `1440×900`, `1920×1080`)**, **iPad/Tablet (`768×1024`, `1024×768`)**, and **Mobile (`320–430px`)** based on actual available width and height — never simply scale desktop down.
2. **No Stretched Empty Panels:** Never stretch a short financial summary to match a tall chart beside it; keep Financial Overview compact (`112–160px`) and use horizontal composition intelligently.
3. **Urgency-Differentiated Insights:** Distinguish critical operational exceptions, pending actions, and informational tips using icon + badge + semantic accent (never color alone).
4. **Bottom Navigation Clearance:** On `< lg` viewports where fixed bottom navigation is shown, reserve bottom clearance (`pb-20 lg:pb-0`) so no content or action is obscured.
5. **Weighted Acceptance Rubric (100 pts):** Visual transformation (20) · Laptop 1366×768 vertical efficiency (20) · Financial readability (15) · Charts & analytics (10) · iPad adaptive layout (10) · Mobile adaptive layout (10) · Windows/Desktop interaction (5) · RTL/LTR/A11y/Themes (10).
6. **Canonical Skill:** Follow `.agents/skills/hisabche-adaptive-ui-ux/SKILL.md` (including Inventory & Procurement IA separation rules: no unrelated Diagnostics/Agriculture tools on `/warehouse?view=reorder`, capability-driven industry visibility, actionable Reorder empty state without floating PO forms, and no duplicate `/invoices?tab=orders`).

---

# 19. V100 GLOBAL UI/UX RECONSTRUCTION ENGINE & PROOF GATE

This section upgrades the reconstruction standard across the entire workspace and strictly forbids superficial CSS tweaks, arbitrary squishing, or premature completion claims.

1. **Product Architecture Redesign — Not Surface CSS Patching:**
   - Moving margins, centering tab buttons, changing grid column counts, or adding `truncate` alone does **NOT** qualify as UI/UX reconstruction.
   - Re-evaluate Information Architecture (`IA`), workflow separation, progressive disclosure, action hierarchy, and visual composition across every tab and sub-view of a route so each screen functions as a coherent Linear / Stripe / Ramp-grade Business Operating System module using `@hisabche/design-tokens` and `@hisabche/ui`.
   - Never stack unrelated forms, calculators, diagnostic widgets, and operational ledgers in a single endless wall of uniform bordered boxes. Separate distinct modes purposefully via clean navigation/workspaces or contextual drawers/panels.
2. **Global Recursive Source Discovery (`Route -> Page -> Primary Tab -> Subtab -> Section -> Workflow -> Component`):**
   - Before modifying any route, inspect every sub-route, primary `HubTabs`, secondary `SegmentedControl`, filter group, modal/dialog, drawer, bulk bar, and industry-gated panel owned by that route, and keep `docs/ux/ROUTE-REGISTRY.md`, `docs/ux/route-registry.json`, and `docs/ux/UX-RECONSTRUCTION-PROGRESS.md` synchronized with the live tree.
3. **Intentional 1366×768 Vertical Space Optimization (Zero Cramming):**
   - Optimizing for `1366×768` means removing wasted vertical bloat (duplicate banners, standalone progress bars under KPIs, multi-row stacked toolbars, empty summary panels), NOT shrinking text or jamming dense inputs together.
   - Preserve clear scannability, comfortable whitespace rhythm, readable tabular Persian/AFN numbers, and accessible `>= 44×44px` touch targets on mobile/tablet (`min-h-[44px] sm:min-h-[36px]`).
4. **Domain IA & Industry Discipline:**
   - Industry-specific tools (such as Jewelry Gold Rate/Scrap/Melt/Reconcile or Agriculture Crop/Livestock) must be isolated in purposeful domain sub-workspaces and capability/industry-gated whenever inappropriate for generic businesses.
5. **Three Mandatory Proofs Per Route Before `WAITING_FOR_OWNER_VISUAL_APPROVAL`:**
   - **Technical Proof:** `npx tsc --noEmit`, `npx eslint` on edited files, and relevant guard/functional Vitest suites (`exit 0`, zero weakened assertions).
   - **Route Coverage Proof:** Explicit checklist confirming every tab, sub-tab, segmented filter, modal/drawer, and empty/error/populated state inside the route was verified end-to-end.
   - **Visual QA Proof:** Real browser inspection/screenshots at `1366×768` (Desktop) and narrow/mobile viewport (~`390×844` / narrow split-pane), verifying height/density, zero overlap, RTL/LTR logical spacing, light/dark token fidelity, and typography legibility. If live authenticated UI cannot be loaded (e.g., auth/login wall in isolated headless session), report `IMPLEMENTED_NOT_LIVE_VERIFIED` explicitly — never fabricate visual verification.
6. **Execution & Approval Lock (`§14` Order):**
   - Complete **only `/invoices` (and all its active tabs/subtabs: `invoices` + `pricing` `[promotions, price lists, goldRates]`)** first, update `docs/ux/UX-OWNER-APPROVALS.md` & `docs/ux/UX-RECONSTRUCTION-PROGRESS.md` with status `WAITING_FOR_OWNER_VISUAL_APPROVAL`, present all 3 proofs in Persian, and **STOP** for owner confirmation before moving to any subsequent route.
7. **Centered Responsive Blurred Form Modals & Emerald Gradient Law:**
   - Every create/edit form opened by an action button (e.g., `+ تخفیف تازه`, `+ فهرست قیمت تازه`, row-edit drawers/editors) MUST render in a viewport-centered `<Dialog>` / `<DialogContent size="sm|md|lg|xl">` whose size scales cleanly across mobile, tablet, laptop, and desktop (`w-[calc(100vw-24px)] ... max-h-[88dvh]`), with a blurred translucent backdrop (`backdrop-blur-md`), emerald brand gradient top glow (`bg-[image:var(--gradient-brand)]` + soft emerald header wash), and matching brand gradient primary CTA buttons (`variant="default"` / `bg-[image:var(--gradient-brand)]`).
