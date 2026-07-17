// ============================================
// backend/src/drizzle-schema.ts
// ============================================

import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  pgEnum,
  index,
  foreignKey,
} from 'drizzle-orm/pg-core'

/* ═══════════════════════════════════════════════════════════════
   ENUMS — Workflow v1.1
   ═══════════════════════════════════════════════════════════════ */

export const workflowStatusEnum = pgEnum('workflow_status', [
  'pending',
  'in_progress',
  'approved',
  'rejected',
  'cancelled',
])

export const workflowActionEnum = pgEnum('workflow_action', [
  'approved',
  'rejected',
  'forwarded',
  'cancelled',
])

// ─── Workspaces ─────────────────────────────────────────────
export const workspaces = pgTable('workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo: text('logo'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// ─── Products ─────────────────────────────────────────────
export const products = pgTable(
  'products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id').notNull(),
    name: text('name').notNull(),
    barcode: text('barcode').default(''),
    sku: text('sku').default(''),
    category: text('category').default('general'),
    quantity: integer('quantity').default(0),
    unit: text('unit').default('piece'),
    buyPrice: numeric('buy_price', { precision: 12, scale: 2 }).default('0'),
    sellPrice: numeric('sell_price', { precision: 12, scale: 2 }).default('0'),
    wholesalePrice: numeric('wholesale_price', { precision: 12, scale: 2 }).default('0'),
    minStockLevel: integer('min_stock_level').default(5),
    description: text('description').default(''),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    syncedAt: timestamp('synced_at'),
    userId: uuid('user_id'), // ✅ اضافه شد برای RLS و فیلتر
  },
  (table) => ({
    // ✅ Indexهای جدید
    workspaceIdx: index('products_workspace_idx').on(table.workspaceId),
    userIdIdx: index('products_user_id_idx').on(table.userId),
    createdAtIdx: index('products_created_at_idx').on(table.createdAt),
    categoryIdx: index('products_category_idx').on(table.category),
    skuIdx: index('products_sku_idx').on(table.sku),
    barcodeIdx: index('products_barcode_idx').on(table.barcode),
    workspaceFk: foreignKey({
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
    }),
  })
)

// ─── Customers ────────────────────────────────────────────
export const customers = pgTable(
  'customers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id').notNull(),
    fullName: text('full_name').notNull(),
    phone: text('phone').default(''),
    email: text('email').default(''),
    address: text('address').default(''),
    openingBalance: numeric('opening_balance', { precision: 12, scale: 2 }).default('0'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    syncedAt: timestamp('synced_at'),
    userId: uuid('user_id'), // ✅ اضافه شد
  },
  (table) => ({
    workspaceIdx: index('customers_workspace_idx').on(table.workspaceId),
    userIdIdx: index('customers_user_id_idx').on(table.userId),
    createdAtIdx: index('customers_created_at_idx').on(table.createdAt),
    phoneIdx: index('customers_phone_idx').on(table.phone),
    workspaceFk: foreignKey({
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
    }),
  })
)

// ─── Invoices ─────────────────────────────────────────────
export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id').notNull(),
    invoiceNumber: text('invoice_number').notNull(),
    type: text('type').notNull().default('sale'),
    customerId: uuid('customer_id'),
    supplierId: uuid('supplier_id'),
    date: timestamp('date').notNull().defaultNow(),
    dueDate: timestamp('due_date'),
    subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull().default('0'),
    discountTotal: numeric('discount_total', { precision: 12, scale: 2 }).default('0'),
    taxTotal: numeric('tax_total', { precision: 12, scale: 2 }).default('0'),
    total: numeric('total', { precision: 12, scale: 2 }).notNull().default('0'),
    paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).default('0'),
    currency: text('currency').notNull().default('AFN'),
    paymentMethod: text('payment_method').default('cash'),
    status: text('status').default('pending'),
    notes: text('notes').default(''),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    syncedAt: timestamp('synced_at'),
    userId: uuid('user_id'), // ✅ اضافه شد
  },
  (table) => ({
    // ✅ Indexهای کلیدی برای Performance
    workspaceIdx: index('invoices_workspace_idx').on(table.workspaceId),
    userIdIdx: index('invoices_user_id_idx').on(table.userId),
    customerIdx: index('invoices_customer_idx').on(table.customerId),
    createdAtIdx: index('invoices_created_at_idx').on(table.createdAt),
    updatedAtIdx: index('invoices_updated_at_idx').on(table.updatedAt),
    statusIdx: index('invoices_status_idx').on(table.status),
    invoiceNumberIdx: index('invoices_number_idx').on(table.invoiceNumber),
    dateIdx: index('invoices_date_idx').on(table.date),
    // ✅ Index ترکیبی برای فیلترهای رایج
    userStatusIdx: index('invoices_user_status_idx').on(table.userId, table.status),
    userCreatedIdx: index('invoices_user_created_idx').on(table.userId, table.createdAt),
    workspaceFk: foreignKey({
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
    }),
  })
)

