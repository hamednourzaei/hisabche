// ============================================
// Hisabche Validation — Barrel Exports
// ============================================

// ---------- Common ----------
export {
  uuidSchema,
  emailSchema,
  phoneSchema,
  positiveNumberSchema,
  nonNegativeNumberSchema,
  percentageSchema,
  isoDateSchema,
  nonEmptyStringSchema,
  optionalStringSchema,
  currencyCodeSchema,
  paymentMethodSchema,
  transactionTypeSchema,
  productCategorySchema,
  unitSchema,
  sortDirectionSchema,
  paginationSchema,
  addressSchema,
  type Pagination,
  type Address,
} from './schemas/common.schema'

// ---------- Auth ----------
export {
  loginSchema,
  signUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  pinCodeSchema,
  updateProfileSchema,
  type LoginInput,
  type SignUpInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type PinCodeInput,
  type UpdateProfileInput,
} from './schemas/auth.schema'

// ---------- Invoice ----------
export {
  invoiceItemSchema,
  invoiceSchema,
  createInvoiceSchema,
  updateInvoiceSchema,
  invoiceFiltersSchema,
  type InvoiceItem,
  type Invoice,
  type CreateInvoice,
  type UpdateInvoice,
  type InvoiceFilters,
} from './schemas/invoice.schema'

// ---------- Product ----------
export {
  productSchema,
  createProductSchema,
  updateProductSchema,
  productFiltersSchema,
  type Product,
  type CreateProduct,
  type UpdateProduct,
  type ProductFilters,
} from './schemas/product.schema'

// ---------- Customer & Supplier ----------
export {
  customerSchema,
  createCustomerSchema,
  updateCustomerSchema,
  supplierSchema,
  createSupplierSchema,
  updateSupplierSchema,
  customerFiltersSchema,
  type Customer,
  type CreateCustomer,
  type UpdateCustomer,
  type Supplier,
  type CreateSupplier,
  type UpdateSupplier,
  type CustomerFilters,
} from './schemas/customer.schema'

export {
  transactionSchema,
  createTransactionSchema,
  transactionFiltersSchema,
  ledgerSummarySchema,
  type Transaction,
  type CreateTransaction,
  type TransactionFilters,
  type LedgerSummary,
} from './schemas/transaction.schema'

// ---------- Accounting ----------
export {
  accountSchema,
  createAccountSchema,
  updateAccountSchema,
  journalEntrySchema,
  createJournalEntrySchema,
  journalLineSchema,
  trialBalanceSchema,
  balanceSheetSchema,
  incomeStatementSchema,
  type Account,
  type CreateAccount,
  type UpdateAccount,
  type JournalEntry,
  type CreateJournalEntry,
  type JournalLine,
  type TrialBalance,
  type BalanceSheet,
  type IncomeStatement,
} from './schemas/accounting.schema'

// ---------- Godam (Inventory) ----------
export {
  godamSchema,
  createGodamSchema,
  updateGodamSchema,
  stockTransferSchema,      
  stockMovementSchema,
  type Godam,
  type CreateGodam,
  type UpdateGodam,
  type StockTransfer,       
  type StockMovement,
} from './schemas/godam.schema'

// ---------- CRM ----------
export {
  interactionSchema,
  createInteractionSchema,
  opportunitySchema,
  createOpportunitySchema,
  updateOpportunitySchema,
  type Interaction,
  type CreateInteraction,
  type Opportunity,
  type CreateOpportunity,
  type UpdateOpportunity,
} from './schemas/crm.schema'

// ============================================
// ✅ NEW — Purchasing (فاز ۱۳)
// ============================================
export {
  purchaseOrderSchema,
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  type PurchaseOrder,
  type CreatePurchaseOrder,
  type UpdatePurchaseOrder,
} from './schemas/purchasing.schema'

