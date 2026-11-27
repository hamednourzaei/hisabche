# Hisabche UX Reconstruction — Route Registry (Verified)

> **Phase 0 Deliverable** | Revised: `2026-11-26` | Source of Truth: Repository Codebase
> Status: `DISCOVERED` (Zero UI modifications performed in Phase 0)

## 1. Reconciled Route Counts Across All Surfaces

| Surface                                  | Total Entries |         Active / Unique |     Redirects / Aliases | Notes & Source                                                                                |
| ---------------------------------------- | ------------: | ----------------------: | ----------------------: | --------------------------------------------------------------------------------------------- |
| **Web Workspace (`(dashboard)`)**        |            30 |                      30 |          0 (`page.tsx`) | `apps/web/app/[lang]/(dashboard)/**/page.tsx`                                                 |
| **Web Public / Auth / Token**            |            37 |                      37 |          0 (`page.tsx`) | `apps/web/app/[lang]/**/page.tsx` (excl. `(dashboard)`)                                       |
| **Web Permanent Redirects (`moved`)**    |            31 |                       0 |              31 (`308`) | `apps/web/next.config.js`                                                                     |
| **App-Shell (`@hisabche/app-shell`)**    |            74 |                      36 | 38 (`<Navigate>` + `*`) | `packages/app-shell/src/app/app.tsx` (31 `moved` + 5 legacy aliases + `dashboard`->`/` + `*`) |
| **Desktop (`apps/desktop`)**             |            74 |                      36 |                      38 | Electron renders `@hisabche/app-shell` via hash router                                        |
| **Mobile (`apps/mobile`)**               | 1 native host |        36 (via WebView) |        38 (via WebView) | `apps/mobile/app/_layout.tsx` -> `ShellWebView` (`assets/shell/index.html`)                   |
| **Platform Admin (`apps/admin`)**        |            27 |                      27 |                       0 | `apps/admin/app/[lang]/**/page.tsx` (25 `(admin)` + `/login` + `/wall`)                       |
| **Navigation Contract (`NAV_CONTRACT`)** |            17 | 15 visible + 2 disabled |                       — | `packages/ui-contract/src/navigation.ts` (`DISABLED_PAGES` hides 2)                           |

---

## 2. Workspace Routes — Platform Coverage Matrix (30 Routes)

> **Mobile Architecture Note:** `apps/mobile` does **not** render separate React Native screens for business routes (`apps/mobile/app/_layout.tsx` mounts `ShellWebView` loading `@hisabche/app-shell`). Therefore **WebView Dependency = Yes** for all 30 workspace routes on Mobile. "Resp" indicates responsive CSS (`sm:/md:/lg:/xl:`) or mobile hooks (`useIsMobile`/`useMediaQuery`) verified in the domain UI folder.

