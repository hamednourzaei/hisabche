// ============================================
// Customer & Supplier Schemas
// ============================================

import { z } from 'zod'
import {
  uuidSchema,
  emailSchema,
  phoneSchema,
  nonEmptyStringSchema,
  optionalStringSchema,
  addressSchema,
} from './common.schema'

// ============================================
// Customer
// ============================================

export const customerSchema = z.object({
  id: uuidSchema.optional(),
  fullName: nonEmptyStringSchema,
  phone: phoneSchema.optional(),
  email: emailSchema.optional().or(z.literal('')),
  address: addressSchema.optional(),
  notes: optionalStringSchema,
  openingBalance: z.number().default(0),
  isActive: z.boolean().default(true),
  type: z.enum(['cash', 'credit']).default('cash'), // ✅ جدید
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
})

export type Customer = z.infer<typeof customerSchema>

// ============================================
// Create Customer
// ============================================

export const createCustomerSchema = customerSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export type CreateCustomer = z.infer<typeof createCustomerSchema>

// ============================================
// Update Customer
// ============================================

export const updateCustomerSchema = customerSchema.partial().extend({
  id: uuidSchema,
})

export type UpdateCustomer = z.infer<typeof updateCustomerSchema>

// ============================================
// Supplier (same structure as Customer)
// ============================================

export const supplierSchema = customerSchema

export type Supplier = z.infer<typeof supplierSchema>

export const createSupplierSchema = createCustomerSchema

export type CreateSupplier = z.infer<typeof createSupplierSchema>

export const updateSupplierSchema = updateCustomerSchema

export type UpdateSupplier = z.infer<typeof updateSupplierSchema>

// ============================================
// Customer Filters
// ============================================

// ============================================
// Customer Filters — اضافه کردن cursor
// ============================================

export const customerFiltersSchema = z.object({
  /**
   * Filter by the party's DERIVED transaction role.
   *
   * Not stored on the customer:  already means payment terms
   * (cash|credit). The role comes from whether the party appears on sale or
   * purchase invoices, so one person is never duplicated into two records.
   * A 'both' party matches either filter.
   */
  role: z.enum(['buyer', 'seller']).optional(),
  search: z.string().optional(),
  isActive: z
    .union([z.boolean(), z.string()])
    .transform((val) => (typeof val === 'string' ? val === 'true' : val))
    .optional(),
  hasBalance: z
    .union([z.boolean(), z.string()])
    .transform((val) => (typeof val === 'string' ? val === 'true' : val))
    .optional(),
  type: z.enum(['cash', 'credit']).optional(),
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
  // ✅ اضافه شد
  cursor: z.string().optional(),
})

export type CustomerFilters = z.infer<typeof customerFiltersSchema>

// ============================================
// Party role — derived, never stored.
//
// `customers.type` is cash|credit — payment terms — and must not be repurposed
// to mean buyer/seller. A party's role comes from the direction of its
// invoices, so the same person can be both without being duplicated into two
// records just to carry a label.
// ============================================

export type PartyRole = 'buyer' | 'seller' | 'both' | 'none'

/**
 * Which side of the ledger this party has actually been on.
 *
 * A sale means they bought from us (buyer); a purchase means they sold to us
 * (seller). Doing both is common — a shop that buys gold from a jeweller and
 * later sells them a display case — and must read as `both`, not as whichever
 * invoice happened to come first.
 */
export function derivePartyRole(invoices: ReadonlyArray<{ type?: string | null }>): PartyRole {
  let buyer = false
  let seller = false

  for (const invoice of invoices) {
    if ((invoice.type ?? 'sale') === 'purchase') seller = true
    else buyer = true
    if (buyer && seller) return 'both'
  }

  if (buyer) return 'buyer'
  if (seller) return 'seller'
  return 'none'
}

/** Copy key for a derived role. Same words on every platform. */
export function partyRoleLabelKey(role: PartyRole): string {
  return `customers.role.${role}`
}