// ============================================
// ✅ NEW — Manufacturing (فاز ۱۴)
// ============================================
export {
  bomSchema,
  createBomSchema,
  updateBomSchema,
  workOrderSchema,
  createWorkOrderSchema,
  updateWorkOrderSchema,
  productionPlanSchema,
  createProductionPlanSchema,
  type BOM,
  type CreateBOM,
  type UpdateBOM,
  type WorkOrder,
  type CreateWorkOrder,
  type UpdateWorkOrder,
  type ProductionPlan,
  type CreateProductionPlan,
} from './schemas/manufacturing.schema'
// ============================================
// ✅ NEW — HR (فاز ۱۵)
// ============================================
export {
  departmentSchema,
  createDepartmentSchema,
  updateDepartmentSchema,
  employeeSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  attendanceSchema,
  createAttendanceSchema,
  updateAttendanceSchema,
  payrollSchema,
  createPayrollSchema,
  updatePayrollSchema,
  leaveSchema,
  createLeaveSchema,
  updateLeaveSchema,
  type Department,
  type CreateDepartment,
  type UpdateDepartment,
  type Employee,
  type CreateEmployee,
  type UpdateEmployee,
  type Attendance,
  type CreateAttendance,
  type UpdateAttendance,
  type Payroll,
  type CreatePayroll,
  type UpdatePayroll,
  type Leave,
  type CreateLeave,
  type UpdateLeave,
} from './schemas/hr.schema'
// ============================================

// ============================================
// ✅ NEW — Projects (فاز ۱۶)
// ============================================
export {
  projectSchema,
  createProjectSchema,
  updateProjectSchema,
  projectTaskSchema,
  createProjectTaskSchema,
  updateProjectTaskSchema,
  projectMemberSchema,
  createProjectMemberSchema,
  timeEntrySchema,
  createTimeEntrySchema,
  updateTimeEntrySchema,
  type Project,
  type CreateProject,
  type UpdateProject,
  type ProjectTask,
  type CreateProjectTask,
  type UpdateProjectTask,
  type ProjectMember,
  type CreateProjectMember,
  type TimeEntry,
  type CreateTimeEntry,
  type UpdateTimeEntry,
} from './schemas/project.schema'
// ============================================
// ✅ NEW — Workspace (فاز ۱۷)
// ============================================
export {
  workspaceSchema,
  createWorkspaceSchema,
  updateWorkspaceSchema,
  workspaceMemberSchema,
  createWorkspaceMemberSchema,
  updateMemberRoleSchema,
  workspaceInviteSchema,
  createInviteSchema,
  acceptInviteSchema,
  type Workspace,
  type CreateWorkspace,
  type UpdateWorkspace,
  type WorkspaceMember,
  type CreateWorkspaceMember,
  type UpdateMemberRole,
  type WorkspaceInvite,
  type CreateInvite,
  type AcceptInvite,
} from './schemas/workspace.schema'
// ============================================
// ✅ NEW — Permissions (فاز ۱۸)
// ============================================
export {
  permissionSchema,
  createPermissionSchema,
  roleSchema,
  createRoleSchema,
  updateRoleSchema,
  userRoleSchema,
  assignRoleSchema,
  removeRoleSchema,
  checkPermissionSchema,
  type Permission,
  type CreatePermission,
  type Role,
  type CreateRole,
  type UpdateRole,
  type UserRole,
  type AssignRole,
  type RemoveRole,
  type CheckPermission,
} from './schemas/permission.schema'
// ============================================
// ✅ NEW — Audit (فاز ۱۹)
// ============================================
export {
  auditLogSchema,
  createAuditLogSchema,
  auditFiltersSchema,
  auditStatsSchema,
  type AuditLog,
  type CreateAuditLog,
  type AuditFilters,
  type AuditStats,
} from './schemas/audit.schema'
// ============================================
// ✅ NEW — Sync (فاز ۲۰)
// ============================================
export {
  syncQueueItemSchema,
  createSyncQueueItemSchema,
  syncLogSchema,
  syncConfigSchema,
  networkStatusSchema,
  type SyncQueueItem,
  type CreateSyncQueueItem,
  type SyncLog,
  type SyncConfig,
  type NetworkStatus,
} from './schemas/sync.schema'
// ---------- Event (فاز ۲۱) ----------
export {
  eventTypeSchema,
  eventLogSchema,
  createEventLogSchema,
  EVENT_TYPE_CODES,
  type EventType,
  type EventLog,
  type CreateEventLog,
  type EventTypeCode,
} from './schemas/event.schema'
// ---------- Analytics (فاز ۲۲) ----------
export {
  dateRangeSchema,
  salesSummarySchema,
  inventorySummarySchema,
  financialSummarySchema,
  dashboardKpisSchema,
  type DateRange,
  type SalesSummary,
  type InventorySummary,
  type FinancialSummary,
  type DashboardKpis,
} from './schemas/analytics.schema'
// ---------- AI (فاز ۲۳) ----------
export {
  aiQuerySchema,
  aiResponseSchema,
  aiInsightSchema,
  aiChatMessageSchema,
  type AIQuery,
  type AIResponse,
  type AIInsight,
  type AIChatMessage,
} from './schemas/ai.schema'