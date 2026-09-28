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
  unitLabelSchema,
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
  /**
   * The word shown when `unit === 'custom'` — a workspace's own unit from
   * `custom_units` (patch 2). Same role as `invoice_items.unitLabel`.
   */
  unitLabel: unitLabelSchema.nullish(),
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

export const createProductSchema = productSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    /**
     * Multi-warehouse: put this product's opening stock IN a warehouse.
     * Omitted: the business's only warehouse, or — with several — none
     * («بدون انبار»), to be moved with «افزودن کالا به انبار».
     */
    warehouseId: uuidSchema.nullable().optional(),
  })

export type CreateProduct = z.infer<typeof createProductSchema>

// ============================================
// Update Product
// ============================================

export const updateProductSchema = productSchema.partial().extend({
  id: uuidSchema,
  /**
   * The warehouse a quantity change lands in. Required when the business has
   * several (PRODUCT_WAREHOUSE_REQUIRED); omitted, its only warehouse.
   */
  warehouseId: uuidSchema.nullable().optional(),
})

export type UpdateProduct = z.infer<typeof updateProductSchema>

// ============================================
// Product Filters — FIXED with defaults
// ============================================

export const productFiltersSchema = z.object({
  // ✅ FIX: استفاده از coerce برای تبدیل خودکار
  search: z.string().optional().default(''),

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

  /**
   * Ask the list to also return `summary` — stock value and stock-state counts
   * computed server-side over EVERY product in the workspace, not the page.
   */
  includeSummary: z
    .union([z.boolean(), z.string()])
    .transform((value) =>
      typeof value === 'boolean' ? value : ['true', '1', 'yes'].includes(value.toLowerCase()),
    )
    .optional(),

  // ✅ FIX: page با default و coerce
  page: z
    .union([z.number(), z.string()])
    .transform((val) => {
      const num = typeof val === 'string' ? parseInt(val, 10) : val
      return isNaN(num) ? 1 : num
    })
    .default(1)
    .optional(),

  // ✅ FIX: limit با default و coerce
  limit: z
    .union([z.number(), z.string()])
    .transform((val) => {
      const num = typeof val === 'string' ? parseInt(val, 10) : val
      return isNaN(num) ? 20 : num
    })
    .default(20)
    .optional(),

  sortBy: z.string().optional().default('created_at'),

  sortDirection: z.enum(['asc', 'desc']).optional().default('desc'),

  cursor: z.string().optional(),
})

// ✅ اضافه کردن نوع با فیلدهای اجباری برای استفاده در کد
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
// ============================================
// Stock economics
//
// The margin and stock-value rules, in one place. Web derived them inline in
// `warehouse-detail-container`; mobile needed the same numbers, and two
// independent derivations of "what is this stock worth" is exactly the kind of
// drift that shows up as two devices disagreeing about profit.
// ============================================

/** Margin on one unit. Negative when a product is sold below cost — that is a
 *  real state worth showing, not something to clamp to zero. */
export function profitPerUnit(product: {
  sellPrice?: number | null
  buyPrice?: number | null
}): number {
  return (product.sellPrice ?? 0) - (product.buyPrice ?? 0)
}

/** Margin across everything currently in stock. */
export function totalProfit(product: {
  quantity?: number | null
  sellPrice?: number | null
  buyPrice?: number | null
}): number {
  return (product.quantity ?? 0) * profitPerUnit(product)
}

/**
 * Stock value at *selling* price, matching the web detail page.
 *
 * Deliberately not cost basis: this figure answers "what is this shelf worth to
 * me", which is the question the warehouse page is built around.
 */
export function stockValue(product: {
  quantity?: number | null
  sellPrice?: number | null
}): number {
  return (product.quantity ?? 0) * (product.sellPrice ?? 0)
}
