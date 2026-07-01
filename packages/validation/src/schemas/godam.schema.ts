// ============================================
// packages/validation/src/schemas/godam.schema.ts
// ============================================

import { z } from 'zod'
import { 
  uuidSchema, 
  nonEmptyStringSchema, 
  optionalStringSchema, 
  positiveNumberSchema,
  isoDateSchema
} from './common.schema'

// ============================================
// Godam (Warehouse)
// ============================================

export const godamSchema = z.object({
  id: uuidSchema.optional(),
  name: nonEmptyStringSchema,
  location: optionalStringSchema,
  isActive: z.boolean().default(true),
  createdAt: isoDateSchema.optional(),
  updatedAt: isoDateSchema.optional(),
})

export type Godam = z.infer<typeof godamSchema>

export const createGodamSchema = godamSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export type CreateGodam = z.infer<typeof createGodamSchema>

export const updateGodamSchema = godamSchema.partial().extend({
  id: uuidSchema,
})

export type UpdateGodam = z.infer<typeof updateGodamSchema>

// ============================================
// Stock Transfer (بین گدام‌ها)
// ============================================

export const stockTransferSchema = z.object({
  productId: uuidSchema,
  fromGodamId: uuidSchema,   // ✅ اصلاح شده
  toGodamId: uuidSchema,     // ✅ اصلاح شده
  quantity: positiveNumberSchema,
  notes: optionalStringSchema,
  date: isoDateSchema.default(() => new Date().toISOString()),
})

export type StockTransfer = z.infer<typeof stockTransferSchema>

// ============================================
// Stock Movement (برای لیست کردن حرکات)
// ============================================

export const stockMovementSchema = z.object({
  id: uuidSchema.optional(),
  productId: uuidSchema,
  fromGodamId: uuidSchema.optional(),
  toGodamId: uuidSchema.optional(),
  type: z.enum(['in', 'out', 'sale', 'adjustment', 'return', 'transfer']),
  quantity: positiveNumberSchema,
  notes: optionalStringSchema,
  createdAt: isoDateSchema.optional(),
})

export type StockMovement = z.infer<typeof stockMovementSchema>