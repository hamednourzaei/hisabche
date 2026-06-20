// ============================================
// Product Schemas
// ============================================

import { z } from 'zod'
import {
  uuidSchema,
  positiveNumberSchema,
  nonNegativeNumberSchema,
  nonEmptyStringSchema,
  optionalStringSchema,
  productCategorySchema,
  unitSchema,
} from './common.schema'

// ============================================
// Product
// ============================================

export const productSchema = z.object({
  id: uuidSchema.optional(),
  name: nonEmptyStringSchema,
  barcode: z.string().optional(),
  sku: z.string().optional(),
  category: productCategorySchema.default('general'),
  description: optionalStringSchema,
  imageUrl: z.string().url().optional().or(z.literal('')),

  // Stock
  quantity: nonNegativeNumberSchema.default(0),
  unit: unitSchema.default('piece'),
  minStockLevel: nonNegativeNumberSchema.default(5),

  // Pricing
  buyPrice: nonNegativeNumberSchema.default(0),
  sellPrice: nonNegativeNumberSchema.default(0),
  wholesalePrice: nonNegativeNumberSchema.optional(),

  // Status
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
})

export type Product = z.infer<typeof productSchema>

// ============================================
// Create Product
// ============================================

export const createProductSchema = productSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export type CreateProduct = z.infer<typeof createProductSchema>

// ============================================
// Update Product
// ============================================

export const updateProductSchema = productSchema.partial().extend({
  id: uuidSchema,
})

export type UpdateProduct = z.infer<typeof updateProductSchema>

// ============================================
// Product Filters (اصلاح‌شده با تبدیل خودکار Query String)
// ============================================

export const productFiltersSchema = z.object({
  search: z.string().optional(),
  category: productCategorySchema.optional(),
  isActive: z
    .union([z.boolean(), z.string()])
    .transform((val) => (typeof val === 'string' ? val === 'true' : val))
    .optional(),
  lowStock: z
    .union([z.boolean(), z.string()])
    .transform((val) => (typeof val === 'string' ? val === 'true' : val))
    .optional(),
  minPrice: z
    .union([z.number(), z.string()])
    .transform((val) => (typeof val === 'string' ? parseFloat(val) : val))
    .optional(),
  maxPrice: z
    .union([z.number(), z.string()])
    .transform((val) => (typeof val === 'string' ? parseFloat(val) : val))
    .optional(),
  barcode: z.string().optional(),
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

export type ProductFilters = z.infer<typeof productFiltersSchema>

// ============================================
// Stock Transfer
// ============================================

export const stockTransferSchema = z.object({
  productId: uuidSchema,
  fromInventoryId: uuidSchema,
  toInventoryId: uuidSchema,
  quantity: positiveNumberSchema,
  notes: optionalStringSchema,
  date: z.string().datetime(),
})

export type StockTransfer = z.infer<typeof stockTransferSchema>