# HISABCHE UNIVERSAL PRODUCT UX & ARCHITECTURE BLUEPRINT

**Phase 1 — Product Reverse Engineering.** No code written, no source files modified.

## Evidence basis (read this first)

Everything below is derived from files actually inspected in this repository. Where a
claim is an _inference_ rather than a verified read, it is marked **[INFERRED]**. Where
a required file does not exist, it is marked **[MISSING]** in §23.

Depth is not uniform, and deliberately so:

- **Full depth** — the eight modules that exist on all three platforms (dashboard,
  sales/invoices, inventory/products, CRM/customers, accounting, sync, settings, auth).
  These are the only places where a genuine three-platform comparison is possible.
- **Inventory depth** — the 18 web-only dashboard routes. There is no desktop or
  mobile implementation to reverse-engineer for these, so any "desktop UX" for them
  would be invention, which this phase forbids.

---

## 1. PRODUCT MAP

Hisabche is a workspace-scoped business/accounting operating system, RTL-first
(fa / af / en), offline-capable, delivered as three clients over one backend.

```
                          HISABCHE
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   apps/web              apps/desktop          apps/mobile
   Next.js 16            Electron 31 +         Expo Router
   App Router            React Router          + React Native
   46 routes             (hash)                17 route files
                         10 routes             5 tabs
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                     SHARED PACKAGES (13)
   api · auth · auth-core · config · db · db-schema · i18n
   mobile-ui · offline · store · ui · validation · analytics
                              │
                     backend (Fastify 5)
              26 route modules · Drizzle · Supabase
```

**Verified platform entry points**

| Platform | Entry                                           | Router                                                         | Shell                      |
| -------- | ----------------------------------------------- | -------------------------------------------------------------- | -------------------------- |
| Web      | `apps/web/app/[lang]/…`                         | Next App Router, `localePrefix: 'as-needed'` (`fa` unprefixed) | `(dashboard)` route group  |
| Desktop  | `apps/desktop/src/main.tsx` → `src/app/app.tsx` | React Router **hash** router                                   | `RequireAuth` + layout     |
| Mobile   | `apps/mobile/app/_layout.tsx`                   | Expo Router file-based                                         | `(tabs)` + `(auth)` groups |

Desktop uses hash routing deliberately — a packaged app loads from `file://` and has no
server to rewrite paths (comment verified in `app.tsx`).

**Key structural finding.** There is no `apps/web/**/components` directory. Web pages
compose almost entirely from `packages/ui/src/components/ui`, which holds **80 entries** —
both shadcn-style primitives (`button.tsx`, `dialog.tsx`, `table.tsx`, `sheet.tsx`) and
whole feature folders (`crm/`, `invoices/`, `warehouse/`, `manufacturing/`, `billing/`…).
`@hisabche/ui` is therefore not a design-system package; it is the web application's
component layer wearing a shared-package label. This is the single most consequential
architectural fact in this document — see §21.

---

## 2. COMPLETE ROUTE / SCREEN MAP

### 2.1 Web — `apps/web/app` (46 `page.tsx` files, all verified)

**Dashboard group** — `[lang]/(dashboard)/`

| Route                      | Purpose                 | Desktop?                  | Mobile?               |
| -------------------------- | ----------------------- | ------------------------- | --------------------- |
| `/` (group index)          | Dashboard entry         | ✅                        | ✅                    |
| `dashboard`                | KPI overview            | ✅                        | ✅ `(tabs)/index`     |
| `invoices`                 | Invoice list            | ✅ `sales`                | ✅ `(tabs)/sales`     |
| `invoices/[id]`            | Invoice detail          | ✅ `sales/:id`            | ✅ `sales/[id]`       |
| `quick-invoice`            | Fast invoice capture    | ⚠️ as `sales/new`         | ⚠️ as `sales/new`     |
| `customers`                | Customer list           | ✅                        | ✅ `(tabs)/customers` |
| `warehouse`                | Stock/inventory         | ✅ as `inventory`         | ✅ `(tabs)/inventory` |
| `warehouse/[id]`           | Stock item detail       | ✅ _(no dedicated route)_ | ✅ `inventory/[id]`   |
| `accounting`               | Ledger / transactions   | ✅                        | ✅ `accounting`       |
| `sync-center`              | Sync status & queue     | ✅ `sync`                 | ✅ `sync`             |
| `settings`                 | Workspace/user settings | ✅                        | ✅ via `more`         |
| `crm`                      | CRM pipeline            | ❌                        | ❌                    |
| `activities`               | Activity feed           | ❌                        | ❌                    |
| `approvals`                | Approval queue          | ❌                        | ❌                    |
| `billing`                  | Subscription/billing    | ❌                        | ❌                    |
| `human-resources` + `[id]` | HR records              | ❌                        | ❌                    |
| `manufacturing`            | Production              | ❌                        | ❌                    |
| `projects` + `[id]`        | Projects                | ❌                        | ❌                    |
| `purchasing`               | Purchase orders         | ❌                        | ❌                    |
| `permissions`              | Role/capability admin   | ❌                        | ❌                    |
| `sales-followup`           | Follow-up queue         | ❌                        | ❌                    |
| `team&page`                | Team management         | ❌                        | ❌                    |
| `workflow-templates`       | Workflow builder        | ❌                        | ❌                    |
| `onboarding`               | First-run setup         | ❌                        | ❌                    |

