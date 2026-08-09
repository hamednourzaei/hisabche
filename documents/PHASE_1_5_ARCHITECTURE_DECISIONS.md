# HISABCHE — PHASE 1.5

**Ambiguity resolution + cross-platform UI architecture decisions.**
No visual implementation. No renames performed. No pages redesigned.

## Corrections to Phase 1

Two Phase 1 claims were wrong and are corrected here, because the rest of this document
depends on them.

1. **"Desktop has zero shared primitives / `shared/components` is empty."**
   Wrong conclusion from looking in the wrong directory. Desktop primitives exist at
   `apps/desktop/src/components/ui/` — `primitives.tsx` (Button, Input, Card, Badge,
   Skeleton, `cn`), `data-table.tsx` (156 lines), `context-menu.tsx`, `filter-tabs.tsx`.
   398 lines total. `src/shared/components/` is empty because primitives live elsewhere.
   Desktop is under-provisioned, not empty.

2. **`packages/ui/src/components/ui/dashboard-sidebar.tsx` is not the live web navigation.**
   The real nav source is `apps/web/app/[lang]/(dashboard)/constants/nav-items.ts` —
   16 items in 4 groups, task-oriented labels, `lucide-react` icons. The
   `ICON_PATHS`-with-5-icons observation was about a component that the dashboard does
   not drive its nav from.

---

# 1. ANSWER — SUPPLIERS / HR / PROJECTS / PURCHASING / MANUFACTURING / BILLING

**Verdict: A — fully implemented in Supabase, deliberately absent from Drizzle.**

This is not scaffolding and not incomplete. The backend uses **two persistence paths on
purpose**, and the split is coherent.

**Evidence.** Every service under `backend/src/services/` imports `supabase` from
`../db` and queries with `supabase.from('<table>')`. Extracted table references per
service (verified by grep across all 27 service files):

| Service                            | Supabase tables                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| human-resources                    | `departments`, `employees`, `attendance`, `leaves`, `payrolls`                          |
| project                            | `projects`, `project_members`, `project_tasks`, `project_time_entries`                  |
| purchasing                         | `purchase_orders`, `purchase_order_items`, `products`                                   |
| manufacturing                      | `boms`, `bom_items`, `work_orders`, `products`                                          |
| billing                            | `subscriptions`, `workspaces`, `workspace_members`, `invoices`, `transactions`          |
| warehouse                          | `warehouses`, `warehouse_stock`, `stock_movements`                                      |
| crm                                | `customers`, `interactions`, `opportunities`                                            |
| permission                         | `permissions`, `roles`, `role_permissions`, `user_roles`                                |
| accounting                         | `accounts`, `journal_entries`, `journal_lines`, `transactions`, `invoices`, `customers` |
| workspace                          | `workspaces`, `workspace_members`, `workspace_invites`, `profiles`, `users`             |
| audit / event / webhook / checkout | `audit_logs`, `event_log`, `event_types`, `webhook_events`, `checkout_sessions`         |
| analytics                          | + `ledger_entries_view`, `invoice_items`                                                |

Drizzle covers exactly **11 tables** and `backend/drizzle/migrations/` contains exactly
**two** migrations (`0000_loose_bishop.sql`, `0001_dry_avengers.sql`).

**Why the split is coherent.** The 11 Drizzle tables are precisely the tables that also
appear in the desktop offline contract (`localTableSchema`): `product, customer, invoice,
invoice_item, transaction, inventory_movement, employee`. Drizzle exists to give the
**offline-syncable core** a migration-controlled, locally-mirrorable SQL schema.
Everything else is server-only and managed in Supabase.

There is one inconsistency: `employee` is in the offline contract but HR lives entirely
in Supabase. Either `employee` should leave `localTableSchema`, or HR's employee table
should join Drizzle.

**Module status table**

