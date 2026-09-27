// ============================================
// Hisabche Validation — Barrel Exports v2.0
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
  CURRENCY_CODES,
  currencyCodeSchema,
  paymentMethodSchema,
  paymentMethodLabelSchema,
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

export { profitPerUnit, totalProfit, stockValue } from './schemas/product.schema'
export { derivePartyRole, partyRoleLabelKey, type PartyRole } from './schemas/customer.schema'

// ---------- Invoice ----------
export {
  invoiceItemSchema,
  invoiceItemDetailSchema,
  computeItemTotal,
  computeInvoiceMoney,
  emptyPaymentValue,
  paidAmountOf,
  paymentEntriesOf,
  type PaymentEntry,
  tranchesTotal,
  settlementDate,
  invoiceSchema,
  createInvoiceSchema,
  updateInvoiceSchema,
  invoiceFiltersSchema,
  invoiceStatusSchema,
  type InvoiceStatus,
  type InvoiceItem,
  type InvoiceItemDetail,
  type Invoice,
  type CreateInvoice,
  type UpdateInvoice,
  type InvoiceFilters,
} from './schemas/invoice.schema'

// ---------- Invoice builder grid (generic, trade-agnostic) ----------
export {
  COLUMN,
  COLUMN_TYPES,
  canAggregate,
  columnCountsInTotal,
  canDeleteColumn,
  columnTotals,
  currencyPrecision,
  customColumnId,
  defaultColumns,
  emptyRow,
  hasCellValue,
  isBuiltinColumn,
  isForeignMoneyColumn,
  isRowFilled,
  isRowSubmittable,
  moveColumn,
  parseCellNumber,
  roundTo,
  rowDiscountPercent,
  rowExtraMoney,
  rowExtraPercent,
  rowQuantity,
  rowTaxPercent,
  rowToInvoiceItem,
  rowTotal,
  rowUnitPrice,
  summarize,
  toInvoiceCurrency,
  validateGrid,
  visibleColumns,
  type BuiltinColumnId,
  type GridMoneyContext,
  type GridValidationIssue,
  type InvoiceColumn,
  type InvoiceColumnType,
  type InvoiceGridRow,
  type InvoiceSummary,
  type InvoiceSummaryInput,
  type MappedInvoiceItem,
} from './schemas/invoice-grid'

// ---------- Sync protocol (local-first push/pull) ----------
export {
  syncEntitySchema,
  syncOperationSchema,
  syncCursorSchema,
  syncMutationSchema,
  syncPushRequestSchema,
  syncPushResponseSchema,
  syncMutationResultSchema,
  syncErrorCodeSchema,
  syncPullRequestSchema,
  syncPullResponseSchema,
  syncChangeSchema,
  syncLeaseRequestSchema,
  syncLeaseResponseSchema,
  isRetryable,
  RETRYABLE_ERRORS,
  MAX_PUSH_BATCH,
  MAX_PULL_PAGE,
  LEASE_TTL_SECONDS,
  type SyncEntity,
  type SyncOperation,
  type SyncMutation,
  type SyncPushRequest,
  type SyncPushResponse,
  type SyncMutationResult,
  type SyncErrorCode,
  type SyncPullRequest,
  type SyncPullResponse,
  type SyncChange,
  type SyncLeaseRequest,
  type SyncLeaseResponse,
} from './schemas/sync-protocol.schema'

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

// ---------- Transaction ----------
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
  accountRootTypes,
  accountRoles,
  createAccountSchema,
  updateAccountSchema,
  journalEntrySchema,
  journalEntryStatuses,
  createJournalEntrySchema,
  journalLineSchema,
  reverseJournalEntrySchema,
  periodLockSchema,
  trialBalanceSchema,
  trialBalanceRowSchema,
  balanceSheetSchema,
  incomeStatementSchema,
  type Account,
  type AccountRole,
  type CreateAccount,
  type UpdateAccount,
  type JournalEntry,
  type JournalEntryStatus,
  type CreateJournalEntry,
  type JournalLine,
  type ReverseJournalEntry,
  type PeriodLock,
  type TrialBalance,
  type TrialBalanceRow,
  type BalanceSheet,
  type IncomeStatement,
} from './schemas/accounting.schema'

// ---------- Warehouse ----------
export {
  warehouseSchema,
  createwarehouseSchema,
  updatewarehouseSchema,
  stockTransferSchema,
  stockMovementSchema,
  type warehouse,
  type CreateGodam,
  type UpdateGodam,
  type StockTransfer,
  type StockMovement,
} from './schemas/warehouse.schema'

// ---------- CRM ----------
export {
  interactionSchema,
  createInteractionSchema,
  updateInteractionStatusSchema,
  publicUpdateTaskStatusSchema,
  recordCustomerOutcomeSchema,
  customerOutcomeSchema,
  opportunitySchema,
  createOpportunitySchema,
  updateOpportunitySchema,
  type Interaction,
  type CreateInteraction,
  type UpdateInteractionStatus,
  type PublicUpdateTaskStatus,
  type RecordCustomerOutcome,
  type CustomerOutcome,
  type Opportunity,
  type CreateOpportunity,
  type UpdateOpportunity,
} from './schemas/crm.schema'

