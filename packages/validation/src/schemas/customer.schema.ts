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
  phone: phoneSchema, // ✅ phoneSchema از قبل optional است، نیازی به .optional() اضافه نیست
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
// Customer Filters (اصلاح‌شده با تبدیل خودکار Query String)
// ============================================

export const customerFiltersSchema = z.object({
  search: z.string().optional(),
  isActive: z
    .union([z.boolean(), z.string()])
    .transform((val) => (typeof val === 'string' ? val === 'true' : val))
    .optional(),
  hasBalance: z
    .union([z.boolean(), z.string()])
    .transform((val) => (typeof val === 'string' ? val === 'true' : val))
    .optional(),
  page: z
    .union([z.number(), z.string()])
    .transform((val) => (typeof val === 'string' ? parseInt(val, 10) : val))
    .default(1),
  limit: z
    .union([z.number(), z.string()])
    .transform((val) => (typeof val === 'string' ? parseInt(val, 10) : val))
    .default(20),
  sortBy: z.string().optional(),
  sortDirection: z.enum(['asc', 'desc']).optional().default('desc'),
})

export type CustomerFilters = z.infer<typeof customerFiltersSchema>