| Module        | Route                       | Hook                            | Schema                      | Backend                      | DB table                                                               | Storage  | Status                                                    |
| ------------- | --------------------------- | ------------------------------- | --------------------------- | ---------------------------- | ---------------------------------------------------------------------- | -------- | --------------------------------------------------------- |
| Suppliers     | ⚠️ via purchasing           | ⚠️ purchasing.ts                | ⚠️ purchasing.schema        | ⚠️ purchasing.routes         | ❌ none (`invoices.supplierId` unconstrained uuid)                     | —        | **D — scaffolded**, no supplier entity anywhere           |
| HR            | ✅ `human-resources(+[id])` | ✅ `employees.ts`, `payroll.ts` | ✅ `human-resources.schema` | ✅ 407 lines, service-backed | `departments`, `employees`, `attendance`, `leaves`, `payrolls`         | Supabase | **A — complete**                                          |
| Projects      | ✅ `projects(+[id])`        | ✅ `projects.ts`                | ✅ `project.schema`         | ✅ 389 lines                 | `projects`, `project_members`, `project_tasks`, `project_time_entries` | Supabase | **A — complete**                                          |
| Purchasing    | ✅ `purchasing`             | ✅ `purchasing.ts`              | ✅ `purchasing.schema`      | ⚠️ 114 lines                 | `purchase_orders`, `purchase_order_items`                              | Supabase | **B — partial** (thin route layer)                        |
| Manufacturing | ✅ `manufacturing`          | ✅ `manufacturing.ts`           | ✅ `manufacturing.schema`   | ⚠️ 189 lines                 | `boms`, `bom_items`, `work_orders`                                     | Supabase | **A/B — complete-ish**                                    |
| Billing       | ✅ `billing`                | ✅ `billing.ts`                 | ✅ `billing.schema`         | ⚠️ 105 lines                 | `subscriptions`, `checkout_sessions`, `webhook_events`                 | Supabase | **B — partial** (payment provider integration unverified) |

**Consequence for Phase 2.** Only **suppliers** is genuinely missing. The other five are
real, working modules whose absence on desktop/mobile is a UI gap, not a data gap.

---

# 2. WAREHOUSE VS INVENTORY — DECISION

**They are two different business concepts. The Phase 1 "naming inconsistency" framing
was wrong.**

**Evidence — separate backends:**

| Concept             | Backend route                             | Service                | Tables                                             |
| ------------------- | ----------------------------------------- | ---------------------- | -------------------------------------------------- |
| **Product catalog** | `/api/products`                           | `product.service.ts`   | `products`, `invoice_items`, `stock_movements`     |
| **Warehouse**       | `/api/warehouses`, `/api/stock-transfers` | `warehouse.service.ts` | `warehouses`, `warehouse_stock`, `stock_movements` |

Two distinct route namespaces, two services, two table sets. `stock_movements` is the
join between them.

**Evidence — the i18n file distinguishes them** (`apps/web/messages/fa/common.json`):

- `"warehouse": "انبار"` / `"warehouse_description": "مدیریت انبار و کالاها"`
- `"inventory": "مدیریت انبار"`, `"inventoryDesc": "موجودی، هشدار کمبود، انتقال کالا"`
- `nav`: `"inventory": "انبارداری"` (the practice), `"warehouse": "انبارداری"`

Persian collapses both onto انبار/انبارداری, which is exactly why the code drifted.

**Evidence — the live web nav** (`nav-items.ts`) uses neither word:
`{ id: 'stock', labelKey: 'nav.stock', path: '/warehouse', group: 'primary' }`.
The user-facing concept is **"stock" (موجودی/انبار)**.

**Answers to the six questions**

1. _Actual business concept_ — two: **Product** (catalog: sku, price, cost) and
   **Warehouse/Stock** (physical location + quantity + movements).
2. _User-facing terminology_ — Persian **انبار / انبارداری**, nav id `stock`.
3. _Internal terminology_ — `products` and `warehouses`/`warehouse_stock` in the DB;
   `Product` in validation schemas.
