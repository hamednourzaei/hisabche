import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core'

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