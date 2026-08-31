// ============================================
// Hisabche screens — the shared application surface.
//
// A "screen" is a container: it owns data fetching and navigation intent, then
// renders a presentational view. Web mounts these from its Next.js route
// segments; desktop mounts the same modules from react-router. Neither owns a
// private copy of a screen, so a change to invoicing lands on both renderers at
// once.
//
// Deliberately separate from `index.ts`: that barrel also carries the landing
// site and every primitive, which desktop has no use for. Importing screens
// through their own entry keeps the renderer bundle to the app surface.
//
// Navigation contract: containers push web-style paths (`/invoices/:id`,
// `/quick-invoice`). Desktop's router mirrors those paths exactly — see
// `apps/desktop/src/app/app.tsx` — so no container needs a per-platform branch.
// ============================================

export { DashboardContainer } from './components/ui/dashboard/containers/dashboard-container'

// ---------- Sales & purchasing ----------
export { InvoicesContainer } from './components/ui/invoices/containers/invoices-container'
export { InvoiceDetailContainer } from './components/ui/invoice-detail/containers/invoice-detail-container'
export { QuickInvoiceContainer } from './components/ui/quick-invoice/containers/quick-invoice-container'
export { InvoiceBuilderContainer } from './components/ui/invoice-builder/containers/invoice-builder-container'
export { InvoicePreviewContainer } from './components/ui/invoice-builder/containers/invoice-preview-container'
export { PurchasingContainer } from './components/ui/purchasing/containers/purchasing-container'

// ---------- Customers ----------
export { CustomersContainer } from './components/ui/customers/containers/customer-container'
export { CustomerDetailContainer } from './components/ui/customers/containers/customer-detail-container'

// ---------- Inventory ----------
export { warehouseContainer as WarehouseContainer } from './components/ui/warehouse/containers/Warehouse-container'
export { ProductDetailContainer } from './components/ui/warehouse-detail/containers/warehouse-detail-container'

// ---------- Accounting & activity ----------
export { AccountingPage } from './components/ui/accounting'
export { ActivitiesPage } from './components/ui/activity/ActivitiesPage'

// ---------- Sync ----------
export { SyncCenterContainer } from './components/ui/sync-center/containers/sync-center-container'

// ---------- Settings ----------
export { SettingsPage, BusinessStampSection } from './components/ui/settings'

// ---------- CRM ----------
export { CrmContainer } from './components/ui/crm/containers/crm-container'
export { PublicTaskContainer } from './components/ui/crm/containers/public-task-container'

// ---------- Workflow / Approvals ----------
export { ApprovalsContainer } from './components/ui/workflow/containers/approvals-container'
export { WorkflowTemplatesContainer } from './components/ui/workflow/containers/workflow-templates-container'

// ---------- Billing ----------
export { BillingContainer } from './components/ui/billing'

// ---------- Onboarding ----------
export { OnboardingContainer } from './components/ui/onboarding/containers/onboarding-container'

// ---------- Manufacturing ----------
export { ManufacturingContainer } from './components/ui/manufacturing/containers/manufacturing-container'

// ---------- Permissions ----------
export { PermissionsContainer } from './components/ui/permissions/containers/permissions-container'

// ---------- Human Resources ----------
export { HumanResourcesContainer } from './components/ui/human-resources/containers/hr-container'

// ---------- Team & Payroll ----------
export { TeamAndPayrollContainer } from './components/ui/team-and-payroll/containers/team-and-payroll-container'

// ---------- Sales Follow-up ----------
export { SalesFollowupContainer } from './components/ui/sales-followup/containers/sales-followup-container'

// ---------- Audit ----------
export { AuditContainer } from './components/ui/audit/containers/audit-container'

// ---------- Public (no-auth) ----------
export { PublicInvoiceContainer } from './components/ui/invoice-detail/containers/public-invoice-container'

// ---------- Tier 1/2 capabilities ----------
// One container per NAV_CONTRACT destination. Web mounts these from its route
// segments and desktop mounts the same modules from react-router — neither owns
// a private copy.
export { TillContainer } from './components/ui/till/containers/till-container'
export { AssetsContainer } from './components/ui/assets/containers/assets-container'
export { BankContainer } from './components/ui/bank/containers/bank-container'
export { BudgetsContainer } from './components/ui/budgets/containers/budgets-container'
export { DataMigrationContainer } from './components/ui/data-migration/containers/data-migration-container'
export { DataAndSyncContainer } from './components/ui/data-and-sync/containers/data-and-sync-container'
export { TimesheetsContainer } from './components/ui/timesheets/containers/timesheets-container'
export { ExpiryContainer } from './components/ui/expiry/containers/expiry-container'

// ---------- Offline conflicts ----------
// The review queue for offline writes the server refused. For an offline-first
// product this is not an admin screen — it is where unrecorded money waits.
export { ConflictsContainer } from './components/ui/conflicts/containers/conflicts-container'

// ---------- Separation of duties ----------
export { GovernanceContainer } from './components/ui/governance/containers/governance-container'
