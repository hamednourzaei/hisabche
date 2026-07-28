# Hisabche — Business OS Restructuring Roadmap

Produced by three parallel architectural reviews (ERP/Domain, UX/Information Architecture, Technical/Database) of the real codebase — not generic ERP theory. Every claim below is grounded in an actual file, schema, or route in this repo.

## Executive summary

Hisabche works, feature by feature, but the product is organized around **modules** (Accounting, CRM, Warehouse, Manufacturing, HR) instead of **business objects** and **user intents**. The three reviews converge on the same root cause from three angles:

- **ERP lens**: business objects are fragmented across schemas that don't reference each other (Invoice ↔ Accounting have no foreign key; Supplier is a copy-pasted Customer; Opportunity has no link to Invoice).
- **UX lens**: the nav is already half-redesigned around intent (Today/Sell/Get Paid/Stock/Buy/Money) but several pages behind that nav are still weak or duplicated (Purchasing has no create flow, Quick-Invoice duplicates Invoices, three separate "what happened" UIs).
- **Tech lens**: the same "three parallel systems for one concept" pattern repeats at the infrastructure level (three auth systems, three event tables, RLS patched reactively table-by-table instead of governed by migrations).

**The single most repeated finding across all three reports**: this app keeps building *N* separate systems for what should be *one* concept — one Customer/Supplier object, one Invoice creation flow, one Events table, one workspace access model, one auth system. Fixing that pattern, not any single page, is the actual restructuring project.

## Priority sequencing (cross-cutting, combines all three lenses)

1. **Fix Accounting↔Invoice linkage** (ERP + Tech) — highest business risk today: invoices can silently post with zero accounting trail. Make account-code mapping configurable, fail loudly, add payment-side posting.
2. **Unify the Events model** (Tech) — one `events` table backing notifications/activities/audit as views. Unblocks the UX layer's "unify notifications/activities/audit" recommendation cleanly.
3. **Merge Quick-Invoice into Invoices** (ERP + UX) — same object, one flow, keep the new preview-before-commit pattern as the house standard.
4. **Rebuild or demote Purchasing** (ERP + UX) — either give it a real create-PO flow wired to stock/accounting, or pull it out of the primary nav until it does.
5. **Fold CRM Opportunities into Customer, keep Interactions** (ERP + UX) — delete the unused pipeline concept, keep the useful follow-up log.
6. **Settings cluster unification** (UX) — Billing/Workspace/Permissions as tabs of one Settings shell; fix the orphan `/billing` route with no nav entry.
7. **RLS governance + migration baseline** (Tech) — stop reactive per-table patching; generate a baseline migration and CI-check policy coverage going forward.
8. **Projects roadmap/milestone view** (UX) — cheap client-side grouping first, real `milestones` table later if warranted.
9. **Auth consolidation** (Tech) — delete the two dead auth systems, scoped as its own PR.
10. **Command palette** (UX) — resurrect using the existing `COMMAND_ITEMS` data that already exists but has no UI.
11. **Mobile parity** (Tech) — lowest priority, phased by business criticality, only after the web-side object model above stabilizes (no point porting modules that are about to be merged/deleted).

---

## Part 1 — ERP / Domain Architecture

### Business-object inventory

**Customer** — canonical home: `apps/web/app/[lang]/(dashboard)/customers` backed by `packages/validation/src/schemas/customer.schema.ts`. Every other module should only reference `customerId` (invoices, CRM interactions/opportunities, projects via `clientId`). Fragmentation today: `supplierSchema = customerSchema` (schema literally aliases customer with no distinguishing fields beyond `type: 'cash'|'credit'`), so Supplier under Purchasing (`(dashboard)/purchasing`) is really the same object wearing a different hat, but lives in a completely separate page with its own picker instead of reusing `customer-picker.tsx`. CRM's `interactionSchema`/`opportunitySchema` (`crm.schema.ts`) both key off `customerId` too, so CRM is really "activity/notes on top of Customer," not a separate root object — yet it lives in its own top-level page (`(dashboard)/crm`) with its own `crm-view.tsx` disconnected from the customer detail page.

**Product** — home: `product.schema.ts` / Warehouse module (`(dashboard)/warehouse`). Referenced by `invoiceItemSchema.productId`, `bomSchema.productId`, `workOrderSchema.productId`, `purchaseOrderSchema` items. Fine in principle, but Manufacturing's BOM/Work Order screens duplicate product pickers rather than deep-linking into warehouse stock records, and nothing in `workOrderSchema` or `bomSchema` writes back to warehouse stock quantities on completion (no `stockMovementId` field anywhere in these schemas).

