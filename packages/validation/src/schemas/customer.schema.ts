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
  paginationSchema,
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

export const customerFiltersSchema = z.object({
  search: z.string().optional(),
  isActive: z.boolean().optional(),
  hasBalance: z.boolean().optional(),
  ...paginationSchema.shape,
})

export type CustomerFilters = z.infer<typeof customerFiltersSchema>