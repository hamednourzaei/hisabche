# DESKTOP → WEB PARITY AUDIT

> Generated from actual source code inspection — no assumptions.

---

## 1. Current Desktop Architecture

Desktop is an **Electron + react-router-dom v6** application with Next.js shims.

### Key Files

| File                                                     | Purpose                                               |
| -------------------------------------------------------- | ----------------------------------------------------- |
| `apps/desktop/src/app/app.tsx`                           | Hash router with all routes                           |
| `apps/desktop/src/components/layout/app-shell.tsx`       | Shell: Sidebar + Toolbar + Outlet                     |
| `apps/desktop/src/components/layout/sidebar.tsx`         | Independent sidebar using `@hisabche/ui/menu` items   |
| `apps/desktop/src/components/layout/toolbar.tsx`         | Independent header bar                                |
| `apps/desktop/src/components/layout/command-palette.tsx` | Cmd+K palette using `@hisabche/ui/menu` items         |
| `apps/desktop/src/features/auth/login-page.tsx`          | Independent login page                                |
| `apps/desktop/src/features/settings/settings-page.tsx`   | Hybrid: local + `BusinessStampSection` from canonical |
| `apps/desktop/src/features/sync/sync-page.tsx`           | Independent sync queue (not canonical SyncCenter)     |
| `apps/desktop/src/shims/next-*.tsx`                      | Next.js → react-router-dom shims                      |

### Shims (enabling `@hisabche/ui` to run in Electron)

| Shim                 | Maps                                             |
| -------------------- | ------------------------------------------------ |
| `next-link.tsx`      | `next/link` → react-router-dom `<Link>`          |
| `next-navigation.ts` | `next/navigation` hooks → react-router-dom hooks |
| `next-image.tsx`     | `next/image` → `<img>`                           |
| `next-dynamic.tsx`   | `next/dynamic` → `React.lazy`                    |
| `next-intl.tsx`      | `next-intl` → `i18next`/`react-i18next`          |

### Electron-Specific (must preserve)

- IPC bridge (`shared/lib/bridge.ts`)
- Offline storage (`shared/lib/storage.ts`)
- Sync engine (`features/sync/sync-engine.ts`)
- Printing (`shared/print/`)
- Keyboard shortcuts (`shared/hooks/use-shortcuts.ts`)
- Auto-update, native menus, tray

---

## 2. Canonical Web Architecture

Web is a **Next.js 15 App Router** application using `next-intl` for i18n.

### Canonical UI Source of Truth

```
packages/ui/src/components/ui/
```

### Canonical Screens (exported via `packages/ui/src/screens.ts`)

| Export                    | Source                                                       |
| ------------------------- | ------------------------------------------------------------ |
| `DashboardContainer`      | `dashboard/containers/dashboard-container.tsx`               |
| `InvoicesContainer`       | `invoices/containers/invoices-container.tsx`                 |
| `InvoiceDetailContainer`  | `invoice-detail/containers/invoice-detail-container.tsx`     |
| `QuickInvoiceContainer`   | `quick-invoice/containers/quick-invoice-container.tsx`       |
| `PurchasingContainer`     | `purchasing/containers/purchasing-container.tsx`             |
| `CustomersContainer`      | `customers/containers/customer-container.tsx`                |
| `CustomerDetailContainer` | `customers/containers/customer-detail-container.tsx`         |
| `WarehouseContainer`      | `warehouse/containers/Warehouse-container.tsx`               |
| `ProductDetailContainer`  | `warehouse-detail/containers/warehouse-detail-container.tsx` |
| `AccountingPage`          | `accounting/`                                                |
| `ActivitiesPage`          | `activity/ActivitiesPage.tsx`                                |
| `SyncCenterContainer`     | `sync-center/containers/sync-center-container.tsx`           |
| `BusinessStampSection`    | `settings/` (partial — only stamp uploader)                  |

### Canonical UI Components (exported via `packages/ui/src/index.ts` but NOT `screens.ts`)

| Export                       | Source                                                       | Desktop Available?   |
| ---------------------------- | ------------------------------------------------------------ | -------------------- |
| `CrmContainer`               | `crm/containers/crm-container.tsx`                           | ❌ Not in screens.ts |
| `ApprovalsContainer`         | `workflow/containers/approvals-container.tsx`                | ❌ Not in screens.ts |
| `BillingContainer`           | `billing/`                                                   | ❌ Not in screens.ts |
| `OnboardingContainer`        | `onboarding/containers/onboarding-container.tsx`             | ❌ Not in screens.ts |
| `ManufacturingContainer`     | `manufacturing/containers/manufacturing-container.tsx`       | ❌ Not in screens.ts |
| `PermissionsContainer`       | `permissions/containers/permissions-container.tsx`           | ❌ Not in screens.ts |
| `ProjectsContainer`          | `projects/containers/projects-container.tsx`                 | ❌ Not in screens.ts |
| `HumanResourcesContainer`    | `human-resources/containers/hr-container.tsx`                | ❌ Not in screens.ts |
| `TeamAndPayrollContainer`    | `team-and-payroll/containers/team-and-payroll-container.tsx` | ❌ Not in screens.ts |
| `WorkflowTemplatesContainer` | `workflow/containers/workflow-templates-container.tsx`       | ❌ Not in screens.ts |
| `SalesFollowupContainer`     | `sales-followup/containers/sales-followup-container.tsx`     | ❌ Not in screens.ts |
| `AuditContainer`             | `audit/containers/audit-container.tsx`                       | ❌ Not in screens.ts |
| `PublicTaskContainer`        | `crm/containers/public-task-container.tsx`                   | ❌ Not in screens.ts |
| `PublicInvoiceContainer`     | `invoice-detail/containers/public-invoice-container.tsx`     | ❌ Not in screens.ts |
| `SettingsPage`               | `settings/`                                                  | ❌ Not in screens.ts |

