// ============================================
// Hisabche UI — Barrel Exports v7.5 (Internationalized)
// ============================================

import './styles/lite-mode.css'

// ---------- Utils ----------
export { cn, formatCurrency, formatDate } from './lib/utils'

// ---------- Primitives ----------
export { Button } from './components/ui/button'
export type { ButtonVariant, ButtonSize } from './components/ui/button'
export { Input } from './components/ui/input'
export { MoneyInput } from './components/ui/money-input'
export type { MoneyInputProps } from './components/ui/money-input'
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './components/ui/card'
export { Badge } from './components/ui/badge'
export type { BadgeVariant, BadgeSize } from './components/ui/badge'
export { Skeleton } from './components/ui/skeleton'
export { PageSkeleton, type PageSkeletonProps } from './components/ui/page-skeleton'
export { RouteProgress, type RouteProgressProps } from './components/ui/route-progress'
export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from './components/ui/dialog'
export {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from './components/ui/sheet'
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from './components/ui/dropdown-menu'
export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from './components/ui/select'
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from './components/ui/table'
export { Toaster } from './components/ui/sonner'

// ---------- Feedback ----------
export { SaveIndicator, type SaveIndicatorProps } from './components/ui/save-indicator'
export { Celebration, type CelebrationProps } from './components/ui/celebration'
export {
  ErrorBoundary,
  ErrorFallbackView,
  type EscapeDestination,
} from './components/ui/error-boundary'
export {
  ROLE_TONE,
  ROLE_TONE_UNKNOWN,
  roleTone,
  roleLabelKey,
  isRoleName,
  type RoleName,
} from './lib/role-tone'
export { AccountingPage } from './components/ui/accounting'

// ---------- Navigation — Dashboard ----------
export { DashboardSidebar, BottomNav, type NavItem } from './components/ui/dashboard-sidebar'
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './components/ui/tooltip'
export { BrandMark, LOGO_SRC } from './components/ui/brand-mark'
export { DashboardHeader, type HeaderPerson } from './components/ui/dashboard-header'
export { CommandPalette } from './components/ui/command-palette'
export { GlobalSearch, type SearchPageItem } from './components/ui/global-search'

// ---------- Navigation — Enterprise ----------
export { NavigationProvider, useNavigation } from './hooks/menu/use-navigation-state'
export { TopNav } from './components/ui/navigation/top-nav'
export { default as SiteFooter } from './components/ui/landing/site-footer'
export { SideNav } from './components/ui/navigation/side-nav'
export { NavigationRegistry } from './components/ui/navigation/navigation-registry'
export { ActivitiesPage } from './components/ui/activity/ActivitiesPage'

// ---------- Landing ----------
export {
  GlassNavbar,
  AnimatedCounter,
  Section,
  FeatureCard,
  SectionHeading,
  GradientMesh,
  ShimmerCTA,
} from './components/ui/landing-section'
export { LandingPreview } from './components/ui/landing-preview'
export { LivingBackground } from './components/ui/living-background'

// ---------- Data Display ----------
export { EmptyState, type EmptyStateProps } from './components/ui/empty-state'
export { BentoStats, compactAmount, type BentoStat } from './components/ui/bento-stats'
// THE KPI card — every screen in the product uses this one.
export {
  KpiCard,
  KpiGrid,
  fullAmount,
  valueFontClass,
  type KpiCardProps,
  type KpiSurface,
} from './components/ui/kpi-card'

// ─── Shared table system (search / column settings / sorting) ───
export {
  DataTable,
  TableToolbar,
  SortableHeader,
  useTableState,
  VISIBILITY_CLASS,
  compareValues,
  type DataTableProps,
  type TableToolbarProps,
  type TableState,
  type TableColumn,
  type ColumnVisibility,
  type SortDirection,
} from './components/ui/data-table'
export { SyncStatus, type SyncStatusProps } from './components/ui/sync-status'
export { OfflineBanner, type OfflineBannerProps } from './components/ui/offline-banner'
export { OfflineQueue, type OfflineQueueProps } from './components/ui/offline-queue'
export { RealtimeIndicator } from './components/ui/realtime-indicator'

// ---------- Forms ----------
export { SearchInput, type SearchInputProps } from './components/ui/search-input'
export { ProductPicker } from './components/ui/product-picker'
export { CustomerPicker } from './components/ui/customer-picker'

// ---------- Layout / FAB ----------
export { Fab, type FabAction, type FabProps } from './components/ui/fab'

// ---------- Auth ----------
export { AuthShell } from './components/ui/auth/AuthShell'
export { AuthContainer } from './components/ui/auth/containers/auth-container'

// ---------- Modals ----------
export { Modal } from './components/ui/Modal'
export { AddProductModal } from './components/ui/add-product-modal'
export { AddCustomerModal } from './components/ui/customers'
export { PaymentModal } from './components/ui/customers'
export { InviteModal } from './components/ui/invite-modal'

// ---------- Pages — Customers ----------
export { customersView, customersSkeleton } from './components/ui/customers'
export { customersContainer as customersPage } from './components/ui/customers/containers/customer-container'

// ---------- Pages — Warehouse ----------
export { WarehouseView } from './components/ui/warehouse/warehouse-view'
export { warehouseSkeleton } from './components/ui/warehouse/warehouse-skeleton'
export { ProductDetailPage } from './components/ui/warehouse-detail'

// ---------- Pages — Invoices ----------
export { InvoicesContainer } from './components/ui/invoices/containers/invoices-container'
export { InvoicesView } from './components/ui/invoices/invoices-view'
export { InvoicesSkeleton } from './components/ui/invoices/invoices-skeleton'
export { InvoiceDetailPage } from './components/ui/invoice-detail/invoice-detail-page'

// ---------- Pages — Settings & Others ----------
export { SettingsPage, BusinessStampSection } from './components/ui/settings'
export { QuickInvoicePage } from './components/ui/quick-invoice'
export { SyncCenterPage } from './components/ui/sync-center'
export { WorkspacePage } from './components/ui/workspace'
export { OnboardingPage } from './components/ui/onboarding/onboarding-page'
export { CustomerDetailView } from './components/ui/customers'
export { CustomerDetailContainer } from './components/ui/customers/containers/customer-detail-container'

// ---------- Containers ----------
export { DashboardContainer } from './components/ui/dashboard/containers/dashboard-container'
export { warehouseContainer } from './components/ui/warehouse/containers/Warehouse-container'
export { WarehouseTabsContainer } from './components/ui/warehouse/containers/warehouse-tabs-container'
export { ProductDetailContainer } from './components/ui/warehouse-detail/containers/warehouse-detail-container'
export { InvoiceDetailContainer } from './components/ui/invoice-detail/containers/invoice-detail-container'
export { PublicInvoiceContainer } from './components/ui/invoice-detail/containers/public-invoice-container'
export { QuickInvoiceContainer } from './components/ui/quick-invoice/containers/quick-invoice-container'
export { InvoiceBuilderContainer, InvoicePreviewContainer } from './components/ui/invoice-builder'
export { SyncCenterContainer } from './components/ui/sync-center/containers/sync-center-container'
export { OnboardingContainer } from './components/ui/onboarding/containers/onboarding-container'

// ---------- Dashboard ----------
export { DashboardView } from './components/ui/dashboard/dashboard-view'
export { InsightCard } from './components/ui/dashboard/dashboard-stats'
export { DashboardInvoices } from './components/ui/dashboard/dashboard-invoices'
export { useDashboard } from './hooks/dashboard/use-dashboard'

// ---------- Human Resources ----------
export { HumanResourcesContainer } from './components/ui/human-resources/containers/hr-container'
export { HumanResourcesView } from './components/ui/human-resources/hr-view'
export { EmployeeDetailContainer } from './components/ui/human-resources/containers/employee-detail-container'
export { EmployeeDetailView } from './components/ui/human-resources/employee-detail-view'

// ---------- Approvals (Fixed) ----------
export { ApprovalsContainer as approvalsPage } from './components/ui/approvals/containers/approvals-container'

// ---------- Team & Payroll ----------
export { TeamAndPayrollContainer } from './components/ui/team-and-payroll/containers/team-and-payroll-container'
export { TeamAndPayrollView } from './components/ui/team-and-payroll/team-and-payroll-view'
export type {
  EmployeeStatus,
  PayrollStatus,
} from './components/ui/team-and-payroll/team-and-payroll-view'
export type {
  Employee,
  PayrollRecord,
} from './components/ui/team-and-payroll/team-and-payroll-view'

// ---------- Permissions ----------
export { PermissionsContainer } from './components/ui/permissions/containers/permissions-container'
export { PermissionsView } from './components/ui/permissions/permissions-view'

// ---------- Audit ----------
export { AuditContainer } from './components/ui/audit/containers/audit-container'
export { AuditView } from './components/ui/audit/audit-view'

// ---------- CRM ----------
export { CrmContainer } from './components/ui/crm/containers/crm-container'
export { CrmView, type CrmTabId } from './components/ui/crm/crm-view'
export { PublicTaskContainer } from './components/ui/crm/containers/public-task-container'
export { CustomerCrmPanel } from './components/ui/crm/customer-crm-panel'

// ---------- Manufacturing ----------
export { ManufacturingContainer } from './components/ui/manufacturing/containers/manufacturing-container'
export {
  ManufacturingView,
  type ManufacturingTabId,
} from './components/ui/manufacturing/manufacturing-view'

// ---------- Purchasing ----------
export { PurchasingContainer } from './components/ui/purchasing/containers/purchasing-container'
export { PurchasingView } from './components/ui/purchasing/purchasing-view'

// ---------- Workflow / Approvals ----------
export { ApprovalsContainer } from './components/ui/workflow/containers/approvals-container'
export { ApprovalsView } from './components/ui/workflow/approvals-view'
export { ApprovalCard } from './components/ui/workflow/approval-timeline'
export { ApprovalActions } from './components/ui/workflow/approval-actions'
export { WorkflowTemplatesContainer } from './components/ui/workflow/containers/workflow-templates-container'
export { WorkflowTemplatesView } from './components/ui/workflow/workflow-templates-view'

// ---------- Workspace ----------
export { WorkspaceContainer } from './components/ui/workspace/containers/workspace-container'

// ---------- Toast ----------
export { Toast, ToastContainer, type ToastProps, type ToastVariant } from './components/ui/toast'
export { ToastProvider, useToast } from './components/ui/toast-provider'

// ---------- Other Components ----------
export { Breadcrumb } from './components/ui/breadcrumb'
export { NotificationBell } from './components/ui/notification-bell'
export { SalesChart } from './components/ui/dashboard/sales-chart'
export { JalaliDatePicker } from './components/ui/jalali-datepicker'
export { PhoneInput } from './components/ui/phone-input'

// ---------- Utils & Hooks ----------
export { exportToCSV } from './lib/export'
export { useCurrency } from './hooks/use-currency'
export { useDateFormat, type DateFormatters } from './hooks/use-date-format'
export {
  useServerFieldErrors,
  focusField,
  type ServerFieldErrors,
} from './hooks/use-server-field-errors'
export { toPersianNumbers, toArabicNumbers, usePersianNumbers } from './lib/persian-numbers'

// ---------- Types ----------
export { PricingContainer, BillingContainer, BillingStatusContainer } from './components/ui/billing'
export {
  SubscriptionLockNotice,
  SubscriptionLockDialog,
  useSubscriptionLocked,
  isRouteAllowedWhenExpired,
  billingHref,
} from './components/ui/billing'
export type SupportedLanguage = 'fa-AF' | 'fa-IR'

// ─── ✅ Activity Components ──────────────────────────────────────────────────
// (Consolidated — see packages/ui/src/components/ui/activity/index.ts for
// what's left after removing ~14 dead files that had no consumers anywhere.)
export {
  ActivityGroupCard,
  ActivityFeedList,
  ActivitySkeleton,
  ActivityEmptyState,
} from './components/ui/activity'
export type { ActivityItemDto, ActivityGroupDto, EntitySummaryDto } from '@hisabche/api'

// ---------- Tier 1/2 capabilities ----------
export { TillContainer } from './components/ui/till/containers/till-container'
export { TillView } from './components/ui/till/till-view'
export { AssetsContainer } from './components/ui/assets/containers/assets-container'
export { AssetsView } from './components/ui/assets/assets-view'
export { BankContainer } from './components/ui/bank/containers/bank-container'
export { BankView } from './components/ui/bank/bank-view'
export { BudgetsContainer } from './components/ui/budgets/containers/budgets-container'
export { BudgetsView } from './components/ui/budgets/budgets-view'
export { DataMigrationContainer } from './components/ui/data-migration/containers/data-migration-container'
export { DataMigrationView } from './components/ui/data-migration/data-migration-view'
export { WorkStateBadge, WorkStateNote } from './components/ui/state/work-state'
export { DataAndSyncContainer } from './components/ui/data-and-sync/containers/data-and-sync-container'
export { DataAndSyncView } from './components/ui/data-and-sync/data-and-sync-view'
export { WorkQueuePanel } from './components/ui/work-queue/work-queue-panel'
export { WorkQueueContainer } from './components/ui/work-queue/containers/work-queue-container'
export { useListEngine, type ListEngine } from './hooks/use-list-engine'
export { DomainWorkspaceContainer } from './components/ui/domain/containers/domain-workspace-container'
export { DomainWorkspaceView } from './components/ui/domain/domain-workspace-view'
export { Entity360 } from './components/ui/entity/entity-360'
export { CustomerListContainer } from './components/ui/customers/containers/customer-list-container'
export { CustomerListView } from './components/ui/customers/customer-list-view'
export { Invoice360Container } from './components/ui/invoice-detail/containers/invoice-360-container'
export { Customer360Container } from './components/ui/customers/containers/customer-360-container'
export { ProductListContainer } from './components/ui/products/containers/product-list-container'
export { ProductListView } from './components/ui/products/product-list-view'
export { TimesheetsContainer } from './components/ui/timesheets/containers/timesheets-container'
export { TimesheetsView } from './components/ui/timesheets/timesheets-view'
export { ExpiryContainer } from './components/ui/expiry/containers/expiry-container'
export { ConflictsContainer } from './components/ui/conflicts/containers/conflicts-container'
export { ConflictsView } from './components/ui/conflicts/conflicts-view'
export { GovernanceContainer } from './components/ui/governance/containers/governance-container'
export { GovernanceHubContainer } from './components/ui/governance/containers/governance-hub-container'
export { GovernanceView } from './components/ui/governance/governance-view'
export { ExpiryView } from './components/ui/expiry/expiry-view'

// ─── AI assistant (T13) ───
export { AiAssistantLauncher } from './components/ui/ai/ai-assistant-launcher'
export { AiAssistantPanel } from './components/ui/ai/ai-assistant-panel'
export { AiAssistantContainer } from './components/ui/ai/containers/ai-assistant-container'

// ─── T11 — screens for backend that had no UI ───
export {
  ProductUnitsPanel,
  newUnitRow,
  unitSetProblems,
} from './components/ui/warehouse/product-units-panel'
export { InventoryOpsView } from './components/ui/inventory-ops/inventory-ops-view'

// ─── T12 — public documentation ───
export { DocsView } from './components/ui/docs/docs-view'
export {
  DOCS_ARTICLES,
  DOCS_GROUPS,
  DOCS_ENTRY_SLUG,
  findArticle,
  docsMessageKeys,
} from './lib/docs/docs-content'
export type { DocsArticleDef, DocsSectionDef, DocsGroupId } from './lib/docs/docs-content'

// ─── T11 / L2 — stock counting ───
export { CycleCountView } from './components/ui/cycle-count/cycle-count-view'
export { CycleCountContainer } from './components/ui/cycle-count/containers/cycle-count-container'
export { InventoryOpsContainer } from './components/ui/inventory-ops/containers/inventory-ops-container'
export { DocsHelpLink, ROUTE_DOCS_MAP, docsSlugForPath } from './components/ui/docs/docs-help-link'

export {
  authorizationMessage,
  authorizationText,
  type AuthorizationMessage,
} from './lib/authorization-message'
