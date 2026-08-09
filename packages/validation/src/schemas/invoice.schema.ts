// ============================================
// Invoice Schemas
// ============================================

import { z } from 'zod'
import {
  uuidSchema,
  currencyCodeSchema,
  paymentMethodSchema,
  isoDateSchema,
  positiveNumberSchema,
  nonNegativeNumberSchema,
  unitSchema,
  unitLabelSchema,
  percentageSchema,
  nonEmptyStringSchema,
  optionalStringSchema,
} from './common.schema'

// ============================================
// Invoice Item
// ============================================

/**
 * A component of a parent item — "گردنبند" made of زنجیر / سنگ / اجرت.
 *
 * A detail is NOT an independent invoice line. It belongs to exactly one
 * invoice item and disappears with it.
 *
 * `amount` is the money for this component. Whether it contributes to the
 * parent's total is decided by `detailsArePriced` on the parent — see there.
 */
export const invoiceItemDetailSchema = z.object({
  id: uuidSchema.optional(),
  title: nonEmptyStringSchema,
  quantity: positiveNumberSchema.default(1),
  amount: nonNegativeNumberSchema.default(0),
  unit: unitSchema.default('piece'),
  /** Only used when `unit === 'custom'` — the label the user typed. */
  unitLabel: unitLabelSchema.optional(),
  /** Weight is tracked separately from quantity — see the parent item. */
  weightGrams: nonNegativeNumberSchema.optional(),
  /** Preserves the order the user typed the details in. */
  sortOrder: z.number().int().nonnegative().default(0),
})

export type InvoiceItemDetail = z.infer<typeof invoiceItemDetailSchema>

export const invoiceItemSchema = z.object({
  id: uuidSchema.optional(),
  // اختیاری: آیتم با نام دلخواه (بدون محصول واقعی از انبار، مثلاً خدمات) productId ندارد
  productId: uuidSchema.optional(),
  productName: nonEmptyStringSchema,
  quantity: positiveNumberSchema,
  unit: unitSchema.default('piece'),
  /** Only used when `unit === 'custom'` — the label the user typed. */
  unitLabel: unitLabelSchema.optional(),
  /**
   * Weight is deliberately NOT the same field as `quantity`.
   * "1 necklace weighing 12.5 g" is quantity=1, weightGrams=12.5.
   * "10 grams of gold" is quantity=10, unit='gram'.
   * Collapsing the two would make one of the numbers wrong.
   */
  weightGrams: nonNegativeNumberSchema.optional(),
  unitPrice: positiveNumberSchema,
  discount: percentageSchema.default(0),
  totalPrice: positiveNumberSchema,
  notes: optionalStringSchema,

  /**
   * Optional components. An empty array is a completely valid item — a simple
   * sale must never be forced to open or fill this.
   */
  details: z.array(invoiceItemDetailSchema).default([]),

  /**
   * How details participate in money.
   *
   * false (default) — details are INFORMATIONAL. The line total stays
   *   `quantity × unitPrice`, exactly as it is today. Existing invoices and
   *   every current total keep their meaning.
   * true — the line total is the SUM of the detail amounts, and `unitPrice`
   *   is derived from it. For a hand-made item priced up from its parts.
   *
   * Defaulting to false is what makes this change backward compatible: no
   * existing invoice can be re-totalled by adding this field.
   */
  detailsArePriced: z.boolean().default(false),
})

export type InvoiceItem = z.infer<typeof invoiceItemSchema>

/**
 * The one place the parent/detail money rule lives. Both totals paths and any
 * UI preview must call this — never re-derive it inline.
 */
export function computeItemTotal(item: {
  quantity: number
  unitPrice: number
  discount?: number
  details?: readonly { quantity: number; amount: number }[]
  detailsArePriced?: boolean
}): number {
  const base = item.detailsArePriced
    ? (item.details ?? []).reduce((sum, d) => sum + d.quantity * d.amount, 0)
    : item.quantity * item.unitPrice

  const discount = item.discount ?? 0
  return base - (base * discount) / 100
}

// ============================================
// Invoice Status — ✅ اضافه کردن "paid" و "overdue"
// ============================================

