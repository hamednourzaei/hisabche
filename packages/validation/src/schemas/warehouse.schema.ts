// ============================================
// packages/validation/src/schemas/warehouse.schema.ts
// ============================================

import { z } from 'zod'
import {
  uuidSchema,
  nonEmptyStringSchema,
  optionalStringSchema,
  positiveNumberSchema,
  isoDateSchema,
} from './common.schema'

// ============================================
// warehouse (Warehouse)
// ============================================

export const warehouseSchema = z.object({
  id: uuidSchema.optional(),
  name: nonEmptyStringSchema,
  location: optionalStringSchema,
  isActive: z.boolean().default(true),
  createdAt: isoDateSchema.optional(),
  updatedAt: isoDateSchema.optional(),
})

export type warehouse = z.infer<typeof warehouseSchema>

export const createwarehouseSchema = warehouseSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export type CreateGodam = z.infer<typeof createwarehouseSchema>

export const updatewarehouseSchema = warehouseSchema.partial().extend({
  id: uuidSchema,
})

export type UpdateGodam = z.infer<typeof updatewarehouseSchema>

// ============================================
// Stock Transfer (بین گدام‌ها)
// ============================================

export const stockTransferSchema = z.object({
  productId: uuidSchema,
  // ⚠️ The names `warehouse.service#transferStock` reads. They were
  // `fromGodamId` / `toGodamId` here: the service then compared
  // `undefined === undefined` and refused EVERY transfer as «same warehouse».
  // The route could not have worked, and no screen called it to find out.
  fromWarehouseId: uuidSchema,
  toWarehouseId: uuidSchema,
  quantity: positiveNumberSchema,
  notes: optionalStringSchema,
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