**Invoice** — home: `(dashboard)/invoices` + `invoice.schema.ts`. `quick-invoice` (`(dashboard)/quick-invoice`) is a second creation surface for the same object with its own component tree (`packages/ui/src/components/ui/quick-invoice`) rather than a mode/variant of the one invoice form — genuine duplication of the invoice-creation UI, not just a shortcut.

**Payment** — has no schema of its own; it's folded into `invoiceSchema.paidAmount`/`paymentMethod` and separately into `transaction.schema.ts` (used by the Accounting module's `/api/accounting` routes registered in `backend/src/index.ts`). Two representations of "money received against an invoice" that never reference each other — `invoiceSchema` has no `journalEntryId`/`transactionId` field, and `journalEntrySchema` (`accounting.schema.ts`) has a generic `reference: optionalStringSchema` free-text field instead of a typed `sourceInvoiceId`. This is the literal cause of the "Accounting and Invoices are disconnected" problem: there is no foreign key in either schema, only a string a human would have to type in by hand.

**Journal Entry / Account** — home should be Accounting (`(dashboard)/accounting`), and it should be a system-generated ledger, not a page where users hand-type debit/credit lines against a Chart of Accounts (`accountSchema`) that nothing else in the app populates automatically. Right now it's the only true "home" for financial truth, but it's an island: `backend/src/routes/accounting.routes.ts` only exposes `/journal` GET/POST with no endpoint that is called from `invoice.routes.ts` on invoice paid/create.

**Project / Task** — home: `(dashboard)/projects`, `project.schema.ts`. `clientId` links to Customer (good), but `projectMemberSchema.employeeId` links to HR while `userId` also exists on the same record — two different identity systems for "who is on this project" coexisting in one schema, foreshadowing the three-auth-systems problem inside a business object itself.

**Employee** — home: `(dashboard)/human-resources`, `human-resources.schema.ts`. Referenced by `projectMemberSchema`, `timeEntrySchema`. No employee-to-user linkage visible outside optional `userId` on project member — HR employees and authenticated Users are not modeled as the same or even linked entities anywhere central.

**Supplier / Purchase Order** — `(dashboard)/purchasing`, `purchasing.schema.ts`. As flagged by the user, this is a genuinely thin object: `purchaseOrderSchema` has `status: pending/approved/shipped/received/cancelled` but nothing in the schema or route layer ties a "received" PO to a warehouse stock increase or an accounting payable entry — it's a form that goes nowhere. Given Supplier ⊆ Customer schema already, Purchasing today is largely a reskinned, disconnected mini-invoice module.

**Opportunity** — `crm.schema.ts`, under CRM. As user-reported "basically unused," and structurally it's just `{customerId, stage, value, probability}` with no relationship to actual Invoices (an opportunity that is "won" doesn't create anything — no `invoiceId` field, no route wiring found).

**Work Order / BOM** — `(dashboard)/manufacturing`, `manufacturing.schema.ts`. Legitimate distinct object (production), but as noted, isolated from Warehouse stock and from Accounting (no cost-of-goods entries generated).

**Workspace / User / Role-Permission** — `workspace.schema.ts`, `permission.schema.ts`, plus the three parallel auth systems (`packages/auth`, `packages/api/hooks/auth.ts`, `store/auth.slice.ts`). `(dashboard)/workspace`, `(dashboard)/settings`, `(dashboard)/billing`, `(dashboard)/permissions` are four separate pages that all mutate facets of "the account," none aware of each other.

### Nav reorganization: is the current nav-items.ts direction right?

The existing `nav-items.ts` (Today/Sell/Get Paid/Stock/Buy/Money + secondary People/Work/System) is the right instinct and should be kept as the top-level shape — it correctly stops using "Accounting," "CRM," "Warehouse" as if they were the mental model of a shop owner. But it is only a relabeling of the same six/seventeen pages, not a restructuring of what lives inside them. It goes half the distance because:

- "Sell" (`/quick-invoice`) and "Get Paid" (`/invoices`) are the same object (Invoice) split across two routes/components rather than one flow with entry points. A shop owner does not experience "create an invoice" and "collect on an invoice" as different objects — they should be one page with a filter/tab, not two apps.
- "Buy" (`/purchasing`) is a full top-level primary slot for a page the user has already said is confusing and low-value — that's an over-promotion of a weak object to the same visual weight as Sell/Stock/Money.
- "Follow-up" (`/crm`) sits under secondary People, correctly demoted, but CRM (Opportunities/Interactions) still exists as an independent page/schema rather than being folded as a tab on the Customer detail page it should never have been split from.
- "Money" (`/accounting`) and "Get Paid" (`/invoices`) are conceptually the same ledger to a shop owner ("how much came in, how much do I owe") but remain two unconnected schemas/routes.
- Approvals (`/approvals`) uses `entityTypeEnum` = `invoice | purchase_order | expense` in `workflow.schema.ts` with hardcoded `approverRoleEnum` (`sales_manager | finance_manager | ceo | admin`) that has no relationship to the dynamic `roleSchema`/`permissionSchema` records in `permission.schema.ts` — Approvals invented its own private, static role vocabulary instead of reusing the "real" permission system, which is itself disconnected from access control. So "Work" secondary group hides a second, competing RBAC concept.

**Recommendation**: go one level further than the current nav — collapse Sell + Get Paid into one "Invoices" object-page with tabs (draft/sent/paid/overdue), demote Buy out of the primary row entirely until Purchasing is rebuilt smaller, and treat Money as the single destination that Get-Paid actions write into rather than a parallel page.

### Merge / split / delete recommendations

- **Merge**: Quick Invoice into Invoices as a "new invoice" quick-entry mode of the same form component, not a separate route/component tree.
- **Merge**: Accounting and Invoices must become one object graph. Add `sourceInvoiceId`/`sourceType` fields to `createJournalEntrySchema`, and have `invoice.routes.ts`'s create/mark-paid handlers call the accounting service to auto-post a journal entry, rather than leaving `/api/accounting/journal` as a hand-entry-only endpoint.
- **Merge**: CRM Interactions and Opportunities should not be a standalone top-level page. Fold them into the Customer detail view as an "activity/deals" tab keyed by `customerId`, deleting the separate `crm-view.tsx` route shell.
- **Split/rebuild smaller**: Purchasing should be scrapped as an independent module and rebuilt as a lightweight "reorder" action attached to Warehouse/Product, with Supplier folded fully into the Customer/contact object (`type: 'supplier'`) instead of a parallel PO lifecycle nobody asked for.
- **Delete/rebuild smaller**: Opportunities/CRM pipeline as currently modeled should be deleted; if a lightweight "follow up" reminder is wanted, it belongs as a field/tag on Customer, not a Kanban sales pipeline for a single-shop-owner product.
- **Unify, don't merge outright**: Notifications, Activities, and Audit Logs are three tables with overlapping `entity_type`/`entityId` shapes and no shared schema — they should converge on one event schema with three read-projections (toast/feed/compliance-log), not three independently-maintained schemas.
- **Split off from Settings**: Billing, Workspace/team, and Permissions should become tabs of one "Account & Team" settings object rather than three sibling top-level routes.

### Permissions in an object-centric model

Today `permission.schema.ts` defines `resource`/`action` pairs and roles, and `backend/src/routes/permission.routes.ts` exposes a `hasPermission(userId, permissionCode)` check — but this check is called from nowhere except its own read endpoint; no route file uses a `requirePermission` preHandler. Meanwhile Workflow invented its own hardcoded `approverRoleEnum`, a second, parallel, static notion of "who can act on this."

For an object-centric model, permissions should be defined once per business object and every route handler for create/update/delete/approve should call the same check as a preHandler. Workflow approvals should consume `roleSchema`/`permissionIds`, not `approverRoleEnum`. Given RBAC was already downgraded to a read-only explainer because the backend was global-per-user rather than workspace-scoped, the next real step is workspace-scoping `userRoleSchema`/`roleSchema` before re-promising granular per-object permissions in the UI.

### Cross-object relationship map: ideal vs actual

Ideal chain: Customer → Invoices → Payments → Accounting Entries → Activities → CRM → Projects → Audit → Files.

- Customer → Invoice: **connected** (`invoiceSchema.customerId`).
- Invoice → Payment: **connected but shallow** — fields on the invoice, not a separate Payment record.
- Payment → Accounting Entry: **broken**. No field links them; `/api/accounting/journal` is never called by `invoice.routes.ts`.
- Accounting Entry → Activities: **broken**. `activityTypeEnum` doesn't include `accounting`/`journal`.
- Activities → CRM: **broken**. No relation between interaction/opportunity schemas and the activity schema.
- CRM → Projects: **broken**. No `projectId` on opportunity; a won opportunity doesn't spawn a project.
- Projects → Audit: **partially connected**, side-channel at best.
- Audit → Files: **not modeled at all** — no file/attachment schema exists yet.