---

## 3. Route Parity Matrix

| Route                     | Web Canonical                | Desktop Current                                  | Status         |
| ------------------------- | ---------------------------- | ------------------------------------------------ | -------------- |
| `/dashboard`              | `DashboardContainer`         | `DashboardPage` → `DashboardContainer`           | ✅ MATCH       |
| `/invoices`               | `InvoicesContainer`          | `InvoicesPage` → `InvoicesContainer`             | ✅ MATCH       |
| `/invoices/[id]`          | `InvoiceDetailContainer`     | `InvoiceDetailPage` → `InvoiceDetailContainer`   | ✅ MATCH       |
| `/quick-invoice`          | `QuickInvoiceContainer`      | `QuickInvoicePage` → `QuickInvoiceContainer`     | ✅ MATCH       |
| `/purchasing`             | `PurchasingContainer`        | `PurchasingPage` → `PurchasingContainer`         | ✅ MATCH       |
| `/warehouse`              | `WarehouseContainer`         | `ProductsPage` → `WarehouseContainer`            | ✅ MATCH       |
| `/warehouse/[id]`         | `ProductDetailContainer`     | `ProductDetailPage` → `ProductDetailContainer`   | ✅ MATCH       |
| `/customers`              | `CustomersContainer`         | `CustomersPage` → `CustomersContainer`           | ✅ MATCH       |
| `/customers/[id]`         | `CustomerDetailContainer`    | `CustomerDetailPage` → `CustomerDetailContainer` | ✅ MATCH       |
| `/accounting`             | `AccountingPage`             | `AccountingPage` → `AccountingPage`              | ✅ MATCH       |
| `/activities`             | `ActivitiesPage`             | `ActivitiesPage` → `ActivitiesPage`              | ✅ MATCH       |
| `/crm`                    | `CrmContainer`               | **MISSING**                                      | ❌ WEB_ONLY    |
| `/settings`               | `SettingsPage`               | Independent + `BusinessStampSection` only        | ⚠️ PARTIAL     |
| `/sync-center`            | `SyncCenterContainer`        | Independent `SyncPage`                           | ⚠️ INDEPENDENT |
| `/approvals`              | `ApprovalsContainer`         | **MISSING**                                      | ❌ WEB_ONLY    |
| `/billing`                | `BillingContainer`           | **MISSING**                                      | ❌ WEB_ONLY    |
| `/onboarding`             | `OnboardingContainer`        | **MISSING**                                      | ❌ WEB_ONLY    |
| `/manufacturing`          | `ManufacturingContainer`     | **MISSING**                                      | ❌ WEB_ONLY    |
| `/permissions`            | `PermissionsContainer`       | **MISSING**                                      | ❌ WEB_ONLY    |
| `/projects`               | `ProjectsContainer`          | **MISSING**                                      | ❌ WEB_ONLY    |
| `/human-resources`        | `HumanResourcesContainer`    | **MISSING**                                      | ❌ WEB_ONLY    |
| `/team-and-payroll`       | `TeamAndPayrollContainer`    | **MISSING**                                      | ❌ WEB_ONLY    |
| `/workflow`               | `WorkflowTemplatesContainer` | **MISSING**                                      | ❌ WEB_ONLY    |
| `/sales-followup`         | `SalesFollowupContainer`     | **MISSING**                                      | ❌ WEB_ONLY    |
| `/audit`                  | `AuditContainer`             | **MISSING**                                      | ❌ WEB_ONLY    |
| `/public-task/[token]`    | `PublicTaskContainer`        | **MISSING**                                      | ❌ WEB_ONLY    |
| `/public-invoice/[token]` | `PublicInvoiceContainer`     | **MISSING**                                      | ❌ WEB_ONLY    |

---

## 4. Shell Parity Matrix

