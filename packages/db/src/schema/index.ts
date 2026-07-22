// packages/db/src/schema/index.ts
// ============================================
// Drizzle Schema — Hisabche v2.4
// ============================================

import {
  pgTable,
  uuid,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

/* ═══════════════════════════════════════════════════════════════
   ENUMS — Core
   ═══════════════════════════════════════════════════════════════ */

export const invoiceTypeEnum = pgEnum("invoice_type", ["sale", "purchase"]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "pending",
  "completed",
  "cancelled",
  "partial",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "credit",
  "bank",
  "mobile_money",
]);
export const transactionTypeEnum = pgEnum("transaction_type", [
  "sale",
  "purchase",
  "payment",
  "receipt",
  "return",
]);

/* ═══════════════════════════════════════════════════════════════
   ENUMS — Workflow v1.1
   ═══════════════════════════════════════════════════════════════ */

export const workflowStatusEnum = pgEnum("workflow_status", [
  "pending",
  "in_progress",
  "approved",
  "rejected",
  "cancelled",
]);

export const workflowActionEnum = pgEnum("workflow_action", [
  "approved",
  "rejected",
  "forwarded",
  "cancelled",
]);

/* ═══════════════════════════════════════════════════════════════
   TABLES — Core
   ═══════════════════════════════════════════════════════════════ */

export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceNumber: text("invoice_number").notNull(),
  type: invoiceTypeEnum("type").notNull().default("sale"),
  customerId: uuid("customer_id"),
  supplierId: uuid("supplier_id"),
  date: timestamp("date").notNull().defaultNow(),
  dueDate: timestamp("due_date"),
  subtotal: decimal("subtotal").notNull(),
  discountTotal: decimal("discount_total").default("0"),
  taxTotal: decimal("tax_total").default("0"),
  total: decimal("total").notNull(),
  paidAmount: decimal("paid_amount").default("0"),
  currency: text("currency").notNull().default("AFN"),
  paymentMethod: paymentMethodEnum("payment_method").default("cash"),
  status: invoiceStatusEnum("status").default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  syncedAt: timestamp("synced_at"),
});

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  barcode: text("barcode").default(""),
  sku: text("sku").default(""),
  category: text("category").default("general"),
  quantity: integer("quantity").default(0),
  unit: text("unit").default("piece"),
  buyPrice: decimal("buy_price").default("0"),
  sellPrice: decimal("sell_price").default("0"),
  wholesalePrice: decimal("wholesale_price").default("0"),
  minStockLevel: integer("min_stock_level").default(5),
  description: text("description").default(""),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  syncedAt: timestamp("synced_at"),
});

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  openingBalance: decimal("opening_balance").default("0"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  syncedAt: timestamp("synced_at"),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id"),
  supplierId: uuid("supplier_id"),
  type: transactionTypeEnum("type").notNull().default("sale"),
  amount: decimal("amount").notNull(),
  currency: text("currency").default("AFN"),
  description: text("description"),
  reference: text("reference"),
  date: timestamp("date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  syncedAt: timestamp("synced_at"),
});

/* ═══════════════════════════════════════════════════════════════
   TABLES — Workflow & Approval Engine v1.1
   ═══════════════════════════════════════════════════════════════ */

export const workflows = pgTable("workflows", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  entityType: text("entity_type").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const workflowSteps = pgTable("workflow_steps", {
  id: uuid("id").defaultRandom().primaryKey(),
  workflowId: uuid("workflow_id").notNull(),
  stepOrder: integer("step_order").notNull(),
  approverRole: text("approver_role").notNull(),
  approverUserId: uuid("approver_user_id"),
  isFinal: boolean("is_final").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const workflowInstances = pgTable("workflow_instances", {
  id: uuid("id").defaultRandom().primaryKey(),
  workflowId: uuid("workflow_id").notNull(),
  workspaceId: uuid("workspace_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  status: workflowStatusEnum("status").default("in_progress").notNull(),
  currentStep: integer("current_step").default(1).notNull(),
  totalSteps: integer("total_steps").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowActions = pgTable("workflow_actions", {
  id: uuid("id").defaultRandom().primaryKey(),
  instanceId: uuid("instance_id").notNull(),
  stepOrder: integer("step_order").notNull(),
  action: workflowActionEnum("action").notNull(),
  actorUserId: uuid("actor_user_id").notNull(),
  actorRole: text("actor_role"),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Relations ─────────────────────────────────────────────────────────────

export const invoiceRelations = {};

// ─── Types ─────────────────────────────────────────────────────────────────

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type Product = typeof products.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Workflow = typeof workflows.$inferSelect;
export type WorkflowStep = typeof workflowSteps.$inferSelect;
export type WorkflowInstance = typeof workflowInstances.$inferSelect;
export type WorkflowAction = typeof workflowActions.$inferSelect;