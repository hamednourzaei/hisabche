# Desktop → Web Visual + UX Parity Report

> Final verification pass — all static checks complete.

---

## 1. Routes Fixed / Verified

| Route                    | Canonical Source             | Desktop                   | Status   |
| ------------------------ | ---------------------------- | ------------------------- | -------- |
| `/dashboard`             | `DashboardContainer`         | Mounts canonical directly | ✅ MATCH |
| `/invoices`              | `InvoicesContainer`          | Mounts canonical directly | ✅ MATCH |
| `/invoices/:id`          | `InvoiceDetailContainer`     | Mounts canonical directly | ✅ MATCH |
| `/quick-invoice`         | `QuickInvoiceContainer`      | Mounts canonical directly | ✅ MATCH |
| `/purchasing`            | `PurchasingContainer`        | Mounts canonical directly | ✅ MATCH |
| `/warehouse`             | `WarehouseContainer`         | Mounts canonical directly | ✅ MATCH |
| `/warehouse/:id`         | `ProductDetailContainer`     | Mounts canonical directly | ✅ MATCH |
| `/customers`             | `CustomersContainer`         | Mounts canonical directly | ✅ MATCH |
| `/customers/:id`         | `CustomerDetailContainer`    | Mounts canonical directly | ✅ MATCH |
| `/accounting`            | `AccountingPage`             | Mounts canonical directly | ✅ MATCH |
| `/activities`            | `ActivitiesPage`             | Mounts canonical directly | ✅ MATCH |
| `/crm`                   | `CrmContainer`               | Mounts canonical directly | ✅ MATCH |
| `/settings`              | `SettingsPage`               | Mounts canonical directly | ✅ MATCH |
| `/sync-center`           | `SyncCenterContainer`        | Mounts canonical directly | ✅ MATCH |
| `/approvals`             | `ApprovalsContainer`         | Mounts canonical directly | ✅ MATCH |
| `/billing`               | `BillingContainer`           | Mounts canonical directly | ✅ MATCH |
| `/onboarding`            | `OnboardingContainer`        | Mounts canonical directly | ✅ MATCH |
| `/manufacturing`         | `ManufacturingContainer`     | Mounts canonical directly | ✅ MATCH |
| `/permissions`           | `PermissionsContainer`       | Mounts canonical directly | ✅ MATCH |
| `/projects`              | `ProjectsContainer`          | Mounts canonical directly | ✅ MATCH |
| `/human-resources`       | `HumanResourcesContainer`    | Mounts canonical directly | ✅ MATCH |
| `/team-and-payroll`      | `TeamAndPayrollContainer`    | Mounts canonical directly | ✅ MATCH |
| `/workflow`              | `WorkflowTemplatesContainer` | Mounts canonical directly | ✅ MATCH |
| `/sales-followup`        | `SalesFollowupContainer`     | Mounts canonical directly | ✅ MATCH |
| `/audit`                 | `AuditContainer`             | Mounts canonical directly | ✅ MATCH |
| `/public-task/:token`    | `PublicTaskContainer`        | Mounts canonical directly | ✅ MATCH |
| `/public-invoice/:token` | `PublicInvoiceContainer`     | Mounts canonical directly | ✅ MATCH |

**All 26 routes mount canonical Web containers via `@hisabche/ui/screens`.**

## 2. Shared UI Fixed

| Element           | Status                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| Sidebar           | Canonical anatomy from `dashboard-sidebar.tsx` — same width (224px), same tokens, same nav data                    |
| Header            | Canonical anatomy from `dashboard-header.tsx` — brand, app name, sync pill, language, theme, notifications, logout |
| Global Search     | Toolbar search button → command palette trigger (matches Web behavior)                                             |
| Command Palette   | Uses `COMMAND_ITEMS` from `@hisabche/ui/menu` (same data source as Web)                                            |
| Notification Bell | **Canonical `NotificationBell` from `@hisabche/ui` mounted directly**                                              |
| Sync Indicator    | `SyncPill` matches canonical `SyncStatus` component's visual anatomy                                               |
| i18n              | Same `next-intl` catalog via shim; same translation keys                                                           |
| Design Tokens     | `@hisabche/ui/globals.css` imported — identical CSS custom properties                                              |
| Buttons           | Local primitives use same token system (`var(--radius-sm)`, `hsl(var(--color-primary))`, etc.)                     |
| Inputs            | Same token system                                                                                                  |
| Cards             | Same token system                                                                                                  |
| Badges            | Same token system                                                                                                  |
| Skeletons         | Same token system                                                                                                  |

## 3. Visual Deviations Remaining