// ---------- Purchasing ----------
export {
  purchaseOrderSchema,
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  type PurchaseOrder,
  type CreatePurchaseOrder,
  type UpdatePurchaseOrder,
} from './schemas/purchasing.schema'

// ---------- Manufacturing ----------
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

// ---------- HR ----------
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
} from './schemas/human-resources.schema'

// ---------- Projects ----------
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

// ---------- Workspace ----------
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
  createMemberDirectBodySchema,
  setMemberSuspensionSchema,
  MAX_WORKSPACE_MEMBERS,
  type Workspace,
  type CreateWorkspace,
  type UpdateWorkspace,
  type WorkspaceMember,
  type CreateWorkspaceMember,
  type UpdateMemberRole,
  type WorkspaceInvite,
  type CreateInvite,
  type AcceptInvite,
  type CreateMemberDirect,
  type CreateMemberDirectBody,
  type SetMemberSuspension,
} from './schemas/workspace.schema'

// ---------- Permissions ----------
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

// ---------- Audit ----------
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

// ---------- Sync ----------
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

// ---------- Event ----------
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

// ---------- Analytics ----------
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

// ---------- AI ----------
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

// ---------- Workflow ----------
export {
  workflowStatusEnum,
  workflowActionEnum,
  entityTypeEnum,
  approverRoleEnum,
  workflowStepSchema,
  createWorkflowSchema,
  updateWorkflowSchema,
  workflowSchema,
  createWorkflowInstanceSchema,
  workflowInstanceSchema,
  createWorkflowActionSchema,
  workflowActionSchema,
  workflowFiltersSchema,
  instanceFiltersSchema,
  type WorkflowStatus,
  type WorkflowAction,
  type EntityType,
  type ApproverRole,
  type CreateWorkflowInput,
  type UpdateWorkflowInput,
  type Workflow,
  type CreateWorkflowInstanceInput,
  type WorkflowInstance,
  type CreateWorkflowActionInput,
  type WorkflowActionRecord,
  type WorkflowFilters,
  type InstanceFilters,
} from './schemas/workflow.schema'

// ---------- Notifications ----------
export {
  notificationTypeEnum,
  createNotificationSchema,
  notificationSchema,
  notificationFiltersSchema,
  markReadSchema,
  type NotificationType,
  type CreateNotificationInput,
  type Notification,
  type NotificationFilters,
} from './schemas/notification.schema'

// ---------- ✅ Activity ----------
export {
  activityTypeEnum,
  activityActionEnum,
  activityImportanceEnum,
  createActivitySchema,
  activityFiltersSchema,
  type CreateActivityInput,
  type ActivityFilters,
} from './schemas/activity.schema'

// ---------- Job ----------
export {
  jobStatusEnum,
  createJobSchema,
  jobSchema,
  type JobStatus,
  type CreateJobInput,
  type Job,
} from './schemas/job.schema'

// ---------- Billing ----------
export {
  planEnum,
  subscriptionStatusEnum,
  subscriptionSchema,
  usageLimitsSchema,
  planFeaturesSchema,
  checkoutSchema,
  stripeWebhookSchema,
  type Plan,
  type SubscriptionStatus,
  type Subscription,
  type UsageLimits,
  type PlanFeatures,
  type CheckoutInput,
  type StripeWebhook,
} from './schemas/billing.schema'

export type { InvoicePaymentValue, PaymentMode, PaymentTranche } from './schemas/invoice.schema'

// ---------- Blog ----------
export {
  BLOG_LOCALES,
  BLOG_POST_STATUSES,
  BLOG_COMMENT_STATUSES,
  BLOG_FONT_FAMILIES,
  BLOG_FONT_SIZES,
  BLOG_FOLLOWED_SECTIONS,
  BLOG_SLUG_PATTERN,
  BLOG_RESERVED_SLUGS,
  BLOG_IMAGE_MIME_TYPES,
  BLOG_IMAGE_MAX_BYTES,
  SEO_MIN_WORDS,
  SEO_MIN_INTERNAL_LINKS,
  SEO_META_TITLE,
  SEO_META_DESCRIPTION,
  SEO_MAX_AVG_SENTENCE_WORDS,
  blogLocaleSchema,
  blogSlugSchema,
  blogFaqItemSchema,
  blogPostInputSchema,
  blogCommentInputSchema,
  blogReactionSchema,
  blogRatingSchema,
  blogTaxonomyInputSchema,
  blogImageUploadSchema,
  blogCommentModerationSchema,
  seoChecklist,
  CLAIMS_NOT_IN_PRODUCT,
  CAPABILITIES_NOT_IN_PRODUCT,
  UNSOURCED_METRICS,
  claimsNotInProduct,
  isInternalHref,
  htmlToText,
  countWords,
  normalizeForMatch,
  type BlogLocale,
  type BlogPostStatus,
  type BlogCommentStatus,
  type BlogFontFamilyKey,
  type BlogFaqItem,
  type BlogPostInput,
  type BlogCommentInput,
  type BlogTaxonomyInput,
  type SeoChecklistInput,
  type SeoCheck,
  type SeoCheckId,
} from './schemas/blog.schema'

export { BARCODE_MAX_LENGTH, barcodeSchema, normalizeBarcode } from './schemas/barcode.schema'
