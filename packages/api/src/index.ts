// ============================================
// Hisabche API — Barrel Exports (Complete)
// ============================================

// ─── Core Client ──────────────────────────────────────────
export { apiClient, normalizeBaseUrl } from './lib/client'
export type { ApiResponse, ApiError } from './lib/client'

// ✅ Token Provider + onUnauthorized
export {
  registerTokenGetter,
  getToken,
  hasToken,
  isTokenProviderReady,
  tokenReady,
} from './lib/tokenProvider'
export { setOnUnauthorized } from './lib/client'

// ─── Storage Adapter (platform agnostic) ──────────────────
export {
  registerStorage,
  getStorage,
  readStorage,
  writeStorage,
  removeStorage,
  STORAGE_KEYS,
  type KeyValueStorage,
} from './storage'
export { createWebStorage } from './storage/web'

// ─── Auth Hooks ───────────────────────────────────────────
export { useLogin, useSignUp, useLogout, useCurrentUser } from './hooks/auth'

// ─── Invoices ─────────────────────────────────────────────
export {
  useInvoices,
  useInvoice,
  useCreateInvoice,
  useUpdateInvoice,
  useDeleteInvoice,
  invoiceKeys,
  type InvoiceWithCustomer,
} from './hooks/invoices'

// ─── Products ─────────────────────────────────────────────
export {
  useProducts,
  useProduct,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  productKeys,
} from './hooks/products'

// ─── Customers ────────────────────────────────────────────
export {
  useCustomers,
  useCustomer,
  useCreateCustomer,
  useUpdateCustomer,
  customerKeys,
} from './hooks/customers'

// ─── Transactions ─────────────────────────────────────────
export {
  useTransactions,
  useCreateTransaction,
  useLedger,
  transactionKeys,
} from './hooks/transactions'

// ─── Branches ─────────────────────────────────────────────
// G2: /api/branches existed since the branch migration with no client hook,
// so the product could not show or pick a branch anywhere.
export {
  useBranches,
  useBranchTree,
  useCreateBranch,
  branchKeys,
  type Branch,
  type BranchEmployee,
  type BranchTreeNode,
  type CreateBranchInput,
} from './hooks/branches'

// ─── Payments (AR / AP) ───────────────────────────────────
// The one client-side path for money moving between the business and a party.
// `useCreateTransaction` is NOT that path — see hooks/payments.ts.
export {
  usePayments,
  useOpenInvoices,
  useRecordPayment,
  paymentKeys,
  type PaymentDirection,
  type PaymentPartyType,
  type PaymentRecord,
  type RecordPaymentInput,
  type OpenInvoice,
} from './hooks/payments'

// ─── Realtime ─────────────────────────────────────────────
export { useRealtime, useActiveWorkspaceId } from './hooks/useRealtime'

// The workspace registry. `@hisabche/store` calls `setActiveWorkspaceId`,
// because it depends on this package and not the reverse — see
// lib/active-workspace.ts for why the value is pushed rather than pulled.
export {
  getActiveWorkspaceId,
  setActiveWorkspaceId,
  onActiveWorkspaceChange,
} from './lib/active-workspace'

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
} from './hooks/dashboard'

// ─── Employees ────────────────────────────────────────────
export {
  useEmployees,
  useEmployee,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  employeeKeys,
} from './hooks/employees'

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
} from './hooks/projects'

// ─── Workspace ────────────────────────────────────────────
export {
  useWorkspaces,
  useWorkspaceMembers,
  useCreateWorkspace,
  useUpdateWorkspace,
  useInviteMember,
  useCreateMemberDirect,
  useSetMemberSuspension,
  useRemoveMember,
  useUpdateMemberRole,
  workspaceKeys,
  type CreateMemberDirectInput,
} from './hooks/workspace'

// ─── Payroll ──────────────────────────────────────────────
export { usePayrolls, usePayrollSummary, useCreatePayroll, payrollKeys } from './hooks/payroll'

// ─── Permissions ──────────────────────────────────────────
export {
  useRoles,
  usePermissions,
  useCreateRole,
  useDeleteRole,
  permissionKeys,
} from './hooks/permissions'

// ─── Audit ────────────────────────────────────────────────
export { useAuditLogs, auditKeys, type AuditLog, type AuditResponse } from './hooks/audit'

// ─── Sales Follow-up ──────────────────────────────────────
export {
  useSalesFollowups,
  useFollowup,
  useCreateFollowup,
  useUpdateFollowup,
  useDeleteFollowup,
  salesFollowupKeys,
  type FollowUp,
  type CreateFollowUpInput,
  type UpdateFollowUpInput,
  type FollowUpFilters,
} from './hooks/sales-followup'

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
  type AccountRootType,
  type JournalEntry,
  type JournalEntryStatus,
  type JournalLine,
  type TrialBalance,
  type TrialBalanceResult,
  type BalanceSheet,
  type IncomeStatement,
} from './hooks/accounting'