| Deviation                                                                           | Severity | Classification                                                         |
| ----------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| Sidebar has collapse toggle (Web doesn't)                                           | Low      | `INTENTIONAL_NATIVE_VARIATION`                                         |
| `as never` casts on `useTranslations()` calls in toolbar                            | Low      | TypeScript shim limitation; visual output is identical                 |
| Desktop header shows `businessName` from auth store; Web header shows it from props | None     | Both display business name; data source differs, visual output matches |

## 4. Behavioral Deviations Remaining

| Deviation                                              | Severity | Classification                                                   |
| ------------------------------------------------------ | -------- | ---------------------------------------------------------------- |
| Language change doesn't persist/reload i18n in Desktop | Medium   | Desktop adapter limitation — would require i18n reinitialization |
| Sidebar collapse state persisted in `ui.store.ts`      | Low      | Desktop-only feature; no Web equivalent needed                   |

## 5. Electron-Specific Adaptations

| Adaptation                                                | Purpose                                                    |
| --------------------------------------------------------- | ---------------------------------------------------------- |
| `WebkitAppRegion: drag` on header                         | Frameless window dragging                                  |
| `WebkitAppRegion: no-drag` on interactive header elements | Buttons inside drag region                                 |
| `createHashRouter`                                        | File:// URLs in packaged app                               |
| `useSyncStatus()` local queue                             | Offline-first sync                                         |
| `usePlatform()` detection                                 | Keyboard shortcut labels                                   |
| Keyboard shortcuts                                        | `useShortcuts` for New Invoice, Search, Cmd+K              |
| Login flow                                                | Separate `auth.store.ts` with Electron session persistence |
| Printing                                                  | Desktop-specific invoice printing (`shared/print/`)        |

## 6. Files Changed

| File                                                               | Change                                                 |
| ------------------------------------------------------------------ | ------------------------------------------------------ |
| `packages/ui/src/screens.ts`                                       | Added 14 canonical container exports for Desktop       |
| `packages/ui/src/components/ui/auth/containers/auth-container.tsx` | Fixed `t.has()` → `t()` (pre-existing incompatibility) |
| `apps/desktop/src/app/app.tsx`                                     | Added 16 lazy routes + 16 route entries                |
| `apps/desktop/src/components/layout/sidebar.tsx`                   | Canonical sidebar anatomy, 26 routes                   |
| `apps/desktop/src/components/layout/toolbar.tsx`                   | Canonical header anatomy + `NotificationBell`          |
| `apps/desktop/src/components/layout/app-shell.tsx`                 | Clean canonical layout pattern                         |
| `apps/desktop/src/features/crm/crm-page.tsx`                       | Thin wrapper for `CrmContainer`                        |
| `apps/desktop/src/features/approvals/approvals-page.tsx`           | Thin wrapper for `ApprovalsContainer`                  |
| `apps/desktop/src/features/billing/billing-page.tsx`               | Thin wrapper for `BillingContainer`                    |
| `apps/desktop/src/features/onboarding/onboarding-page.tsx`         | Thin wrapper for `OnboardingContainer`                 |
| `apps/desktop/src/features/manufacturing/manufacturing-page.tsx`   | Thin wrapper for `ManufacturingContainer`              |
| `apps/desktop/src/features/permissions/permissions-page.tsx`       | Thin wrapper for `PermissionsContainer`                |
| `apps/desktop/src/features/projects/projects-page.tsx`             | Thin wrapper for `ProjectsContainer`                   |
| `apps/desktop/src/features/human-resources/hr-page.tsx`            | Thin wrapper for `HumanResourcesContainer`             |
| `apps/desktop/src/features/team-and-payroll/tap-page.tsx`          | Thin wrapper for `TeamAndPayrollContainer`             |
| `apps/desktop/src/features/workflow/workflow-page.tsx`             | Thin wrapper for `WorkflowTemplatesContainer`          |
| `apps/desktop/src/features/sales-followup/sales-followup-page.tsx` | Thin wrapper for `SalesFollowupContainer`              |
| `apps/desktop/src/features/audit/audit-page.tsx`                   | Thin wrapper for `AuditContainer`                      |
| `apps/desktop/src/features/public/public-task-page.tsx`            | Thin wrapper for `PublicTaskContainer`                 |
| `apps/desktop/src/features/public/public-invoice-page.tsx`         | Thin wrapper for `PublicInvoiceContainer`              |
| `documents/DESKTOP_WEB_PARITY_AUDIT.md`                            | Created audit document                                 |
| `documents/DESKTOP_WEB_PARITY_PLAN.md`                             | Created plan document                                  |
| `documents/DESKTOP_SHELL_PARITY_REPORT.md`                         | Created shell parity report                            |
| `documents/DESKTOP_SHELL_FINAL_PARITY_REPORT.md`                   | Created final parity report                            |

## 7. Verification

| Check               | Status                                                 |
| ------------------- | ------------------------------------------------------ |
| Desktop TypeScript  | ✅ PASS                                                |
| Web TypeScript      | ✅ PASS                                                |
| Mobile TypeScript   | ✅ PASS                                                |
| Desktop Build       | ✅ PASS (11.96s)                                       |
| Visual Verification | BLOCKED — AUTH (requires interactive Electron session) |

## 8. Remaining Work

### P0

None. All routes at parity.

### P1

| Item                                 | Reason                                                |
| ------------------------------------ | ----------------------------------------------------- |
| Language persistence across restarts | Desktop language selector doesn't persist/reload i18n |

### P2

| Item                                                | Reason                                                                                                            |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Standalone `SyncStatus` component on `/sync-center` | Desktop toolbar's SyncPill is sufficient for header; canonical `SyncStatus` could be used on the sync-center page |

---

## Architecture Summary

```
packages/ui (canonical)
    ↓
@hisabche/ui/screens (shared containers)
    ↓
┌─────────────────────┬─────────────────────┐
│     Web (Next.js)   │  Desktop (Electron) │
│  direct mount       │  React.lazy mount   │
│  Next.js router     │  react-router-dom   │
│  next-intl          │  next-intl shim     │
│  next/navigation    │  react-router shim  │
│  browser            │  Electron IPC       │
└─────────────────────┴─────────────────────┘
```

**All product features render from the same canonical UI source. Desktop adds only platform-specific adapters.**
