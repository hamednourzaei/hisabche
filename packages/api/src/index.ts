// ============================================
// Hisabche API — Barrel Exports (Complete)
// ============================================

export { apiClient, type ApiResponse, type ApiError } from './lib/client'

export { useLogin, useSignUp, useLogout, useCurrentUser } from './hooks/auth'

export {
  useInvoices,
  useInvoice,
  useCreateInvoice,
  useUpdateInvoice,
  useDeleteInvoice,
  invoiceKeys,
} from './hooks/invoices'

export {
  useProducts,
  useProduct,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  productKeys,
} from './hooks/products'

export {
  useCustomers,
  useCustomer,
  useCreateCustomer,
  useUpdateCustomer,
  customerKeys,
} from './hooks/customers'

export { useTransactions, useCreateTransaction, useLedger, transactionKeys } from './hooks/transactions'
export { useRealtime } from './hooks/useRealtime'

// ✅ Dashboard
export {
  useDashboardKPIs,
  useAIInsights,
  useDashboardSales,
  dashboardKeys,
  type DashboardKPIs,
  type AIInsight,
  type SalesDataPoint,
  type SalesChartData,
} from './hooks/dashboard'

// ---------- Employees ----------
export {
  useEmployees,
  useEmployee,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  employeeKeys,
} from './hooks/employees'

// ---------- Projects ----------
export {
  useProjects, useProject, useCreateProject, useUpdateProject, useDeleteProject,
  useProjectTasks, useCreateProjectTask, useUpdateProjectTask, useDeleteProjectTask,
  projectKeys, projectTaskKeys,
} from './hooks/projects'

// ---------- Workspace ----------
export {
  useWorkspaces,
  useWorkspaceMembers,
  useCreateWorkspace,
  useInviteMember,
  useRemoveMember,
  useUpdateMemberRole,
  workspaceKeys,
} from './hooks/workspace'

// ---------- Permissions ----------
export { 
  useRoles, 
  usePermissions, 
  useCreateRole, 
  useDeleteRole, 
  permissionKeys,
} from './hooks/permissions'

// ---------- Audit ----------
export { 
  useAuditLogs, 
  auditKeys,
  type AuditLog,
  type AuditResponse,
} from './hooks/audit'

// ---------- Accounting (NEW) ----------
export {
  useAccounts,
  useCreateAccount,
  useJournalEntries,
  useCreateJournalEntry,
  useTrialBalance,
  useBalanceSheet,
  useIncomeStatement,
  accountingKeys,
  type Account,
  type JournalEntry,
  type JournalLine,
  type TrialBalance,
  type BalanceSheet,
  type IncomeStatement,
} from './hooks/accounting'

// ---------- CRM (NEW) ----------
export {
  useInteractions,
  useCreateInteraction,
  useOpportunities,
  useCreateOpportunity,
  useUpdateOpportunity,
  crmKeys,
  type Interaction,
  type Opportunity,
} from './hooks/crm'

// ---------- Manufacturing (NEW) ----------
export {
  useBOMs,
  useCreateBOM,
  useWorkOrders,
  useCreateWorkOrder,
  useCompleteWorkOrder,
  manufacturingKeys,
  type BOM,
  type BOMItem,
  type WorkOrder,
} from './hooks/manufacturing'

// ---------- Purchasing (NEW) ----------
export {
  usePurchaseOrders,
  usePurchaseOrder,
  useCreatePurchaseOrder,
  useReceiveGoods,
  purchasingKeys,
  type PurchaseOrder,
  type PurchaseOrderItem,
} from './hooks/purchasing'