// packages/ui/src/components/ui/customers/index.ts
export { customersView } from "./customer-view"
export { customersStats } from "./customer-stats"
export { customersCustomerList } from "./customer-list"
export { customersSkeleton } from "./customer-skeleton"
export { AddCustomerModal } from "./AddCustomerModal"
export { PaymentModal } from "./PaymentModal"
export { CustomerDetailView } from "./customer-detail-view"

// 🆕 Customer Workspace v4 — DataGrid System
export { CustomerWorkspaceContainer } from "./containers/customer-workspace-container"
export { customerWorkspace } from "./customer-workspace"
export { Customer360Header } from "./customer-360-header"
export { CustomerAISummary } from "./customer-ai-summary"


// DataGrid (Generic — reusable across all modules)
export { DataGrid } from "./datagrid/datagrid"
export { Drawer } from "./datagrid/drawer"

// Column definitions
export { getInvoiceColumns } from "./datagrid/columns/invoice-columns"
export { getInteractionColumns } from "./datagrid/columns/interaction-columns"
export { getOpportunityColumns } from "./datagrid/columns/opportunity-columns"
export { getPaymentColumns } from "./datagrid/columns/payment-columns"
export { getTimelineColumns } from "./datagrid/columns/timeline-columns"

// Types
export type { InvoiceRow } from "./datagrid/columns/invoice-columns"
export type { InteractionRow } from "./datagrid/columns/interaction-columns"
export type { OpportunityRow } from "./datagrid/columns/opportunity-columns"
export type { PaymentRow } from "./datagrid/columns/payment-columns"
export type { TimelineRow } from "./datagrid/columns/timeline-columns"
export type { ColumnDef, BulkAction } from "./datagrid/datagrid"