`team&page` is almost certainly a typo'd directory name (`&` in a route segment) —
flagged in §23.

**Public / auth group** — `[lang]/`

`/` (landing), `about`, `contact`, `login`, `signup`, `forgot-password`,
`reset-password`, `accept-invite`, `public-invoice/[token]`, `public-task/[token]`,
plus 10 `legal/*` pages (accessibility, cookies, copyright, data-deletion, disclaimer,
gdpr, privacy, refund, security, terms).

The two `public-*/[token]` routes are unauthenticated share links — the only routes that
render business data without a session.

### 2.2 Desktop — `apps/desktop/src/app/app.tsx` (10 routes, all verified)

| Path             | Component                     | Lazy  |
| ---------------- | ----------------------------- | ----- |
| `/login`         | `LoginPage`                   | eager |
| `/` (index)      | `DashboardPage`               | ✅    |
| `/sales`         | `InvoicesPage`                | ✅    |
| `/sales/new`     | `NewInvoicePage`              | ✅    |
| `/sales/:id`     | `InvoiceDetailPage`           | ✅    |
| `/inventory`     | `ProductsPage`                | ✅    |
| `/customers`     | `CustomersPage`               | ✅    |
| `/customers/:id` | `CustomerDetailPage`          | ✅    |
| `/accounting`    | `AccountingPage`              | ✅    |
| `/sync`          | `SyncPage`                    | ✅    |
| `/settings`      | `SettingsPage`                | ✅    |
| `*`              | `<Navigate to="/" replace />` | —     |

Desktop has **no** product-detail route (`/inventory/:id`) while mobile does. Asymmetry
flagged in §13.

### 2.3 Mobile — `apps/mobile/app` (Expo Router, verified)

| File                                       | Kind                               |
| ------------------------------------------ | ---------------------------------- |
| `_layout.tsx`                              | Root stack                         |
| `index.tsx`                                | Boot/redirect                      |
| `(auth)/_layout.tsx`, `(auth)/login.tsx`   | Auth stack                         |
| `(tabs)/_layout.tsx`                       | 5-tab bar, custom `AnimatedTabBar` |
| `(tabs)/index.tsx`                         | Home / dashboard                   |
| `(tabs)/sales.tsx`                         | Invoices                           |
| `(tabs)/inventory.tsx`                     | Products                           |
| `(tabs)/customers.tsx`                     | Customers                          |
| `(tabs)/more.tsx`                          | Overflow menu                      |
| `sales/new.tsx`, `sales/[id].tsx`          | Stack screens                      |
| `customers/[id].tsx`                       | Stack screen                       |
| `inventory/[id].tsx`, `inventory/scan.tsx` | Stack screens                      |
| `accounting.tsx`, `sync.tsx`               | Stack screens                      |

Route files are thin; the real screens live in `src/features/*/screens/*`. Mobile is the
only platform with a **barcode scan screen** as a route (`inventory/scan`); desktop has
barcode support as a _hook_ (`use-barcode-scanner.ts`) rather than a screen.

---

## 3. NAVIGATION MAP

### Web

Persistent `DashboardSidebar` (`packages/ui/src/components/ui/dashboard-sidebar.tsx`,
702 lines, v7.3, fully memoized). Structure verified: `NavGroup[] → NavItem[]` with
`{ id, icon, label, path, badge? }`. Active-state matching is locale-aware — it strips
`/(fa|af|en)` before comparing, and matches exact, `path + '/'`, and `path + '?'`.
Icons are inline SVG path fragments in a local `ICON_PATHS` record (only 5 defined:
dashboard, warehouse, invoices, customers, settings) — meaning most sidebar items render
via a different icon path than this record. Companion shells: `dashboard-header.tsx`,
`command-palette.tsx`, `global-search.tsx`, `breadcrumb.tsx`, `notification-bell.tsx`.

### Desktop

Single persistent layout wrapping all authenticated routes, `RequireAuth` gate at the
route-tree root. Keyboard layer verified in `shared/hooks/use-shortcuts.ts` and
`use-search-focus.ts`; `ui.store.ts` holds `sidebarCollapsed`, `paletteOpen`,
`searchRequestId` (a counter bumped by Ctrl+F so the active page focuses its own search
field — a genuinely good pattern, see §16).

### Mobile