4. _Dominant name_ — `product` is dominant in data (`products` table, `/api/products`,
   `product.schema.ts`, `localTableSchema: 'product'`). `warehouse` is dominant in the
   web route layer only.
5. _Canonical_ —
   - **Domain/data layer: `product` and `warehouse` stay separate. Do not merge.**
   - **Route layer: `inventory` is the correct umbrella noun for the user-facing module**
     that shows stock levels, because that is what desktop and mobile already call it and
     it is the word the i18n file uses for "موجودی، هشدار کمبود، انتقال کالا".
6. _Can routes stay platform-specific?_ — **Yes, and they should.** Web's `/warehouse`
   is a warehouse-management screen (multi-warehouse, transfers). Desktop/mobile
   `inventory` is a product-stock list. They are different screens serving different
   depths of the same domain. Forcing one route name would misrepresent both.

**Decision (no rename executed):**

- Keep `products` / `warehouses` separate in domain, API and DB. **No change.**
- Keep web `/warehouse` for warehouse management. **No change.**
- Keep desktop/mobile `inventory` for the product-stock list. **No change.**
- **Add a shared glossary** so the terms stop drifting: `Product` (catalog item),
  `Stock` (quantity of a Product at a Warehouse), `Warehouse` (location),
  `StockMovement` (transfer/adjustment). Phase 2 UI copy derives from this glossary.
- Desktop's missing `/inventory/:id` is still a real gap (mobile has it).

---

# 3. `team&page` ROUTE — DECISION

**It is a typo, and it is dead. Renaming is zero-risk.**

**Evidence**

- Directory: `apps/web/app/[lang]/(dashboard)/team&page/` containing only `page.tsx`.
- `page.tsx` imports `TeamAndPayrollContainer` from `@hisabche/ui` and its metadata reads
  `"Team & Payroll"` / `"تیم و حقوق"`. The intended segment is **`team-and-payroll`**;
  `&payroll` was truncated to `&page`.
- **Zero inbound references in source.** A repo-wide grep for `team&` outside
  `node_modules` returns hits only inside `apps/web/.next/**` build artifacts
  (`routes-manifest.json`, `app-paths-manifest.json`, generated `routes.d.ts`).
  No `<Link>`, no `router.push`, no nav item, no sitemap entry, no test, no redirect.
- The live nav's `team` item points to `/human-resources`, **not** here:
  `{ id: 'team', labelKey: 'nav.team', path: '/human-resources', group: 'people' }`.
- The rendered container navigates to `/team-and-payroll/employee/${id}` and
  `/team-and-payroll/payroll/${id}` — **routes that do not exist**. Every link inside
  this page is already broken.

**Classification: 2 — a typo, currently a 4 — works but must be renamed.**

**Impact of renaming to `team-and-payroll`**

- Inbound source references to update: **0**.
- External links: the URL is unreachable from the UI, so real-world traffic is
  essentially zero. A 301 from `/team&page` is cheap insurance, not a necessity.
- `&` in a path segment is a genuine hazard: it terminates a path in some parsers and
  must be percent-encoded in query contexts. Keeping it is a latent bug.
- **Separate follow-up:** the two `/team-and-payroll/*` child routes the container links
  to still would not exist. Renaming fixes the segment; it does not fix the dead links.

**Recommendation** — rename to `team-and-payroll`, add the two missing child routes or
remove the links, and point the nav's `team` item at it if HR and Team&Payroll are meant
to be distinct destinations. **Not executed in this phase.**

---

# 4. UI PRIMITIVE DUPLICATION AUDIT