Net assessment: the only genuinely solid link in the entire ideal chain is Customer→Invoice. The three-systems-for-one-concept pattern (auth, notifications/activities/audit, permissions-vs-workflow-roles) is the dominant architectural smell across the whole object model, and it repeats even at the schema level (Supplier=Customer alias, Payment=fields-on-invoice-vs-separate-transaction-schema).

---

## Part 2 — UX / Information Architecture

### Page-by-page audit

**Dashboard (`/dashboard`)** — Responsibility today: greeting → AI insight banner → BusinessHealthHero (today's sales/invoices/growth) → PerformanceSnapshot (monthly revenue, active customers) → AttentionPanel (pending payments, low stock) → QuickActions grid → sales chart + recent invoices. Close to right conceptually — the problem is density and duplication: `BusinessHealthHero` and `PerformanceSnapshot` both show monthly growth; `QuickActions` duplicates entry points already in the primary nav — the same four verbs appear three times on one screen. Proposed: collapse to greeting, one insight, one "today" hero, one "needs attention" list, chart+recent invoices below the fold. Drop the separate QuickActions grid since primary nav already is the quick-actions bar.

**Sell / quick-invoice (`/quick-invoice`)** — Just rebuilt into item→customer→payment→preview→confirm wizard, reusing `InvoiceDocument` on both the preview step and the invoice detail page. Strongest pattern in the app right now. Recommendation: promote "preview-before-commit with a shared document component" to a house pattern wherever the object is document-shaped — Purchasing (PO), Manufacturing/Projects (work order). Don't force it onto non-document things (creating a task, adding a customer).

**Get Paid (`/invoices`, `/invoices/[id]`)** — fine as-is; detail page already shares `InvoiceDocument`.

**Stock (`/warehouse`)** — fine as-is.

**Buy / Purchasing (`/purchasing`)** — no create-PO flow visible in the container — a passive receiving log, not an actionable "buy stock" tool, yet the primary nav literally labels it "Buy." Proposed: make this the real "replenish stock" workflow — trigger from low-stock alerts, "create purchase order" using the items→supplier→preview pattern, then this page tracks what's on order/received. Interim fix if not prioritized: rename the nav item to "Orders" until it has a create flow.

**Follow-up / CRM (`/crm`, tabs: interactions / opportunities)** — two tabs bolted together, opportunities is a second, mostly-empty mental model shoved into the same page as interaction logging. Proposed: keep "Follow-up" = interaction log tied to customers. Demote/remove the opportunities tab from primary IA entirely; a Kanban sales pipeline is enterprise-B2B thinking that doesn't match a shop owner's same-day, cash sales cycle.

**Projects (`/projects`, `/projects/[id]`)** — no phase/milestone entity exists, just a flat task list. The "still a mess, want a roadmap" complaint is structural — you can't show project phases if the backend has no phase concept. Recommend: (1) minimal — group tasks by a client-side milestone tag/date-bucket, render a timeline strip above the Kanban, no schema change; (2) proper — add a `milestones` table later if warranted. Prototype (1) first.

**Settings cluster (`/settings`, `/billing`, `/workspace`, `/permissions`)** — Four separate route roots. `/billing` is an orphan route with **no nav entry at all**. Proposed: one `/settings` shell with tabs — General, Billing & Subscription, Team & Workspace, Permissions & Roles. Routes: `/settings`, `/settings/billing`, `/settings/team`, `/settings/permissions`.

**Activities / Notifications / Audit cluster** — Unify into one system, three views. The bell's `resolveEntityUrl()` and the Activities page's click-through already route by the same `entity_type`/`entity_id` shape. Proposal: bell = last 5-10 unread popover; `/activities` = full filterable feed (already rebuilt well this session); `/audit` = permission-gated immutable compliance log, linked from Settings > Permissions, not primary nav.

**Command palette** — No `CommandPalette.tsx` remains, but `nav-items.ts` still defines unused `COMMAND_ITEMS` with shortcuts. Given the nav buries 12 items in "More," a Cmd+K palette is the single highest-leverage fix for "I don't know where to find X." Pair with a visible search icon for low-literacy discoverability, not just a keyboard shortcut.

### Navigation/IA redesign (final proposal)
Keep the current primary six. Changes: (1) fix Purchasing before keeping the "Buy" label; (2) collapse `/workspace` into unified Settings > Team; (3) collapse System group from 5 items to 3: Settings (sub-tabs), Events, Sync; (4) add a persistent global search/command trigger next to the notification bell.

---

## Part 3 — Technical / Database Architecture

### 1. Unified Event/Activity Data Model

Three independent write paths exist today (`notifications`, `activities`, `audit_logs`). This session's `logBusinessEvent()` fans out into two of the three but still performs two physical inserts per event, and `audit_logs` remains a fully separate third path. Proposed: one `events` table as single source of truth:

```
events (
  id uuid pk, workspace_id uuid not null, actor_id uuid not null,
  entity_type text not null, entity_id uuid not null, action text not null,
  title text not null, description text, metadata jsonb not null default '{}',
  severity smallint not null default 0, old_data jsonb, new_data jsonb,
  created_at timestamptz not null default now()
)
```

`notifications` becomes a `notification_recipients (event_id, user_id, read_at)` join table; `activities` becomes a filtered view over `events`; `audit` becomes a view filtered to rows with a diff. Migrate via compatibility views, cut over route-by-route.

### 2. RLS/Permissions Architecture

RLS gaps were patched reactively across ~24 tables this session. Since the backend uses `SUPABASE_SERVICE_KEY` and bypasses RLS entirely, these policies only matter for the one real direct-to-Supabase path: `packages/api/src/supabase/realtime.ts`. The two `SECURITY DEFINER` linter warnings (`get_user_workspace_ids`/`is_workspace_member`) are a deliberate, necessary pattern for self-referential RLS, not a smell — document them as the canonical membership check. Recommendation: (1) finish adopting a real migration tool — only 2 Drizzle migrations exist against 25+ services and dozens of hand-managed tables (`warehouse_stock` was found completely missing this session); (2) enforce a per-table RLS policy-coverage check in CI instead of discovering gaps reactively; (3) if granular per-permission roles are needed for real, scope `user_roles` by `workspace_id` and add a `has_permission()` sibling function alongside `is_workspace_member()`.

### 3. Accounting/Invoice Integration

Partial, not absent: `invoice.service.ts` auto-posts a journal entry using hardcoded account codes, but silently no-ops if the chart of accounts is incomplete, has no reversal on edit/void, and `checkout.service.ts` posts no journal entry at all (ledger never sees the collection side). Recommendation: make account-code mapping configurable per workspace, fail loudly instead of silently skipping, post on payment completion, add reversal handling, and add `source_type`/`source_id` columns to `journal_entries` instead of overloading a free-text `reference` field.

### 4. API Versioning Consistency

`workflow.routes.ts` alone uses `/api/v1/` while every other route uses plain `/api/` — not real versioning. Drop the prefix to match, or introduce versioning deliberately at the Fastify plugin-registration level if ever needed.

### 5. Migration/Schema Governance

Only 2 tracked migrations exist against a schema that has clearly diverged (the `warehouse_stock` incident). Generate a baseline migration from the live schema now, enforce "no dashboard SQL editor changes" going forward, and add a CI check that diffs live schema against migration history.

### 6. Mobile Parity (lower priority)

`apps/mobile` shares `packages/api`/`packages/store` with web — the gap is UI/navigation only. Adopt React Navigation, phase remaining modules by business criticality, and don't port modules that are about to be merged/deleted per Parts 1-2 above.

### 7. Auth Consolidation

Three parallel auth systems exist (`packages/auth`, `packages/api/src/hooks/auth.ts`, `store/auth.slice.ts`) — only one is live end-to-end. Confirm via import grep, delete the other two's source in one dedicated PR.

### Critical files (all three parts combined)
- packages/validation/src/schemas/{invoice,accounting,crm,purchasing,permission,workflow}.schema.ts
- backend/src/routes/{invoice,accounting,workflow}.routes.ts
- backend/src/services/{event-log,invoice,accounting,permission}.service.ts
- backend/drizzle/migrations/
- packages/api/src/supabase/realtime.ts
- packages/auth/src/supabase.ts · packages/api/src/hooks/auth.ts · packages/store/src/slices/auth.slice.ts
- apps/web/app/[lang]/(dashboard)/constants/nav-items.ts
- packages/ui/src/components/ui/dashboard/{dashboard-view,business-health-panel}.tsx
- packages/ui/src/components/ui/{purchasing,crm,projects}/containers/*.tsx
- packages/ui/src/components/ui/notification-bell.tsx
- packages/ui/src/components/ui/activity/ActivitiesPage.tsx
- packages/ui/src/components/ui/invoice-detail/invoice-document.tsx
- apps/mobile/App.tsx