Bottom tabs: **خانه / فروش / انبار / مشتریان / بیشتر**. Custom `AnimatedTabBar`,
`headerShown: false` globally (screens draw their own `ScreenHeader`). Icons switch
outline→solid on focus (correct iOS/Android convention). Unauthenticated users are
`Redirect`ed to `(auth)/login` from the tabs layout. Push registration is initialised
inside the tabs layout via `usePushRegistration(isAuthenticated)`.

**Navigation asymmetry.** Web exposes 26 dashboard destinations through a grouped
sidebar; desktop exposes 8; mobile exposes 5 tabs + overflow. Mobile's `more` tab is the
correct pressure valve. Desktop currently has **no equivalent** — the 18 web-only
modules are simply unreachable, with no "not on this platform" affordance.

---

## 4. CORE BUSINESS FLOWS

### 4.1 Create invoice (verified against `invoice-draft.ts`, `new-invoice-*`, schema)

```
Select customer → Add products (line items) → Qty / unit price / per-line discount
   → Subtotal → Discount total → Tax total → Total
   → Save → invoice + invoice_items rows → enqueue for sync
   → Inventory movement → Customer balance → Success
```

Money model is verified from `backend/src/drizzle-schema.ts`:
`numeric(12,2)` for all money, `numeric(12,3)` for `quantity`, `numeric(5,2)` for
per-line `discount`. `currency` defaults to `'AFN'`, `paymentMethod` to `'cash'`,
`status` to `'pending'`, `type` to `'sale'`.

| Step          | Web                                    | Desktop                             | Mobile                                        |
| ------------- | -------------------------------------- | ----------------------------------- | --------------------------------------------- |
| Pick customer | `customer-picker.tsx` (inline popover) | inline picker in `new-invoice-page` | `customer-picker-sheet.tsx` (bottom sheet)    |
| Pick product  | `product-picker.tsx`                   | inline + barcode hook               | `product-picker-sheet.tsx` + `inventory/scan` |
| Edit lines    | table rows                             | dense table rows                    | `line-item-row.tsx` cards                     |
| Save          | form submit                            | Ctrl+S **[INFERRED]**               | sticky primary action                         |

Business logic identical; only the picker surface differs. This is the correct pattern
and should be the model for every other flow.

### 4.2 Sync (verified)

Desktop `sync-engine.ts` exposes exactly two entry points: `pullAll()` and
`runSync(queryClient)` — i.e. pull-then-push, with React Query cache invalidation as the
completion signal. `packages/offline/src/sync/sync-queue.ts` exports a single
`syncQueue` singleton. The desktop local DB is reachable only over IPC, with the table
set fixed by `localTableSchema`:

`product · customer · invoice · invoice_item · transaction · inventory_movement · employee`

Note that `employee` is syncable locally but HR has no desktop or mobile UI.

### 4.3 Auth (verified)

Backend `POST /api/auth/login` → `supabase.auth.signInWithPassword` → returns
`{ user: SanitizedUser, token: access_token }`. `SanitizedUser` = `id, email, fullName,
businessName, avatarUrl, createdAt`. Desktop persists the session through
`secure:set`/`secure:get` IPC into an OS-keyring-backed vault (`safeStorage`, DPAPI /
Keychain / libsecret, with an unencrypted userData-scoped fallback).

---

## 5. ENTITY RELATIONSHIPS

Verified from `backend/src/drizzle-schema.ts` — **11 tables**:

```
workspaces
   ├── products ────┐
   ├── customers ─┐ │
   ├── invoices ←─┘ │        invoices.customerId → customers.id
   │      └── invoice_items ─┘   invoice_items.productId → products.id
   ├── transactions
   └── workflows
          ├── workflow_steps
          └── workflow_instances
                 └── workflow_actions
exchange_rates   (standalone, currency conversion)
```

Foreign keys actually declared: `invoices.workspaceId → workspaces.id`,
plus `products`, `customers`, `transactions`, `workflow_instances`, `workflows` each
carrying a workspace FK. `invoice_items` has **indexes** on `invoiceId`/`productId` but
**no declared FK** — flagged in §23.

Tenancy is dual-keyed: rows carry both `workspaceId` and `userId`, with composite
indexes `(userId, status)` and `(userId, createdAt)` on invoices. Any client-side query
must filter on the same axis the index expects or large workspaces will table-scan.

**Not in the Postgres schema**: suppliers (only `invoices.supplierId`, an unconstrained
uuid), HR/employees, projects, purchasing, manufacturing, billing — despite all six
having web routes and backend route modules. Those either live in Supabase-managed
tables outside Drizzle or are incomplete. **[MISSING]** — see §23.

---

## 6. PAGE-BY-PAGE ANALYSIS

Format per §25. Full depth for the eight shared modules.

### 6.1 DASHBOARD

- **Business purpose** — single-glance health of the workspace.
- **User** — owner/manager, first screen after login.
- **Data** — sales, revenue, receivables (بدهکار), stock value. Verified from the live
  desktop render: four KPI tiles plus sales/inventory/customer sections.
