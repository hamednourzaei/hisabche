# Hisabche UX Reconstruction — Page Layout Blueprints

> **Phase 1 Deliverable** | Generated: `2026-11-26` | Constraint: Global Header & Sidebar are **LOCKED** (`hisabche-ux.md §0.1`).

All workspace pages render inside the locked global shell (`DashboardHeader` + `DashboardSidebar` on desktop/web; bottom tab bar + More drawer on mobile) and follow one of these standardized blueprints:

## 1. Dashboard Blueprint (`/dashboard`)

- **Hierarchy:** Context greeting + operational status bar (offline/sync/currency) -> Priority KPI row (`KpiGrid`/`KpiCard`, max 4 visible above fold) -> Primary action strip (role-filtered quick actions) -> Two-column asymmetric desktop workspace (Work Queue / Approvals + Cash/Sales/Stock summaries) -> Single-column priority stack on mobile.
- **Industry & Role Rule:** Widgets come from `DashboardRegistry.ts` + `industry-profiles.ts` order. Unavailable modules/packs collapse completely (**zero blank grid slots**).

## 2. Hub + Data Listing Blueprint (`/invoices`, `/warehouse`, `/customers`, `/accounting`, `/team-and-payroll`, `/approvals`, `/activities`, `/billing`, `/governance`, `/data-and-sync`)

- **Top Chrome:** `PageHub` / centered `HubTabs` (`?tab=`, horizontally scrollable on mobile) + optional single `SegmentedControl` (`?view=`) for one-section-at-a-time switching.
- **Toolbar:** Search (`search-input.tsx`), server/client filters (`TableFilterSelect` / `TableFilterMenu`), saved views, and single Primary Action CTA (`Button`).
- **Body:** `DataTable` on desktop (`md+`) with `VISIBILITY_CLASS` priority columns; automatic card/list view (`data-table-cards.tsx`) on mobile (`< md`) keeping identifiers and minor-unit totals readable.
- **Row Detail:** Clicking a row opens detail inline/panel (`Sheet`/`Drawer`) or navigates to `/x/:id` for bookmarkable entities.

## 3. Entity Detail Blueprint (`/invoices/:id`, `/warehouse/:id`, `/customers/:id`, `/team-and-payroll/:id`)

- **Header:** Back breadcrumb + entity title/code + status `Badge` + contextual primary/secondary actions (with two-step confirmation for financial/destructive actions).
- **Body:** Summary strip (`KpiGrid`) + `SegmentedControl` sub-sections (Overview, Ledger/Movements, Notes/Attachments via `entity-notes.tsx`).

## 4. Create / Edit & Express Form Blueprint (`Sheet` / `Dialog` / `/invoices/new`)

- **1–3 fields / confirmation:** `Dialog` or `alert-dialog.tsx`.
- **Standard record create/edit:** Side `Sheet` (desktop) / bottom `Sheet` (mobile) so the user never loses list context.
- **Full-grid transactional workspace (`/invoices/new`, `/till`):** Full-width split grid on desktop; sticky summary footer + step/drawer item picker on mobile.

## 5. Required Non-Happy States (Every Blueprint)

- **Loading:** `page-skeleton.tsx` / `skeleton.tsx` matching layout geometry.
- **Empty:** `empty-state.tsx` with clear Persian/Dari/English guidance and primary CTA.
- **Error:** `error-boundary.tsx` + explicit retry (never masked as empty data).
- **Offline:** `offline-banner.tsx` / `offline-page-gate.tsx` / `offline-refusal-notice.tsx` / `cloud-required-notice.tsx`.
- **Permission Denied:** `no-access-notice.tsx` (`isNavLocked` / `isRouteDenied`).