| Primitive         | Web (`packages/ui/.../ui`)                                            | Desktop (`src/components/ui`) | Mobile (`packages/mobile-ui`)                                | Verdict                          |
| ----------------- | --------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------ | -------------------------------- |
| Button            | `button.tsx`                                                          | `primitives.tsx` → `Button`   | `button.tsx`                                                 | **3 impls**                      |
| Input             | `input.tsx`, `money-input.tsx`, `phone-input.tsx`, `search-input.tsx` | `primitives.tsx` → `Input`    | `input.tsx`, `search-bar.tsx`                                | **3 impls, web richest**         |
| Textarea          | ❌                                                                    | ❌                            | ❌                                                           | missing everywhere               |
| Select            | `select.tsx`                                                          | ❌                            | ❌                                                           | web only                         |
| Checkbox / Radio  | ❌                                                                    | ❌                            | ❌                                                           | missing                          |
| Switch            | `switch.tsx`                                                          | ❌                            | ❌                                                           | web only                         |
| Dialog            | `dialog.tsx`, `Modal.tsx`                                             | ❌                            | ❌                                                           | **web only — 2 competing impls** |
| Drawer / Sheet    | `sheet.tsx`                                                           | ❌                            | `bottom-sheet.tsx`, `action-sheet.tsx`                       | web + mobile, no desktop         |
| Popover / Tooltip | ❌                                                                    | `context-menu.tsx`            | ❌                                                           | fragmented                       |
| Tabs              | `tabs.tsx`                                                            | `filter-tabs.tsx`             | ❌                                                           | 2 impls, different semantics     |
| Badge             | `badge.tsx`                                                           | `primitives.tsx` → `Badge`    | `badge.tsx`, `status-chip.tsx`, `trend-pill.tsx`             | **3 impls, mobile richest**      |
| Card              | `card.tsx`                                                            | `primitives.tsx` → `Card`     | `mobile-card.tsx`, `metric-card.tsx`, `hero-metric-card.tsx` | **3 impls**                      |
| Table             | `table.tsx`, `data-table/`                                            | `data-table.tsx` (156 ln)     | n/a (lists)                                                  | 2 impls                          |
| List              | n/a                                                                   | n/a                           | `query-list.tsx`                                             | mobile only                      |
| Avatar            | ❌                                                                    | ❌                            | `avatar.tsx`                                                 | mobile only                      |
| Dropdown          | `dropdown-menu.tsx`                                                   | `context-menu.tsx`            | `action-sheet.tsx`                                           | 3 different answers              |
| Toast             | `toast.tsx`, `toast-provider.tsx`, `sonner.tsx`                       | ❌                            | ❌                                                           | **web only — 2 competing impls** |
| Alert             | ❌                                                                    | ❌                            | `error-state.tsx`                                            | fragmented                       |
| EmptyState        | `empty-state.tsx`                                                     | ❌                            | `empty-state.tsx`                                            | **duplicated, desktop missing**  |
| ErrorState        | `error-boundary.tsx`                                                  | ❌                            | `error-state.tsx`                                            | desktop missing                  |
| Skeleton          | `skeleton.tsx`                                                        | `primitives.tsx` → `Skeleton` | `skeleton.tsx`                                               | **3 impls**                      |
| Money             | `money-input.tsx`                                                     | `shared/lib/currency.ts` (fn) | `money.tsx`                                                  | **3 impls, no shared formatter** |
| Date              | `jalali-datepicker.tsx`                                               | ❌                            | ❌                                                           | **web only — RTL-critical gap**  |
| Pagination        | in `data-table/`                                                      | in `data-table.tsx`           | infinite list                                                | 3 answers                        |
| Search            | `global-search.tsx`, `search-input.tsx`                               | `use-search-focus.ts`         | `search-bar.tsx`                                             | 3 impls                          |
| Filter            | in feature folders                                                    | `filter-tabs.tsx`             | `filter-bar.tsx`                                             | 3 impls                          |
| Form              | react-hook-form + zod                                                 | manual                        | manual                                                       | **inconsistent**                 |
| Navigation        | `dashboard-sidebar.tsx` + `nav-items.ts`                              | inline in app shell           | `animated-tab-bar.tsx`                                       | platform-correct                 |
| Offline banner    | `offline-banner.tsx`                                                  | ❌                            | `offline-banner.tsx`                                         | **duplicated, desktop missing**  |
| Chart             | `chart.tsx` (recharts)                                                | recharts direct               | `sparkline.tsx`                                              | 3 impls                          |
| FAB               | `fab.tsx`                                                             | ❌                            | `floating-button.tsx`                                        | duplicated                       |