- **Actions** — refresh, new invoice, jump to module.
- **Entry** — post-login. **Exit** — invoices or inventory.
- **Side effects** — none (read-only).

|             | Layout                                 | Navigation                            | Components                                                                 | States   |
| ----------- | -------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------- | -------- |
| **Web**     | Sidebar + KPI grid + `bento-stats.tsx` | sidebar + breadcrumb                  | `bento-stats`, `chart.tsx`                                                 | full set |
| **Desktop** | dense tile row, no decorative cards    | persistent sidebar; `metric-tile.tsx` | `dashboard-page.tsx` + `metric-tile.tsx`                                   | full set |
| **Mobile**  | vertical scroll, hero metric first     | tab `index`                           | `hero-metric-card`, `insight-card`, `sales-trend-card`, `dashboard-header` | full set |

Mobile is the best-factored of the three (four purpose-built components); desktop is the
thinnest (one tile component).

### 6.2 INVOICES / SALES

- **Purpose** — the revenue ledger; the product's centre of gravity.
- **Data** — `invoiceNumber, type, customerId, date, dueDate, subtotal, discountTotal,
taxTotal, total, paidAmount, currency, paymentMethod, status, notes`.
- **Actions** — list, filter, open, create, print/PDF (`invoice-pdf.routes.ts`),
  public share link (`invoice-public.routes.ts`).
- **Side effects** — stock movement, customer balance, activity feed.

|             | Layout                               | Navigation               | Components                                                           | Keyboard / Touch      | States |
| ----------- | ------------------------------------ | ------------------------ | -------------------------------------------------------------------- | --------------------- | ------ |
| **Web**     | responsive table                     | route push to `[id]`     | `invoices/`, `data-table/`                                           | —                     | full   |
| **Desktop** | dense table, master/detail candidate | `/sales` → `/sales/:id`  | `invoices-page`, `invoice-detail-page`, `data-table` chunk (54.5 kB) | Ctrl+F → page search  | full   |
| **Mobile**  | list of `invoice-row` cards          | tab → stack `sales/[id]` | `invoices-screen`, `invoice-row`, `query-list`                       | swipe via `swipe-row` | full   |

Desktop currently navigates away to the detail route. With a persistent window and
`sales` already loaded, **master/detail (list left, detail right)** is the obvious
desktop-native improvement and requires no business-logic change.

### 6.3 INVENTORY / PRODUCTS / WAREHOUSE

Naming is inconsistent across platforms — web `warehouse`, desktop `inventory`, mobile
`inventory`, DB `products`. Flagged in §23.

|             | Layout                            | Components                                     | Notes                |
| ----------- | --------------------------------- | ---------------------------------------------- | -------------------- |
| **Web**     | table + `stock-stats-card.tsx`    | `warehouse/`, `warehouse-detail/`              | has `warehouse/[id]` |
| **Desktop** | `products-page.tsx`               | `use-barcode-scanner.ts`                       | **no detail route**  |
| **Mobile**  | `products-screen` + `product-row` | `product-detail-screen`, `barcode-scan-screen` | has detail + scan    |

### 6.4 CUSTOMERS / CRM

Web splits `customers` (list) from `crm` (pipeline). Desktop and mobile implement only
`customers`. Mobile has `customer-profile-header.tsx` and `customer-row.tsx`; desktop has
list + detail pages with no sub-components. Web `crm/` is a full feature folder with no
counterpart elsewhere.

### 6.5 ACCOUNTING

Present on all three (`accounting-page.tsx` / `accounting-screen.tsx` /
`(dashboard)/accounting`). Backed by `transactions` (13 columns, 6 indexes) and
`exchange_rates`. Desktop accounting chunk is 8.4 kB — the lightest of the shared
modules, suggesting the thinnest implementation.

### 6.6 SYNC CENTER

Web `sync-center`, desktop `/sync`, mobile `sync.tsx`. Desktop is the most developed:
`sync-engine.ts` (`pullAll` + `runSync`), `use-sync.ts`, `sync-page.tsx`. Mobile has
`sync-screen.tsx` + `offline-banner.tsx`. Web has `sync-center/`, `sync-status.tsx`,
`offline-queue.tsx`, `offline-banner.tsx`, `realtime-indicator.tsx`.

### 6.7 SETTINGS

All three platforms. Mobile reaches it through the `more` tab rather than a tab of its
own — correct for a 5-tab budget.

### 6.8 AUTH

Web: `login`, `signup`, `forgot-password`, `reset-password`, `accept-invite`.
Desktop: `login` only. Mobile: `(auth)/login` only.
Neither desktop nor mobile can register an account or recover a password — both must
send users to the web. Flagged in §23.

### 6.9 Web-only routes (inventory depth)

