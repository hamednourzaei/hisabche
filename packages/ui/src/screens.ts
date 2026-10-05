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
export { SalesHubContainer } from './components/ui/invoices/containers/sales-hub-container'
export { InvoiceDetailContainer } from './components/ui/invoice-detail/containers/invoice-detail-container'
export { QuickInvoiceContainer } from './components/ui/quick-invoice/containers/quick-invoice-container'
export { InvoiceBuilderContainer } from './components/ui/invoice-builder/containers/invoice-builder-container'
export { InvoicePreviewContainer } from './components/ui/invoice-builder/containers/invoice-preview-container'

// ---------- Customers ----------
export { CustomersContainer } from './components/ui/customers/containers/customer-container'
export { CustomersHubContainer } from './components/ui/customers/containers/customers-hub-container'
export { CustomerDetailContainer } from './components/ui/customers/containers/customer-detail-container'

// ---------- Inventory ----------
export { warehouseContainer as WarehouseContainer } from './components/ui/warehouse/containers/Warehouse-container'
// G1: the warehouse destination now carries two tabs — stock and the product
// catalogue. Both renderers mount this, so neither gets the tab and the other
// not.
export { WarehouseTabsContainer } from './components/ui/warehouse/containers/warehouse-tabs-container'
export { ProductDetailContainer } from './components/ui/warehouse-detail/containers/warehouse-detail-container'

// ---------- Accounting & activity ----------
export { AccountingPage } from './components/ui/accounting'
export { ActivitiesPage } from './components/ui/activity/ActivitiesPage'

// ---------- Sync ----------
export { SyncCenterContainer } from './components/ui/sync-center/containers/sync-center-container'

// ---------- Settings ----------
export { SettingsPage, BusinessStampSection, HardwareSection } from './components/ui/settings'

// ---------- CRM ----------
export { CrmContainer } from './components/ui/crm/containers/crm-container'
export { PublicTaskContainer } from './components/ui/crm/containers/public-task-container'

// ---------- Workflow / Approvals ----------
export { ApprovalsContainer } from './components/ui/workflow/containers/approvals-container'
export { ReferralsContainer } from './components/ui/referrals/containers/referrals-container'
export { DevelopersContainer } from './components/ui/developers/containers/developers-container'
export { OrdersContainer } from './components/ui/orders/containers/orders-container'
export { MarketplaceContainer } from './components/ui/marketplace/containers/marketplace-container'
export { WorkflowTemplatesContainer } from './components/ui/workflow/containers/workflow-templates-container'
export { ApprovalsHubContainer } from './components/ui/workflow/containers/approvals-hub-container'

// ---------- Billing ----------
export { BillingContainer } from './components/ui/billing'
export { BillingHubContainer } from './components/ui/billing/containers/billing-hub-container'
export { WalletContainer } from './components/ui/wallet/wallet-container'
export { MarketSellerContainer } from './components/ui/market/market-seller-container'
export { AnalysisContainer } from './components/ui/analysis/analysis-container'
export { PromotionsContainer } from './components/ui/promotions/promotions-container'
export { CampaignsContainer } from './components/ui/campaigns/campaigns-container'

// ---------- Onboarding ----------
export { OnboardingContainer } from './components/ui/onboarding/containers/onboarding-container'

// ---------- Manufacturing ----------
export { ManufacturingContainer } from './components/ui/manufacturing/containers/manufacturing-container'

// ---------- Permissions ----------
export { PermissionsContainer } from './components/ui/permissions/containers/permissions-container'

// ---------- Human Resources ----------
export { HumanResourcesContainer } from './components/ui/human-resources/containers/hr-container'
// G1: desktop routes the employee detail screen too now, at
// /team-and-payroll/:id — the same path web uses.
export { EmployeeDetailContainer } from './components/ui/human-resources/containers/employee-detail-container'

// ---------- Team & Payroll ----------
export { TeamAndPayrollContainer } from './components/ui/team-and-payroll/containers/team-and-payroll-container'
// G2: the branch tree and its form — exported so a second caller (a branch
// picker elsewhere, a department tree) can reuse them.
export { BranchTreeView } from './components/ui/team-and-payroll/branch-tree-view'
export { BranchForm } from './components/ui/team-and-payroll/branch-form'

// ---------- Sales Follow-up ----------

// ---------- Audit ----------
export { AuditContainer } from './components/ui/audit/containers/audit-container'

// ---------- Public (no-auth) ----------
export { PublicInvoiceContainer } from './components/ui/invoice-detail/containers/public-invoice-container'
export { PublicPortalContainer } from './components/ui/customers/containers/public-portal-container'

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
export { DataHubContainer } from './components/ui/data-and-sync/containers/data-hub-container'
export { WorkQueueContainer } from './components/ui/work-queue/containers/work-queue-container'
export { CustomerListContainer } from './components/ui/customers/containers/customer-list-container'
export { Invoice360Container } from './components/ui/invoice-detail/containers/invoice-360-container'
export { Customer360Container } from './components/ui/customers/containers/customer-360-container'
export { ProductListContainer } from './components/ui/products/containers/product-list-container'
export { TimesheetsContainer } from './components/ui/timesheets/containers/timesheets-container'
export { ExpiryContainer } from './components/ui/expiry/containers/expiry-container'

// ---------- Offline conflicts ----------
// The review queue for offline writes the server refused. For an offline-first
// product this is not an admin screen — it is where unrecorded money waits.
export { ConflictsContainer } from './components/ui/conflicts/containers/conflicts-container'

// ---------- Separation of duties ----------
export { GovernanceContainer } from './components/ui/governance/containers/governance-container'
export { GovernanceHubContainer } from './components/ui/governance/containers/governance-hub-container'

// ⚠️ Added so the shared shell can route them: Windows and mobile were
// missing /assistant, /operations and /stock-count entirely — three pages the
// web app has had all along. A container the shell cannot import is a page
// that exists on one machine and not the others.
export { AiAssistantContainer } from './components/ui/ai/containers/ai-assistant-container'
export { CycleCountContainer } from './components/ui/cycle-count/containers/cycle-count-container'
export { InventoryOpsContainer } from './components/ui/inventory-ops/containers/inventory-ops-container'
export { SettingsHubContainer } from './components/ui/settings/settings-hub-container'