**Counts:** web ≈ 30 primitives + ~50 feature folders (80 entries flat); desktop 9;
mobile 25.

**Worst duplications, ranked**

1. **Money formatting in three places with no shared source** — the highest-risk
   duplication in the product. Money is `numeric(12,2)`, `AFN` default, RTL digit
   shaping. Three formatters means three rounding/shaping behaviours.
2. **Two dialog systems and two toast systems inside `packages/ui` alone**
   (`dialog.tsx` + `Modal.tsx`; `toast.tsx` + `sonner.tsx`).
3. **Skeleton/Badge/Card/Button ×3** with no shared variant contract.
4. **No Jalali date component outside web** — blocks any date entry on desktop/mobile.
5. **Desktop missing EmptyState / ErrorState / Toast / OfflineBanner** — the four states
   every list screen needs.

---

# 5. DESIGN TOKEN AUDIT

**Canonical source: `packages/ui/src/styles/globals.css` — 114 CSS custom properties.**
Verified prefix families:

| Family            | Tokens                                                                                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand colour      | `--color-primary`, `-primary-fg`, `-primary-hover`, `-primary-light`, `--color-secondary`, `--color-accent`, `--color-emerald`, `--color-cyan`, `--color-purple` |
| Semantic          | `--color-success(-fg)`, `--color-warning(-fg)`, `--color-destructive(-fg)`, `--color-info(-fg)`                                                                  |
| Surfaces          | `--surface-base`, `-muted`, `-elevated`, `-overlay` (4-level ladder)                                                                                             |
| Foreground        | `--fg-primary`, `-secondary`, `-tertiary` (3-tier ramp)                                                                                                          |
| Legacy alias set  | `--hisab-*` (14 tokens: background, foreground, card, border, muted, primary, success, warning, destructive, ring…)                                              |
| Border            | `--border-default`, `--border-strong`, `--focus-ring`                                                                                                            |
| Radius            | `--radius-xs`, `--radius-lg`, `--radius-full`                                                                                                                    |
| Typography        | `--text-body`, `--leading-tight`, `-normal`, `-relaxed`                                                                                                          |
| Spacing           | `--space`                                                                                                                                                        |
| Elevation / glass | `--shadow-premium`, `--glass-bg`, `--glass-blur`, `--glass-border`                                                                                               |
| Gradient          | `--gradient-brand`, `-brand-hover`, `--gradient-success`                                                                                                         |
| Motion            | `--ease-out`, `--ease-soft`, `--easing-cinema-{in,out,inout,snap}`, `--motion-scale`, `--stagger-base`, `--flip-duration`, `--flip-easing`, `--cinematic`        |

**Mobile port is faithful.** `packages/mobile-ui/src/tokens/colors.ts` declares a typed
`ColorScheme` mirroring the brand/semantic/surface/text families with
character-identical `hsl()` strings, because React Native parses `hsl()` natively.
Companions: `typography.ts`, `layout.ts`, `theme-provider.tsx`.

**Desktop has no tokens.** `apps/desktop/src/styles.css` contains exactly **4** custom
properties, all layout: `--sidebar-width`, `--sidebar-width-collapsed`,
`--toolbar-height`, `--row-height`. Colour and typography come from Tailwind defaults,
which is why desktop drifts.

**Gaps against the target token tree**