`crm`, `activities`, `approvals`, `billing`, `human-resources(+[id])`, `manufacturing`,
`projects(+[id])`, `purchasing`, `permissions`, `sales-followup`, `team&page`,
`workflow-templates`, `onboarding`, and the public/legal set. Each has a matching
`packages/ui/.../<module>/` folder, a `packages/api/src/hooks/<module>.ts`, a
`packages/validation/src/schemas/<module>.schema.ts`, and a
`backend/src/routes/<module>.routes.ts`. The data and validation layers are therefore
already cross-platform ready; only the UI is web-bound.

---

## 7. COMPONENT MAP

**Verified inventory**

| Layer                                  | Location                            | Count                                      |
| -------------------------------------- | ----------------------------------- | ------------------------------------------ |
| Web components (mislabelled as shared) | `packages/ui/src/components/ui`     | 80 entries                                 |
| Mobile primitives                      | `packages/mobile-ui/src/components` | 25 components                              |
| Desktop components                     | `apps/desktop/src/features/*`       | 13 files, `shared/components` is **empty** |

**Desktop's `shared/components/` directory is empty.** Every desktop page builds its own
markup. That is the root cause of desktop's visual drift from web and mobile.

**Correct target taxonomy**

```
Shared Primitive        → tokens, Money, Badge/StatusChip, Skeleton, EmptyState,
                          ErrorState  (must exist on all 3; today only mobile-ui has
                          the full set)
Shared Business Comp.   → invoice totals, line-item math, status derivation
                          (today: partly in invoice-draft.ts, desktop-only)
Web Composition         → packages/ui/src/components/ui/*   (already exists)
Desktop Composition     → apps/desktop/src/shared/components/*  (EMPTY — the gap)
Mobile Composition      → apps/mobile/src/features/*/components/*  (already exists)
```

**Duplication already present:** `offline-banner` exists in both `packages/ui` and
`packages/mobile-ui`. `empty-state` likewise. `money-input` (web) vs `money` (mobile)
vs nothing (desktop).

---

## 8. DESIGN SYSTEM AUDIT

**Source of truth** — `packages/ui/src/styles/globals.css` **v3.1, Emerald/Teal,
dark-first**, cited verbatim in the header of `packages/mobile-ui/src/tokens/colors.ts`.

**Mobile token port is exemplary.** `colors.ts` declares a typed `ColorScheme` with:
brand (`primary`, `primaryFg`, `primaryHover`, `primaryLight`, `primarySoft`,
`secondary`, `accent`), semantic (`success`/`warning`/`destructive`/`info`, each with
`Fg` and `Soft`), a **4-level surface elevation ladder**
(`surfaceBase`, `surfaceMuted`, `surfaceElevated`, `surfaceOverlay`), and a **3-tier text
ramp**. Values are kept character-identical to the web CSS variables because React Native
parses `hsl()`/`hsla()` natively. Companion files: `typography.ts`, `layout.ts`,
`theme-provider.tsx`.

**The gap.** Desktop consumes neither. It has `apps/desktop/src/styles.css` and no token
module. Two of three platforms share a design system; the third improvises.

**Primitive coverage**

| Primitive                | Web                           | Mobile                            | Desktop |
| ------------------------ | ----------------------------- | --------------------------------- | ------- |
| Button / Input / Badge   | ✅                            | ✅                                | ❌      |
| Table / DataTable        | ✅ `data-table/`              | n/a (lists)                       | ad-hoc  |
| Dialog / Sheet / Drawer  | ✅ `dialog`, `sheet`, `Modal` | ✅ `bottom-sheet`, `action-sheet` | ❌      |
| Empty / Error / Skeleton | ✅                            | ✅                                | ❌      |
| Money display            | `money-input`                 | `money`                           | ❌      |
| Status                   | `badge`                       | `status-chip`, `trend-pill`       | ❌      |
| Charts                   | `chart.tsx`                   | `sparkline`                       | ❌      |
| Offline banner           | ✅                            | ✅                                | ❌      |

Desktop has zero shared primitives. This is the top finding of the audit.

**Inconsistencies found**

1. Design tokens exist in two of three platforms.
2. `packages/ui` mixes primitives and feature folders in one flat directory (80 entries).
3. `dashboard-sidebar.tsx` defines only 5 icons in `ICON_PATHS` but the sidebar covers
   26 destinations.
4. Persian comments, `✅` markers and version banners (`v7.3`, `v3.1`) inside component
   source — harmless but signals hand-maintained rather than generated components.

---

## 9. STATE MAP

Global state — `packages/store/src/slices` (11 verified slices):
`auth · backup · cart · currency · device · onboarding · preferences · sync · theme ·
warehouse · workspace`. Desktop additionally keeps `ui.store.ts` locally, and mobile
keeps `features/auth/auth.store.ts` locally.

**Three separate auth stores exist** (`packages/store/auth.slice.ts`,
`apps/desktop/src/features/auth/auth.store.ts`, `apps/mobile/src/features/auth/auth.store.ts`).
Session _shape_ is shared via `@hisabche/auth-core` (`createSessionStore`, `sessionCan`),
but the stores are not. Flagged in §23.

Per-screen state matrix — required on every list/detail screen:

| State                       | Web                                                  | Desktop             | Mobile                |
| --------------------------- | ---------------------------------------------------- | ------------------- | --------------------- |
| Initial loading             | skeleton                                             | skeleton            | `skeleton.tsx`        |
| Empty                       | `empty-state.tsx`                                    | **missing**         | `empty-state.tsx`     |
| Populated                   | table                                                | table               | list                  |
| Submitting                  | inline                                               | inline              | sticky button spinner |
| Success                     | `sonner`/`toast`                                     | **missing**         | inline                |
| Error                       | `error-boundary`                                     | **missing**         | `error-state.tsx`     |
| Permission restricted       | `permissions` route + `sessionCan`                   | `sessionCan` in IPC | **[INFERRED]**        |
| Offline                     | `offline-banner`                                     | banner **missing**  | `offline-banner.tsx`  |
| Syncing / failed / recovery | `sync-status`, `offline-queue`, `realtime-indicator` | `sync-page` only    | `sync-screen`         |

Desktop is missing empty, error, success and offline presentation as reusable pieces.

---

## 10. WEB UX BLUEPRINT

Keep the current model — it is the reference. Priorities:

1. Split `packages/ui` into `ui-primitives` (design system) and `web-features`
   (compositions). Nothing else can be shared cleanly until this happens.
2. Give `dashboard-sidebar` a complete icon set or a single icon source.
3. Keep `command-palette` + `global-search` as the power-user path; they are the
   pattern desktop should adopt directly.
4. Breadcrumbs already exist — use them consistently on the `[id]` routes.

## 11. DESKTOP UX BLUEPRINT

Desktop is the weakest of the three and has the clearest upside.

| Area            | Now                      | Target                                                |
| --------------- | ------------------------ | ----------------------------------------------------- |
| Primitives      | none                     | consume shared tokens + primitives                    |
| Invoices        | list → route change      | **master/detail split pane**                          |
| Inventory       | no detail route          | add `/inventory/:id` (parity with mobile)             |
| Density         | ad-hoc                   | dense tables, no decorative cards, no oversized radii |
| Keyboard        | `use-shortcuts` + Ctrl+F | full command palette, N=new, /=search, Esc=close      |
| Bulk actions    | none                     | multi-select + bulk status/print                      |
| States          | missing                  | empty / error / offline / success components          |
| Window          | default                  | remember size & position, restore last route          |
| Missing modules | silently absent          | explicit "open in web" affordance                     |

`searchRequestId` in `ui.store.ts` is already the right primitive for global→local search
focus; extend the same pattern for "new record" and "refresh".

## 12. MOBILE UX BLUEPRINT

Mobile is the best-executed platform. Preserve and extend:

- 5-tab budget is correct; `more` absorbs growth.
- Bottom sheets for both pickers — correct, keep.
- `swipe-row` exists; use it only where a real workflow benefits (mark paid, delete).
- `barcode-scan-screen` is a genuine mobile-native advantage.
- Add: pull-to-refresh on the four list tabs, keyboard-avoidance on `sales/new`,
  offline queue depth on the `sync` screen.
- Do **not** add HR/manufacturing/projects to mobile. They are desk work.

---

## 13. WEB → DESKTOP → MOBILE MAPPING

| Feature                                                                                                                        | Web             | Desktop      | Mobile        | Shared logic                            |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------- | ------------ | ------------- | --------------------------------------- |
| Dashboard                                                                                                                      | ✅ bento        | ✅ tiles     | ✅ hero+cards | `hooks/dashboard.ts`                    |
| Invoices list                                                                                                                  | ✅ table        | ✅ table     | ✅ list       | `hooks/invoices.ts`                     |
| Invoice detail                                                                                                                 | ✅              | ✅           | ✅            | `invoice.schema.ts`                     |
| New invoice                                                                                                                    | `quick-invoice` | `/sales/new` | `sales/new`   | `invoice-draft.ts` (desktop-only today) |
| Customers                                                                                                                      | ✅              | ✅           | ✅            | `hooks/customers.ts`                    |
| Customer detail                                                                                                                | via `crm`       | ✅           | ✅            | `customer.schema.ts`                    |
| Products                                                                                                                       | `warehouse`     | `inventory`  | `inventory`   | `hooks/products.ts`                     |
| Product detail                                                                                                                 | ✅              | ❌           | ✅            | `product.schema.ts`                     |
| Barcode                                                                                                                        | ❌              | hook only    | ✅ screen     | —                                       |
| Accounting                                                                                                                     | ✅              | ✅           | ✅            | `hooks/accounting.ts`                   |
| Sync                                                                                                                           | ✅              | ✅           | ✅            | `packages/offline`                      |
| Settings                                                                                                                       | ✅              | ✅           | ✅ (`more`)   | `preferences.slice`                     |
| Login                                                                                                                          | ✅              | ✅           | ✅            | `auth-core`                             |
| Signup / reset                                                                                                                 | ✅              | ❌           | ❌            | `auth.schema.ts`                        |
| CRM / HR / Projects / Purchasing / Manufacturing / Billing / Approvals / Permissions / Workflows / Activities / Sales-followup | ✅              | ❌           | ❌            | hooks + schemas **already exist**       |