| Route ID                  | Path                     | Web         | Admin | Desktop     | Mobile (WebView) | Resp / Mobile Hook | HubTabs | SegCtrl | Dialog / Drawer | Shared Container (`@hisabche/ui`) |
| ------------------------- | ------------------------ | ----------- | ----- | ----------- | ---------------- | ------------------ | ------- | ------- | --------------- | --------------------------------- |
| `dashboard`               | `/dashboard` (`/` shell) | Yes         | No    | Yes         | Yes (WebView)    | Yes / Yes          | No      | No      | Dialog          | `DashboardContainer`              |
| `invoices`                | `/invoices`              | Yes         | No    | Yes         | Yes (WebView)    | Yes / Yes          | Yes     | Yes     | Dialog          | `SalesHubContainer`               |
| `invoices-new`            | `/invoices/new`          | Yes         | No    | Yes         | Yes (WebView)    | Yes / Yes          | No      | No      | Dialog + Drawer | `InvoiceBuilderContainer`         |
| `invoices-new-preview`    | `/invoices/new/preview`  | Yes         | No    | Yes         | Yes (WebView)    | Yes / Yes          | No      | No      | Dialog + Drawer | `InvoicePreviewContainer`         |
| `invoices-detail`         | `/invoices/:id`          | Yes         | No    | Yes         | Yes (WebView)    | Yes / Yes          | No      | No      | Dialog          | `InvoiceDetailContainer`          |
| `till`                    | `/till`                  | Yes         | No    | Yes         | Yes (WebView)    | Yes / Yes          | Yes     | Yes     | Dialog + Drawer | `TillContainer`                   |
| `warehouse`               | `/warehouse`             | Yes         | No    | Yes         | Yes (WebView)    | Yes / Yes          | Yes     | Yes     | Dialog + Drawer | `WarehouseTabsContainer`          |
| `warehouse-detail`        | `/warehouse/:id`         | Yes         | No    | Yes         | Yes (WebView)    | Yes / Yes          | No      | No      | Dialog + Drawer | `ProductDetailContainer`          |
| `accounting`              | `/accounting`            | Yes         | No    | Yes         | Yes (WebView)    | Yes / No           | Yes     | Yes     | Dialog + Drawer | `AccountingPage`                  |
| `customers`               | `/customers`             | Yes         | No    | Yes         | Yes (WebView)    | Yes / Yes          | Yes     | Yes     | Dialog + Drawer | `CustomersHubContainer`           |
| `customers-detail`        | `/customers/:id`         | Yes         | No    | Yes         | Yes (WebView)    | Yes / Yes          | No      | Yes     | Dialog + Drawer | `CustomerDetailContainer`         |
| `team-and-payroll`        | `/team-and-payroll`      | Yes         | No    | Yes         | Yes (WebView)    | Yes / Yes          | Yes     | Yes     | Dialog + Drawer | `TeamAndPayrollContainer`         |
| `team-and-payroll-detail` | `/team-and-payroll/:id`  | Yes         | No    | Yes         | Yes (WebView)    | Yes / No           | No      | No      | No              | `EmployeeDetailContainer`         |
| `approvals`               | `/approvals`             | Yes         | No    | Yes         | Yes (WebView)    | Yes / Yes          | Yes     | No      | Dialog          | `ApprovalsHubContainer`           |
| `manufacturing`           | `/manufacturing`         | Yes         | No    | Yes         | Yes (WebView)    | Yes / No           | Yes     | Yes     | Dialog          | `ManufacturingContainer`          |
| `analysis`                | `/analysis`              | Yes         | No    | Yes         | Yes (WebView)    | Yes / No           | Yes     | Yes     | No              | `AnalysisContainer`               |
| `market-seller`           | `/market-seller`         | Yes (gated) | No    | Yes (gated) | Yes (gated)      | Yes / No           | No      | No      | No              | `MarketSellerContainer`           |
| `marketplace`             | `/marketplace`           | Yes (gated) | No    | Yes (gated) | Yes (gated)      | Yes / No           | No      | No      | No              | `MarketplaceContainer`            |
| `operations`              | `/operations`            | Yes         | No    | Yes         | Yes (WebView)    | Yes / No           | No      | Yes     | No              | `InventoryOpsContainer`           |
| `stock-count`             | `/stock-count`           | Yes         | No    | Yes         | Yes (WebView)    | Yes / No           | No      | No      | No              | `CycleCountContainer`             |
| `settings`                | `/settings`              | Yes         | No    | Yes         | Yes (WebView)    | Yes / Yes          | Yes     | Yes     | Dialog + Drawer | `SettingsHubContainer`            |
| `activities`              | `/activities`            | Yes         | No    | Yes         | Yes (WebView)    | Yes / No           | Yes     | Yes     | No              | `ActivitiesPage`                  |
| `data-and-sync`           | `/data-and-sync`         | Yes         | No    | Yes         | Yes (WebView)    | Yes / No           | Yes     | No      | No              | `DataHubContainer`                |
| `sync-center`             | `/sync-center`           | Yes         | No    | Yes         | Yes (WebView)    | Yes / No           | No      | No      | No              | `SyncCenterContainer`             |
| `billing`                 | `/billing`               | Yes         | No    | Yes         | Yes (WebView)    | Yes / No           | Yes     | No      | Dialog          | `BillingHubContainer`             |
| `assistant`               | `/assistant`             | Yes         | No    | Yes         | Yes (WebView)    | Yes / Yes          | No      | Yes     | No              | `AiAssistantContainer`            |
| `governance`              | `/governance`            | Yes         | No    | Yes         | Yes (WebView)    | **No** / No        | Yes     | No      | No              | `GovernanceHubContainer`          |
| `developers`              | `/developers`            | Yes         | No    | Yes         | Yes (WebView)    | Yes / No           | No      | No      | Dialog          | `DevelopersContainer`             |
| `audit`                   | `/audit`                 | Yes         | No    | Yes         | Yes (WebView)    | Yes / No           | No      | No      | No              | `AuditContainer`                  |
| `onboarding`              | `/onboarding`            | Yes         | No    | Yes         | Yes (WebView)    | Yes / No           | No      | Yes     | No              | `OnboardingContainer`             |