// ─── CRM ──────────────────────────────────────────────────
export {
  useInteractions,
  useCreateInteraction,
  useUpdateInteractionStatus,
  useRecordCustomerOutcome,
  useSubjectSuggestions,
  useOpportunities,
  useCreateOpportunity,
  useUpdateOpportunity,
  crmKeys,
  type Interaction,
  type CreateInteractionInput,
  type TaskStatus,
  type InteractionCustomer,
  type InteractionStatusEvent,
  type CustomerOutcome,
  type RecordCustomerOutcomeInput,
  type Opportunity,
} from './hooks/crm'

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
} from './hooks/manufacturing'

// ─── Purchasing ───────────────────────────────────────────
export {
  usePurchaseOrders,
  usePurchaseOrder,
  useCreatePurchaseOrder,
  useReceiveGoods,
  purchasingKeys,
  type PurchaseOrder,
  type PurchaseOrderItem,
} from './hooks/purchasing'

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
} from './hooks/billing'

// ─── Notifications ─────────────────────────────────────────
export {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  notificationKeys,
  type Notification,
} from './hooks/notifications'

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
} from './hooks/activity'

// ─── Activity Types (از فایل types) ──────────────────────
export type {
  ActivityDto,
  // ActivityItemDto, // ❌ از hooks/activity export شده
  // ActivityGroupDto, // ❌ از hooks/activity export شده
  // EntitySummaryDto, // ❌ از hooks/activity export شده
  PaginatedActivitiesResponse,
} from './types/activity.types'

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
} from './hooks/use-workflow'

// ─── Tier 1/2 capabilities ────────────────────────────────
// Six destinations, six hook modules. Exported by name rather than with a
// star so a future collision is a compile error here, not a silently shadowed
// hook at a call site.
export {
  tillKeys,
  useCurrentSession,
  useSession,
  useAbandonedSessions,
  useOpenSession,
  useRecordOrder,
  useRecordCashMovement,
  useCloseSession,
  useVoidOrder,
  type PosSession,
  type PosPaymentMethod,
  type SessionTotals,
  type AbandonedSession,
  type RecordOrderInput,
} from './hooks/till'

export {
  assetKeys,
  useAssets,
  useAssetSchedule,
  useCreateAsset,
  usePostDepreciation,
  useDisposeAsset,
  type FixedAsset,
  type ScheduleRow,
  type CreateAssetInput,
  type DepreciationMethod,
  type DepreciationRunResult,
  type DisposalResult,
} from './hooks/assets'

export {
  bankKeys,
  useBankStatements,
  useMatchSuggestions,
  useReconciliation,
  useImportStatement,
  useReconcileLine,
  useUnmatchLine,
  type BankStatement,
  type MatchSuggestion,
  type MatchReason,
  type ReconciliationSummary,
  type ImportStatementInput,
} from './hooks/bank'

export {
  budgetKeys,
  useBudgets,
  useBudgetVariance,
  useSaveBudget,
  useCheckSpend,
  type Budget,
  type BudgetAction,
  type BudgetPeriod,
  type BudgetStatus,
  type BudgetCheck,
  type VarianceRow,
} from './hooks/budgets'

export {
  migrationKeys,
  useMigrations,
  useMigration,
  useScanMigration,
  useSaveMapping,
  useDryRun,
  useCommitMigration,
  useCancelMigration,
  type MigrationEntity,
  type MigrationSourceType,
  type MigrationStatus,
  type MigrationJob,
  type MigrationDiscovery,
  type MappingStatus,
  type MappingSuggestion,
  type SourceGuess,
  type Finding,
  type FindingSeverity,
  type DryRunSummary,
  type ReconciliationLine,
} from './hooks/migrations'

export {
  timesheetKeys,
  useTimesheetSummary,
  useBillingPreview,
  useProjectProfitability,
  useLogTime,
  useSaveBillingConfig,
  type BillingMethod,
  type ProjectBillingConfig,
  type TimeTotals,
  type BillableLine,
  type ProjectProfitability,
  type LogTimeInput,
} from './hooks/timesheets'

export {
  expiryKeys,
  useBatches,
  useSerials,
  useExpiryReport,
  useLotTrail,
  usePlanIssue,
  useReceiveBatch,
  useReceiveSerials,
  type StockBatch,
  type SerialUnit,
  type SerialStatus,
  type ExpiryState,
  type ExpiryBucket,
  type ExpiryReport,
  type AllocationPlan,
  type AllocationStrategy,
} from './hooks/expiry'

// ─── Offline conflicts ────────────────────────────────────
// The review queue for offline writes the server refused, and the only place
// a decision about one can be applied.
export {
  conflictKeys,
  useConflicts,
  useConflict,
  useOpenConflictCount,
  useResolveConflict,
  type Conflict,
  type ConflictEntity,
  type FieldDivergence,
  type ResolutionChoice,
  type ResolveConflictInput,
} from './hooks/conflicts'

// ─── Separation of duties ─────────────────────────────────
export {
  governanceKeys,
  useSoD,
  useSoDOverrides,
  useSaveSoD,
  type SoDMode,
  type SoDRule,
  type SoDSettings,
  type SoDOverride,
} from './hooks/governance'