The right-hand column is the important one: for every unbuilt module the data, hook and
validation layers already exist. Phase 2 is a UI problem, not an architecture problem.

---

## 14. MOBILE INTERACTION RULES

Touch targets ≥44pt. Primary action bottom-right or full-width sticky. Back = OS back,
always. Sheets for selection, full-screen for creation, modal only for destructive
confirm. Numeric keypad for money/quantity; `keyboardType` must match the field. Sticky
submit above the keyboard. Pull-to-refresh only on server-backed lists. Gestures only
where they replace a real tap-path (`swipe-row`), never decorative. Offline banner is
persistent, not a toast.

## 15. DESKTOP INTERACTION RULES

Density over decoration. Persistent sidebar, never a hamburger. Master/detail wherever a
list feeds a detail. Multi-select + bulk actions on every table. Right-click context
menus on rows. Command palette as the universal accelerator. Resizable split panes with
remembered sizes. Avoid: giant cards, excessive whitespace, decorative dashboards,
mobile-sized touch targets.

## 16. KEYBOARD UX

Existing: `use-shortcuts.ts`, `use-search-focus.ts`, Ctrl+F → `searchRequestId`.
Web already ships `command-palette.tsx`.

Target set (all three where applicable):

| Key               | Action                       |
| ----------------- | ---------------------------- |
| `Ctrl/⌘ K`        | command palette              |
| `Ctrl/⌘ F` or `/` | focus page search            |
| `Ctrl/⌘ N`        | new record in current module |
| `Ctrl/⌘ S`        | save current form            |
| `Esc`             | close sheet/dialog/panel     |
| `↑ ↓`             | move row selection           |
| `Enter`           | open selected row            |
| `Ctrl/⌘ P`        | print/PDF current invoice    |

RTL note: `↑/↓` are safe; any `←/→` binding must be mirrored per §17.

## 17. RTL REQUIREMENTS

RTL-first, locales `fa` (default, unprefixed) / `af` / `en`. `direction: rtl` alone is
not sufficient. Audit checklist:

- **Navigation** — sidebar on the right in RTL; active indicator mirrored.
- **Tables** — column order mirrored; numeric columns stay LTR internally.
- **Numbers/currency** — money is `numeric(12,2)`, `AFN` default. Digit shaping
  (Persian vs Latin digits) must be one shared formatter, not per-platform.
- **Dates** — `jalali-datepicker.tsx` exists on web only. Desktop and mobile have no
  Jalali picker. **Gap.**
- **Icons/arrows** — directional icons (back, next, chevron) must mirror; non-directional
  must not.
- **Breadcrumbs** — separator direction mirrored.
- **Sheets/drawers** — enter from the correct edge.
- **Gestures** — mobile swipe direction must mirror in RTL.
- **Keyboard** — `←/→` semantics inverted.

## 18. OFFLINE / SYNC UX

Architecture verified: `packages/offline` (`database.native.ts` / `database.web.ts`,
WatermelonDB models, `sync-queue.ts` singleton) + desktop's own SQLite-over-IPC path
(`localTableSchema`, `dbQuery`/`dbUpsertMany`/`dbEnqueue`/`dbResolveQueue`) +
`sync.slice.ts`.

Required presentation, per platform:

| Signal          | Web                  | Desktop                           | Mobile           |
| --------------- | -------------------- | --------------------------------- | ---------------- |
| Offline         | `offline-banner`     | **add banner**                    | `offline-banner` |
| Pending count   | `offline-queue`      | sync page only → **add to shell** | sync screen      |
| Syncing         | `realtime-indicator` | **add**                           | inline           |
| Success         | toast                | **add**                           | inline           |
| Failure + retry | `sync-status`        | sync page                         | sync screen      |
| Last synced     | `sync-center`        | `sync-page`                       | `sync`           |

Business behaviour must stay identical; only presentation differs.

## 19. PERFORMANCE RISKS

Measured from the real `electron-vite` production build:

| Chunk                    | Size         | Risk                      |
| ------------------------ | ------------ | ------------------------- |
| `index-CbKwum-G.js`      | **1,638 kB** | main bundle far too large |
| `spreadsheet`            | **858 kB**   | loaded for one feature    |
| `dashboard-page`         | **830 kB**   | first screen after login  |
| `realtime`               | **718 kB**   | Supabase realtime client  |
| `data-table`             | 54 kB        | acceptable                |
| Vazirmatn Regular + Bold | 246 kB       | subset not applied        |

Desktop ships ~4 MB of JS to render a dashboard. `realtime` (718 kB) is already
dynamically imported (`import('../supabase/realtime')`) — good. `dashboard-page` at
830 kB means chart/vendor code is bundled into the first authenticated screen, which
directly hurts perceived startup.

