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
  percentageSchema,
  nonEmptyStringSchema,
  optionalStringSchema,
  paginationSchema,
} from './common.schema'

// ============================================
// Invoice Item
// ============================================

export const invoiceItemSchema = z.object({
  id: uuidSchema.optional(),
  productId: uuidSchema,
  productName: nonEmptyStringSchema,
  quantity: positiveNumberSchema,
  unitPrice: positiveNumberSchema,
  discount: percentageSchema.default(0),
  totalPrice: positiveNumberSchema,
  notes: optionalStringSchema,
})

export type InvoiceItem = z.infer<typeof invoiceItemSchema>

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
  customerName: nonEmptyStringSchema.optional(),
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

  // Status
  status: z.enum(['pending', 'completed', 'cancelled', 'partial']).default('pending'),

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

export type CreateInvoice = z.infer<typeof createInvoiceSchema>

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
  status: z.enum(['pending', 'completed', 'cancelled', 'partial']).optional(),
  customerId: uuidSchema.optional(),
  supplierId: uuidSchema.optional(),
  currency: currencyCodeSchema.optional(),
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional(),
  minTotal: positiveNumberSchema.optional(),
  maxTotal: positiveNumberSchema.optional(),
  ...paginationSchema.shape,
})

export type InvoiceFilters = z.infer<typeof invoiceFiltersSchema>