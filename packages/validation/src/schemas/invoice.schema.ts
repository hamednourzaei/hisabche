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
   * @deprecated Components are always ADDITIVE — see `computeItemTotal`.
   * Kept optional only so a client still sending it does not fail validation.
   * The value is ignored.
   */
  detailsArePriced: z.boolean().optional(),
})

export type InvoiceItem = z.infer<typeof invoiceItemSchema>

/**
 * The one place the parent/detail money rule lives. Every totals path and any
 * UI preview must call this — never re-derive it inline.
 *
 * THE RULE — components ADD to the line:
 *
 *   line total = (quantity × unitPrice  +  Σ component.quantity × component.amount)
 *                × (1 − discount%)
 *
 * "قند ۲٬۰۰۰ + سنگ امیتیس ۱٬۰۰۰" totals 3,000, not 2,000. A necklace with no
 * price of its own is the same rule with a zero base: 0 + زنجیر + سنگ + اجرت.
 *
 * Backward compatible: an item with no components contributes an empty sum, so
 * every pre-existing invoice totals exactly as it always did.
 */
export function computeItemTotal(item: {
  quantity: number
  unitPrice: number
  discount?: number
  details?: readonly { quantity: number; amount: number }[]
}): number {
  const base = item.quantity * item.unitPrice
  const components = (item.details ?? []).reduce((sum, d) => sum + d.quantity * d.amount, 0)
  const gross = base + components

  const discount = item.discount ?? 0
  return gross - (gross * discount) / 100
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

/**
 * When an invoice was settled — the «تاریخ تسویه» column — or `null` while it
 * is still outstanding.
 *
 * The rule is that settlement is recorded by the `completed` transition, so the
 * timestamp of that transition is the settlement date. Any other status has no
 * settlement date, and showing `updatedAt` for one would date a settlement that
 * has not happened.
 *
 * Returns the raw ISO string; each platform formats it with its own calendar
 * helper. Lives here so the invoice list, the mobile card and any export agree
 * on which invoices count as settled.
 */
export function settlementDate(invoice: {
  status?: string | null | undefined
  /** J3 — the settlement dimension, derived from payment_allocations. */
  settlementStatus?: string | null | undefined
  updatedAt?: string | null | undefined
}): string | null {
  // ⚠️ J3 — `settlementStatus` FIRST, `status` only as a fallback.
  //
  // This read `status === 'completed'`, which worked by accident:
  // `invoice.service.create()` writes `completed` when `paidAmount >= total`,
  // so a DOCUMENT word was standing in for a settlement fact. Any invoice that
  // became fully paid LATER — through a payment allocation rather than at
  // creation — never got `completed`, and this returned null for it. A
  // settled invoice with no settlement date.
  //
  // `settlement_status` is maintained by trigger from the allocations
  // themselves (Phase F), so it is right whenever the money arrived.
  //
  // The old branch stays because rows written before Phase F have no
  // `settlement_status`, and dropping it would lose their date entirely.
  if (invoice.settlementStatus === 'paid') return invoice.updatedAt ?? null
  if (invoice.settlementStatus) return null

  if (invoice.status !== 'completed') return null
  return invoice.updatedAt ?? null
}

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
  /**
   * ⚠️ THIS IS AN INSTRUCTION, NOT A STORED VALUE (T9).
   *
   * `invoices.paid_amount` is DERIVED from `SUM(payment_allocations)`. Phase F
   * closed the PATCH path that wrote it directly, but the CREATE path kept
   * writing `paid_amount: data.paidAmount || 0` — a second writer on a derived
   * number. The result showed up on a real sale as:
   *
   *   «مبلغ پرداخت‌شده‌ی ثبت‌شده روی فاکتور با مجموع پرداخت‌ها یکی نیست»
   *
   * with `paid_amount` set and not one `payment_allocations` row behind it.
   *
   * The field is kept because clients send it and it expresses a real
   * intention — «this was paid at the counter». What changed is what the
   * server does with it: it now RECORDS A PAYMENT and lets `paid_amount`
   * follow, instead of stamping the number.
   */
  paidAmount: nonNegativeNumberSchema.default(0),

  /**
   * How the money arrived, when it was more than one way — «۵۰۰ نقد، بقیه
   * کارت». Omit it for a single method and `paymentMethod` covers it.
   *
   * Each entry becomes its OWN payment record. One payment row carrying a
   * blended method would make the cash-drawer and bank reconciliations both
   * wrong, and neither could be repaired from the data afterwards.
   */
  payments: z
    .array(
      z.object({
        method: paymentMethodSchema,
        amount: positiveNumberSchema,
        reference: z.string().max(120).optional(),
      }),
    )
    .optional(),

  /**
   * ⚠️ INSTALMENTS ARE NOT ACCEPTED HERE, DELIBERATELY (T9 — STOP CONDITION).
   *
   * The owner asked for «قسطی». There is nowhere to put it: no instalments
   * table, no due-schedule column, nothing in the codebase that stores a
   * payment plan. `invoices.due_date` holds ONE date, which is a single
   * deadline and not a schedule.
   *
   * A field accepted here and dropped on the floor — or a picker on
   * /invoices/new that saves nothing — is the UI-theatre guardrail exactly.
   * The person would enter a plan, see it accepted, and it would not exist.
   *
   * What it needs first is a product decision, not code:
   *   · does an instalment generate its own receivable, or is it a view of
   *     one invoice's balance?
   *   · does a missed instalment change the invoice's status?
   *   · is a late fee charged, and does it post to the ledger?
   *
   * Until those are answered, PARTIAL PAYMENT covers the real case: record
   * what was actually paid, and the remainder stays outstanding.
   */

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

  /**
   * H1 — «still owed on», the predicate behind the «بدهی مشتریان» KPI.
   *
   * Not expressible with `status` alone: the rule is a NEGATION («anything but
   * fully paid»), and a status added later must fall on the outstanding side
   * automatically. The rule itself lives in
   * `backend/src/services/invoices/outstanding.domain.ts`, shared with the KPI
   * so the list and the number that opens it cannot drift apart.
   *
   * ⚠️ Parsed from a STRING, not `z.coerce.boolean()`. Coercion makes the
   * string "false" truthy, so `?outstanding=false` would filter — the opposite
   * of what it says. Only the affirmative spellings turn it on.
   */
  outstanding: z
    .union([z.boolean(), z.string()])
    .transform((value) =>
      typeof value === 'boolean' ? value : ['true', '1', 'yes'].includes(value.toLowerCase()),
    )
    .optional(),
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