Other risks: web LCP on the landing route (`living-background.tsx`, `marquee.tsx`,
`framer-motion`); mobile list virtualization on low-end devices; large-workspace table
scans if client queries don't match the `(userId, status)` / `(userId, createdAt)`
composite indexes; desktop `dbQuery` `limit` caps at 1000 rows per call.

## 20. ACCESSIBILITY RISKS

- Web has a `legal/accessibility` page but no verified a11y test layer.
- Dialog focus trapping — verify `Modal.tsx` and `dialog.tsx` both trap and restore.
- Desktop has no focus-visible system (no shared primitives to carry one).
- Touch targets: mobile primitives look adequate; web at mobile widths is unverified.
- Screen-reader labels on the inline-SVG sidebar icons — `ICON_PATHS` renders raw
  `<path>` with no `<title>`/`aria-label` visible in the head of the file.
- Error announcements: no `aria-live` region identified on any platform.
- Contrast: dark-first Emerald/Teal ramp needs verification at the `Soft` variants.

## 21. SHARED VS PLATFORM-SPECIFIC ARCHITECTURE

**Already shared and healthy** — `validation` (25 schemas), `api` (33 hooks),
`auth-core`, `db-schema`, `offline`, `store` (11 slices), `i18n` (fa/af/en), `config`.

**The one structural problem** — `packages/ui` is named as shared but is web-only, so
desktop has nothing to consume and reimplements everything, while mobile maintains a
parallel port (`mobile-ui`).

**Target**

```
packages/design-tokens     ← single source (extract from ui/styles/globals.css)
                             consumed by ui, mobile-ui, and desktop
packages/ui-primitives     ← headless/DOM primitives: web + desktop
packages/mobile-ui         ← RN primitives (already correct)
packages/ui-web-features   ← the 60-odd feature folders currently in packages/ui
apps/desktop/src/shared/components  ← desktop compositions (currently EMPTY)
```

Business logic (`invoice-draft.ts`) currently lives in `apps/desktop` and should move to
a shared package so web and mobile compute totals identically.

## 22. IMPLEMENTATION ORDER

1. **Extract `packages/design-tokens`** from `globals.css`; repoint `mobile-ui` at it.
   Nothing visual changes. Unblocks everything else.
2. **Split `packages/ui`** into primitives vs web-features.
3. **Build desktop's `shared/components`** on the extracted primitives: Button, Input,
   Table, Dialog, Sheet, Money, StatusChip, Empty, Error, Skeleton, OfflineBanner.
4. **Move invoice math** out of `apps/desktop` into a shared package; adopt on web+mobile.
5. **Desktop parity gaps**: `/inventory/:id`, master/detail on `/sales`, bulk actions,
   command palette, offline banner, window state.
6. **Mobile polish**: pull-to-refresh, keyboard avoidance, sync queue depth.
7. **Performance**: split desktop's 1.6 MB entry and 830 kB dashboard; subset Vazirmatn.
8. **RTL + a11y sweep** against §17/§20.
9. **Then, and only then**, decide which of the 18 web-only modules earn a desktop
   presence. Their hooks and schemas already exist.

Steps 1–4 are refactors with no user-visible change and no new features. Step 5 onward
is product work.

## 23. RISKS / AMBIGUITIES

**[MISSING] — files/tables that do not exist but are implied by routes**

1. No Postgres tables for suppliers, employees/HR, projects, purchasing, manufacturing,
   billing — despite routes, hooks, schemas and backend modules for all of them. Either
   they live in Supabase outside Drizzle, or those modules are incomplete. **I could not
   determine which; this needs your answer before Phase 2.**
2. `apps/desktop/src/shared/components/` is empty.
3. No Jalali date picker outside web.
4. No signup / password-reset on desktop or mobile.
5. No `/inventory/:id` on desktop.

**Ambiguities**

6. `apps/web/app/[lang]/(dashboard)/team&page/` — `&` in a route segment. Typo?
7. Module naming: web `warehouse` vs desktop/mobile `inventory` vs DB `products`.
   Which is canonical?
8. `invoice_items` has no declared FK to `invoices`/`products` (indexes only).
9. Three separate auth stores; session shape shared, store not.
10. `packages/offline` has exactly one model (`Activity.model.ts`) but the desktop IPC
    contract syncs seven tables. The two offline layers appear unrelated.
11. `packages/ui/src/components/ui/` mixes 80 primitives and feature folders flat.
12. `backend/src/routes/debug.routes.ts` — is it registered in production?

**Not verified (would need deeper reads than this phase allowed)**

- Per-screen state handling inside each of the 46 web pages.
- Actual capability strings behind `sessionCan` and the `permissions` module.
- Whether `packages/analytics` and `packages/db` are wired into any app.

---

**END OF PHASE 1.** No code written. No source files modified. Awaiting instruction
before Phase 2.
