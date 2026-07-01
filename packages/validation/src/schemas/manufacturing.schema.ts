// ============================================
// packages/validation/src/schemas/manufacturing.schema.ts
// ============================================

import { z } from 'zod'
import { 
  uuidSchema, 
  nonEmptyStringSchema, 
  optionalStringSchema, 
  positiveNumberSchema,
  isoDateSchema,
  nonNegativeNumberSchema
} from './common.schema'

// ============================================
// BOM (Bill of Materials)
// ============================================

export const bomSchema = z.object({
  id: uuidSchema.optional(),
  productId: uuidSchema,
  version: z.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
  items: z.array(z.object({
    rawMaterialId: uuidSchema,
    quantity: positiveNumberSchema,
    unitCost: nonNegativeNumberSchema.default(0),
  })),
  createdAt: isoDateSchema.optional(),
  updatedAt: isoDateSchema.optional(),
})

export type BOM = z.infer<typeof bomSchema>

export const createBomSchema = bomSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export type CreateBOM = z.infer<typeof createBomSchema>

export const updateBomSchema = bomSchema.partial().extend({
  id: uuidSchema,
})

export type UpdateBOM = z.infer<typeof updateBomSchema>

// ============================================
// Work Order (دستور کار)
// ============================================

export const workOrderSchema = z.object({
  id: uuidSchema.optional(),
  productId: uuidSchema,
  quantity: positiveNumberSchema,
  bomId: uuidSchema,
  status: z.enum(['planned', 'in_progress', 'completed', 'cancelled']).default('planned'),
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
  createdAt: isoDateSchema.optional(),
  updatedAt: isoDateSchema.optional(),
})

export type WorkOrder = z.infer<typeof workOrderSchema>

export const createWorkOrderSchema = workOrderSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export type CreateWorkOrder = z.infer<typeof createWorkOrderSchema>

export const updateWorkOrderSchema = workOrderSchema.partial().extend({
  id: uuidSchema,
})

export type UpdateWorkOrder = z.infer<typeof updateWorkOrderSchema>

// ============================================
// Production Plan (برنامه تولید)
// ============================================

export const productionPlanSchema = z.object({
  id: uuidSchema.optional(),
  workOrderId: uuidSchema,
  startDate: isoDateSchema,
  endDate: isoDateSchema.optional(),
  notes: optionalStringSchema,
})

export type ProductionPlan = z.infer<typeof productionPlanSchema>

export const createProductionPlanSchema = productionPlanSchema.omit({
  id: true,
})

export type CreateProductionPlan = z.infer<typeof createProductionPlanSchema>