| Target          | Status                                                                 |
| --------------- | ---------------------------------------------------------------------- |
| Color           | ✅ complete                                                            |
| Typography      | ⚠️ partial (`--text-body` + 3 leadings only; no scale)                 |
| Spacing         | ⚠️ single `--space`, no scale                                          |
| Radius          | ⚠️ 3 of an expected ~5                                                 |
| Border          | ✅                                                                     |
| Elevation       | ⚠️ one `--shadow-premium` + glass set                                  |
| Motion          | ✅ rich                                                                |
| Z-index         | ❌ **absent**                                                          |
| Density         | ❌ **absent** (desktop's 4 layout vars are the de-facto density layer) |
| Semantic states | ✅                                                                     |

**Two problems to resolve before extraction:** the `--color-*` and `--hisab-*` families
overlap (two names for the same colour), and there is no `--z-*` or density scale.
**No new visual tokens are being created and no colour is being changed** — the work is
naming/consolidation plus filling z-index and density.

---

# 6. SHARED VS PLATFORM-SPECIFIC ARCHITECTURE

| Layer               | Web                    | Desktop                      | Mobile          | Shared                                                     |
| ------------------- | ---------------------- | ---------------------------- | --------------- | ---------------------------------------------------------- |
| Business logic      | consume                | consume + `invoice-draft.ts` | consume         | ✅ **should be 100%** (today invoice math is desktop-only) |
| API                 | `@hisabche/api`        | `@hisabche/api`              | `@hisabche/api` | ✅ already shared (33 hooks)                               |
| Validation          | `@hisabche/validation` | same                         | same            | ✅ already shared (25 schemas)                             |
| Entities            | `@hisabche/db-schema`  | same                         | same            | ✅ already shared                                          |
| State               | `@hisabche/store`      | + `ui.store`                 | + `auth.store`  | ⚠️ mostly shared; 3 auth stores                            |
| Design tokens       | `globals.css`          | **none**                     | ported copy     | ❌ **must become shared**                                  |
| Primitive semantics | implicit               | implicit                     | implicit        | ❌ **must become shared contract**                         |
| Rendering           | DOM/Next               | DOM/Electron                 | RN              | 🚫 **never shared**                                        |
| Navigation          | App Router             | React Router hash            | Expo Router     | 🚫 platform                                                |
| Layout              | responsive             | dense/split                  | stack+tabs      | 🚫 platform                                                |
| Tables              | DataTable              | DataTable                    | list/cards      | ⚠️ shared _column model_, platform rendering               |
| Forms               | RHF+zod                | manual                       | manual          | ⚠️ shared _schema_, platform rendering                     |
| Dialogs             | Dialog                 | Dialog                       | Modal           | ⚠️ shared _semantics_                                      |
| Sheets              | Sheet                  | side panel                   | BottomSheet     | ⚠️ shared _semantics_                                      |
| Keyboard            | partial                | primary                      | n/a             | 🚫 platform                                                |
| Touch               | partial                | n/a                          | primary         | 🚫 platform                                                |

Legend — ✅ shared today · ❌ must become shared · ⚠️ partially · 🚫 must stay platform.

---

# 7. PROPOSED CROSS-PLATFORM UI ARCHITECTURE

Per Part 4 and Part 9: one **design contract**, three renderers. No `DesktopButton` /
`MobileButton` as unrelated systems, and no attempt to run one DOM component in RN.

```
packages/design-tokens          ← NEW. Framework-free TS. Single source of truth.
  ├── color.ts                    exported as raw values + a CSS-var emitter
  ├── typography.ts
  ├── space.ts · radius.ts · elevation.ts · motion.ts · zIndex.ts · density.ts
  └── semantic.ts                 (states: success/warning/destructive/info)
        │
        ├──► packages/ui            (web/DOM)      — emits CSS vars into globals.css
        ├──► apps/desktop           (Electron/DOM) — imports the same CSS vars
        └──► packages/mobile-ui     (RN)           — imports the raw values

packages/ui-contract            ← NEW. Types only, zero runtime.
  ButtonVariant · ButtonSize · BadgeTone · InputState · DialogRole
  EmptyStateProps · MoneyProps · ColumnDef<T> · FilterSpec
        │
        └──► every platform implements this contract natively

packages/formatting             ← NEW. Money, dates, digit shaping. Pure functions.
  formatMoney · formatAmount · toJalali · shapeDigits
```

**Rules**

- `design-tokens` has zero dependencies and no JSX. It is the only place a colour exists.
- `ui-contract` is types only. It defines _what a Button means_, never how it renders.
- Rendering is never shared across DOM↔RN. Web and desktop **may** share DOM primitives
  where the density contract allows; that is an optimisation, not a requirement.
- Business components (invoice totals, stock math) live in a shared package and are
  consumed by all three.

**Applied to the examples in Part 4**

| Semantic                 | Web                   | Desktop                  | Mobile                   |
| ------------------------ | --------------------- | ------------------------ | ------------------------ |
| `Button` variant=primary | `<button>` + CSS vars | same DOM, denser padding | `Pressable` + raw tokens |
| `Dialog` role=confirm    | `dialog.tsx`          | centred modal            | `Modal`                  |
| `Dialog` role=pick       | `sheet.tsx`           | side panel               | `bottom-sheet.tsx`       |
| `Money`                  | `money-input`         | `<Money>` (to build)     | `money.tsx`              |

All four rows derive from the same tokens, variants, states and a11y rules.

---

# 8. DESKTOP BUNDLE / PERFORMANCE PLAN

**Root causes identified (evidence, not guesses).**

| Chunk                    | Size     | Cause (verified)                                                                                                                                                                                                                                                              |
| ------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index-CbKwum-G.js`      | 1,638 kB | Renderer entry. `main.tsx` synchronously pulls `styles.css`, `App`, bridge, i18n (`i18next` + `react-i18next`), storage, auth store. `App` statically imports `LoginPage`; `@hisabche/api` brings axios + 33 hooks; `@hisabche/store` brings 11 slices; `lucide-react` icons. |
| `spreadsheet`            | 858 kB   | **SheetJS (`import * as XLSX from 'xlsx'`)** in `shared/lib/spreadsheet.ts`, imported **statically** by `accounting-page`, `customers-page`, `products-page`.                                                                                                                 |
| `dashboard-page`         | 830 kB   | **recharts** — `Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis` imported **statically** at the top of `dashboard-page.tsx`, the first screen after login.                                                                                                        |
| `realtime`               | 718 kB   | Supabase realtime — **already dynamically imported** (`import('../supabase/realtime')`). Correct; leave alone.                                                                                                                                                                |
| Vazirmatn Regular + Bold | 246 kB   | Full TTFs, no subsetting.                                                                                                                                                                                                                                                     |

**Plan, ordered by benefit ÷ risk**

1. **Lazy-load SheetJS** — change `import * as XLSX` to `await import('xlsx')` inside
   `exportRows`/`importRows`. Import/export is user-initiated; nobody needs 858 kB until
   they click Export. _Removes 858 kB from three pages' critical path. Near-zero risk._
2. **Lazy-load recharts on the dashboard** — keep KPI tiles synchronous (they are the
   above-the-fold value), `React.lazy` the chart with a `Skeleton` fallback. _Cuts the
   first authenticated screen by up to ~800 kB._
3. **Subset Vazirmatn to Arabic+Latin+digits and ship woff2** — TTF→woff2 alone is
   typically a large reduction. _~246 kB → well under 100 kB._
4. **Split `@hisabche/api`** — 33 hooks in one barrel means importing one hook pulls all
   of them. Move to per-module entry points so `useDashboardKPIs` does not drag
   manufacturing and payroll into the entry chunk.
5. **Audit `lucide-react` imports** — confirm tree-shaking is effective; if not, switch
   to per-icon paths.
6. **Electron startup** — `main.tsx` awaits `initStorage()` → `bridge().app.info()` →
   `initDesktopI18n(locale)` **serially** before first paint. `initStorage` and the
   window can start in parallel; only i18n truly gates render.

**Explicitly not doing:** chasing bundle numbers for their own sake. Items 1 and 2 are
the only ones that change perceived startup materially; 3–6 are follow-ups.

**Success criteria** — time-to-interactive on the dashboard after login, and time to
first paint after `app.whenReady()`. Both must be measured before and after.

---

# 9. MIGRATION ORDER

Each step is independently shippable and visually neutral until step 6.

| #   | Step                                                                                                                       | Visual change                                 | Risk   |
| --- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------ |
| 1   | Create `packages/design-tokens` from `globals.css`; add z-index + density; reconcile `--color-*` vs `--hisab-*` as aliases | none                                          | low    |
| 2   | Repoint `packages/mobile-ui/tokens` at `design-tokens` (values identical)                                                  | none                                          | low    |
| 3   | Emit the same CSS vars into `apps/desktop/src/styles.css`; keep desktop's 4 layout vars as the density layer               | none                                          | low    |
| 4   | Create `packages/formatting`; migrate money/date/digit formatting off the three copies                                     | none if outputs match — **needs tests first** | medium |
| 5   | Create `packages/ui-contract` (types only)                                                                                 | none                                          | none   |
| 6   | Desktop: add EmptyState, ErrorState, Toast, OfflineBanner, Money on the contract                                           | **yes — desktop gains missing states**        | low    |
| 7   | Lazy-load SheetJS + recharts (§8 items 1–2)                                                                                | none                                          | low    |
| 8   | Desktop `/inventory/:id`; master/detail on `/sales`                                                                        | yes                                           | medium |
| 9   | Consolidate web's duplicate Dialog/Modal and Toast/sonner                                                                  | yes                                           | medium |
| 10  | Jalali date primitive for desktop + mobile                                                                                 | yes                                           | medium |
| 11  | Rename `team&page` → `team-and-payroll` + fix its dead child links                                                         | URL only                                      | low    |
| 12  | Decide `employee` in `localTableSchema` vs HR-in-Supabase                                                                  | none                                          | low    |

Steps 1–5, 7 and 12 are pure foundation: no screen changes, no route changes.

---

# 10. RISKS

1. **Money formatting consolidation (step 4) is the highest-risk item in the plan.**
   Three implementations may already disagree on rounding or digit shaping. Characterise
   current behaviour with tests _before_ replacing anything, or invoices will change
   values.
2. **`--hisab-*` vs `--color-*` reconciliation** could silently change a colour if the
   two families have drifted. Diff every pair before aliasing.
3. **`packages/ui` split** is the largest mechanical change (80 entries) and touches
   every web page's imports. Defer until after the token work lands.
4. **Desktop density vs shared primitives** — sharing DOM primitives between web and
   desktop risks importing web's roomier spacing. The density token layer must be in
   place first (step 1), or desktop regresses to a stretched web app.
5. **Supabase tables have no migration history.** The 21+ non-Drizzle tables are not
   under `backend/drizzle/migrations/`. Schema drift there is invisible to CI, and this
   contradicts `documents/DATABASE_MIGRATION_POLICY.md`.
6. **`employee` in the offline contract with no Drizzle table** — offline sync of an
   entity the local schema does not define will fail at runtime if exercised.
7. **`invoice_items` has no FK** to `invoices`/`products` (indexes only) — orphaned line
   items are possible.
8. **Three auth stores** may diverge in refresh/expiry handling.
9. **Suppliers is genuinely absent** — `invoices.supplierId` is an unconstrained uuid
   pointing at nothing. Any purchasing UI built on it will need the entity first.
10. **Renaming `team&page` is safe today** but its container links to
    `/team-and-payroll/*`, which does not exist. Renaming without adding those routes
    leaves the page functional but its links broken — same as today.

---

**END OF PHASE 1.5.** No UI implemented, no pages redesigned, no routes renamed,
no migration executed.
