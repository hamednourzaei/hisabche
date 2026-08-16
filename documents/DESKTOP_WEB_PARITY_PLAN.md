# DESKTOP → WEB PARITY PLAN

> Incremental migration — one batch at a time, typecheck after each.

---

## D1 — Canonical Screen Exports + Missing Routes (P0)

**Goal**: Make every canonical container available to Desktop via `@hisabche/ui/screens`.

**Files to change**:

- `packages/ui/src/screens.ts` — Add exports for: `CrmContainer`, `SettingsPage`, `SyncCenterContainer`, `ApprovalsContainer`, `BillingContainer`, `OnboardingContainer`, `ManufacturingContainer`, `PermissionsContainer`, `ProjectsContainer`, `HumanResourcesContainer`, `TeamAndPayrollContainer`, `WorkflowTemplatesContainer`, `SalesFollowupContainer`, `AuditContainer`, `PublicTaskContainer`, `PublicInvoiceContainer`
- `apps/desktop/src/app/app.tsx` — Add route entries for: `/crm`, `/approvals`, `/billing`, `/onboarding`, `/manufacturing`, `/permissions`, `/projects`, `/human-resources`, `/team-and-payroll`, `/workflow`, `/sales-followup`, `/audit`, `/public-task/:token`, `/public-invoice/:token`
- `apps/desktop/src/features/crm/crm-page.tsx` — New thin wrapper
- `apps/desktop/src/features/approvals/approvals-page.tsx` — New thin wrapper
- `apps/desktop/src/features/billing/billing-page.tsx` — New thin wrapper
- `apps/desktop/src/features/onboarding/onboarding-page.tsx` — New thin wrapper
- `apps/desktop/src/features/manufacturing/manufacturing-page.tsx` — New thin wrapper
- `apps/desktop/src/features/permissions/permissions-page.tsx` — New thin wrapper
- `apps/desktop/src/features/projects/projects-page.tsx` — New thin wrapper
- `apps/desktop/src/features/human-resources/hr-page.tsx` — New thin wrapper
- `apps/desktop/src/features/team-and-payroll/tap-page.tsx` — New thin wrapper
- `apps/desktop/src/features/workflow/workflow-page.tsx` — New thin wrapper
- `apps/desktop/src/features/sales-followup/sales-followup-page.tsx` — New thin wrapper
- `apps/desktop/src/features/audit/audit-page.tsx` — New thin wrapper
- `apps/desktop/src/features/public/public-task-page.tsx` — New thin wrapper (public route)
- `apps/desktop/src/features/public/public-invoice-page.tsx` — New thin wrapper (public route)

**Dependencies**: None
**Risk**: Low — adding exports and thin wrappers cannot break existing routes
**Verification**: `pnpm --filter @hisabche/desktop type-check && pnpm --filter @hisabche/web type-check`

---

## D2 — Replace Independent Settings

**Goal**: Mount canonical `SettingsPage` instead of local hybrid implementation.

**Files to change**:

- `apps/desktop/src/features/settings/settings-page.tsx` — Replace local implementation with canonical `SettingsPage` mount, keeping only Desktop-specific sections (app version, local DB) as an adapter

**Dependencies**: D1 (SettingsPage must be exported from screens.ts)
**Risk**: Medium — settings has Desktop-specific sections that must be preserved
**Verification**: Desktop typecheck

---

## D3 — Replace Independent Sync

**Goal**: Mount canonical `SyncCenterContainer` instead of independent sync queue.

**Files to change**:

- `apps/desktop/src/features/sync/sync-page.tsx` — Replace with canonical `SyncCenterContainer` mount

**Dependencies**: D1
**Risk**: Low — canonical SyncCenter is designed for Web/Desktop
**Verification**: Desktop typecheck

---

## D4 — Sidebar Navigation Update

**Goal**: Make Desktop sidebar show all routes.

**Files to change**:

- `apps/desktop/src/components/layout/sidebar.tsx` — Add navigation items for newly routed features

**Dependencies**: D1
**Risk**: Low
**Verification**: Desktop typecheck + visual sidebar inspection

---

## Verification Strategy

After each batch:

1. `pnpm --filter @hisabche/desktop type-check`
2. `pnpm --filter @hisabche/web type-check`
3. Verify no existing routes broke
4. If possible, run `pnpm --filter @hisabche/desktop build`