export const invoiceStatusSchema = z.enum([
  'pending',
  'paid', // ✅ اضافه شد
  'completed', // ✅ اضافه شد
  'cancelled',
  'partial',
  'overdue', // ✅ اضافه شد
])

export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>

// ============================================
// Invoice
// ============================================

export const invoiceSchema = z.object({
  id: uuidSchema.optional(),
  invoiceNumber: z.string().min(1),
  type: z.enum(['sale', 'purchase']),
  date: isoDateSchema,
  dueDate: isoDateSchema.optional(),

  // Customer/Supplier
  customerId: uuidSchema.optional(),
  supplierId: uuidSchema.optional(),
  supplierName: nonEmptyStringSchema.optional(),

  // Items
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),

  // Financial
  subtotal: positiveNumberSchema,
  discountTotal: nonNegativeNumberSchema.default(0),
  discountType: z.enum(['percentage', 'fixed']).default('fixed'),
  taxRate: percentageSchema.default(0),
  taxTotal: nonNegativeNumberSchema.default(0),
  total: positiveNumberSchema,

  // Payment
  paidAmount: nonNegativeNumberSchema.default(0),
  paymentMethod: paymentMethodSchema.default('cash'),
  currency: currencyCodeSchema.default('AFN'),

  // Status — ✅ استفاده از invoiceStatusSchema
  status: invoiceStatusSchema.default('pending'),

  // Additional
  notes: optionalStringSchema,
  reference: optionalStringSchema,
  createdAt: isoDateSchema.optional(),
  updatedAt: isoDateSchema.optional(),
})

export type Invoice = z.infer<typeof invoiceSchema>

// ============================================
// Create Invoice (omits generated fields)
// ============================================

export const createInvoiceSchema = invoiceSchema.omit({
  id: true,
  invoiceNumber: true,
  createdAt: true,
  updatedAt: true,
  status: true,
})

/**
 * `z.input`, not `z.infer`.
 *
 * `infer` gives the OUTPUT type, in which every `.default()` field is
 * required — so adding `unit`, `details` and `detailsArePriced` with defaults
 * would force every existing caller to supply them. `input` is what a caller
 * actually has to send: the defaulted fields stay optional and existing call
 * sites keep compiling unchanged. The server still parses with the schema, so
 * the defaults are applied there.
 */
export type CreateInvoice = z.input<typeof createInvoiceSchema>

/** The parsed, defaults-applied shape the server works with. */
export type CreateInvoiceParsed = z.infer<typeof createInvoiceSchema>

// ============================================
// Update Invoice (all fields optional)
// ============================================

export const updateInvoiceSchema = invoiceSchema.partial().extend({
  id: uuidSchema,
})

export type UpdateInvoice = z.infer<typeof updateInvoiceSchema>

// ============================================
// Invoice Filters
// ============================================

export const invoiceFiltersSchema = z.object({
  search: z.string().optional(),
  type: z.enum(['sale', 'purchase']).optional(),
  status: invoiceStatusSchema.optional(), // ✅ استفاده از invoiceStatusSchema
  customerId: uuidSchema.optional(),
  supplierId: uuidSchema.optional(),
  currency: currencyCodeSchema.optional(),
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional(),
  minTotal: z
    .union([z.number(), z.string()])
    .transform((val) => (typeof val === 'string' ? parseFloat(val) : val))
    .optional(),
  maxTotal: z
    .union([z.number(), z.string()])
    .transform((val) => (typeof val === 'string' ? parseFloat(val) : val))
    .optional(),
  page: z
    .union([z.number(), z.string()])
    .transform((val) => (typeof val === 'string' ? parseInt(val, 10) : val))
    .optional(),
  limit: z
    .union([z.number(), z.string()])
    .transform((val) => (typeof val === 'string' ? parseInt(val, 10) : val))
    .default(20),
  sortBy: z.string().optional(),
  sortDirection: z.enum(['asc', 'desc']).optional().default('desc'),
  cursor: z.string().optional(),
})

export type InvoiceFilters = z.infer<typeof invoiceFiltersSchema>
