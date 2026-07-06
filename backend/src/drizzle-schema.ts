import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  pgEnum,
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

// ─── Products ─────────────────────────────────────────────
export const products = pgTable('products', {
  id:            uuid('id').defaultRandom().primaryKey(),
  name:          text('name').notNull(),
  barcode:       text('barcode').default(''),
  sku:           text('sku').default(''),
  category:      text('category').default('general'),
  quantity:      integer('quantity').default(0),
  unit:          text('unit').default('piece'),
  buyPrice:      numeric('buy_price', { precision: 12, scale: 2 }).default('0'),
  sellPrice:     numeric('sell_price', { precision: 12, scale: 2 }).default('0'),
  wholesalePrice:numeric('wholesale_price', { precision: 12, scale: 2 }).default('0'),
  minStockLevel: integer('min_stock_level').default(5),
  description:   text('description').default(''),
  isActive:      boolean('is_active').default(true),
  createdAt:     timestamp('created_at').defaultNow(),
  updatedAt:     timestamp('updated_at').defaultNow(),
  syncedAt:      timestamp('synced_at'),
})

// ─── Customers ────────────────────────────────────────────
export const customers = pgTable('customers', {
  id:             uuid('id').defaultRandom().primaryKey(),
  fullName:       text('full_name').notNull(),
  phone:          text('phone').default(''),
  email:          text('email').default(''),
  address:        text('address').default(''),
  openingBalance: numeric('opening_balance', { precision: 12, scale: 2 }).default('0'),
  isActive:       boolean('is_active').default(true),
  createdAt:      timestamp('created_at').defaultNow(),
  updatedAt:      timestamp('updated_at').defaultNow(),
  syncedAt:       timestamp('synced_at'),
})

// ─── Invoices ─────────────────────────────────────────────
export const invoices = pgTable('invoices', {
  id:            uuid('id').defaultRandom().primaryKey(),
  invoiceNumber: text('invoice_number').notNull(),
  type:          text('type').notNull().default('sale'),
  customerId:    uuid('customer_id'),
  supplierId:    uuid('supplier_id'),
  date:          timestamp('date').notNull().defaultNow(),
  dueDate:       timestamp('due_date'),
  subtotal:      numeric('subtotal', { precision: 12, scale: 2 }).notNull().default('0'),
  discountTotal: numeric('discount_total', { precision: 12, scale: 2 }).default('0'),
  taxTotal:      numeric('tax_total', { precision: 12, scale: 2 }).default('0'),
  total:         numeric('total', { precision: 12, scale: 2 }).notNull().default('0'),
  paidAmount:    numeric('paid_amount', { precision: 12, scale: 2 }).default('0'),
  currency:      text('currency').notNull().default('AFN'),
  paymentMethod: text('payment_method').default('cash'),
  status:        text('status').default('pending'),
  notes:         text('notes').default(''),
  createdAt:     timestamp('created_at').defaultNow(),
  updatedAt:     timestamp('updated_at').defaultNow(),
  syncedAt:      timestamp('synced_at'),
})

// ─── Invoice Items ────────────────────────────────────────
export const invoiceItems = pgTable('invoice_items', {
  id:          uuid('id').defaultRandom().primaryKey(),
  invoiceId:   uuid('invoice_id').notNull(),
  productId:   uuid('product_id').notNull(),
  productName: text('product_name').notNull(),
  quantity:    numeric('quantity', { precision: 12, scale: 3 }).notNull().default('1'),
  unitPrice:   numeric('unit_price', { precision: 12, scale: 2 }).notNull().default('0'),
  discount:    numeric('discount', { precision: 5, scale: 2 }).default('0'),
  totalPrice:  numeric('total_price', { precision: 12, scale: 2 }).notNull().default('0'),
  createdAt:   timestamp('created_at').defaultNow(),
})

// ─── Transactions ─────────────────────────────────────────
export const transactions = pgTable('transactions', {
  id:          uuid('id').defaultRandom().primaryKey(),
  customerId:  uuid('customer_id'),
  supplierId:  uuid('supplier_id'),
  type:        text('type').notNull().default('sale'),
  amount:      numeric('amount', { precision: 12, scale: 2 }).notNull(),
  currency:    text('currency').default('AFN'),
  description: text('description').default(''),
  reference:   text('reference').default(''),
  date:        timestamp('date').defaultNow(),
  createdAt:   timestamp('created_at').defaultNow(),
  syncedAt:    timestamp('synced_at'),
})

// ─── Exchange Rates ───────────────────────────────────────
export const exchangeRates = pgTable('exchange_rates', {
  id:           uuid('id').defaultRandom().primaryKey(),
  currencyCode: text('currency_code').notNull(),
  rate:         numeric('rate', { precision: 12, scale: 6 }).notNull(),
  updatedAt:    timestamp('updated_at').defaultNow(),
})

/* ═══════════════════════════════════════════════════════════════
   WORKFLOW & APPROVAL ENGINE — v1.1 (ماژول ۱)
   ═══════════════════════════════════════════════════════════════ */

// ─── Workflows (Approval Templates) ───────────────────────
export const workflows = pgTable('workflows', {
  id:          uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull(),
  name:        text('name').notNull(),
  description: text('description'),
  entityType:  text('entity_type').notNull(), // 'invoice' | 'purchase_order' | 'expense'
  isActive:    boolean('is_active').default(true).notNull(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
  deletedAt:   timestamp('deleted_at'),
})

// ─── Workflow Steps (Template steps in order) ─────────────
export const workflowSteps = pgTable('workflow_steps', {
  id:             uuid('id').defaultRandom().primaryKey(),
  workflowId:     uuid('workflow_id').notNull(),
  stepOrder:      integer('step_order').notNull(),
  approverRole:   text('approver_role').notNull(), // 'sales_manager' | 'finance_manager' | 'ceo' | 'admin'
  approverUserId: uuid('approver_user_id'),
  isFinal:        boolean('is_final').default(false).notNull(),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
})

// ─── Workflow Instances (Running approvals) ───────────────
export const workflowInstances = pgTable('workflow_instances', {
  id:           uuid('id').defaultRandom().primaryKey(),
  workflowId:   uuid('workflow_id').notNull(),
  workspaceId:  uuid('workspace_id').notNull(),
  entityType:   text('entity_type').notNull(), // 'invoice'
  entityId:     uuid('entity_id').notNull(),    // invoice.id
  status:       workflowStatusEnum('status').default('in_progress').notNull(),
  currentStep:  integer('current_step').default(1).notNull(),
  totalSteps:   integer('total_steps').notNull(),
  startedAt:    timestamp('started_at').defaultNow().notNull(),
  completedAt:  timestamp('completed_at'),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
})

// ─── Workflow Actions (Approval history) ──────────────────
export const workflowActions = pgTable('workflow_actions', {
  id:          uuid('id').defaultRandom().primaryKey(),
  instanceId:  uuid('instance_id').notNull(),
  stepOrder:   integer('step_order').notNull(),
  action:      workflowActionEnum('action').notNull(),
  actorUserId: uuid('actor_user_id').notNull(),
  actorRole:   text('actor_role'),
  comment:     text('comment'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
})