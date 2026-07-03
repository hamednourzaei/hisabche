// ============================================
// Hisabche API — Barrel Exports
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

// ✅ Dashboard (فاز ۲۲ + ۲۳)
export {
  useDashboardKPIs,
  useAIInsights,
  dashboardKeys,
  type DashboardKPIs,
  type AIInsight,
} from './hooks/dashboard'
// ---------- Employees (فاز ۱۵) ----------
export {
  useEmployees,
  useEmployee,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  employeeKeys,
} from './hooks/employees'
// ---------- Projects (فاز ۱۶) ----------

export {
  useProjects, useProject, useCreateProject, useUpdateProject, useDeleteProject,
  useProjectTasks, useCreateProjectTask, useUpdateProjectTask, useDeleteProjectTask,
  projectKeys, projectTaskKeys,
} from './hooks/projects'
// ---------- Workspace (فاز ۱۷) ----------
export {
  useWorkspaces,
  useWorkspaceMembers,
  useCreateWorkspace,
  useInviteMember,
  useRemoveMember,
  workspaceKeys,
} from './hooks/workspace'
// ---------- Permissions (فاز ۱۸) ----------
export { useRoles, usePermissions, useCreateRole, useDeleteRole, permissionKeys } from './hooks/permissions'
// ---------- Audit (فاز ۱۹) ----------
export { useAuditLogs, auditKeys } from './hooks/audit'