// ============================================
// Hisabche API — Barrel Exports (Complete)
// ============================================

// ─── Core Client ──────────────────────────────────────────
export { apiClient } from "./lib/client";
export type { ApiResponse, ApiError } from "./lib/client";

// ✅ Token Provider + onUnauthorized
export {
  registerTokenGetter,
  getToken,
  hasToken,
  isTokenProviderReady,
  tokenReady,
} from "./lib/tokenProvider";
export { setOnUnauthorized } from "./lib/client";

// ─── Auth Hooks ───────────────────────────────────────────
export {
  useLogin,
  useSignUp,
  useLogout,
  useCurrentUser,
} from "./hooks/auth";

// ─── Invoices ─────────────────────────────────────────────
export {
  useInvoices,
  useInvoice,
  useCreateInvoice,
  useUpdateInvoice,
  useDeleteInvoice,
  invoiceKeys,
} from "./hooks/invoices";

// ─── Products ─────────────────────────────────────────────
export {
  useProducts,
  useProduct,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  productKeys,
} from "./hooks/products";

// ─── Customers ────────────────────────────────────────────
export {
  useCustomers,
  useCustomer,
  useCreateCustomer,
  useUpdateCustomer,
  customerKeys,
} from "./hooks/customers";

// ─── Transactions ─────────────────────────────────────────
export {
  useTransactions,
  useCreateTransaction,
  useLedger,
  transactionKeys,
} from "./hooks/transactions";

// ─── Realtime ─────────────────────────────────────────────
export { useRealtime } from "./hooks/useRealtime";

// ─── Dashboard ────────────────────────────────────────────
export {
  useDashboardKPIs,
  useAIInsights,
  useDashboardSales,
  dashboardKeys,
  type DashboardKPIs,
  type AIInsight,
  type SalesDataPoint,
  type SalesChartData,
} from "./hooks/dashboard";

// ─── Employees ────────────────────────────────────────────
export {
  useEmployees,
  useEmployee,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  employeeKeys,
} from "./hooks/employees";

// ─── Projects ─────────────────────────────────────────────
export {
  useProjects,
  useProject,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useProjectTasks,
  useCreateProjectTask,
  useUpdateProjectTask,
  useDeleteProjectTask,
  projectKeys,
  projectTaskKeys,
} from "./hooks/projects";

// ─── Workspace ────────────────────────────────────────────
export {
  useWorkspaces,
  useWorkspaceMembers,
  useCreateWorkspace,
  useUpdateWorkspace,
  useInviteMember,
  useRemoveMember,
  useUpdateMemberRole,
  workspaceKeys,
} from "./hooks/workspace";

// ─── Permissions ──────────────────────────────────────────
export {
  useRoles,
  usePermissions,
  useCreateRole,
  useDeleteRole,
  permissionKeys,
} from "./hooks/permissions";

// ─── Audit ────────────────────────────────────────────────
export {
  useAuditLogs,
  auditKeys,
  type AuditLog,
  type AuditResponse,
} from "./hooks/audit";

// ─── Accounting ───────────────────────────────────────────
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
} from "./hooks/accounting";

// ─── CRM ──────────────────────────────────────────────────
export {
  useInteractions,
  useCreateInteraction,
  useOpportunities,
  useCreateOpportunity,
  useUpdateOpportunity,
  crmKeys,
  type Interaction,
  type Opportunity,
} from "./hooks/crm";

// ─── Manufacturing ────────────────────────────────────────
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
} from "./hooks/manufacturing";

// ─── Purchasing ───────────────────────────────────────────
export {
  usePurchaseOrders,
  usePurchaseOrder,
  useCreatePurchaseOrder,
  useReceiveGoods,
  purchasingKeys,
  type PurchaseOrder,
  type PurchaseOrderItem,
} from "./hooks/purchasing";

// ─── Billing & Subscription ───────────────────────────────
export {
  usePlans,
  useSubscription,
  useTrialStatus,
  useUsage,
  useUpgrade,
  useCancelSubscription,
  billingKeys,
  type BillingPlan,
  type UsageReport,
  type TrialStatus,
} from "./hooks/billing";

// ─── Notifications ─────────────────────────────────────────
export {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  notificationKeys,
  type Notification,
} from "./hooks/notifications";

// ═══════════════════════════════════════════════════════════
// ─── ✅ Activity Hooks ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════

export {
  // ─── Query Keys ──────────────────────────────────────────
  activityKeys,

  // ─── Get Hooks ──────────────────────────────────────────
  useActivities,
  useInfiniteActivities,
  // ✅ renamed to avoid collision with hooks/notifications' useUnreadCount
  useUnreadCount as useUnreadActivityCount,
  useEntityActivities,
  useEntitySummary,

  // ─── Mutation Hooks ─────────────────────────────────────
  // ✅ renamed to avoid collision with hooks/notifications' useMarkAsRead / useMarkAllAsRead
  useMarkAsRead as useMarkActivityAsRead,
  useMarkAllAsRead as useMarkAllActivitiesAsRead,

  // ─── Types ──────────────────────────────────────────────
  type ActivityItemDto,
  type ActivityGroupDto,
  type EntitySummaryDto,
  type ActivityFilter,
  type Activity,
  type ActivityGroup,
  type EntitySummary,
} from "./hooks/activity";

// ─── Activity Types (از فایل types) ──────────────────────
export type {
  ActivityDto,
  // ActivityItemDto, // ❌ از hooks/activity export شده
  // ActivityGroupDto, // ❌ از hooks/activity export شده
  // EntitySummaryDto, // ❌ از hooks/activity export شده
  PaginatedActivitiesResponse,
} from "./types/activity.types";

// ─── Workflow ─────────────────────────────────────────────
export {
  useWorkflows,
  useWorkflow,
  useCreateWorkflow,
  useWorkflowInstances,
  useWorkflowInstanceDetail,
  useWorkflowInstance,
  useStartWorkflowInstance,
  usePerformWorkflowAction,
  workflowKeys,
  type Workflow,
  type WorkflowStep,
  type WorkflowInstance,
  type WorkflowActionRecord,
  type WorkflowFilters,
  type InstanceFilters,
  type WorkflowEntityType,
  type WorkflowStatus,
  type WorkflowActionType,
  type ApproverRole,
} from "./hooks/use-workflow";