---

## 3. Platform Admin Routes (`apps/admin` — 27 Separate App Routes)

`apps/admin` is a standalone Next.js platform-administration application (distinct from workspace tenant routes; not bundled in Desktop/Mobile `app-shell`).

| Route ID                 | Admin Path       | Source (`apps/admin/app/[lang]/...`) | Scope                                    |
| ------------------------ | ---------------- | ------------------------------------ | ---------------------------------------- |
| `admin-ai`               | `/ai`            | `(admin)/ai/page.tsx`                | Platform AI usage & controls             |
| `admin-audit-logs`       | `/audit-logs`    | `(admin)/audit-logs/page.tsx`        | Platform-wide audit logs                 |
| `admin-blog`             | `/blog`          | `(admin)/blog/page.tsx`              | CMS blog posts list                      |
| `admin-blog-new`         | `/blog/new`      | `(admin)/blog/new/page.tsx`          | Create blog post (`PostEditorClient`)    |
| `admin-blog-detail`      | `/blog/:id`      | `(admin)/blog/[id]/page.tsx`         | Edit blog post (`PostEditorClient`)      |
| `admin-cms-globals`      | `/cms/globals`   | `(admin)/cms/globals/page.tsx`       | CMS global settings (`CmsGlobalsClient`) |
| `admin-cms-media`        | `/cms/media`     | `(admin)/cms/media/page.tsx`         | CMS media library (`CmsMediaClient`)     |
| `admin-cms-pages`        | `/cms/pages`     | `(admin)/cms/pages/page.tsx`         | CMS pages list (`CmsPagesClient`)        |
| `admin-cms-pages-new`    | `/cms/pages/new` | `(admin)/cms/pages/new/page.tsx`     | Create CMS page (`CmsPageEditorClient`)  |
| `admin-cms-pages-detail` | `/cms/pages/:id` | `(admin)/cms/pages/[id]/page.tsx`    | Edit CMS page (`CmsPageEditorClient`)    |
| `admin-content`          | `/content`       | `(admin)/content/page.tsx`           | Content hub (`ContentClient`)            |
| `admin-customers`        | `/customers`     | `(admin)/customers/page.tsx`         | Platform customers (`CustomersClient`)   |
| `admin-dashboard`        | `/dashboard`     | `(admin)/dashboard/page.tsx`         | Admin overview (`DashboardClient`)       |
| `admin-market`           | `/market`        | `(admin)/market/page.tsx`            | Marketplace moderation                   |
| `admin-oauth-apps`       | `/oauth-apps`    | `(admin)/oauth-apps/page.tsx`        | OAuth applications registry              |
| `admin-offline`          | `/offline`       | `(admin)/offline/page.tsx`           | Offline telemetry (`OfflineClient`)      |
| `admin-operations`       | `/operations`    | `(admin)/operations/page.tsx`        | Platform operations (`OperationsClient`) |
| `admin-product`          | `/product`       | `(admin)/product/page.tsx`           | Product/plan flags (`ProductClient`)     |
| `admin-revenue`          | `/revenue`       | `(admin)/revenue/page.tsx`           | Platform revenue (`RevenueClient`)       |
| `admin-security`         | `/security`      | `(admin)/security/page.tsx`          | Platform security (`SecurityClient`)     |
| `admin-servers`          | `/servers`       | `(admin)/servers/page.tsx`           | Server/DB health                         |
| `admin-subscriptions`    | `/subscriptions` | `(admin)/subscriptions/page.tsx`     | Tenant subscriptions                     |
| `admin-users`            | `/users`         | `(admin)/users/page.tsx`             | Platform users                           |
| `admin-wallet`           | `/wallet`        | `(admin)/wallet/page.tsx`            | Platform wallet/payouts                  |
| `admin-workspaces`       | `/workspaces`    | `(admin)/workspaces/page.tsx`        | Tenant workspaces                        |
| `admin-login`            | `/login`         | `login/page.tsx`                     | Admin sign-in (`LoginClient`)            |
| `admin-wall`             | `/wall`          | `wall/page.tsx`                      | Admin access wall (`WallClient`)         |

---

## 4. Web Public, Auth & Token Routes (37 Routes)