// ─── Invoice Items ────────────────────────────────────────
export const invoiceItems = pgTable(
  'invoice_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    invoiceId: uuid('invoice_id').notNull(),
    productId: uuid('product_id').notNull(),
    productName: text('product_name').notNull(),
    quantity: numeric('quantity', { precision: 12, scale: 3 }).notNull().default('1'),
    unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull().default('0'),
    discount: numeric('discount', { precision: 5, scale: 2 }).default('0'),
    totalPrice: numeric('total_price', { precision: 12, scale: 2 }).notNull().default('0'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    invoiceIdx: index('invoice_items_invoice_idx').on(table.invoiceId),
    productIdx: index('invoice_items_product_idx').on(table.productId),
  })
)

// ─── Transactions ─────────────────────────────────────────
export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id').notNull(),
    customerId: uuid('customer_id'),
    supplierId: uuid('supplier_id'),
    type: text('type').notNull().default('sale'),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    currency: text('currency').default('AFN'),
    description: text('description').default(''),
    reference: text('reference').default(''),
    date: timestamp('date').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
    syncedAt: timestamp('synced_at'),
    userId: uuid('user_id'), // ✅ اضافه شد
  },
  (table) => ({
    workspaceIdx: index('transactions_workspace_idx').on(table.workspaceId),
    userIdIdx: index('transactions_user_id_idx').on(table.userId),
    customerIdx: index('transactions_customer_idx').on(table.customerId),
    createdAtIdx: index('transactions_created_at_idx').on(table.createdAt),
    dateIdx: index('transactions_date_idx').on(table.date),
    typeIdx: index('transactions_type_idx').on(table.type),
    workspaceFk: foreignKey({
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
    }),
  })
)

// ─── Exchange Rates ───────────────────────────────────────
export const exchangeRates = pgTable(
  'exchange_rates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    currencyCode: text('currency_code').notNull(),
    rate: numeric('rate', { precision: 12, scale: 6 }).notNull(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    currencyIdx: index('exchange_rates_currency_idx').on(table.currencyCode),
    updatedAtIdx: index('exchange_rates_updated_at_idx').on(table.updatedAt),
  })
)

/* ═══════════════════════════════════════════════════════════════
   WORKFLOW & APPROVAL ENGINE — v1.1
   ═══════════════════════════════════════════════════════════════ */

// ─── Workflows (Approval Templates) ───────────────────────
export const workflows = pgTable(
  'workflows',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    entityType: text('entity_type').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    workspaceIdx: index('workflows_workspace_idx').on(table.workspaceId),
    entityTypeIdx: index('workflows_entity_type_idx').on(table.entityType),
    isActiveIdx: index('workflows_is_active_idx').on(table.isActive),
    workspaceFk: foreignKey({
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
    }),
  })
)

// ─── Workflow Steps ────────────────────────────────────────
export const workflowSteps = pgTable(
  'workflow_steps',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workflowId: uuid('workflow_id').notNull(),
    stepOrder: integer('step_order').notNull(),
    approverRole: text('approver_role').notNull(),
    approverUserId: uuid('approver_user_id'),
    isFinal: boolean('is_final').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    workflowIdx: index('workflow_steps_workflow_idx').on(table.workflowId),
    approverIdx: index('workflow_steps_approver_idx').on(table.approverUserId),
  })
)

// ─── Workflow Instances ────────────────────────────────────
export const workflowInstances = pgTable(
  'workflow_instances',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workflowId: uuid('workflow_id').notNull(),
    workspaceId: uuid('workspace_id').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    status: workflowStatusEnum('status').default('in_progress').notNull(),
    currentStep: integer('current_step').default(1).notNull(),
    totalSteps: integer('total_steps').notNull(),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    workflowIdx: index('workflow_instances_workflow_idx').on(table.workflowId),
    workspaceIdx: index('workflow_instances_workspace_idx').on(table.workspaceId),
    statusIdx: index('workflow_instances_status_idx').on(table.status),
    entityIdx: index('workflow_instances_entity_idx').on(table.entityId),
    createdIdx: index('workflow_instances_created_idx').on(table.createdAt),
    workspaceFk: foreignKey({
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
    }),
  })
)

// ─── Workflow Actions ──────────────────────────────────────
export const workflowActions = pgTable(
  'workflow_actions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    instanceId: uuid('instance_id').notNull(),
    stepOrder: integer('step_order').notNull(),
    action: workflowActionEnum('action').notNull(),
    actorUserId: uuid('actor_user_id').notNull(),
    actorRole: text('actor_role'),
    comment: text('comment'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    instanceIdx: index('workflow_actions_instance_idx').on(table.instanceId),
    actorIdx: index('workflow_actions_actor_idx').on(table.actorUserId),
    createdIdx: index('workflow_actions_created_idx').on(table.createdAt),
  })
)

// ─── Export all tables ─────────────────────────────────────
export const allTables = {
  workspaces,
  products,
  customers,
  invoices,
  invoiceItems,
  transactions,
  exchangeRates,
  workflows,
  workflowSteps,
  workflowInstances,
  workflowActions,
}