| Shell Component    | Web Canonical                           | Desktop                                               | Status         |
| ------------------ | --------------------------------------- | ----------------------------------------------------- | -------------- |
| Sidebar            | `dashboard-sidebar.tsx` + `navigation/` | Local `sidebar.tsx` using `@hisabche/ui/menu` items   | ⚠️ INDEPENDENT |
| Header             | `dashboard-header.tsx`                  | Local `toolbar.tsx`                                   | ⚠️ INDEPENDENT |
| Global search      | `global-search.tsx`                     | Local toolbar button → `CommandPalette`               | ⚠️ INDEPENDENT |
| Notification bell  | `notification-bell.tsx`                 | **MISSING**                                           | ❌ PARITY_GAP  |
| Sync status        | `sync-status.tsx`                       | Local toolbar badge                                   | ⚠️ INDEPENDENT |
| Command palette    | `command-palette.tsx`                   | Local `command-palette.tsx` using `@hisabche/ui/menu` | ⚠️ INDEPENDENT |
| Workspace switcher | `workspace/`                            | **MISSING**                                           | ❌ PARITY_GAP  |
| Login              | `auth/`                                 | Independent `login-page.tsx`                          | ⚠️ INDEPENDENT |

---

## 5. Component Reuse Matrix

Desktop **already reuses canonical UI** for 11 of 13 operational routes. This is the correct architecture and should be preserved.

| Feature           | Uses Canonical `@hisabche/ui/screens`?   |
| ----------------- | ---------------------------------------- |
| Dashboard         | ✅ YES                                   |
| Invoices          | ✅ YES                                   |
| Invoice Detail    | ✅ YES                                   |
| Quick Invoice     | ✅ YES                                   |
| Purchasing        | ✅ YES                                   |
| Warehouse         | ✅ YES                                   |
| Warehouse Detail  | ✅ YES                                   |
| Customers         | ✅ YES                                   |
| Customer Detail   | ✅ YES                                   |
| Accounting        | ✅ YES                                   |
| Activities        | ✅ YES                                   |
| Settings          | ⚠️ PARTIAL (only `BusinessStampSection`) |
| Sync              | ❌ NO (independent)                      |
| CRM               | ❌ MISSING                               |
| All P2/P3 modules | ❌ MISSING                               |

---

## 6. Independent Implementations To Replace

| File                                  | Issue                                            | Fix                                                                       |
| ------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------- |
| `features/settings/settings-page.tsx` | Only uses `BusinessStampSection`; rest is local  | Mount full `SettingsPage` from `@hisabche/ui`                             |
| `features/sync/sync-page.tsx`         | Independent sync queue; not canonical SyncCenter | Mount `SyncCenterContainer` from `@hisabche/ui/screens`                   |
| `features/auth/login-page.tsx`        | Independent login form                           | Consider canonical `LoginContainer` if it exists, or keep as thin adapter |

---

## 7. Missing Routes

**P0 — Critical**: `/crm`, `/settings` (fix)
**P1 — Major**: `/permissions`, `/sync-center` (fix)
**P2 — Secondary**: `/approvals`, `/billing`, `/onboarding`, `/manufacturing`, `/projects`, `/human-resources`, `/team-and-payroll`
**P3 — Polish**: `/workflow`, `/sales-followup`, `/audit`, `/public-task/[token]`, `/public-invoice/[token]`

---

## 8. Platform-Specific Blockers

| Blocker                                            | Severity     | Resolution                                   |
| -------------------------------------------------- | ------------ | -------------------------------------------- |
| Desktop hash router vs Next.js file-system routing | Resolved     | Shims already bridge the gap                 |
| `next-intl` vs `i18next`                           | Resolved     | `next-intl.tsx` shim handles this            |
| `next/navigation` hooks                            | Resolved     | `next-navigation.ts` shim handles this       |
| `next/image`                                       | Resolved     | `next-image.tsx` shim handles this           |
| `next/dynamic` (code splitting)                    | Resolved     | `next-dynamic.tsx` shim → `React.lazy`       |
| Public task/invoice routes need `:token` param     | Low          | Desktop router supports this natively        |
| Electron window drag regions in shell              | Desktop-only | Keep in Desktop toolbar, not in canonical UI |

---

## 9. Recommended Migration Strategy

1. **Extend `packages/ui/src/screens.ts`** to export all missing canonical containers (`CrmContainer`, `SettingsPage`, `SyncCenterContainer`, etc.)
2. **Add route entries** in `apps/desktop/src/app/app.tsx` for each missing route
3. **Add thin page wrappers** in `apps/desktop/src/features/` that import from `@hisabche/ui/screens`
4. **Replace** independent Settings and Sync implementations with canonical mounts
5. **Update sidebar navigation** to include all routes
6. **Verify** typecheck after each batch

---

## 10. Verification Status (Baseline)

| Check              | Status                       |
| ------------------ | ---------------------------- |
| Desktop TypeScript | ✅ PASS                      |
| Web TypeScript     | ✅ PASS                      |
| Mobile TypeScript  | ✅ PASS                      |
| Lint               | NOT RUN (stub per CLAUDE.md) |
| Tests              | NOT RUN                      |
| Build              | NOT RUN                      |
| Visual             | BLOCKED — AUTH               |