- **Auth & Account (6):** `/login` (also in `app-shell`), `/signup`, `/forgot-password`, `/reset-password`, `/accept-invite`, `/oauth/authorize`
- **Token Portals (5):** `/public-invoice/:token` (shell), `/public-task/:token` (shell), `/portal/:token` (shell), `/my-attendance/:token` (shell), `/feedback/:token` (web-only)
- **Marketing, Docs, Blog, Legal, Public Market (26 web-only):** `/`, `/about`, `/contact`, `/features/:slug`, `/docs`, `/docs/:slug`, `/blog`, `/blog/page/:page`, `/blog/:slug`, `/blog/category/:slug`, `/blog/category/:slug/page/:page`, `/blog/tag/:slug`, `/blog/tag/:slug/page/:page`, 10 `/legal/*` pages, `/market`, `/market/:seller`, `/market/:seller/:listing`

---

## 5. Legacy Redirects (31 `next.config.js` + 38 `app-shell` `<Navigate>`)

All 31 `moved` pairs in `apps/web/next.config.js` match `packages/app-shell/src/app/app.tsx` (`route-parity.test.ts`), plus 5 legacy aliases (`/sales`, `/sales/new`, `/sales/:id`, `/inventory`, `/sync`), `/dashboard -> /`, and `* -> /` in `app-shell`.

---

## 6. V100 Recursive Route Tree — `/invoices` (`SalesHubContainer`)

- **Web & Shell Entries:** `apps/web/app/[lang]/(dashboard)/invoices/page.tsx` · `packages/app-shell/src/app/app.tsx` (`/invoices` -> `InvoicesPage` -> `SalesHubContainer`)
- **Primary Tabs (`HubTabs`, `?tab=`, permission-gated via `NAV_MODULE`):**
  1. `invoices` (default `/invoices`) -> `<InvoicesContainer />` -> `<InvoicesView />`
     - **Sub-switch (`SegmentedControl branch`, `typeFilter`):** `all` (`همه`) | `trading` (`خرید و فروش` + bulk delete `BulkActionBar`) | `advances` (`پیش‌خرید و پیش‌فروش` + focus-by-id)
     - **Executive Summary Band:** `useInvoiceStats(statsSummary)` (`totalAmount` + `count` + `collectionRatio` + `pendingAmount` + `paidAmount`; `advances` status bar when `typeFilter === 'advances'`)
     - **Table & Filter Workflow:** Single unified `<DataTable tableId="invoices">` with `<TableFilterMenu>` (`status`, `branch`, `warehouse`), `SavedViewsMenu`, column toggle, search, CSV export (`ExportButton`), pagination (`PaginationControls`)
     - **Header & Modal Workflows:** `<NewInvoiceChooser />` (`sale`, `purchase`, `pre_sale`, `pre_purchase` -> `/invoices/new?type=...`), `<InvoiceDraftsButton />` (saved drafts dialog), `<RecurringInvoicesButton />` (pause/resume/run-now/history/remove dialog), `<InvoiceRowActions />` / `<AdvanceRowActions />` (view/PDF/print/PNG/copy-share/finalize-advance/delete dialogs)
  2. `pricing` (`?tab=pricing`, `/promotions`) -> `<PromotionsContainer />`
     - **Sub-switch (`SegmentedControl branch`, `section`):** `promotions` (`تخفیف‌ها`) | `lists` (`فهرست‌های قیمت` -> `<PriceListsPanel />`) | `goldRates` (`تابلوی نرخ طلا` -> `<GoldRateBoardPanel />`, industry-gated to `profile.primary === 'jewellery'`)
     - **Promotions Workflow (`promotions`):** Active KPI summary bar, `PromotionForm` (name, kind, value/currency, dates, stacking, `ScopePicker` products/customers), `<DataTable tableId="promotions">` + retire/reactivate actions
     - **Price Lists Workflow (`lists`):** `PriceListForm`, `<DataTable tableId="price-lists">`, split inspector `PriceListEditor` (product price overrides + customer assignment)
     - **Gold Operations Workflow (`goldRates`, jewellery only):** Live 24K + 6-karat matrix (`24K..9K`) + tabbed Operations Desk (`secondHand` w/ KYC preview, `melt`, `reconcile`, `history` `<DataTable tableId="gold-rate-history">`)
- _Note:_ Duplicate `?tab=orders` / `SalesOrdersContainer` has been permanently removed from `SalesHubContainer`; procurement & reorder live under `/warehouse?view=reorder` and `/warehouse?view=rfqs`.
